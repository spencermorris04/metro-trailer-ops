import { numericToNumber } from "@/lib/server/production-utils";

export type LineImportState = {
  done: boolean;
  recordsSeen: number;
  total: number | null;
};

export function payloadText(
  payload: Record<string, unknown> | null | undefined,
  keys: string[],
) {
  if (!payload) {
    return null;
  }
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
    if (typeof value === "number" && Number.isFinite(value)) {
      return String(value);
    }
  }
  return null;
}

export function payloadAmount(
  payload: Record<string, unknown> | null | undefined,
  keys: string[],
) {
  if (!payload) {
    return null;
  }
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      return value;
    }
    if (typeof value === "string" && value.trim()) {
      const parsed = Number.parseFloat(value);
      if (Number.isFinite(parsed)) {
        return parsed;
      }
    }
  }
  return null;
}

export function readLineImportState(checkpointData: unknown): LineImportState {
  if (!checkpointData || typeof checkpointData !== "object") {
    return {
      done: false,
      recordsSeen: 0,
      total: null,
    };
  }
  const data = checkpointData as Record<string, unknown>;
  const recordsSeen =
    typeof data.recordsSeen === "number" && Number.isFinite(data.recordsSeen)
      ? data.recordsSeen
      : 0;
  const total =
    typeof data.total === "number" && Number.isFinite(data.total) ? data.total : null;
  return {
    done: data.done === true,
    recordsSeen,
    total,
  };
}

export function getBusinessCentralInvoiceStatus(input: {
  documentType: string | null;
  lineCount: number;
  lineImportComplete: boolean;
}) {
  if (input.documentType === "Posted Credit Memo") {
    return "Credit Memo";
  }
  if (input.lineCount <= 0) {
    return "Lines pending";
  }
  return input.lineImportComplete ? "Lines imported" : "Lines partial";
}

export function getBusinessCentralInvoiceAmount(input: {
  lineCount: number;
  lineTotal: string | number | null | undefined;
  sourcePayload: Record<string, unknown> | null | undefined;
}) {
  if (input.lineCount > 0) {
    return {
      amount: numericToNumber(input.lineTotal),
      source: "rmi_lines" as const,
    };
  }
  return {
    amount:
      payloadAmount(input.sourcePayload, [
        "AmountIncludingVAT",
        "Amount",
        "TotalAmount",
        "Total",
      ]) ?? 0,
    source: "header_payload" as const,
  };
}
