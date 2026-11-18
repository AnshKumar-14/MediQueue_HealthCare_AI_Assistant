const crypto = require("crypto");

const ALGORITHM = "aes-256-gcm";

function deriveKey(secret) {
  return crypto.createHash("sha256").update(secret).digest();
}

function getKey() {
  const secret =
    process.env.DATA_ENCRYPTION_KEY ||
    process.env.JWT_SECRET ||
    "mediqueue-development-key";
  return deriveKey(secret);
}

/**
 * Keys that older records may have been encrypted with. Before a dedicated
 * DATA_ENCRYPTION_KEY was configured, everything used JWT_SECRET. Keeping that
 * key as a decryption fallback means setting DATA_ENCRYPTION_KEY later does not
 * make existing chat, intake or medical records unreadable.
 */
function getLegacyKeys() {
  const keys = [];
  const jwtSecret = process.env.JWT_SECRET;
  if (process.env.DATA_ENCRYPTION_KEY && jwtSecret) {
    keys.push(deriveKey(jwtSecret));
  }
  return keys;
}

function encrypt(plainText) {
  if (plainText === undefined || plainText === null || plainText === "") {
    return "";
  }

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([
    cipher.update(String(plainText), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [iv.toString("base64"), tag.toString("base64"), encrypted.toString("base64")].join(":");
}

function decryptWith(key, payload) {
  const [ivPart, tagPart, dataPart] = payload.split(":");
  if (!ivPart || !tagPart || !dataPart) return "";

  const decipher = crypto.createDecipheriv(
    ALGORITHM,
    key,
    Buffer.from(ivPart, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagPart, "base64"));

  return Buffer.concat([
    decipher.update(Buffer.from(dataPart, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

function decrypt(payload) {
  if (!payload) return "";

  for (const key of [getKey(), ...getLegacyKeys()]) {
    try {
      const plainText = decryptWith(key, payload);
      if (plainText !== "") return plainText;
    } catch {
      // Try the next key. A failed auth tag means this key is not the one
      // that encrypted the payload.
    }
  }

  return "";
}

module.exports = { encrypt, decrypt };
