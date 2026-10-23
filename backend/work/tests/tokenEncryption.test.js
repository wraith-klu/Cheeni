import crypto from "crypto";
import { describe, expect, it } from "vitest";
import {
  decryptToken,
  encryptToken,
  getEncryptionKey,
} from "../utils/tokenEncryption.js";

const TEST_KEY = crypto.randomBytes(32).toString("hex");

describe("tokenEncryption utility (Phase 7)", () => {
  it("throws when CHEENI_TOKEN_ENCRYPTION_KEY is unset and no override provided", () => {
    const prev = process.env.CHEENI_TOKEN_ENCRYPTION_KEY;
    delete process.env.CHEENI_TOKEN_ENCRYPTION_KEY;
    try {
      expect(() => getEncryptionKey()).toThrow(/CHEENI_TOKEN_ENCRYPTION_KEY is required/);
    } finally {
      if (prev) process.env.CHEENI_TOKEN_ENCRYPTION_KEY = prev;
    }
  });

  it("encrypts and decrypts round-trip accurately", () => {
    process.env.CHEENI_TOKEN_ENCRYPTION_KEY = TEST_KEY;
    const plaintext = "ya29.a0AfH6SMD-google-oauth-access-token-example";
    const envelope = encryptToken(plaintext);

    expect(envelope).toHaveProperty("iv");
    expect(envelope).toHaveProperty("ciphertext");
    expect(envelope).toHaveProperty("tag");
    expect(envelope.ciphertext).not.toBe(plaintext);

    const decrypted = decryptToken(envelope);
    expect(decrypted).toBe(plaintext);
  });

  it("produces distinct IVs and ciphertexts for subsequent calls with same plaintext", () => {
    process.env.CHEENI_TOKEN_ENCRYPTION_KEY = TEST_KEY;
    const plaintext = "secret-refresh-token-12345";
    const env1 = encryptToken(plaintext);
    const env2 = encryptToken(plaintext);

    expect(env1.iv).not.toBe(env2.iv);
    expect(env1.ciphertext).not.toBe(env2.ciphertext);
    expect(decryptToken(env1)).toBe(plaintext);
    expect(decryptToken(env2)).toBe(plaintext);
  });

  it("throws error when ciphertext is tampered with", () => {
    process.env.CHEENI_TOKEN_ENCRYPTION_KEY = TEST_KEY;
    const envelope = encryptToken("confidential-token");
    const tamperedCiphertext = Buffer.from("corrupted" + envelope.ciphertext).toString("base64");
    const tamperedEnvelope = { ...envelope, ciphertext: tamperedCiphertext };

    expect(() => decryptToken(tamperedEnvelope)).toThrow();
  });

  it("throws error when auth tag is tampered with", () => {
    process.env.CHEENI_TOKEN_ENCRYPTION_KEY = TEST_KEY;
    const envelope = encryptToken("confidential-token");
    const tamperedTag = Buffer.from(envelope.tag, "base64");
    tamperedTag[0] ^= 0xff; // flip bits
    const tamperedEnvelope = { ...envelope, tag: tamperedTag.toString("base64") };

    expect(() => decryptToken(tamperedEnvelope)).toThrow();
  });
});
