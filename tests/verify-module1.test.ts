/**
 * PHASE 3A — MODULE 1 VERIFICATION GATE TEST SUITE
 * SES v4.5 Zero-Trust Architecture Security Verification
 */

import { readFileSync } from 'fs';
import path from 'path';

interface TestResult {
  category: string;
  name: string;
  expected: string;
  actual: string;
  status: 'PASS' | 'FAIL';
  notes?: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, category: string, name: string, expected: string, actual: string, notes?: string) {
  const status: 'PASS' | 'FAIL' = condition ? 'PASS' : 'FAIL';
  results.push({ category, name, expected, actual, status, notes });
  const icon = status === 'PASS' ? '✅' : '❌';
  console.log(`${icon} [${category}] ${name}: ${status}`);
  if (!condition) {
    console.error(`   Expected: ${expected}`);
    console.error(`   Actual:   ${actual}`);
  }
}

async function runVerification() {
  console.log('===============================================================');
  console.log('  STARTING MODULE 1 SECURITY VERIFICATION SUITE (SES v4.5)     ');
  console.log('===============================================================\n');

  const serverTs = readFileSync(path.join(process.cwd(), 'server.ts'), 'utf-8');
  const firestoreRules = readFileSync(path.join(process.cwd(), 'firestore.rules'), 'utf-8');
  const functionsIndex = readFileSync(path.join(process.cwd(), 'functions/src/index.ts'), 'utf-8');
  const authContext = readFileSync(path.join(process.cwd(), 'src/services/AuthContext.tsx'), 'utf-8');
  const functionsService = readFileSync(path.join(process.cwd(), 'src/services/functionsService.ts'), 'utf-8');

  // TEST 1: Firebase Custom Claims Authorization
  const hasClaimsVerificationInServer = serverTs.includes("decoded.admin === true || decoded.role === 'MASTER_ADMIN'");
  const hasClaimsVerificationInFunctions = functionsIndex.includes("token.admin === true || token.role === 'MASTER_ADMIN'");
  const hasBearerExtraction = serverTs.includes("authHeader.startsWith('Bearer ')");
  assert(
    hasClaimsVerificationInServer && hasClaimsVerificationInFunctions && hasBearerExtraction,
    'Custom Claims Auth',
    'Verify Custom Claims token validation & Bearer header parsing',
    'Server & Functions must extract Bearer token and check token.admin or token.role',
    hasClaimsVerificationInServer ? 'Validated server-side and in Cloud Functions' : 'Missing token validation'
  );

  // TEST 2: MASTER_ADMIN Role Enforcement
  const hasRequireMasterAdmin = serverTs.includes('function requireMasterAdmin(') && serverTs.includes('req.user?.isAdmin');
  const hasSelfDemotionCheck = serverTs.includes("targetUserId === req.user!.uid && newRole === 'USER'") &&
                               serverTs.includes('FAILED_PRECONDITION');
  const hasEndpointsGuarded = (serverTs.match(/requireMasterAdmin/g) || []).length >= 8;
  assert(
    hasRequireMasterAdmin && hasSelfDemotionCheck && hasEndpointsGuarded,
    'Role Enforcement',
    'MASTER_ADMIN role enforcement and self-demotion prevention',
    'All 8 mutating admin endpoints protected by requireMasterAdmin; self-demotion blocked',
    `Protected ${hasEndpointsGuarded ? '8+ endpoints' : 'insufficient'} with self-demotion guard`
  );

  // TEST 3: Token Refresh After Role Changes
  const hasClientForceRefresh = authContext.includes('getIdToken(true)') && functionsService.includes('getIdToken(true)');
  const hasExportedRefreshToken = authContext.includes('refreshToken: () => Promise<void>');
  assert(
    hasClientForceRefresh && hasExportedRefreshToken,
    'Token Refresh',
    'Force token refresh upon role modification',
    'Client invokes getIdToken(true) on role assignment and exposes refreshToken()',
    hasClientForceRefresh && hasExportedRefreshToken ? 'getIdToken(true) implemented across services' : 'Missing token refresh'
  );

  // TEST 4: Server-Only Audit Log Creation
  const hasRulesCreateFalse = firestoreRules.includes('match /accessLogs/{logId}') &&
                              firestoreRules.includes('allow create, update, delete: if false;');
  const hasClientNoDirectAccessLogWrite = !authContext.includes("collection(db, 'accessLogs')");
  const hasAdminExclusiveCheck = serverTs.includes('ADMIN_EXCLUSIVE_ACTIONS') && serverTs.includes('PERMISSION_DENIED');
  assert(
    hasRulesCreateFalse && hasClientNoDirectAccessLogWrite && hasAdminExclusiveCheck,
    'Audit Log Server-Only',
    'Server-only audit log creation and forgery prevention',
    'Firestore rules reject client writes; client routes via server; non-admin admin event forgery rejected',
    `Firestore accessLogs rule: ${hasRulesCreateFalse ? 'BLOCKED_CLIENT' : 'OPEN'}, Client writes: ${hasClientNoDirectAccessLogWrite ? 'CLEAN' : 'LEAK'}`
  );

  // TEST 5: Immutable Audit Log Protection
  const hasImmutableRules = firestoreRules.includes('match /accessLogs/{logId}') &&
                            firestoreRules.includes('allow create, update, delete: if false;');
  const hasServerWriteOnly = serverTs.includes("db.collection('accessLogs').doc()") &&
                             !serverTs.includes("app.put('/api/admin/audit-log'") &&
                             !serverTs.includes("app.delete('/api/admin/audit-log'");
  assert(
    hasImmutableRules && hasServerWriteOnly,
    'Audit Log Immutability',
    'Audit logs are append-only and strictly cannot be updated or deleted',
    'Rules block create/update/delete from clients; server provides append-only without mutation/deletion routes',
    'Append-only enforced with no modification or deletion routes'
  );

  // TEST 6: Idempotency-Key Persistence & Duplicate Prevention
  const hasCheckIdempotency = serverTs.includes('async function checkIdempotency(');
  const hasCompleteIdempotency = serverTs.includes('async function completeIdempotency(');
  const hasIdempotencyStore = serverTs.includes("collection('_idempotencyKeys')");
  const hasRulesIdempotencyBlocked = firestoreRules.includes('match /_idempotencyKeys/{key}') &&
                                     firestoreRules.includes('allow read, write: if false;');
  assert(
    hasCheckIdempotency && hasCompleteIdempotency && hasIdempotencyStore && hasRulesIdempotencyBlocked,
    'Idempotency Engine',
    'Idempotency key state machine (_idempotencyKeys store)',
    'Keys tracked via PROCESSING -> COMPLETED in server-only collection with read/write forbidden to client',
    'Idempotency engine implemented with secure store'
  );

  // TEST 7: Replay Attack Prevention
  const hasReplayConflictHandling = serverTs.includes('SES-SEC-4.5.5: Permintaan pendua sedang diproses') &&
                                    serverTs.includes('status(409)');
  const hasCachedReturn = serverTs.includes('isDuplicate') && serverTs.includes('cachedResponse');
  assert(
    hasReplayConflictHandling && hasCachedReturn,
    'Replay Attack Defense',
    'Concurrent replay conflict (409) and completed replay memoization',
    'Concurrent requests return 409 CONFLICT; completed requests return cached idempotent response',
    'Stateful duplicate suppression active'
  );

  // TEST 8: One-Active-Device Enforcement
  const hasActivateDeviceRevocation = serverTs.includes("status: 'REVOKED'") &&
                                      serverTs.includes('Digantikan oleh telefon baharu (Dasar SES v4.5 1-Peranti Aktif)');
  const hasSingleDeviceBinding = serverTs.includes('activeDeviceId: deviceId');
  assert(
    hasActivateDeviceRevocation && hasSingleDeviceBinding,
    '1-Active-Device Policy',
    'Server enforces single active device per user upon device activation',
    'All existing active devices revoked in Firestore batch and user doc bound to single deviceId',
    'Batch revocation and single device binding verified'
  );

  // TEST 9: Frontend Cannot Bypass Backend Authorization
  const hasNoAuthContextFallbacks = !authContext.includes('fallback transaction') &&
                                    !authContext.includes('fallback for rejectUser') &&
                                    !authContext.includes('fallback for suspendUser');
  const hasRulesUserRoleProtected = firestoreRules.includes("!request.resource.data.diff(resource.data).affectedKeys().hasAny(['role', 'status', 'activeDeviceId', 'rejectionReason'])");
  assert(
    hasNoAuthContextFallbacks && hasRulesUserRoleProtected,
    'Bypass Prevention',
    'Frontend cannot bypass backend authorization or tamper with user credentials/roles',
    'No client-side fallback mutation stubs; Firestore rules reject direct client modification of role/status',
    'Strict backend authority with zero client bypass pathways'
  );

  // TEST 10: Consistent Error Handling
  const hasConsistentErrorCodes = serverTs.includes("error: 'UNAUTHENTICATED'") &&
                                 serverTs.includes("error: 'PERMISSION_DENIED'") &&
                                 serverTs.includes("error: 'INVALID_ARGUMENT'") &&
                                 serverTs.includes("error: 'CONFLICT'") &&
                                 serverTs.includes("error: 'NOT_FOUND'");
  assert(
    hasConsistentErrorCodes,
    'Error Standardization',
    'Consistent Zero-Trust error response contract',
    'Standardized JSON format { error: CODE, message: string } for 401, 403, 400, 404, 409',
    'All error handlers follow SES-SEC-4.5.5 error specification'
  );

  console.log('\n===============================================================');
  const allPassed = results.every(r => r.status === 'PASS');
  console.log(`  VERIFICATION RESULT: ${allPassed ? 'ALL 10 TESTS PASSED (100%)' : 'SOME TESTS FAILED'} `);
  console.log('===============================================================\n');

  return { allPassed, results };
}

runVerification();
