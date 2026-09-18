import http from 'http';

interface TestResult {
  name: string;
  category: string;
  expected: string;
  actual: string;
  passed: boolean;
  details?: string;
}

const results: TestResult[] = [];

function makeJwt(payloadObj: any): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64');
  const payload = Buffer.from(JSON.stringify(payloadObj)).toString('base64');
  return `${header}.${payload}.mock_signature_test`;
}

const adminToken = makeJwt({
  sub: 'admin-gate-tester-01',
  user_id: 'admin-gate-tester-01',
  email: 'admin.gate@kpmbp.edu.my',
  role: 'MASTER_ADMIN',
  admin: true,
});

const userToken = makeJwt({
  sub: 'user-gate-tester-01',
  user_id: 'user-gate-tester-01',
  email: 'student.gate@kpmbp.edu.my',
  role: 'STUDENT',
  admin: false,
});

const invalidToken = 'invalid-malformed-token-string';

function request(options: {
  method: string;
  path: string;
  headers?: Record<string, string>;
  body?: any;
}): Promise<{ statusCode: number; body: any; headers: http.IncomingHttpHeaders }> {
  return new Promise((resolve, reject) => {
    const postData = options.body ? JSON.stringify(options.body) : undefined;
    const reqHeaders: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    };
    if (postData) {
      reqHeaders['Content-Length'] = Buffer.byteLength(postData).toString();
    }

    const req = http.request(
      {
        hostname: '127.0.0.1',
        port: 3000,
        path: options.path,
        method: options.method,
        headers: reqHeaders,
      },
      (res) => {
        let rawData = '';
        res.on('data', (chunk) => {
          rawData += chunk;
        });
        res.on('end', () => {
          let parsed: any;
          try {
            parsed = JSON.parse(rawData);
          } catch {
            parsed = rawData;
          }
          resolve({
            statusCode: res.statusCode || 500,
            body: parsed,
            headers: res.headers,
          });
        });
      }
    );

    req.on('error', (err) => {
      reject(err);
    });

    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

function assert(
  category: string,
  name: string,
  condition: boolean,
  expected: string,
  actual: string,
  details?: string
) {
  results.push({
    category,
    name,
    expected,
    actual,
    passed: condition,
    details,
  });
}

async function runModule2VerificationGate() {
  console.log('====================================================');
  console.log('STARTING PHASE 3 - MODULE 2 VERIFICATION GATE SUITE');
  console.log('Campus Zone Governance (SES-SEC-4.5.5)');
  console.log('====================================================\n');

  const testZoneId = `ZONE-TEST-LIB-${Date.now().toString().slice(-4)}`;
  const testZoneCode = `Z-TLIB-${Date.now().toString().slice(-3)}`;
  const testIdempKey = `idemp-zone-${Date.now()}`;

  // --- 1. Testing Auth & Access Control ---
  console.log('--- 1. Testing Auth & Access Control ---');

  // Test 1: Invalid Token rejected on /api/admin/zones/create
  try {
    const res = await request({
      method: 'POST',
      path: '/api/admin/zones/create',
      headers: { Authorization: `Bearer ${invalidToken}` },
      body: { zoneId: 'ZONE-FAIL', zoneName: 'Fail Zone' },
    });
    assert(
      'API AUTHORIZATION',
      'Auth: Invalid Token Rejected on POST /api/admin/zones/create',
      res.statusCode === 401,
      'HTTP 401',
      `HTTP ${res.statusCode}`
    );
  } catch (e: any) {
    assert('API AUTHORIZATION', 'Auth: Invalid Token Rejected', false, 'HTTP 401', e.message);
  }

  // Test 2: Normal User Blocked on POST /api/admin/zones/create (403)
  try {
    const res = await request({
      method: 'POST',
      path: '/api/admin/zones/create',
      headers: { Authorization: `Bearer ${userToken}` },
      body: { zoneId: 'ZONE-UNAUTH', zoneName: 'Unauthorized Zone' },
    });
    assert(
      'SECURITY & PRIVILEGE',
      'Auth: Normal User Blocked on POST /api/admin/zones/create',
      res.statusCode === 403,
      'HTTP 403',
      `HTTP ${res.statusCode}`
    );
  } catch (e: any) {
    assert('SECURITY & PRIVILEGE', 'Auth: Normal User Blocked on create', false, 'HTTP 403', e.message);
  }

  // Test 3: Normal User Blocked on POST /api/admin/zones/update (403)
  try {
    const res = await request({
      method: 'POST',
      path: '/api/admin/zones/update',
      headers: { Authorization: `Bearer ${userToken}` },
      body: { zoneId: 'ZONE-ACADEMIC', zoneName: 'Tampered Zone' },
    });
    assert(
      'SECURITY & PRIVILEGE',
      'Auth: Normal User Blocked on POST /api/admin/zones/update',
      res.statusCode === 403,
      'HTTP 403',
      `HTTP ${res.statusCode}`
    );
  } catch (e: any) {
    assert('SECURITY & PRIVILEGE', 'Auth: Normal User Blocked on update', false, 'HTTP 403', e.message);
  }

  // Test 4: Normal User Blocked on POST /api/admin/zones/toggle-status (403)
  try {
    const res = await request({
      method: 'POST',
      path: '/api/admin/zones/toggle-status',
      headers: { Authorization: `Bearer ${userToken}` },
      body: { zoneId: 'ZONE-ACADEMIC', newStatus: 'INACTIVE', reason: 'Unauthorized toggle' },
    });
    assert(
      'SECURITY & PRIVILEGE',
      'Auth: Normal User Blocked on POST /api/admin/zones/toggle-status',
      res.statusCode === 403,
      'HTTP 403',
      `HTTP ${res.statusCode}`
    );
  } catch (e: any) {
    assert('SECURITY & PRIVILEGE', 'Auth: Normal User Blocked on toggle-status', false, 'HTTP 403', e.message);
  }

  // Test 5: Normal User Blocked on POST /api/admin/zones/assign-door (403)
  try {
    const res = await request({
      method: 'POST',
      path: '/api/admin/zones/assign-door',
      headers: { Authorization: `Bearer ${userToken}` },
      body: { zoneId: 'ZONE-ACADEMIC', doorId: 'DOOR-KPMBP-A101' },
    });
    assert(
      'SECURITY & PRIVILEGE',
      'Auth: Normal User Blocked on POST /api/admin/zones/assign-door',
      res.statusCode === 403,
      'HTTP 403',
      `HTTP ${res.statusCode}`
    );
  } catch (e: any) {
    assert('SECURITY & PRIVILEGE', 'Auth: Normal User Blocked on assign-door', false, 'HTTP 403', e.message);
  }

  // Test 6: Normal User Blocked on GET /api/admin/zones/:zoneId/audit-history (403)
  try {
    const res = await request({
      method: 'GET',
      path: '/api/admin/zones/ZONE-ACADEMIC/audit-history',
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert(
      'SECURITY & PRIVILEGE',
      'Auth: Normal User Blocked on GET audit-history',
      res.statusCode === 403,
      'HTTP 403',
      `HTTP ${res.statusCode}`
    );
  } catch (e: any) {
    assert('SECURITY & PRIVILEGE', 'Auth: Normal User Blocked on audit-history', false, 'HTTP 403', e.message);
  }

  // --- 2. Input Validation ---
  console.log('--- 2. Testing Input Validation ---');

  // Test 7: Missing zoneId rejected
  try {
    const res = await request({
      method: 'POST',
      path: '/api/admin/zones/create',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { zoneName: 'Missing ID Zone', zoneCode: 'Z-MISS' },
    });
    assert(
      'INPUT VALIDATION',
      'Validation: Missing zoneId rejected with 400',
      res.statusCode === 400,
      'HTTP 400',
      `HTTP ${res.statusCode}`
    );
  } catch (e: any) {
    assert('INPUT VALIDATION', 'Validation: Missing zoneId', false, 'HTTP 400', e.message);
  }

  // Test 8: Missing zoneName rejected
  try {
    const res = await request({
      method: 'POST',
      path: '/api/admin/zones/create',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { zoneId: 'ZONE-NONAME', zoneCode: 'Z-NONAME' },
    });
    assert(
      'INPUT VALIDATION',
      'Validation: Missing zoneName rejected with 400',
      res.statusCode === 400,
      'HTTP 400',
      `HTTP ${res.statusCode}`
    );
  } catch (e: any) {
    assert('INPUT VALIDATION', 'Validation: Missing zoneName', false, 'HTTP 400', e.message);
  }

  // --- 3. Zone Creation & Security ---
  console.log('--- 3. Testing Zone Creation & Security ---');

  // Test 9: Master Admin creates valid zone
  let createdZone: any = null;
  try {
    const res = await request({
      method: 'POST',
      path: '/api/admin/zones/create',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'X-Idempotency-Key': testIdempKey,
      },
      body: {
        zoneId: testZoneId,
        zoneName: 'Zon Perpustakaan & Arkib Digital',
        zoneCode: testZoneCode,
        building: 'Bangunan Akademik A',
        floor: 'Aras 1',
        location: 'Sayap Barat KPMBP',
        description: 'Pusat sumber rujukan digital dan arkib akademik',
        securityLevel: 'MEDIUM',
        // Client attempting to tamper audit fields:
        createdBy: 'hacker@malicious.com',
        createdAt: '1970-01-01T00:00:00Z',
      },
    });

    createdZone = res.body?.zone;
    assert(
      'CRUD & CREATION',
      'Create Zone: Master Admin creates valid campus zone (201)',
      res.statusCode === 201 && res.body?.success === true,
      'HTTP 201 success=true',
      `HTTP ${res.statusCode} success=${res.body?.success}`
    );

    // Test 10: Server authoritative fields (createdBy, createdAt)
    const authorSafe =
      createdZone?.createdBy === 'admin.gate@kpmbp.edu.my' &&
      createdZone?.createdAt !== '1970-01-01T00:00:00Z';
    assert(
      'DATA INTEGRITY',
      'Security: Server authoritative createdBy/createdAt overrides client payload',
      authorSafe,
      'createdBy = admin.gate@kpmbp.edu.my and valid server timestamp',
      `createdBy=${createdZone?.createdBy} createdAt=${createdZone?.createdAt}`
    );
  } catch (e: any) {
    assert('CRUD & CREATION', 'Create Zone: Master Admin create', false, 'HTTP 201', e.message);
  }

  // --- 4. Idempotency & Replay Attack Defense ---
  console.log('--- 4. Testing Idempotency ---');

  // Test 11: Replay with same X-Idempotency-Key
  try {
    const res = await request({
      method: 'POST',
      path: '/api/admin/zones/create',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'X-Idempotency-Key': testIdempKey,
      },
      body: {
        zoneId: testZoneId,
        zoneName: 'Zon Perpustakaan & Arkib Digital',
        zoneCode: testZoneCode,
      },
    });
    assert(
      'SECURITY & IDEMPOTENCY',
      'Idempotency: Replay with same X-Idempotency-Key returns cached response without duplicate write',
      (res.statusCode === 200 || res.statusCode === 201) && res.body?.idempotent === true,
      'HTTP 200/201 idempotent=true',
      `HTTP ${res.statusCode} idempotent=${res.body?.idempotent}`
    );
  } catch (e: any) {
    assert('SECURITY & IDEMPOTENCY', 'Idempotency: Replay test', false, 'HTTP 200/201', e.message);
  }

  // --- 5. Duplicate Zone Prevention ---
  console.log('--- 5. Testing Duplicate Zone Prevention ---');

  // Test 12: Duplicate zoneId rejected (409)
  try {
    const res = await request({
      method: 'POST',
      path: '/api/admin/zones/create',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        zoneId: testZoneId,
        zoneName: 'Duplicate Zone Name',
        zoneCode: `Z-DIFF-${Date.now().toString().slice(-3)}`,
      },
    });
    assert(
      'DATA INTEGRITY',
      'Duplicate: Duplicate zoneId rejected with 409 Conflict',
      res.statusCode === 409,
      'HTTP 409 Conflict',
      `HTTP ${res.statusCode}`
    );
  } catch (e: any) {
    assert('DATA INTEGRITY', 'Duplicate: Duplicate zoneId', false, 'HTTP 409', e.message);
  }

  // Test 13: Duplicate zoneCode rejected (409)
  try {
    const res = await request({
      method: 'POST',
      path: '/api/admin/zones/create',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        zoneId: `ZONE-NEW-${Date.now().toString().slice(-4)}`,
        zoneName: 'Another Library Zone',
        zoneCode: testZoneCode, // Reusing testZoneCode
      },
    });
    assert(
      'DATA INTEGRITY',
      'Duplicate: Duplicate zoneCode rejected with 409 Conflict',
      res.statusCode === 409,
      'HTTP 409 Conflict',
      `HTTP ${res.statusCode}`
    );
  } catch (e: any) {
    assert('DATA INTEGRITY', 'Duplicate: Duplicate zoneCode', false, 'HTTP 409', e.message);
  }

  // --- 6. Zone Update ---
  console.log('--- 6. Testing Zone Update ---');

  // Test 14: Master Admin updates existing zone
  try {
    const res = await request({
      method: 'POST',
      path: '/api/admin/zones/update',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        zoneId: testZoneId,
        zoneName: 'Zon Perpustakaan & Pusat Multimedia',
        description: 'Pusat multimedia dan teknologi maklumat terkini',
        securityLevel: 'HIGH',
      },
    });
    assert(
      'CRUD & UPDATE',
      'Update Zone: Master Admin updates existing zone (200)',
      res.statusCode === 200 && res.body?.success === true,
      'HTTP 200 success=true',
      `HTTP ${res.statusCode} success=${res.body?.success}`
    );
  } catch (e: any) {
    assert('CRUD & UPDATE', 'Update Zone', false, 'HTTP 200', e.message);
  }

  // --- 7. Status Transitions & Mandatory Justifications ---
  console.log('--- 7. Testing Status Transitions ---');

  // Test 15: Missing justification rejected (400)
  try {
    const res = await request({
      method: 'POST',
      path: '/api/admin/zones/toggle-status',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        zoneId: testZoneId,
        newStatus: 'INACTIVE',
        reason: 'bad', // Too short
      },
    });
    assert(
      'STATUS TRANSITION',
      'Status Transition: Missing/short justification rejected with 400',
      res.statusCode === 400,
      'HTTP 400',
      `HTTP ${res.statusCode}`
    );
  } catch (e: any) {
    assert('STATUS TRANSITION', 'Status Transition: Missing justification', false, 'HTTP 400', e.message);
  }

  // Test 16: Deactivate zone with justification (ACTIVE -> INACTIVE)
  try {
    const res = await request({
      method: 'POST',
      path: '/api/admin/zones/toggle-status',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        zoneId: testZoneId,
        newStatus: 'INACTIVE',
        reason: 'Kerja-kerja pengubahsuaian sistem keselamatan zon perpustakaan.',
      },
    });
    assert(
      'STATUS TRANSITION',
      'Status Transition: ACTIVE -> INACTIVE succeeds (200)',
      res.statusCode === 200 && res.body?.newStatus === 'INACTIVE',
      'HTTP 200 newStatus=INACTIVE',
      `HTTP ${res.statusCode} newStatus=${res.body?.newStatus}`
    );
  } catch (e: any) {
    assert('STATUS TRANSITION', 'Status Transition: ACTIVE -> INACTIVE', false, 'HTTP 200', e.message);
  }

  // Test 17: Reactivate zone (INACTIVE -> ACTIVE)
  try {
    const res = await request({
      method: 'POST',
      path: '/api/admin/zones/toggle-status',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        zoneId: testZoneId,
        newStatus: 'ACTIVE',
        reason: 'Selesai pemeriksaan integriti fizikal zon perpustakaan.',
      },
    });
    assert(
      'STATUS TRANSITION',
      'Status Transition: INACTIVE -> ACTIVE succeeds (200)',
      res.statusCode === 200 && res.body?.newStatus === 'ACTIVE',
      'HTTP 200 newStatus=ACTIVE',
      `HTTP ${res.statusCode} newStatus=${res.body?.newStatus}`
    );
  } catch (e: any) {
    assert('STATUS TRANSITION', 'Status Transition: INACTIVE -> ACTIVE', false, 'HTTP 200', e.message);
  }

  // --- 8. Door-Zone Assignment & Reassignment ---
  console.log('--- 8. Testing Door-Zone Assignment ---');

  // First create a door to test assignment
  const testDoorId = `DOOR-ZONE-TEST-${Date.now().toString().slice(-4)}`;
  await request({
    method: 'POST',
    path: '/api/admin/doors/create',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {
      doorId: testDoorId,
      doorName: 'Pintu Masuk Utama Perpustakaan',
      building: 'Bangunan Akademik A',
      floor: 'Aras 1',
      location: 'Pintu Hadapan',
      zoneId: 'ZONE-ACADEMIC',
      readerType: 'ISO/IEC 14443-4 HCE APDU',
      controllerType: 'Syncrozz IP-Controller v4.5',
      integrationStatus: 'SIMULATED',
      operationalStatus: 'ACTIVE',
    },
  });

  // Test 18: Assign door to zone (200)
  try {
    const res = await request({
      method: 'POST',
      path: '/api/admin/zones/assign-door',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        zoneId: testZoneId,
        doorId: testDoorId,
        reason: 'Pintu dipautkan ke zon perpustakaan',
      },
    });
    assert(
      'DOOR-ZONE RELATIONSHIP',
      'Assignment: Door successfully assigned to zone (200)',
      res.statusCode === 200 && res.body?.assignedDoors?.includes(testDoorId),
      'HTTP 200 assignedDoors includes door',
      `HTTP ${res.statusCode} doors=${JSON.stringify(res.body?.assignedDoors)}`
    );
  } catch (e: any) {
    assert('DOOR-ZONE RELATIONSHIP', 'Assignment: Door assignment', false, 'HTTP 200', e.message);
  }

  // Test 19: Hardware status untouched
  try {
    const res = await request({
      method: 'GET',
      path: `/api/admin/zones/${testZoneId}`,
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const attachedDoor = res.body?.doors?.find((d: any) => d.doorId === testDoorId);
    const preservedHardware =
      attachedDoor &&
      (attachedDoor.integrationStatus === 'SIMULATED' || attachedDoor.integrationStatus === 'HARDWARE_VERIFICATION_REQUIRED') &&
      attachedDoor.zoneId === testZoneId;

    assert(
      'DATA INTEGRITY',
      'Hardware Status: Integration status SIMULATED / HARDWARE_VERIFICATION_REQUIRED preserved honestly',
      !!preservedHardware,
      'integrationStatus unchanged, zoneId updated',
      `integrationStatus=${attachedDoor?.integrationStatus} zoneId=${attachedDoor?.zoneId}`
    );
  } catch (e: any) {
    assert('DATA INTEGRITY', 'Hardware Status preservation', false, 'Preserved', e.message);
  }

  // Test 20: Safe deactivation guard (cannot deactivate zone with active doors without force)
  try {
    const res = await request({
      method: 'POST',
      path: '/api/admin/zones/toggle-status',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        zoneId: testZoneId,
        newStatus: 'INACTIVE',
        reason: 'Attempt deactivating without force',
        force: false,
      },
    });
    assert(
      'SAFETY & INTEGRITY',
      'Safety Guard: Deactivating zone with active doors rejected with 409 Conflict',
      res.statusCode === 409,
      'HTTP 409 Conflict',
      `HTTP ${res.statusCode}`
    );
  } catch (e: any) {
    assert('SAFETY & INTEGRITY', 'Safety Guard: Deactivating with active doors', false, 'HTTP 409', e.message);
  }

  // Test 21: Remove door from zone (200)
  try {
    const res = await request({
      method: 'POST',
      path: '/api/admin/zones/remove-door',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        zoneId: testZoneId,
        doorId: testDoorId,
        reason: 'Penstrukturan semula zon perpustakaan.',
      },
    });
    assert(
      'DOOR-ZONE RELATIONSHIP',
      'Removal: Door successfully removed from zone (200)',
      res.statusCode === 200 && !res.body?.assignedDoors?.includes(testDoorId),
      'HTTP 200 assignedDoors excludes door',
      `HTTP ${res.statusCode} doors=${JSON.stringify(res.body?.assignedDoors)}`
    );
  } catch (e: any) {
    assert('DOOR-ZONE RELATIONSHIP', 'Removal: Remove door', false, 'HTTP 200', e.message);
  }

  // --- 9. Queries & Audit Trail ---
  console.log('--- 9. Testing Queries & Audit Trail ---');

  // Test 22: GET /api/admin/zones returns list
  try {
    const res = await request({
      method: 'GET',
      path: '/api/admin/zones',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const found = res.body?.zones?.some((z: any) => z.zoneId === testZoneId);
    assert(
      'API VERIFICATION',
      'API: GET /api/admin/zones returns list containing newly managed zone',
      res.statusCode === 200 && found,
      'HTTP 200 with test zone present',
      `HTTP ${res.statusCode} found=${found}`
    );
  } catch (e: any) {
    assert('API VERIFICATION', 'API: GET /api/admin/zones', false, 'HTTP 200', e.message);
  }

  // Test 23: GET /api/admin/zones/:zoneId returns single zone details
  try {
    const res = await request({
      method: 'GET',
      path: `/api/admin/zones/${testZoneId}`,
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(
      'API VERIFICATION',
      'API: GET /api/admin/zones/:zoneId returns zone and door structure',
      res.statusCode === 200 && res.body?.zone?.zoneId === testZoneId,
      'HTTP 200 zoneId match',
      `HTTP ${res.statusCode} zoneId=${res.body?.zone?.zoneId}`
    );
  } catch (e: any) {
    assert('API VERIFICATION', 'API: GET /api/admin/zones/:zoneId', false, 'HTTP 200', e.message);
  }

  // Test 24: GET /api/admin/zones/:zoneId/audit-history
  try {
    const res = await request({
      method: 'GET',
      path: `/api/admin/zones/${testZoneId}/audit-history`,
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const entries = res.body?.auditEntries || [];
    const hasCreate = entries.some((e: any) => e.action === 'CREATE_ZONE');
    const hasAssign = entries.some((e: any) => e.action === 'ASSIGN_DOOR_ZONE');
    assert(
      'AUDIT LOG',
      'Audit Trail: GET audit-history returns recorded events (CREATE_ZONE, ASSIGN_DOOR_ZONE)',
      res.statusCode === 200 && hasCreate && hasAssign,
      'HTTP 200 with CREATE_ZONE and ASSIGN_DOOR_ZONE events',
      `HTTP ${res.statusCode} count=${entries.length} hasCreate=${hasCreate} hasAssign=${hasAssign}`
    );
  } catch (e: any) {
    assert('AUDIT LOG', 'Audit Trail: GET audit-history', false, 'HTTP 200', e.message);
  }

  // ====================================================
  // SUMMARY REPORT
  // ====================================================
  console.log('\n====================================================');
  console.log('VERIFICATION GATE EXECUTION COMPLETED');
  console.log('====================================================\n');

  let passedCount = 0;
  let failedCount = 0;

  for (const r of results) {
    if (r.passed) {
      passedCount++;
      console.log(`[✓ PASS] [${r.category}] ${r.name}`);
    } else {
      failedCount++;
      console.log(`[✗ FAIL] [${r.category}] ${r.name}`);
      console.log(`   Expected: ${r.expected}`);
      console.log(`   Actual:   ${r.actual}`);
      if (r.details) console.log(`   Details:  ${r.details}`);
    }
  }

  console.log('\nTOTAL TESTS: ' + results.length);
  console.log('PASSED:      ' + passedCount);
  console.log('FAILED:      ' + failedCount);

  if (failedCount === 0) {
    console.log('\n>>> GATE DECISION: VERIFIED. All SES v4.5 Module 2 requirements passed.');
    process.exit(0);
  } else {
    console.log('\n>>> GATE DECISION: BLOCKED. Fix failing tests before proceeding.');
    process.exit(1);
  }
}

runModule2VerificationGate().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
