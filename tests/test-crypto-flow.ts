import crypto from 'crypto';

async function testCrypto() {
  const subtle = crypto.webcrypto.subtle;

  // 1. Client creates ECDSA P-256 keypair
  const keyPair = await subtle.generateKey(
    { name: 'ECDSA', namedCurve: 'P-256' },
    true, // For test export
    ['sign', 'verify']
  );

  // 2. Client exports JWK
  const pubJwk = await subtle.exportKey('jwk', keyPair.publicKey);

  // 3. Server generates nonce
  const nonceHex = crypto.randomBytes(32).toString('hex');
  const nonceBytes = Buffer.from(nonceHex, 'hex');

  // 4. Client signs nonce
  const signature = await subtle.sign(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    keyPair.privateKey,
    nonceBytes
  );
  const signatureHex = Buffer.from(signature).toString('hex');

  // 5. Server imports JWK and verifies signature
  const serverPubKey = await subtle.importKey(
    'jwk',
    pubJwk,
    { name: 'ECDSA', namedCurve: 'P-256' },
    false,
    ['verify']
  );

  const isValid = await subtle.verify(
    { name: 'ECDSA', hash: { name: 'SHA-256' } },
    serverPubKey,
    Buffer.from(signatureHex, 'hex'),
    nonceBytes
  );

  console.log('Crypto verification test result:', isValid);
  if (!isValid) process.exit(1);
}

testCrypto();
