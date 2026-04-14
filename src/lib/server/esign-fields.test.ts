import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDefaultSigningFields,
  getSignerFields,
  parseSignatureAppearanceDataUrl,
} from "@/lib/server/esign-fields";

test("buildDefaultSigningFields creates ordered fields per signer", () => {
  const fields = buildDefaultSigningFields([
    { signerId: "signer_a" },
    { signerId: "signer_b" },
  ]);

  assert.equal(fields.length, 6);
  assert.deepEqual(
    getSignerFields(fields, "signer_a").map((field) => field.kind),
    ["signature", "title", "date"],
  );
  assert.equal(getSignerFields(fields, "signer_a")[0]?.page, 2);
  assert.equal(getSignerFields(fields, "signer_b")[0]?.page, 3);
});

test("parseSignatureAppearanceDataUrl accepts png payloads", () => {
  const payload = Buffer.from("metro-trailer").toString("base64");
  const parsed = parseSignatureAppearanceDataUrl(`data:image/png;base64,${payload}`);

  assert.equal(parsed.mimeType, "image/png");
  assert.equal(parsed.buffer.toString("utf8"), "metro-trailer");
});

test("parseSignatureAppearanceDataUrl rejects unsupported payloads", () => {
  assert.throws(
    () => parseSignatureAppearanceDataUrl("data:image/svg+xml;base64,AAAA"),
    /PNG or JPEG/,
  );
});
