import { createHash } from "node:crypto";

import type { InvoiceRecord } from "@/lib/domain/models";
import {
  buildInvoiceStorageKey,
  fetchStoredBuffer,
  fetchStoredBufferIfExists,
  getS3Bucket,
  isS3StorageEnabled,
  storeBuffer,
} from "@/lib/server/object-storage";
import { renderInvoicePdf } from "@/lib/server/pdf";

type InvoicePdfLineItem = {
  description: string;
  amount: number;
};

export async function getInvoicePdfArtifact(options: {
  invoice: InvoiceRecord;
  lineItems: InvoicePdfLineItem[];
}) {
  const filename = `${options.invoice.invoiceNumber}.pdf`;
  const storageKey = buildInvoiceStorageKey(options.invoice.invoiceNumber);
  const storageBucket = getS3Bucket();

  if (isS3StorageEnabled() && storageBucket) {
    const existing = await fetchStoredBufferIfExists({
      storageBucket,
      storageKey,
    });

    if (existing) {
      return {
        body: existing,
        filename,
        contentType: "application/pdf",
        hash: createHash("sha256").update(existing).digest("hex"),
        storageProvider: "s3" as const,
      };
    }
  }

  const pdf = await renderInvoicePdf({
    invoice: options.invoice,
    customerName: options.invoice.customerName,
    lineItems: options.lineItems,
  });

  const stored = await storeBuffer({
    key: storageKey,
    body: pdf,
    contentType: "application/pdf",
    retentionMode: "governance",
    metadata: {
      artifactType: "invoice_pdf",
      invoiceNumber: options.invoice.invoiceNumber,
      contractNumber: options.invoice.contractNumber,
      customerName: options.invoice.customerName,
    },
  });

  const body =
    stored.storageProvider === "s3" && stored.storageBucket && stored.storageKey
      ? await fetchStoredBuffer({
          storageBucket: stored.storageBucket,
          storageKey: stored.storageKey,
          storageVersionId: stored.storageVersionId,
        })
      : pdf;

  return {
    body,
    filename,
    contentType: "application/pdf",
    hash: createHash("sha256").update(pdf).digest("hex"),
    storageProvider: stored.storageProvider,
  };
}
