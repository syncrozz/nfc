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

// Master Admin Token
const adminToken = makeJwt({
  sub: 'admin-pin-tester-uid-01',
  user_id: 'admin-pin-tester-uid-01',
  email: 'admin.pin@kpmbp.edu.my',
  role: 'MASTER_ADMIN',
  admin: true,
});

// Second Master Admin Token for Lockout Isolation
const adminToken2 = makeJwt({
  sub: 'admin-pin-tester-uid-02',
  user_id: 'admin-pin-tester-uid-02',
  email: 'admin.pin2@kpmbp.edu.my',
  role: 'MASTER_ADMIN',
  admin: true,
});

// Regular User Token (Not Admin)
const regularUserToken = makeJwt({
  sub: 'student-pin-tester-uid-01',
  user_id: 'student-pin-tester-uid-01',
  email: 'student.pin@kpmbp.edu.my',
  role: 'STUDENT',
  admin: false,
});

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

    req.on('error', (err) => reject(err));
    if (postData) {
      req.write(postData);
    }
    req.end();
  });
}

function assert(name: string, category: string, expected: string, actual: string, condition: boolean, details?: string) {
  results.push({
    name,
    category,
    expected,
    actual,
    passed: condition,
    details,
  });
  const symbol = condition ? '✅ PASS' : '❌ FAIL';
  console.log(`${symbol} [${category}] ${name}`);
  if (!condition) {
    console.log(`   Expected: ${expected}`);
    console.log(`   Actual:   ${actual}`);
    if (details) console.log(`   Details:  ${details}`);
  }
}

async function runPinSecurityTestSuite() {
  console.log('\n===============================================================');
  console.log(' SES-SEC-4.5.5: MASTER ADMIN PIN SECURITY & STEP-UP AUTH SUITE');
  console.log('===============================================================\n');

  // CATEGORY 1: UNAUTHORIZED / PERMISSION CHECKS (No PIN-only auth)
  console.log('--- CATEGORY 1: Firebase Auth & RBAC Prerequisites ---');

  // Test 1: PIN verification without any Auth header (Must be rejected)
  const t1 = await request({
    method: 'POST',
    path: '/api/admin/verify-pin',
    body: { pin: '5313' },
  });
  assert(
    'Reject PIN verification without Firebase Auth token',
    'RBAC_AUTH',
    'HTTP 401 UNAUTHORIZED',
    `HTTP ${t1.statusCode} ${t1.body?.error || ''}`,
    t1.statusCode === 401
  );

  // Test 2: PIN verification with regular user token (Not Master Admin)
  const t2 = await request({
    method: 'POST',
    path: '/api/admin/verify-pin',
    headers: { Authorization: `Bearer ${regularUserToken}` },
    body: { pin: '5313' },
  });
  assert(
    'Reject PIN verification for non-master-admin user',
    'RBAC_AUTH',
    'HTTP 403 PERMISSION_DENIED',
    `HTTP ${t2.statusCode} ${t2.body?.error || ''}`,
    t2.statusCode === 403
  );

  // Test 3: Missing PIN body argument
  const t3 = await request({
    method: 'POST',
    path: '/api/admin/verify-pin',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: {},
  });
  assert(
    'Reject empty PIN submission with 400 INVALID_ARGUMENT',
    'INPUT_VALIDATION',
    'HTTP 400 INVALID_ARGUMENT',
    `HTTP ${t3.statusCode} ${t3.body?.error || ''}`,
    t3.statusCode === 400 && t3.body?.error === 'INVALID_ARGUMENT'
  );

  // CATEGORY 2: INVALID PIN & FAILED ATTEMPT TRACKING
  console.log('\n--- CATEGORY 2: Failed Attempts & Rate Limiting ---');

  // Test 4: Attempt 1 with invalid PIN (e.g. 0000)
  const t4 = await request({
    method: 'POST',
    path: '/api/admin/verify-pin',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { pin: '0000' },
  });
  assert(
    'Invalid PIN attempt 1 returns HTTP 401 and decrements remaining attempts',
    'FAILED_TRACKING',
    'HTTP 401 with remainingAttempts 4',
    `HTTP ${t4.statusCode} remainingAttempts=${t4.body?.remainingAttempts}`,
    t4.statusCode === 401 && t4.body?.remainingAttempts === 4
  );

  // Test 5: Attempt 2 with invalid PIN (e.g. 1111)
  const t5 = await request({
    method: 'POST',
    path: '/api/admin/verify-pin',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { pin: '1111' },
  });
  assert(
    'Invalid PIN attempt 2 returns HTTP 401 and decrements remaining attempts',
    'FAILED_TRACKING',
    'HTTP 401 with remainingAttempts 3',
    `HTTP ${t5.statusCode} remainingAttempts=${t5.body?.remainingAttempts}`,
    t5.statusCode === 401 && t5.body?.remainingAttempts === 3
  );

  // Test 6: Attempt 3 with invalid PIN (e.g. 2222)
  const t6 = await request({
    method: 'POST',
    path: '/api/admin/verify-pin',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { pin: '2222' },
  });
  assert(
    'Invalid PIN attempt 3 returns remainingAttempts 2',
    'FAILED_TRACKING',
    'remainingAttempts 2',
    `remainingAttempts=${t6.body?.remainingAttempts}`,
    t6.body?.remainingAttempts === 2
  );

  // Test 7: Attempt 4 with invalid PIN (e.g. 3333)
  const t7 = await request({
    method: 'POST',
    path: '/api/admin/verify-pin',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { pin: '3333' },
  });
  assert(
    'Invalid PIN attempt 4 returns remainingAttempts 1',
    'FAILED_TRACKING',
    'remainingAttempts 1',
    `remainingAttempts=${t7.body?.remainingAttempts}`,
    t7.body?.remainingAttempts === 1
  );

  // Test 8: Attempt 5 with invalid PIN -> triggers 15-min lockout (HTTP 429)
  const t8 = await request({
    method: 'POST',
    path: '/api/admin/verify-pin',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { pin: '4444' },
  });
  assert(
    'Invalid PIN attempt 5 activates temporary lockout (HTTP 429 TOO_MANY_REQUESTS)',
    'LOCKOUT',
    'HTTP 429 locked=true remainingMinutes=15',
    `HTTP ${t8.statusCode} locked=${t8.body?.locked} remainingMinutes=${t8.body?.remainingMinutes}`,
    t8.statusCode === 429 && t8.body?.locked === true
  );

  // Test 9: Subsequent attempt even with correct PIN while locked -> BLOCKED
  const t9 = await request({
    method: 'POST',
    path: '/api/admin/verify-pin',
    headers: { Authorization: `Bearer ${adminToken}` },
    body: { pin: '5313' },
  });
  assert(
    'Subsequent PIN attempt blocked while lockout is active (HTTP 429)',
    'LOCKOUT',
    'HTTP 429 blocked by active lockout',
    `HTTP ${t9.statusCode} ${t9.body?.error || ''}`,
    t9.statusCode === 429 && t9.body?.error === 'TOO_MANY_REQUESTS'
  );

  // CATEGORY 3: VALID PIN (5313) VERIFICATION & ELEVATED SESSION
  console.log('\n--- CATEGORY 3: Valid Master Admin PIN (5313) Verification ---');

  // Test 10: Valid PIN 5313 on independent admin account
  const t10 = await request({
    method: 'POST',
    path: '/api/admin/verify-pin',
    headers: { Authorization: `Bearer ${adminToken2}` },
    body: { pin: '5313' },
  });
  assert(
    'Valid Master Admin PIN 5313 produces HTTP 200 and issues elevated session token',
    'VALID_PIN_AUTH',
    'HTTP 200 with sessionToken and expiresIn',
    `HTTP ${t10.statusCode} success=${t10.body?.success} tokenPrefix=${t10.body?.sessionToken?.substring(0, 10)}`,
    t10.statusCode === 200 && t10.body?.authenticated === true && !!t10.body?.sessionToken
  );

  const elevatedSessionToken = t10.body?.sessionToken;

  // Test 11: Check session status with valid session token
  const t11 = await request({
    method: 'GET',
    path: '/api/admin/session-status',
    headers: {
      Authorization: `Bearer ${adminToken2}`,
      'X-Admin-Session-Token': elevatedSessionToken,
    },
  });
  assert(
    'Check elevated session status confirms active session',
    'SESSION_MGMT',
    'hasElevatedSession=true with remainingSeconds > 800',
    `hasElevatedSession=${t11.body?.hasElevatedSession} remainingSeconds=${t11.body?.remainingSeconds}`,
    t11.body?.hasElevatedSession === true && t11.body?.remainingSeconds > 0
  );

  // Test 12: Check session status without token -> hasElevatedSession=false
  const t12 = await request({
    method: 'GET',
    path: '/api/admin/session-status',
    headers: { Authorization: `Bearer ${adminToken2}` },
  });
  assert(
    'Check elevated session without token returns hasElevatedSession=false',
    'SESSION_MGMT',
    'hasElevatedSession=false',
    `hasElevatedSession=${t12.body?.hasElevatedSession}`,
    t12.body?.hasElevatedSession === false
  );

  // Test 13: Manual Lock Session terminates elevated session
  const t13 = await request({
    method: 'POST',
    path: '/api/admin/lock-session',
    headers: {
      Authorization: `Bearer ${adminToken2}`,
      'X-Admin-Session-Token': elevatedSessionToken,
    },
  });
  assert(
    'Lock elevated session endpoint successfully revokes elevated token',
    'SESSION_MGMT',
    'HTTP 200 success=true',
    `HTTP ${t13.statusCode} success=${t13.body?.success}`,
    t13.statusCode === 200 && t13.body?.success === true
  );

  // Test 14: Verifying session status AFTER lock -> hasElevatedSession=false
  const t14 = await request({
    method: 'GET',
    path: '/api/admin/session-status',
    headers: {
      Authorization: `Bearer ${adminToken2}`,
      'X-Admin-Session-Token': elevatedSessionToken,
    },
  });
  assert(
    'Session is completely invalidated after manual lock',
    'SESSION_MGMT',
    'hasElevatedSession=false',
    `hasElevatedSession=${t14.body?.hasElevatedSession}`,
    t14.body?.hasElevatedSession === false
  );

  // CATEGORY 4: AUDIT LOGGING OF PIN SECURITY EVENTS
  console.log('\n--- CATEGORY 4: Authoritative Audit Logging ---');

  // Test 15: Check that audit logs were produced for PIN events
  const t15 = await request({
    method: 'GET',
    path: '/api/admin/audit-logs',
    headers: { Authorization: `Bearer ${adminToken2}` },
  });
  const logs = Array.isArray(t15.body?.logs) ? t15.body.logs : [];
  const pinLogs = logs.filter((l: any) => l.targetType === 'AUTH_PIN');

  assert(
    'Authoritative audit logs record MASTER_ADMIN_PIN security events',
    'AUDIT_LOGGING',
    'At least 3 AUTH_PIN audit records recorded',
    `Found ${pinLogs.length} AUTH_PIN audit records`,
    pinLogs.length >= 3,
    pinLogs.map((l: any) => `${l.action} (${l.result})`).join(', ')
  );

  console.log('\n===============================================================');
  const passed = results.filter((r) => r.passed).length;
  const total = results.length;
  console.log(` SUMMARY: ${passed}/${total} TESTS PASSED (${Math.round((passed / total) * 100)}%)`);
  console.log('===============================================================\n');

  if (passed !== total) {
    process.exit(1);
  }
}

runPinSecurityTestSuite().catch((err) => {
  console.error('Fatal test error:', err);
  process.exit(1);
});
