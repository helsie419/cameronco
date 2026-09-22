#!/usr/bin/env node
import { randomBytes } from 'node:crypto';

process.env.XERO_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString('base64');
process.env.XERO_CONNECT_SECRET = 'local-connect-secret';

const {
  connectSecretIsValid,
  createOAuthState,
  decryptXeroToken,
  encryptXeroToken,
  hashOAuthState,
} = await import('../netlify/functions/lib/xero-security.mjs');

function expect(condition, message) {
  if (!condition) throw new Error(message);
}

const token = 'not-a-real-xero-token';
const encrypted = encryptXeroToken(token);
expect(encrypted.startsWith('v1.'), 'Tokens must use the versioned encrypted format.');
expect(encrypted !== token, 'Token must not be stored as plaintext.');
expect(decryptXeroToken(encrypted) === token, 'Encrypted token round trip failed.');
expect(connectSecretIsValid('local-connect-secret'), 'Valid connect secret was rejected.');
expect(!connectSecretIsValid('wrong-secret'), 'Invalid connect secret was accepted.');
const state = createOAuthState();
expect(state.length >= 32 && hashOAuthState(state) !== state, 'OAuth state must be random and stored as a hash.');

console.log('Xero security checks passed: encrypted token storage, connect-secret gate, and hashed OAuth state.');
