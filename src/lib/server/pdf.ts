import PDFDocument from "pdfkit";

import { formatCurrency, formatDate, titleize } from "@/lib/format";
import type {
  AssetRecord,
  ContractRecord,
  CustomerRecord,
  InvoiceRecord,
} from "@/lib/domain/models";
import type {
  SignatureRequestRecord,
  SignatureSignerRecord,
} from "@/lib/platform-types";

function streamToBuffer(document: PDFKit.PDFDocument) {
  return new Promise<Buffer>((resolve, reject) => {
    const chunks: Buffer[] = [];

    document.on("data", (chunk) => chunks.push(Buffer.from(chunk)));
    document.on("end", () => resolve(Buffer.concat(chunks)));
    document.on("error", (error) => reject(error));
    document.end();
  });
}

function createLetterDocument() {
  return new PDFDocument({
    margin: 48,
    size: "LETTER",
  });
}

function writeSectionTitle(document: PDFKit.PDFDocument, title: string) {
  document.moveDown(0.6);
  document.fontSize(13).fillColor("#16232b").text(title, {
    underline: true,
  });
  document.moveDown(0.35);
}

function writeKeyValue(
  document: PDFKit.PDFDocument,
  label: string,
  value: string,
) {
  document
    .fontSize(10)
    .fillColor("#5d6870")
    .text(`${label}: `, { continued: true })
    .fillColor("#16232b")
    .text(value);
}

function renderContractSnapshot(document: PDFKit.PDFDocument, options: {
  contract: ContractRecord;
  customer: CustomerRecord;
  assets: AssetRecord[];
}) {
  writeSectionTitle(document, "Contract Summary");
  writeKeyValue(document, "Contract", options.contract.contractNumber);
  writeKeyValue(document, "Customer", options.contract.customerName);
  writeKeyValue(document, "Branch", options.contract.branch);
  writeKeyValue(document, "Site", options.contract.locationName);
  writeKeyValue(document, "Lifecycle status", titleize(options.contract.status));
  writeKeyValue(document, "Start date", formatDate(options.contract.startDate));
  writeKeyValue(
    document,
    "End date",
    options.contract.endDate ? formatDate(options.contract.endDate) : "Open ended",
  );
  writeKeyValue(document, "Contract value", formatCurrency(options.contract.value));
  writeKeyValue(document, "Customer number", options.customer.customerNumber);

  writeSectionTitle(document, "Equipment Schedule");
  options.assets.forEach((asset) => {
    document
      .fontSize(11)
      .fillColor("#16232b")
      .text(`${asset.assetNumber} - ${titleize(asset.type)}`);
    document
      .fontSize(10)
      .fillColor("#5d6870")
      .text(
        `${asset.dimensions} | ${asset.branch} | ${titleize(asset.status)} | Features: ${asset.features.join(", ")}`,
        {
          lineGap: 3,
        },
      );
    document.moveDown(0.4);
  });

  writeSectionTitle(document, "Electronic Signature Terms");
  document
    .fontSize(10)
    .fillColor("#16232b")
    .text(
      "This packet is prepared for Metro Trailer electronic execution. Signers must review the agreement, consent to transact electronically, and adopt their typed name as their signature.",
      {
        lineGap: 4,
      },
    )
    .moveDown(0.3)
    .fillColor("#5d6870")
    .text(
      "Operational recordkeeping remains internal to Metro Trailer. Every signature event is timestamped and associated with signer identity, network information, and document hashes for audit review.",
      {
        lineGap: 4,
      },
    );
}

function renderSignatureEvidence(
  document: PDFKit.PDFDocument,
  signers: SignatureSignerRecord[],
) {
  writeSectionTitle(document, "Signature Evidence");

  signers.forEach((signer) => {
    document
      .fontSize(11)
      .fillColor("#16232b")
      .text(`${signer.name} (${signer.email})`);

    writeKeyValue(document, "Role", signer.title ?? "Not provided");
    writeKeyValue(document, "Routing order", String(signer.routingOrder));
    writeKeyValue(document, "Status", titleize(signer.status));
    writeKeyValue(document, "Requested at", formatDate(signer.requestedAt));
    writeKeyValue(
      document,
      "Viewed at",
      signer.viewedAt ? new Date(signer.viewedAt).toLocaleString("en-US") : "Not viewed",
    );
    writeKeyValue(
      document,
      "Signed at",
      signer.signedAt ? new Date(signer.signedAt).toLocaleString("en-US") : "Not signed",
    );
    writeKeyValue(document, "Signature text", signer.signatureText ?? "Pending");
    writeKeyValue(document, "IP address", signer.ipAddress ?? "Not captured");
    writeKeyValue(
      document,
      "User agent",
      signer.userAgent ? signer.userAgent.slice(0, 96) : "Not captured",
    );
    writeKeyValue(document, "Evidence hash", signer.evidenceHash ?? "Pending");
    document.moveDown(0.75);
  });
}

export async function renderInvoicePdf(options: {
  invoice: InvoiceRecord;
  customerName: string;
  lineItems: Array<{
    description: string;
    amount: number;
  }>;
}) {
  const document = createLetterDocument();

  document.fontSize(24).fillColor("#16232b").text("Metro Trailer");
  document
    .fontSize(11)
    .fillColor("#5d6870")
    .text("Rental operations invoice", { paragraphGap: 18 });

  document
    .fontSize(12)
    .fillColor("#16232b")
    .text(`Invoice: ${options.invoice.invoiceNumber}`)
    .text(`Customer: ${options.customerName}`)
    .text(`Contract: ${options.invoice.contractNumber}`)
    .text(`Invoice date: ${formatDate(options.invoice.invoiceDate)}`)
    .text(`Due date: ${formatDate(options.invoice.dueDate)}`)
    .moveDown();

  document.fontSize(13).fillColor("#16232b").text("Line items", {
    underline: true,
  });
  document.moveDown(0.5);

  options.lineItems.forEach((lineItem) => {
    document
      .fontSize(11)
      .fillColor("#16232b")
      .text(lineItem.description, { continued: true })
      .text(formatCurrency(lineItem.amount), {
        align: "right",
      });
  });

  document.moveDown();
  document
    .fontSize(12)
    .fillColor("#16232b")
    .text(`Balance due: ${formatCurrency(options.invoice.balanceAmount)}`, {
      align: "right",
    })
    .moveDown();

  document
    .fontSize(10)
    .fillColor("#5d6870")
    .text(
      "This PDF was generated by Metro Trailer for operational billing review. Posted accounting and payment execution may sync through QuickBooks Online and Stripe.",
      {
        lineGap: 4,
      },
    );

  return streamToBuffer(document);
}

export async function renderOperationalDocumentPdf(options: {
  contractNumber: string;
  customerName: string;
  documentType: string;
  filename: string;
}) {
  const document = createLetterDocument();

  document.fontSize(24).fillColor("#16232b").text("Metro Trailer");
  document
    .fontSize(12)
    .fillColor("#5d6870")
    .text("Operational document", { paragraphGap: 16 });

  writeKeyValue(document, "Contract", options.contractNumber);
  writeKeyValue(document, "Customer", options.customerName);
  writeKeyValue(document, "Document type", titleize(options.documentType));
  writeKeyValue(document, "Filename", options.filename);

  writeSectionTitle(document, "Retention Notice");
  document
    .fontSize(10)
    .fillColor("#16232b")
    .text(
      "This artifact was generated inside Metro Trailer and stored with immutable-retention intent for operational auditability. Archived status does not remove the underlying retained document record.",
      {
        lineGap: 4,
      },
    );

  return streamToBuffer(document);
}

export async function renderContractSignaturePacketPdf(options: {
  contract: ContractRecord;
  customer: CustomerRecord;
  assets: AssetRecord[];
  title: string;
  subject: string;
  message: string;
  signers: SignatureSignerRecord[];
}) {
  const document = createLetterDocument();

  document.fontSize(24).fillColor("#16232b").text("Metro Trailer");
  document
    .fontSize(12)
    .fillColor("#5d6870")
    .text("Electronic rental agreement packet", {
      paragraphGap: 14,
    });

  document
    .fontSize(15)
    .fillColor("#16232b")
    .text(options.title)
    .moveDown(0.3)
    .fontSize(10)
    .fillColor("#5d6870")
    .text(options.subject)
    .moveDown(0.3)
    .text(options.message, {
      lineGap: 4,
    });

  renderContractSnapshot(document, options);

  writeSectionTitle(document, "Signers");
  options.signers.forEach((signer) => {
    document
      .fontSize(11)
      .fillColor("#16232b")
      .text(`${signer.routingOrder}. ${signer.name}`)
      .fontSize(10)
      .fillColor("#5d6870")
      .text(`${signer.email} | ${signer.title ?? "No title provided"}`);
  });

  return streamToBuffer(document);
}

export async function renderSignatureCertificatePdf(options: {
  request: SignatureRequestRecord;
}) {
  const document = createLetterDocument();

  document.fontSize(24).fillColor("#16232b").text("Metro Trailer");
  document
    .fontSize(12)
    .fillColor("#5d6870")
    .text("Electronic signature certificate", {
      paragraphGap: 16,
    });

  writeKeyValue(document, "Signature request", options.request.id);
  writeKeyValue(document, "Contract", options.request.contractNumber);
  writeKeyValue(document, "Customer", options.request.customerName);
  writeKeyValue(document, "Status", titleize(options.request.status));
  writeKeyValue(
    document,
    "Requested at",
    new Date(options.request.requestedAt).toLocaleString("en-US"),
  );
  writeKeyValue(
    document,
    "Completed at",
    options.request.completedAt
      ? new Date(options.request.completedAt).toLocaleString("en-US")
      : "Pending",
  );
  writeKeyValue(document, "Consent version", options.request.consentTextVersion);
  writeKeyValue(document, "Request evidence hash", options.request.evidenceHash ?? "Pending");

  renderSignatureEvidence(document, options.request.signers);

  return streamToBuffer(document);
}

export async function renderSignedContractPdf(options: {
  contract: ContractRecord;
  customer: CustomerRecord;
  assets: AssetRecord[];
  request: SignatureRequestRecord;
}) {
  const document = createLetterDocument();

  document.fontSize(24).fillColor("#16232b").text("Metro Trailer");
  document
    .fontSize(12)
    .fillColor("#5d6870")
    .text("Signed rental agreement", {
      paragraphGap: 14,
    });

  document
    .fontSize(15)
    .fillColor("#16232b")
    .text(options.request.title)
    .moveDown(0.3)
    .fontSize(10)
    .fillColor("#5d6870")
    .text(options.request.subject)
    .moveDown(0.3)
    .text(options.request.message, {
      lineGap: 4,
    });

  renderContractSnapshot(document, options);

  document.addPage();
  document.fontSize(18).fillColor("#16232b").text("Execution Certificate");
  document
    .moveDown(0.4)
    .fontSize(10)
    .fillColor("#5d6870")
    .text(options.request.certificationText, {
      lineGap: 4,
    });

  renderSignatureEvidence(document, options.request.signers);

  return streamToBuffer(document);
}
