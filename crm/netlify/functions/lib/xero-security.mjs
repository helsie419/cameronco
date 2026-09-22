import { createCipheriv, createDecipheriv, createHash, randomBytes, timingSafeEqual } from 'node:crypto';

const TOKEN_VERSION = 'v1';

export function requireXeroConfig() {
  for (const name of ['XERO_CLIENT_ID', 'XERO_CLIENT_SECRET', 'XERO_REDIRECT_URI']) {
    if (!process.env[name]) throw new Error(`${name} is required for Xero OAuth.`);
  }
}

function encryptionKey() {
  const value = process.env.XERO_TOKEN_ENCRYPTION_KEY;
  if (!value) throw new Error('XERO_TOKEN_ENCRYPTION_KEY is required to store Xero tokens securely.');
  const key = Buffer.from(value, 'base64');
  if (key.length !== 32) throw new Error('XERO_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key.');
  return key;
}

export function encryptXeroToken(token) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  const encrypted = Buffer.concat([cipher.update(String(token), 'utf8'), cipher.final()]);
  return [TOKEN_VERSION, iv.toString('base64url'), cipher.getAuthTag().toString('base64url'), encrypted.toString('base64url')].join('.');
}

export function decryptXeroToken(value) {
  const [version, ivText, tagText, encryptedText, extra] = String(value || '').split('.');
  if (version !== TOKEN_VERSION || !ivText || !tagText || !encryptedText || extra) {
    throw new Error('Stored Xero token is not encrypted with the current token format. Reconnect Xero to replace it securely.');
  }
  const decipher = createDecipheriv('aes-256-gcm', encryptionKey(), Buffer.from(ivText, 'base64url'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  return Buffer.concat([decipher.update(Buffer.from(encryptedText, 'base64url')), decipher.final()]).toString('utf8');
}

export function decryptXeroConnection(connection) {
  return {
    ...connection,
    access_token: decryptXeroToken(connection.access_token),
    refresh_token: decryptXeroToken(connection.refresh_token),
  };
}

export function createOAuthState() {
  return randomBytes(32).toString('base64url');
}

export function hashOAuthState(state) {
  return createHash('sha256').update(state).digest('base64url');
}

export function connectSecretIsValid(provided) {
  const configured = process.env.XERO_CONNECT_SECRET;
  if (!configured || !provided) return false;
  const left = Buffer.from(configured);
  const right = Buffer.from(provided);
  return left.length === right.length && timingSafeEqual(left, right);
}

export function xeroBasicAuthorization() {
  requireXeroConfig();
  return `Basic ${Buffer.from(`${process.env.XERO_CLIENT_ID}:${process.env.XERO_CLIENT_SECRET}`).toString('base64')}`;
}
