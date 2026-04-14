import type { SignatureFieldRecord } from "@/lib/platform-types";

export const SIGNING_PAGE_WIDTH = 612;
export const SIGNING_PAGE_HEIGHT = 792;

const SIGNATURE_FIELD_X = 72;
const SIGNATURE_FIELD_Y = 268;
const SIGNATURE_FIELD_WIDTH = 320;
const SIGNATURE_FIELD_HEIGHT = 92;
const TITLE_FIELD_X = 72;
const TITLE_FIELD_Y = 404;
const TITLE_FIELD_WIDTH = 236;
const TITLE_FIELD_HEIGHT = 30;
const DATE_FIELD_X = 332;
const DATE_FIELD_Y = 404;
const DATE_FIELD_WIDTH = 168;
const DATE_FIELD_HEIGHT = 30;
const SIGNATURE_MAX_BYTES = 2 * 1024 * 1024;

export function buildDefaultSigningFields(
  signers: Array<{
    signerId: string;
  }>,
) {
  return signers.flatMap((signer, index) => {
    const page = index + 2;

    return [
      {
        id: `${signer.signerId}-signature`,
        signerId: signer.signerId,
        kind: "signature",
        label: "Signature",
        page,
        x: SIGNATURE_FIELD_X,
        y: SIGNATURE_FIELD_Y,
        width: SIGNATURE_FIELD_WIDTH,
        height: SIGNATURE_FIELD_HEIGHT,
        required: true,
        navigationOrder: 1,
      },
      {
        id: `${signer.signerId}-title`,
        signerId: signer.signerId,
        kind: "title",
        label: "Title",
        page,
        x: TITLE_FIELD_X,
        y: TITLE_FIELD_Y,
        width: TITLE_FIELD_WIDTH,
        height: TITLE_FIELD_HEIGHT,
        required: false,
        navigationOrder: 2,
      },
      {
        id: `${signer.signerId}-date`,
        signerId: signer.signerId,
        kind: "date",
        label: "Signing date",
        page,
        x: DATE_FIELD_X,
        y: DATE_FIELD_Y,
        width: DATE_FIELD_WIDTH,
        height: DATE_FIELD_HEIGHT,
        required: true,
        navigationOrder: 3,
      },
    ] satisfies SignatureFieldRecord[];
  });
}

export function getSignerFields(
  fields: SignatureFieldRecord[],
  signerId: string,
) {
  return fields
    .filter((field) => field.signerId === signerId)
    .sort((left, right) => left.navigationOrder - right.navigationOrder);
}

export function parseSignatureAppearanceDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/=]+)$/);
  if (!match) {
    throw new Error("Signature appearance must be a PNG or JPEG data URL.");
  }

  const [, mimeType, encoded] = match;
  const buffer = Buffer.from(encoded, "base64");

  if (buffer.length === 0 || buffer.length > SIGNATURE_MAX_BYTES) {
    throw new Error("Signature appearance must be smaller than 2 MB.");
  }

  return {
    mimeType,
    buffer,
  };
}
