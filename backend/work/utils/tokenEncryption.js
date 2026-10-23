import crypto from "crypto";

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits recommended for AES-GCM
const TAG_LENGTH = 16; // 128 bits authentication tag

/**
 * Retrieves the encryption key from environment variable CHEENI_TOKEN_ENCRYPTION_KEY.
 * Must be a 32-byte hex string (64 characters) or 32 raw bytes.
 * Throws if absent or invalid.
 */
export function getEncryptionKey() {
  const keyHex = process.env.CHEENI_TOKEN_ENCRYPTION_KEY;
  if (!keyHex || typeof keyHex !== "string" || keyHex.trim().length === 0) {
    throw new Error("CHEENI_TOKEN_ENCRYPTION_KEY is required but not configured");
  }

  const trimmed = keyHex.trim();
  // Support 64-char hex string (32 bytes) or raw 32-char string
  let keyBuffer;
  if (trimmed.length === 64 && /^[0-9a-fA-F]+$/.test(trimmed)) {
    keyBuffer = Buffer.from(trimmed, "hex");
  } else if (Buffer.byteLength(trimmed, "utf8") === 32) {
    keyBuffer = Buffer.from(trimmed, "utf8");
  } else {
    // If provided as a base64 string
    const b64 = Buffer.from(trimmed, "base64");
    if (b64.length === 32) {
      keyBuffer = b64;
    } else {
      throw new Error("CHEENI_TOKEN_ENCRYPTION_KEY must resolve to exactly 32 bytes (e.g. 64-character hex)");
    }
  }
  return keyBuffer;
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Returns an envelope object with base64 encoded { iv, ciphertext, tag }.
 */
export function encryptToken(plaintext, keyOverride = null) {
  if (typeof plaintext !== "string") {
    throw new TypeError("Plaintext must be a string");
  }

  const key = keyOverride || getEncryptionKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });

  let ciphertext = cipher.update(plaintext, "utf8", "base64");
  ciphertext += cipher.final("base64");
  const tag = cipher.getAuthTag();

  return {
    iv: iv.toString("base64"),
    ciphertext,
    tag: tag.toString("base64"),
  };
}

/**
 * Decrypts an envelope { iv, ciphertext, tag } using AES-256-GCM.
 * Returns the decrypted plaintext string.
 * Throws if authentication fails or envelope is invalid.
 */
export function decryptToken(envelope, keyOverride = null) {
  if (!envelope || typeof envelope !== "object") {
    throw new TypeError("Envelope must be an object with iv, ciphertext, and tag");
  }

  const { iv, ciphertext, tag } = envelope;
  if (!iv || !ciphertext || !tag) {
    throw new Error("Invalid envelope: missing iv, ciphertext, or tag");
  }

  const key = keyOverride || getEncryptionKey();
  const ivBuffer = Buffer.from(iv, "base64");
  const tagBuffer = Buffer.from(tag, "base64");
  const decipher = crypto.createDecipheriv(ALGORITHM, key, ivBuffer, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tagBuffer);

  let decrypted = decipher.update(ciphertext, "base64", "utf8");
  decrypted += decipher.final("utf8");
  return decrypted;
}
