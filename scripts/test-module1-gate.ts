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
        hostname: 'localhost',
        port: 3000,
        path: options.path,
        method: options.method,
        headers: reqHeaders,
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => (raw += chunk));
        res.on('end', () => {
          let parsed: any;
          try {
            parsed = JSON.parse(raw);
          } catch {
            parsed = raw;
          }
          resolve({
            statusCode: res.statusCode || 0,
            body: parsed,
            headers: res.headers,
          });
        });
      }
    );

    req.on('error', reject);
    if (postData) req.write(postData);
    req.end();
  });
}

function assertTest(name: string, category: string, condition: boolean, expected: string, actual: string, details?: string) {
  results.push({
    name,
    category,
    expected,
    actual,
    passed: condition,
    details,
  });
}

async function runGateTests() {
  console.log('====================================================');
  console.log('STARTING PHASE 3 - MODULE 1 VERIFICATION GATE SUITE');
  console.log('====================================================\n');

  const testDoorId = `DOOR-GATE-TEST-${Date.now()}`;

  // ==========================================
  // SECTION 1: AUTHENTICATION & AUTHORIZATION
  // ==========================================
  console.log('--- 1. Testing Auth & Access Control ---');

  // Test 1.1: Invalid Token Rejected (401)
  try {
    const res = await request({
      method: 'GET',
      path: '/api/admin/doors',
      headers: { Authorization: `Bearer ${invalidToken}` },
    });
    assertTest(
      'Auth: Invalid Token Rejected',
      'API VERIFICATION',
      res.statusCode === 401 && res.body?.error === 'INVALID_TOKEN',
      'HTTP 401 INVALID_TOKEN',
      `HTTP ${res.statusCode} ${res.body?.error || ''}`
    );
  } catch (err: any) {
    assertTest('Auth: Invalid Token Rejected', 'API VERIFICATION', false, 'HTTP 401', err.message);
  }

  // Test 1.2: Normal User Forbidden (403) on mutation
  try {
    const res = await request({
      method: 'POST',
      path: '/api/admin/doors/create',
      headers: { Authorization: `Bearer ${userToken}` },
      body: { doorId: 'DOOR-HACK-01', doorName: 'Hacked Door' },
    });
    assertTest(
      'Auth: Normal User Blocked on POST /api/admin/doors/create',
      'SECURITY & PRIVILEGE',
      res.statusCode === 403 && res.body?.error === 'PERMISSION_DENIED',
      'HTTP 403 PERMISSION_DENIED',
      `HTTP ${res.statusCode} ${res.body?.error || ''}`
    );
  } catch (err: any) {
    assertTest('Auth: Normal User Blocked on create', 'SECURITY & PRIVILEGE', false, 'HTTP 403', err.message);
  }

  // Test 1.3: Normal User Forbidden on toggle-status
  try {
    const res = await request({
      method: 'POST',
      path: '/api/admin/doors/toggle-status',
      headers: { Authorization: `Bearer ${userToken}` },
      body: { doorId: 'DOOR-ANY', newStatus: 'LOCKDOWN', reason: 'Malicious attempt' },
    });
    assertTest(
      'Auth: Normal User Blocked on POST /api/admin/doors/toggle-status',
      'SECURITY & PRIVILEGE',
      res.statusCode === 403 && res.body?.error === 'PERMISSION_DENIED',
      'HTTP 403 PERMISSION_DENIED',
      `HTTP ${res.statusCode} ${res.body?.error || ''}`
    );
  } catch (err: any) {
    assertTest('Auth: Normal User Blocked on toggle-status', 'SECURITY & PRIVILEGE', false, 'HTTP 403', err.message);
  }

  // Test 1.4: Normal User Forbidden on audit history
  try {
    const res = await request({
      method: 'GET',
      path: '/api/admin/doors/DOOR-ANY/audit-history',
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assertTest(
      'Auth: Normal User Blocked on GET audit-history',
      'SECURITY & PRIVILEGE',
      res.statusCode === 403,
      'HTTP 403',
      `HTTP ${res.statusCode}`
    );
  } catch (err: any) {
    assertTest('Auth: Normal User Blocked on audit-history', 'SECURITY & PRIVILEGE', false, 'HTTP 403', err.message);
  }

  // ==========================================
  // SECTION 2: API VERIFICATION & INPUT VALIDATION
  // ==========================================
  console.log('--- 2. Testing API & Input Validation ---');

  // Test 2.1: Missing doorId
  try {
    const res = await request({
      method: 'POST',
      path: '/api/admin/doors/create',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { doorName: 'Pintu Tanpa ID' },
    });
    assertTest(
      'Validation: Missing doorId rejected with 400',
      'API VERIFICATION',
      res.statusCode === 400 && res.body?.error === 'INVALID_ARGUMENT',
      'HTTP 400 INVALID_ARGUMENT',
      `HTTP ${res.statusCode} ${res.body?.error || ''}`
    );
  } catch (err: any) {
    assertTest('Validation: Missing doorId', 'API VERIFICATION', false, 'HTTP 400', err.message);
  }

  // Test 2.2: Missing doorName
  try {
    const res = await request({
      method: 'POST',
      path: '/api/admin/doors/create',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: { doorId: 'DOOR-VALID-ID', doorName: '' },
    });
    assertTest(
      'Validation: Missing doorName rejected with 400',
      'API VERIFICATION',
      res.statusCode === 400 && res.body?.error === 'INVALID_ARGUMENT',
      'HTTP 400 INVALID_ARGUMENT',
      `HTTP ${res.statusCode} ${res.body?.error || ''}`
    );
  } catch (err: any) {
    assertTest('Validation: Missing doorName', 'API VERIFICATION', false, 'HTTP 400', err.message);
  }

  // Test 2.3: Invalid Zone rejected
  try {
    const res = await request({
      method: 'POST',
      path: '/api/admin/doors/create',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        doorId: 'DOOR-INVALID-ZONE',
        doorName: 'Pintu Zon Salah',
        zoneId: 'ZONE_INVALID$$$BAD',
      },
    });
    assertTest(
      'Validation: Invalid zone rejected with 400',
      'FIRESTORE & DATA INTEGRITY',
      res.statusCode === 400 && res.body?.error === 'INVALID_ARGUMENT',
      'HTTP 400 INVALID_ARGUMENT',
      `HTTP ${res.statusCode} ${res.body?.error || ''}`
    );
  } catch (err: any) {
    assertTest('Validation: Invalid zone', 'FIRESTORE & DATA INTEGRITY', false, 'HTTP 400', err.message);
  }

  // Test 2.4: Invalid Operational Status rejected
  try {
    const res = await request({
      method: 'POST',
      path: '/api/admin/doors/create',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        doorId: 'DOOR-INVALID-STATUS',
        doorName: 'Pintu Status Salah',
        operationalStatus: 'SUPER_DESTROYED_STATUS',
      },
    });
    assertTest(
      'Validation: Invalid operationalStatus rejected with 400',
      'STATUS TRANSITION TEST',
      res.statusCode === 400 && res.body?.error === 'INVALID_ARGUMENT',
      'HTTP 400 INVALID_ARGUMENT',
      `HTTP ${res.statusCode} ${res.body?.error || ''}`
    );
  } catch (err: any) {
    assertTest('Validation: Invalid operationalStatus', 'STATUS TRANSITION TEST', false, 'HTTP 400', err.message);
  }

  // ==========================================
  // SECTION 3: DOOR CREATION & INTEGRITY
  // ==========================================
  console.log('--- 3. Testing Door Creation & Integrity ---');

  const idempotencyKey = `idemp-door-create-${Date.now()}`;
  let createdDoorData: any = null;

  try {
    const res = await request({
      method: 'POST',
      path: '/api/admin/doors/create',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'X-Idempotency-Key': idempotencyKey,
      },
      body: {
        doorId: testDoorId,
        doorName: 'Makmal Komputer Gate Verification',
        building: 'Bangunan Akademik A',
        floor: 'Aras 1',
        location: 'Bilik A-102 Sayap Timur',
        zoneId: 'ZONE-LABS',
        zoneName: 'Zon Makmal Komputer',
        readerType: 'ISO/IEC 14443-4 HCE APDU',
        controllerType: 'Syncrozz IP-Controller v4.5',
        operationalStatus: 'ACTIVE',
        integrationStatus: 'VERIFIED', // Intentional unverified claim to test safe downgrade
      },
    });

    createdDoorData = res.body?.door;
    assertTest(
      'Create Door: Master Admin creates valid door',
      'API VERIFICATION',
      res.statusCode === 201 && res.body?.success === true && !!createdDoorData,
      'HTTP 201 success=true',
      `HTTP ${res.statusCode} success=${res.body?.success}`
    );

    // Test Safe downgrade of hardware status (SES v4.5 Non-Claim Policy)
    assertTest(
      'Integrity: Integration status safely downgraded from VERIFIED to HARDWARE_VERIFICATION_REQUIRED',
      'FIRESTORE & DATA INTEGRITY',
      createdDoorData?.integrationStatus === 'HARDWARE_VERIFICATION_REQUIRED',
      'HARDWARE_VERIFICATION_REQUIRED',
      createdDoorData?.integrationStatus || 'undefined'
    );

    // Test Server timestamps & createdBy
    assertTest(
      'Integrity: Server recorded createdBy and createdAt',
      'FIRESTORE & DATA INTEGRITY',
      createdDoorData?.createdBy === 'admin.gate@kpmbp.edu.my' && !!createdDoorData?.createdAt,
      'createdBy=admin.gate@kpmbp.edu.my with ISO createdAt',
      `createdBy=${createdDoorData?.createdBy}, createdAt=${createdDoorData?.createdAt}`
    );
  } catch (err: any) {
    assertTest('Create Door: Master Admin creates valid door', 'API VERIFICATION', false, 'HTTP 201', err.message);
  }

  // ==========================================
  // SECTION 4: IDEMPOTENCY & REPLAY ATTACK TEST
  // ==========================================
  console.log('--- 4. Testing Idempotency & Replay Attack ---');

  try {
    const res = await request({
      method: 'POST',
      path: '/api/admin/doors/create',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'X-Idempotency-Key': idempotencyKey, // same key
      },
      body: {
        doorId: testDoorId,
        doorName: 'Makmal Komputer Gate Verification',
      },
    });

    assertTest(
      'Idempotency: Replay with same X-Idempotency-Key returns cached response without duplicate write',
      'SECURITY & REGRESSION',
      res.statusCode === 200 && res.body?.idempotent === true,
      'HTTP 200 idempotent=true',
      `HTTP ${res.statusCode} idempotent=${res.body?.idempotent}`
    );
  } catch (err: any) {
    assertTest('Idempotency: Replay test', 'SECURITY & REGRESSION', false, 'HTTP 200 idempotent=true', err.message);
  }

  // ==========================================
  // SECTION 5: DUPLICATE DOOR ID PREVENTION
  // ==========================================
  console.log('--- 5. Testing Duplicate Door ID Rejection ---');

  try {
    const res = await request({
      method: 'POST',
      path: '/api/admin/doors/create',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'X-Idempotency-Key': `fresh-key-${Date.now()}`,
      },
      body: {
        doorId: testDoorId, // Duplicate ID
        doorName: 'Percubaan Pintu Pendua',
      },
    });

    assertTest(
      'Integrity: Duplicate Door ID rejected with 409 Conflict',
      'FIRESTORE & DATA INTEGRITY',
      res.statusCode === 409 && res.body?.error === 'ALREADY_EXISTS',
      'HTTP 409 ALREADY_EXISTS',
      `HTTP ${res.statusCode} ${res.body?.error || ''}`
    );
  } catch (err: any) {
    assertTest('Integrity: Duplicate Door ID', 'FIRESTORE & DATA INTEGRITY', false, 'HTTP 409', err.message);
  }

  // ==========================================
  // SECTION 6: UPDATE DOOR CONFIGURATION
  // ==========================================
  console.log('--- 6. Testing Door Update ---');

  try {
    const res = await request({
      method: 'POST',
      path: '/api/admin/doors/update',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        doorId: testDoorId,
        doorName: 'Makmal Komputer 1 (Updated)',
        location: 'Bilik A-102 Sayap Barat Kemaskini',
        zoneId: 'ZONE-LABS',
        zoneName: 'Zon Makmal Komputer Komprehensif',
      },
    });

    assertTest(
      'Update Door: Master Admin updates existing door',
      'API VERIFICATION',
      res.statusCode === 200 && res.body?.success === true,
      'HTTP 200 success=true',
      `HTTP ${res.statusCode} success=${res.body?.success}`
    );
  } catch (err: any) {
    assertTest('Update Door: Master Admin update', 'API VERIFICATION', false, 'HTTP 200', err.message);
  }

  // ==========================================
  // SECTION 7: STATUS TRANSITIONS & MANDATORY JUSTIFICATION
  // ==========================================
  console.log('--- 7. Testing Status Transitions & Justifications ---');

  // Test 7.1: Missing justification rejected (400)
  try {
    const res = await request({
      method: 'POST',
      path: '/api/admin/doors/toggle-status',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        doorId: testDoorId,
        newStatus: 'MAINTENANCE',
        reason: '   ', // empty justification
      },
    });

    assertTest(
      'Status Transition: Missing justification rejected with 400',
      'STATUS TRANSITION TEST',
      res.statusCode === 400 && res.body?.error === 'INVALID_ARGUMENT',
      'HTTP 400 INVALID_ARGUMENT',
      `HTTP ${res.statusCode} ${res.body?.error || ''}`
    );
  } catch (err: any) {
    assertTest('Status Transition: Missing justification', 'STATUS TRANSITION TEST', false, 'HTTP 400', err.message);
  }

  // Test 7.2: Transition to MAINTENANCE with valid reason
  try {
    const res = await request({
      method: 'POST',
      path: '/api/admin/doors/toggle-status',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        doorId: testDoorId,
        newStatus: 'MAINTENANCE',
        reason: 'Penyelenggaraan berkala unit kunci elektromagnetik.',
      },
    });

    assertTest(
      'Status Transition: ACTIVE -> MAINTENANCE with justification succeeds',
      'STATUS TRANSITION TEST',
      res.statusCode === 200 && res.body?.newStatus === 'MAINTENANCE',
      'HTTP 200 newStatus=MAINTENANCE',
      `HTTP ${res.statusCode} newStatus=${res.body?.newStatus}`
    );
  } catch (err: any) {
    assertTest('Status Transition: ACTIVE -> MAINTENANCE', 'STATUS TRANSITION TEST', false, 'HTTP 200', err.message);
  }

  // Test 7.3: Transition to LOCKDOWN with valid reason
  try {
    const res = await request({
      method: 'POST',
      path: '/api/admin/doors/toggle-status',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        doorId: testDoorId,
        newStatus: 'LOCKDOWN',
        reason: 'Sekatan keselamatan kecemasan kampus KPMBP.',
      },
    });

    assertTest(
      'Status Transition: MAINTENANCE -> LOCKDOWN with justification succeeds',
      'STATUS TRANSITION TEST',
      res.statusCode === 200 && res.body?.newStatus === 'LOCKDOWN',
      'HTTP 200 newStatus=LOCKDOWN',
      `HTTP ${res.statusCode} newStatus=${res.body?.newStatus}`
    );
  } catch (err: any) {
    assertTest('Status Transition: MAINTENANCE -> LOCKDOWN', 'STATUS TRANSITION TEST', false, 'HTTP 200', err.message);
  }

  // Test 7.4: Transition to INACTIVE with valid reason
  try {
    const res = await request({
      method: 'POST',
      path: '/api/admin/doors/toggle-status',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        doorId: testDoorId,
        newStatus: 'INACTIVE',
        reason: 'Pintu dinyahaktif sementara bagi cuti semester.',
      },
    });

    assertTest(
      'Status Transition: LOCKDOWN -> INACTIVE with justification succeeds',
      'STATUS TRANSITION TEST',
      res.statusCode === 200 && res.body?.newStatus === 'INACTIVE',
      'HTTP 200 newStatus=INACTIVE',
      `HTTP ${res.statusCode} newStatus=${res.body?.newStatus}`
    );
  } catch (err: any) {
    assertTest('Status Transition: LOCKDOWN -> INACTIVE', 'STATUS TRANSITION TEST', false, 'HTTP 200', err.message);
  }

  // Test 7.5: Transition back to ACTIVE with valid reason
  try {
    const res = await request({
      method: 'POST',
      path: '/api/admin/doors/toggle-status',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        doorId: testDoorId,
        newStatus: 'ACTIVE',
        reason: 'Pengaktifan semula operasi bilik makmal.',
      },
    });

    assertTest(
      'Status Transition: INACTIVE -> ACTIVE with justification succeeds',
      'STATUS TRANSITION TEST',
      res.statusCode === 200 && res.body?.newStatus === 'ACTIVE',
      'HTTP 200 newStatus=ACTIVE',
      `HTTP ${res.statusCode} newStatus=${res.body?.newStatus}`
    );
  } catch (err: any) {
    assertTest('Status Transition: INACTIVE -> ACTIVE', 'STATUS TRANSITION TEST', false, 'HTTP 200', err.message);
  }

  // ==========================================
  // SECTION 8: GET DOORS LIST & DATA CONSISTENCY
  // ==========================================
  console.log('--- 8. Testing GET /api/admin/doors ---');

  try {
    const res = await request({
      method: 'GET',
      path: '/api/admin/doors',
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const doors = res.body?.doors;
    const found = doors && Array.isArray(doors) && doors.find((d: any) => d.doorId === testDoorId);

    assertTest(
      'API: GET /api/admin/doors returns list containing newly managed door',
      'API VERIFICATION',
      res.statusCode === 200 && !!found,
      `HTTP 200 with doorId ${testDoorId}`,
      `HTTP ${res.statusCode} found=${!!found}`
    );

    assertTest(
      'Integrity: Authoritative door has consistent SES v4.5 fields',
      'FIRESTORE & DATA INTEGRITY',
      !!found &&
        found.operationalStatus === 'ACTIVE' &&
        found.building === 'Bangunan Akademik A' &&
        found.zoneId === 'ZONE-LABS' &&
        typeof found.assignedAccessGroups === 'object',
      'Consistent SES schema fields present',
      found ? `Status=${found.operationalStatus}, Zone=${found.zoneId}` : 'Not found'
    );
  } catch (err: any) {
    assertTest('API: GET /api/admin/doors', 'API VERIFICATION', false, 'HTTP 200', err.message);
  }

  // ==========================================
  // SECTION 9: AUDIT LOG HISTORY VERIFICATION
  // ==========================================
  console.log('--- 9. Testing Audit Trail Recording ---');

  try {
    const res = await request({
      method: 'GET',
      path: `/api/admin/doors/${testDoorId}/audit-history`,
      headers: { Authorization: `Bearer ${adminToken}` },
    });

    const entries = res.body?.auditEntries || [];
    const actionsRecorded = entries.map((e: any) => e.action);

    assertTest(
      'Audit Trail: GET audit-history returns recorded events for test door',
      'API VERIFICATION',
      res.statusCode === 200 && entries.length >= 3,
      'HTTP 200 with >= 3 audit entries',
      `HTTP ${res.statusCode} entries=${entries.length}`
    );

    assertTest(
      'Audit Trail: CREATE_DOOR event recorded immutably',
      'SECURITY & REGRESSION',
      actionsRecorded.includes('CREATE_DOOR'),
      'Action CREATE_DOOR in audit log',
      `Actions=${actionsRecorded.join(', ')}`
    );

    assertTest(
      'Audit Trail: Status transition events recorded in audit log',
      'STATUS TRANSITION TEST',
      actionsRecorded.includes('MAINTENANCE_DOOR') ||
        actionsRecorded.includes('LOCKDOWN_DOOR') ||
        actionsRecorded.includes('DEACTIVATE_DOOR') ||
        actionsRecorded.includes('ACTIVATE_DOOR'),
      'Status change actions in audit log',
      `Actions=${actionsRecorded.join(', ')}`
    );
  } catch (err: any) {
    assertTest('Audit Trail: audit-history test', 'API VERIFICATION', false, 'HTTP 200', err.message);
  }

  // ==========================================
  // SUMMARY REPORT
  // ==========================================
  console.log('\n====================================================');
  console.log('VERIFICATION GATE EXECUTION COMPLETED');
  console.log('====================================================\n');

  let passedCount = 0;
  let failedCount = 0;

  for (const r of results) {
    const statusSymbol = r.passed ? '✓ PASS' : '✗ FAIL';
    console.log(`[${statusSymbol}] [${r.category}] ${r.name}`);
    if (!r.passed) {
      console.log(`   Expected: ${r.expected}`);
      console.log(`   Actual:   ${r.actual}`);
      if (r.details) console.log(`   Details:  ${r.details}`);
      failedCount++;
    } else {
      passedCount++;
    }
  }

  console.log(`\nTOTAL TESTS: ${results.length}`);
  console.log(`PASSED:      ${passedCount}`);
  console.log(`FAILED:      ${failedCount}`);

  if (failedCount === 0) {
    console.log('\n>>> GATE DECISION: VERIFIED. All SES v4.5 Module 1 requirements passed.');
  } else {
    console.log('\n>>> GATE DECISION: BLOCKED. Fix failing tests before proceeding.');
  }

  process.exit(failedCount === 0 ? 0 : 1);
}

runGateTests().catch((e) => {
  console.error('Test Runner Fatal Error:', e);
  process.exit(1);
});
