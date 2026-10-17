import crypto from "node:crypto";

/**
 * CareConnect Field Encryption Utility
 * Implements AES-256-GCM for sensitive column encryption at rest (PHI / PII)
 * such as patient names, contact numbers, caregiver details.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits recommended for GCM
const AUTH_TAG_LENGTH = 16;
const PREFIX = "enc:v1";

// 32-byte master key derived from environment or secure fallback for dev
function getMasterKey(): Buffer {
  const secret = process.env.ENCRYPTION_KEY || "careconnect-default-secret-key-32b!";
  return crypto.createHash("sha256").update(secret).digest();
}

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * Output format: enc:v1:<iv_hex>:<authTag_hex>:<ciphertext_hex>
 */
export function encryptField(plaintext: string | null | undefined): string | null {
  if (plaintext === null || plaintext === undefined || plaintext === "") {
    return plaintext ?? null;
  }

  // Already encrypted?
  if (typeof plaintext === "string" && plaintext.startsWith(PREFIX)) {
    return plaintext;
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, getMasterKey(), iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  let encrypted = cipher.update(plaintext, "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");

  return `${PREFIX}:${iv.toString("hex")}:${authTag}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM encrypted string.
 * Gracefully handles unencrypted strings for backward compatibility.
 */
export function decryptField(ciphertext: string | null | undefined): string | null {
  if (ciphertext === null || ciphertext === undefined || ciphertext === "") {
    return ciphertext ?? null;
  }

  if (typeof ciphertext !== "string" || !ciphertext.startsWith(PREFIX)) {
    // If not encrypted, return as-is
    return ciphertext;
  }

  const parts = ciphertext.split(":");
  if (parts.length !== 5) {
    return ciphertext;
  }

  const [, , ivHex, authTagHex, encHex] = parts;

  try {
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const decipher = crypto.createDecipheriv(ALGORITHM, getMasterKey(), iv, {
      authTagLength: AUTH_TAG_LENGTH,
    });
    decipher.setAuthTag(authTag);

    let decrypted = decipher.update(encHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    console.warn("[Crypto] Decryption failed, returning redacted marker:", err instanceof Error ? err.message : err);
    return "[DECRYPTION_ERROR]";
  }
}

/**
 * PII Masking Utilities - Never log patient names or raw phone numbers!
 */
export function maskPhone(phone: string | null | undefined): string {
  if (!phone) return "N/A";
  const cleaned = phone.replace(/\D/g, "");
  if (cleaned.length < 4) return "***-****";
  return `***-***-${cleaned.slice(-4)}`;
}

export function maskName(name: string | null | undefined): string {
  if (!name) return "Anonymous";
  const parts = name.trim().split(/\s+/);
  return parts.map((p) => (p.length > 0 ? `${p[0]}***` : "")).join(" ");
}
