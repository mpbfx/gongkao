import assert from "node:assert/strict";
import test from "node:test";
import { decryptSaduckJson, encryptRequestParam } from "../src/tiku-crypto.mjs";

test("encrypts request params with SaDuck AES url-safe base64 shape", () => {
  const encrypted = encryptRequestParam("12345");
  assert.equal(typeof encrypted, "string");
  assert.doesNotMatch(encrypted, /[+/]/);
});

test("decrypts JSON encrypted with matching key", () => {
  const encrypted = encryptRequestParam(JSON.stringify([{ id: 1, title: "试卷" }]), "7SyqrN6925ZYb636");
  assert.deepEqual(decryptSaduckJson(encrypted, "7SyqrN6925ZYb636"), [{ id: 1, title: "试卷" }]);
});
