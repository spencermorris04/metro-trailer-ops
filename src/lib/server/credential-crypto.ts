import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";

function getEncryptionSecret() {
  return (
    process.env.QUICKBOOKS_TOKEN_ENCRYPTION_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    process.env.ESIGN_SECRET?.trim() ||
    "metro-trailer-dev-secret"
  );
}

function getKey() {
  return createHash("sha256").update(getEncryptionSecret()).digest();
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const ciphertext = Buffer.concat([
    cipher.update(value, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();

  return `${iv.toString("base64url")}.${authTag.toString("base64url")}.${ciphertext.toString("base64url")}`;
}

export function decryptSecret(value: string | null | undefined) {
  if (!value) {
    return null;
  }

  const [ivEncoded, authTagEncoded, ciphertextEncoded] = value.split(".");
  if (!ivEncoded || !authTagEncoded || !ciphertextEncoded) {
    throw new Error("Encrypted secret payload is malformed.");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    getKey(),
    Buffer.from(ivEncoded, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(authTagEncoded, "base64url"));

  const plaintext = Buffer.concat([
    decipher.update(Buffer.from(ciphertextEncoded, "base64url")),
    decipher.final(),
  ]);

  return plaintext.toString("utf8");
}
