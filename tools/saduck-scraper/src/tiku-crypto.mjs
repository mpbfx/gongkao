import crypto from "node:crypto";

export const REQUEST_KEY = "kxZ17XQ8z6957n3S";
export const ITEMIZES_KEY = "7SyqrN6925ZYb636";

function normalizeBase64Url(value) {
  return value.replace(/-/g, "+").replace(/_/g, "/");
}

function toBase64Url(value) {
  return value.replace(/\//g, "_").replace(/\+/g, "-");
}

export function encryptRequestParam(value, key = REQUEST_KEY) {
  const cipher = crypto.createCipheriv("aes-128-ecb", Buffer.from(key, "utf8"), null);
  cipher.setAutoPadding(true);
  const encrypted = Buffer.concat([
    cipher.update(String(value), "utf8"),
    cipher.final()
  ]).toString("base64");
  return toBase64Url(encrypted);
}

export function decryptSaduckJson(value, key = ITEMIZES_KEY) {
  const decipher = crypto.createDecipheriv("aes-128-ecb", Buffer.from(key, "utf8"), null);
  decipher.setAutoPadding(true);
  const decrypted = Buffer.concat([
    decipher.update(normalizeBase64Url(value), "base64"),
    decipher.final()
  ]).toString("utf8");
  return JSON.parse(decrypted);
}
