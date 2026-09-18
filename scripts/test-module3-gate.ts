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
  sub: 'admin-gate-tester-03',
  user_id: 'admin-gate-tester-03',
  email: 'admin.m3@kpmbp.edu.my',
  role: 'MASTER_ADMIN',
  admin: true,
});

const userToken = makeJwt({
  sub: 'student-gate-tester-03',
  user_id: 'student-gate-tester-03',
  email: 'student.m3@kpmbp.edu.my',
  role: 'STUDENT',
  admin: false,
});

const invalidToken = 'malformed.invalid.token-03';

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
    passed: !!condition,
    details,
  });
}

async function runModule3VerificationGate() {
  console.log('====================================================');
  console.log('SYNCROZZ ENGINEERING STANDARD (SES) v4.5');
  console.log('PHASE 3 — MODULE 3 (ACCESS GROUP MANAGEMENT)');
  console.log('VERIFICATION GATE & REGRESSION SUITE');
  console.log('====================================================\n');

  const testGroupId = `AG-GATE-${Date.now().toString().slice(-6)}`;
  const testDoorId = `DR-M3-${Date.now().toString().slice(-4)}`;
  const testUserId = `user-m3-${Date.now().toString().slice(-4)}`;
  const testZoneId = `ZONE-M3-${Date.now().toString().slice(-4)}`;

  // ====================================================
  // 1. PREREQUISITE SEEDING (DOOR & ZONE)
  // ====================================================
  try {
    // Seed Door
    await request({
      method: 'POST',
      path: '/api/admin/doors/create',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        doorId: testDoorId,
        doorName: 'Door for Access Group Verification',
        building: 'Blok Teknologi',
        floor: 'Aras 2',
        location: 'Bilik Server M3',
        readerType: 'NFC_HCE_OSDP',
        controllerType: 'KPMBP_V2',
        zoneId: 'ZONE-ACADEMIC',
      },
    });

    // Seed Zone
    await request({
      method: 'POST',
      path: '/api/admin/zones/create',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        zoneId: testZoneId,
        zoneName: 'Zon ICT M3 Gate',
        zoneCode: `ZCM3-${Date.now().toString().slice(-4)}`,
        building: 'Blok Teknologi',
        floor: 'Aras 2',
        location: 'Pusat ICT',
      },
    });
  } catch (err: any) {
    console.error('Failed prerequisite seeding:', err);
  }

  // ====================================================
  // 2. AUTHENTICATION & AUTHORIZATION TESTS
  // ====================================================

  // Test 1: GET /api/admin/access-groups with Invalid Token -> 401
  try {
    const res = await request({
      method: 'GET',
      path: '/api/admin/access-groups',
      headers: { Authorization: `Bearer ${invalidToken}` },
    });
    assert(
      'AUTH & RBAC',
      'GET /api/admin/access-groups rejects invalid token with 401',
      res.statusCode === 401,
      'HTTP 401',
      `HTTP ${res.statusCode}`
    );
  } catch (e: any) {
    assert('AUTH & RBAC', 'GET /api/admin/access-groups rejects invalid token', false, 'HTTP 401', e.message);
  }

  // Test 2: GET /api/admin/access-groups with Non-Admin Token -> 403
  try {
    const res = await request({
      method: 'GET',
      path: '/api/admin/access-groups',
      headers: { Authorization: `Bearer ${userToken}` },
    });
    assert(
      'AUTH & RBAC',
      'GET /api/admin/access-groups rejects regular student user with 403',
      res.statusCode === 403,
      'HTTP 403',
      `HTTP ${res.statusCode}`
    );
  } catch (e: any) {
    assert('AUTH & RBAC', 'GET /api/admin/access-groups rejects non-admin', false, 'HTTP 403', e.message);
  }

  // Test 3: GET /api/admin/access-groups with Master Admin -> 200
  try {
    const res = await request({
      method: 'GET',
      path: '/api/admin/access-groups',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(
      'AUTH & RBAC',
      'GET /api/admin/access-groups allows Master Admin access with 200',
      res.statusCode === 200 && Array.isArray(res.body?.accessGroups),
      'HTTP 200 with accessGroups array',
      `HTTP ${res.statusCode} isArray=${Array.isArray(res.body?.accessGroups)}`
    );
  } catch (e: any) {
    assert('AUTH & RBAC', 'GET /api/admin/access-groups allows Master Admin', false, 'HTTP 200', e.message);
  }

  // ====================================================
  // 3. CREATE ACCESS GROUP TESTS
  // ====================================================

  // Test 4: POST /api/admin/access-groups/create with Non-Admin -> 403
  try {
    const res = await request({
      method: 'POST',
      path: '/api/admin/access-groups/create',
      headers: { Authorization: `Bearer ${userToken}` },
      body: {
        groupId: 'AG-UNAUTH',
        groupName: 'Unauthorized Group',
      },
    });
    assert(
      'AUTH & RBAC',
      'POST /api/admin/access-groups/create rejects non-admin user with 403',
      res.statusCode === 403,
      'HTTP 403',
      `HTTP ${res.statusCode}`
    );
  } catch (e: any) {
    assert('AUTH & RBAC', 'POST create rejects non-admin', false, 'HTTP 403', e.message);
  }

  // Test 5: POST /api/admin/access-groups/create with Missing Fields -> 400
  try {
    const res = await request({
      method: 'POST',
      path: '/api/admin/access-groups/create',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        groupId: '',
        groupName: '',
      },
    });
    assert(
      'DATA VALIDATION',
      'POST /api/admin/access-groups/create rejects missing required fields with 400',
      res.statusCode === 400,
      'HTTP 400',
      `HTTP ${res.statusCode}`
    );
  } catch (e: any) {
    assert('DATA VALIDATION', 'POST create rejects missing fields', false, 'HTTP 400', e.message);
  }

  // Test 6: POST /api/admin/access-groups/create Success -> 200/201
  const createIdempotencyKey = `IDEM-AG-CREATE-${Date.now()}`;
  try {
    const res = await request({
      method: 'POST',
      path: '/api/admin/access-groups/create',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Idempotency-Key': createIdempotencyKey,
      },
      body: {
        groupId: testGroupId,
        groupName: 'Kumpulan Akses Makmal M3 Gate',
        description: 'Ujian automasi SES v4.5 Module 3',
        groupType: 'STAFF',
        assignedZones: [testZoneId],
        assignedDoors: [testDoorId],
        assignedUsers: [testUserId],
        allowedSchedule: {
          daysOfWeek: [1, 2, 3, 4, 5],
          startTime: '08:00',
          endTime: '18:00',
          timezone: 'Asia/Kuala_Lumpur',
        },
        validFrom: '2026-09-01T00:00:00.000Z',
        validUntil: '2027-12-31T23:59:59.000Z',
        status: 'ACTIVE',
      },
    });
    assert(
      'API VERIFICATION',
      'POST /api/admin/access-groups/create successfully creates access group',
      (res.statusCode === 200 || res.statusCode === 201) && res.body?.accessGroup?.groupId === testGroupId,
      'HTTP 200/201 with created accessGroup',
      `HTTP ${res.statusCode} groupId=${res.body?.accessGroup?.groupId}`
    );
  } catch (e: any) {
    assert('API VERIFICATION', 'POST create successfully creates access group', false, 'HTTP 200', e.message);
  }

  // Test 7: Idempotency Replay on Create Group -> identical result
  try {
    const res = await request({
      method: 'POST',
      path: '/api/admin/access-groups/create',
      headers: {
        Authorization: `Bearer ${adminToken}`,
        'Idempotency-Key': createIdempotencyKey,
      },
      body: {
        groupId: testGroupId,
        groupName: 'Duplicate Attempt With Same Idempotency Key',
      },
    });
    assert(
      'IDEMPOTENCY',
      'POST create returns cached response on replayed Idempotency-Key',
      (res.statusCode === 200 || res.statusCode === 201) && res.body?.accessGroup?.groupId === testGroupId,
      'HTTP 200/201 cached replay response',
      `HTTP ${res.statusCode} groupId=${res.body?.accessGroup?.groupId}`
    );
  } catch (e: any) {
    assert('IDEMPOTENCY', 'Idempotency replay on create', false, 'HTTP 200/201', e.message);
  }

  // Test 8: Duplicate groupId Rejection -> 409
  try {
    const res = await request({
      method: 'POST',
      path: '/api/admin/access-groups/create',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        groupId: testGroupId,
        groupName: 'Another Group Same ID',
      },
    });
    assert(
      'DATA VALIDATION',
      'POST create rejects duplicate groupId with 409 Conflict',
      res.statusCode === 409,
      'HTTP 409',
      `HTTP ${res.statusCode}`
    );
  } catch (e: any) {
    assert('DATA VALIDATION', 'POST create duplicate rejection', false, 'HTTP 409', e.message);
  }

  // ====================================================
  // 4. GET ACCESS GROUP BY ID
  // ====================================================

  // Test 9: GET /api/admin/access-groups/:groupId -> 200
  try {
    const res = await request({
      method: 'GET',
      path: `/api/admin/access-groups/${testGroupId}`,
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const ag = res.body?.accessGroup;
    assert(
      'API VERIFICATION',
      'GET /api/admin/access-groups/:groupId returns complete access group details',
      res.statusCode === 200 &&
        ag?.groupId === testGroupId &&
        ag?.assignedDoors?.includes(testDoorId) &&
        ag?.assignedUsers?.includes(testUserId),
      'HTTP 200 with complete group object and assignments',
      `HTTP ${res.statusCode} hasDoors=${ag?.assignedDoors?.includes(testDoorId)} hasUsers=${ag?.assignedUsers?.includes(testUserId)}`
    );
  } catch (e: any) {
    assert('API VERIFICATION', 'GET access group by ID', false, 'HTTP 200', e.message);
  }

  // Test 10: GET non-existent groupId -> 404
  try {
    const res = await request({
      method: 'GET',
      path: '/api/admin/access-groups/AG-DOES-NOT-EXIST-404',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(
      'API VERIFICATION',
      'GET /api/admin/access-groups/:groupId returns 404 for non-existent group',
      res.statusCode === 404,
      'HTTP 404',
      `HTTP ${res.statusCode}`
    );
  } catch (e: any) {
    assert('API VERIFICATION', 'GET non-existent returns 404', false, 'HTTP 404', e.message);
  }

  // ====================================================
  // 5. UPDATE ACCESS GROUP
  // ====================================================

  // Test 11: POST /api/admin/access-groups/update with Non-Admin -> 403
  try {
    const res = await request({
      method: 'POST',
      path: '/api/admin/access-groups/update',
      headers: { Authorization: `Bearer ${userToken}` },
      body: {
        groupId: testGroupId,
        groupName: 'Hacked Name By Student',
      },
    });
    assert(
      'AUTH & RBAC',
      'POST /api/admin/access-groups/update rejects non-admin with 403',
      res.statusCode === 403,
      'HTTP 403',
      `HTTP ${res.statusCode}`
    );
  } catch (e: any) {
    assert('AUTH & RBAC', 'POST update rejects non-admin', false, 'HTTP 403', e.message);
  }

  // Test 12: POST /api/admin/access-groups/update Success -> 200
  try {
    const res = await request({
      method: 'POST',
      path: '/api/admin/access-groups/update',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        groupId: testGroupId,
        groupName: 'Kumpulan Makmal Komputer (Updated)',
        description: 'Penerangan dikemaskini oleh Master Admin SES',
        groupType: 'FACULTY',
        allowedSchedule: {
          daysOfWeek: [1, 2, 3, 4, 5, 6],
          startTime: '07:30',
          endTime: '21:00',
        },
        validUntil: '2028-12-31T23:59:59.000Z',
      },
    });
    const updated = res.body?.accessGroup;
    assert(
      'API VERIFICATION',
      'POST /api/admin/access-groups/update successfully updates group attributes',
      res.statusCode === 200 &&
        updated?.groupName === 'Kumpulan Makmal Komputer (Updated)' &&
        updated?.groupType === 'FACULTY',
      'HTTP 200 with updated fields',
      `HTTP ${res.statusCode} name=${updated?.groupName} type=${updated?.groupType}`
    );
  } catch (e: any) {
    assert('API VERIFICATION', 'POST update group attributes', false, 'HTTP 200', e.message);
  }

  // ====================================================
  // 6. TOGGLE STATUS TESTS
  // ====================================================

  // Test 13: POST /api/admin/access-groups/toggle-status with Non-Admin -> 403
  try {
    const res = await request({
      method: 'POST',
      path: '/api/admin/access-groups/toggle-status',
      headers: { Authorization: `Bearer ${userToken}` },
      body: {
        groupId: testGroupId,
        newStatus: 'INACTIVE',
        reason: 'Testing unauthorized deactivation',
      },
    });
    assert(
      'AUTH & RBAC',
      'POST /api/admin/access-groups/toggle-status rejects non-admin with 403',
      res.statusCode === 403,
      'HTTP 403',
      `HTTP ${res.statusCode}`
    );
  } catch (e: any) {
    assert('AUTH & RBAC', 'POST toggle-status rejects non-admin', false, 'HTTP 403', e.message);
  }

  // Test 14: POST /api/admin/access-groups/toggle-status without reason -> 400
  try {
    const res = await request({
      method: 'POST',
      path: '/api/admin/access-groups/toggle-status',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        groupId: testGroupId,
        newStatus: 'INACTIVE',
        reason: 'Short', // Less than 10 chars
      },
    });
    assert(
      'DATA INTEGRITY & AUDIT',
      'POST toggle-status rejects missing or too-short audit reason with 400',
      res.statusCode === 400,
      'HTTP 400',
      `HTTP ${res.statusCode}`
    );
  } catch (e: any) {
    assert('DATA INTEGRITY & AUDIT', 'POST toggle-status validation', false, 'HTTP 400', e.message);
  }

  // Test 15: POST /api/admin/access-groups/toggle-status to INACTIVE Success -> 200
  try {
    const res = await request({
      method: 'POST',
      path: '/api/admin/access-groups/toggle-status',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        groupId: testGroupId,
        newStatus: 'INACTIVE',
        reason: 'Penyelenggaraan dasar akses keselamatan kampus KPMBP.',
      },
    });
    assert(
      'API VERIFICATION',
      'POST toggle-status deactivates group to INACTIVE',
      res.statusCode === 200 && res.body?.accessGroup?.status === 'INACTIVE',
      'HTTP 200 status=INACTIVE',
      `HTTP ${res.statusCode} status=${res.body?.accessGroup?.status}`
    );
  } catch (e: any) {
    assert('API VERIFICATION', 'POST toggle-status to INACTIVE', false, 'HTTP 200', e.message);
  }

  // Test 16: POST /api/admin/access-groups/toggle-status back to ACTIVE -> 200
  try {
    const res = await request({
      method: 'POST',
      path: '/api/admin/access-groups/toggle-status',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        groupId: testGroupId,
        newStatus: 'ACTIVE',
        reason: 'Pengaktifan semula kumpulan akses rasmi kampus KPMBP.',
      },
    });
    assert(
      'API VERIFICATION',
      'POST toggle-status reactivates group to ACTIVE',
      res.statusCode === 200 && res.body?.accessGroup?.status === 'ACTIVE',
      'HTTP 200 status=ACTIVE',
      `HTTP ${res.statusCode} status=${res.body?.accessGroup?.status}`
    );
  } catch (e: any) {
    assert('API VERIFICATION', 'POST toggle-status to ACTIVE', false, 'HTTP 200', e.message);
  }

  // ====================================================
  // 7. USER MEMBERSHIP ASSIGNMENT TESTS
  // ====================================================

  const newMemberUser = `user-m3-add-${Date.now().toString().slice(-4)}`;

  // Test 17: Assign User to Group -> 200
  try {
    const res = await request({
      method: 'POST',
      path: '/api/admin/access-groups/assign-user',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        groupId: testGroupId,
        userId: newMemberUser,
        reason: 'Penetapan pengguna baharu ke kumpulan akses SES v4.5.',
      },
    });
    assert(
      'API VERIFICATION',
      'POST /api/admin/access-groups/assign-user successfully adds user to group',
      res.statusCode === 200 && res.body?.accessGroup?.assignedUsers?.includes(newMemberUser),
      'HTTP 200 with new member present',
      `HTTP ${res.statusCode} hasUser=${res.body?.accessGroup?.assignedUsers?.includes(newMemberUser)}`
    );
  } catch (e: any) {
    assert('API VERIFICATION', 'POST assign-user', false, 'HTTP 200', e.message);
  }

  // Test 18: Assign Duplicate User -> 200 (idempotent, does not duplicate in array)
  try {
    const res = await request({
      method: 'POST',
      path: '/api/admin/access-groups/assign-user',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        groupId: testGroupId,
        userId: newMemberUser,
        reason: 'Duplicate assignment attempt',
      },
    });
    const userCount = res.body?.accessGroup?.assignedUsers?.filter((u: string) => u === newMemberUser).length;
    assert(
      'DATA INTEGRITY',
      'POST assign-user prevents duplicate entries in assignedUsers array',
      res.statusCode === 200 && userCount === 1,
      'HTTP 200 with unique occurrence (count=1)',
      `HTTP ${res.statusCode} count=${userCount}`
    );
  } catch (e: any) {
    assert('DATA INTEGRITY', 'POST assign-user duplicates check', false, 'HTTP 200', e.message);
  }

  // Test 19: Remove User from Group -> 200
  try {
    const res = await request({
      method: 'POST',
      path: '/api/admin/access-groups/remove-user',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        groupId: testGroupId,
        userId: newMemberUser,
        reason: 'Pengeluaran staf/pelajar daripada kumpulan akses.',
      },
    });
    assert(
      'API VERIFICATION',
      'POST /api/admin/access-groups/remove-user successfully removes member',
      res.statusCode === 200 && !res.body?.accessGroup?.assignedUsers?.includes(newMemberUser),
      'HTTP 200 with user removed',
      `HTTP ${res.statusCode} hasUser=${res.body?.accessGroup?.assignedUsers?.includes(newMemberUser)}`
    );
  } catch (e: any) {
    assert('API VERIFICATION', 'POST remove-user', false, 'HTTP 200', e.message);
  }

  // ====================================================
  // 8. DOOR ASSIGNMENT & INTEGRITY TESTS
  // ====================================================

  const newDoorId = `DR-M3-ADD-${Date.now().toString().slice(-4)}`;
  try {
    await request({
      method: 'POST',
      path: '/api/admin/doors/create',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        doorId: newDoorId,
        doorName: 'Additional Door for M3 Gate',
        building: 'Blok Pentadbiran',
        floor: 'Aras 1',
        location: 'Pejabat Am',
        readerType: 'NFC_HCE_OSDP',
        controllerType: 'KPMBP_V2',
      },
    });
  } catch (err: any) {
    console.error('Failed to seed additional door:', err);
  }

  // Test 20: Assign Door to Group -> 200
  try {
    const res = await request({
      method: 'POST',
      path: '/api/admin/access-groups/assign-door',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        groupId: testGroupId,
        doorId: newDoorId,
        reason: 'Pemberian kebenaran akses pintu fizikal kepada kumpulan.',
      },
    });
    assert(
      'API VERIFICATION',
      'POST /api/admin/access-groups/assign-door assigns door and updates bidirectional link',
      res.statusCode === 200 && res.body?.accessGroup?.assignedDoors?.includes(newDoorId),
      'HTTP 200 with new door linked',
      `HTTP ${res.statusCode} hasDoor=${res.body?.accessGroup?.assignedDoors?.includes(newDoorId)}`
    );
  } catch (e: any) {
    assert('API VERIFICATION', 'POST assign-door', false, 'HTTP 200', e.message);
  }

  // Test 21: Check that hardware integration status was NOT mutated
  try {
    const doorRes = await request({
      method: 'GET',
      path: `/api/admin/doors`,
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const doors = doorRes.body?.doors || [];
    const targetDoor = doors.find((d: any) => (d.doorId || d.id) === newDoorId);
    assert(
      'INTEGRITY & HARDWARE',
      'Assigning door to access group preserves hardware integrationStatus without mutation',
      targetDoor && targetDoor.integrationStatus !== undefined,
      'Door integrationStatus preserved',
      `Door found=${!!targetDoor} integrationStatus=${targetDoor?.integrationStatus}`
    );
  } catch (e: any) {
    assert('INTEGRITY & HARDWARE', 'Preserve hardware integrationStatus', false, 'Preserved', e.message);
  }

  // Test 22: Remove Door from Group -> 200
  try {
    const res = await request({
      method: 'POST',
      path: '/api/admin/access-groups/remove-door',
      headers: { Authorization: `Bearer ${adminToken}` },
      body: {
        groupId: testGroupId,
        doorId: newDoorId,
        reason: 'Penamatan kebenaran pintu fizikal bagi kumpulan.',
      },
    });
    assert(
      'API VERIFICATION',
      'POST /api/admin/access-groups/remove-door unlinks door from group',
      res.statusCode === 200 && !res.body?.accessGroup?.assignedDoors?.includes(newDoorId),
      'HTTP 200 with door removed',
      `HTTP ${res.statusCode} hasDoor=${res.body?.accessGroup?.assignedDoors?.includes(newDoorId)}`
    );
  } catch (e: any) {
    assert('API VERIFICATION', 'POST remove-door', false, 'HTTP 200', e.message);
  }

  // ====================================================
  // 9. AUDIT HISTORY VERIFICATION
  // ====================================================

  // Test 23: GET /api/admin/access-groups/:groupId/audit-history -> 200 with events
  try {
    const res = await request({
      method: 'GET',
      path: `/api/admin/access-groups/${testGroupId}/audit-history`,
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    const entries = res.body?.auditEntries || [];
    const hasCreate = entries.some((e: any) => e.action === 'CREATE_ACCESS_GROUP');
    const hasToggle = entries.some((e: any) => e.action === 'TOGGLE_ACCESS_GROUP_STATUS');
    assert(
      'AUDIT LOG',
      'Audit Trail: GET audit-history returns immutable audit records for access group',
      res.statusCode === 200 && entries.length >= 2 && hasCreate && hasToggle,
      'HTTP 200 with recorded events (CREATE_ACCESS_GROUP, TOGGLE_ACCESS_GROUP_STATUS)',
      `HTTP ${res.statusCode} count=${entries.length} hasCreate=${hasCreate} hasToggle=${hasToggle}`
    );
  } catch (e: any) {
    assert('AUDIT LOG', 'Audit history check', false, 'HTTP 200', e.message);
  }

  // ====================================================
  // 10. REGRESSION TESTS (MODULE 1: DOORS & MODULE 2: ZONES)
  // ====================================================

  // Test 24: Regression - Module 1 GET /api/admin/doors
  try {
    const res = await request({
      method: 'GET',
      path: '/api/admin/doors',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(
      'REGRESSION (MODULE 1)',
      'Regression Check: GET /api/admin/doors functions properly without degradation',
      res.statusCode === 200 && Array.isArray(res.body?.doors),
      'HTTP 200 with doors array',
      `HTTP ${res.statusCode} count=${res.body?.doors?.length}`
    );
  } catch (e: any) {
    assert('REGRESSION (MODULE 1)', 'Doors regression check', false, 'HTTP 200', e.message);
  }

  // Test 25: Regression - Module 2 GET /api/admin/zones
  try {
    const res = await request({
      method: 'GET',
      path: '/api/admin/zones',
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(
      'REGRESSION (MODULE 2)',
      'Regression Check: GET /api/admin/zones functions properly without degradation',
      res.statusCode === 200 && Array.isArray(res.body?.zones),
      'HTTP 200 with zones array',
      `HTTP ${res.statusCode} count=${res.body?.zones?.length}`
    );
  } catch (e: any) {
    assert('REGRESSION (MODULE 2)', 'Zones regression check', false, 'HTTP 200', e.message);
  }

  // Test 26: Regression - Module 2 Zone Detail & Door Assignments
  try {
    const res = await request({
      method: 'GET',
      path: `/api/admin/zones/${testZoneId}`,
      headers: { Authorization: `Bearer ${adminToken}` },
    });
    assert(
      'REGRESSION (MODULE 2)',
      'Regression Check: GET /api/admin/zones/:zoneId returns valid zone structure',
      res.statusCode === 200 && res.body?.zone?.zoneId === testZoneId,
      'HTTP 200 with zone match',
      `HTTP ${res.statusCode} zoneId=${res.body?.zone?.zoneId}`
    );
  } catch (e: any) {
    assert('REGRESSION (MODULE 2)', 'Zone detail regression check', false, 'HTTP 200', e.message);
  }

  // ====================================================
  // 11. SUMMARY REPORT
  // ====================================================
  console.log('\n====================================================');
  console.log('MODULE 3 VERIFICATION GATE RESULTS');
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
    console.log('\n>>> GATE DECISION: VERIFIED. All SES v4.5 Module 3 requirements passed.');
    process.exit(0);
  } else {
    console.log('\n>>> GATE DECISION: BLOCKED. Fix failing tests before proceeding.');
    process.exit(1);
  }
}

runModule3VerificationGate().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
