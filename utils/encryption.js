// backend/utils/encryption.js
import crypto from 'crypto';

// IMPORTANT: These should be robustly managed environment variables!
// Generate strong random keys for production. Never hardcode in production.
const ENCRYPTION_KEY = process.env.PAYMENT_LINK_ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex'); // 32 bytes for AES-256
const IV_LENGTH = 16; // For AES, this is always 16 bytes

export function encrypt(text) {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decrypt(text) {
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift(), 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

console.log("Encryption Key Initialized (For Dev/Test):", ENCRYPTION_KEY); // For debugging