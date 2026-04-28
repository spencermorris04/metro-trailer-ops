import { eq } from "drizzle-orm";

import { db, schema } from "@/lib/db";
import { ApiError } from "@/lib/server/api";
import { createId, now, numericToNumber } from "@/lib/server/production-utils";

export interface PostJournalEntryInput {
  entryDate: Date;
  description: string;
  sourceType: string;
  sourceId?: string | null;
  postingPeriodId?: string | null;
  currencyCode?: string;
  lines: Array<{
    accountId: string;
    side: "debit" | "credit";
    amount: string;
    description?: string | null;
    customerId?: string | null;
    vendorId?: string | null;
    assetId?: string | null;
    contractId?: string | null;
    branchId?: string | null;
    sourceDocumentType?: string | null;
    sourceDocumentNo?: string | null;
  }>;
}

export interface PostArInvoiceInput {
  invoiceId: string;
  accounts: {
    arAccountId: string;
    revenueAccountId: string;
    taxAccountId?: string | null;
  };
}

export interface PostArReceiptInput {
  receiptId: string;
  accounts: {
    cashAccountId: string;
    arAccountId: string;
  };
}

export interface PostApBillInput {
  billId: string;
  accounts: {
    expenseAccountId: string;
    apAccountId: string;
  };
}

export interface PostApPaymentInput {
  paymentId: string;
  accounts: {
    apAccountId: string;
    cashAccountId: string;
  };
}

export interface PostFaPostingInput {
  faPostingId: string;
  accounts: {
    fixedAssetAccountId: string;
    offsetAccountId: string;
  };
}

function assertBalanced(lines: PostJournalEntryInput["lines"]) {
  const totals = lines.reduce(
    (acc, line) => {
      const amount = Number(line.amount);
      if (!Number.isFinite(amount) || amount <= 0) {
        throw new ApiError(400, "Journal line amounts must be positive.");
      }

      acc[line.side] += amount;
      return acc;
    },
    { debit: 0, credit: 0 },
  );

  if (Math.abs(totals.debit - totals.credit) > 0.0001) {
    throw new ApiError(400, "Journal entry is not balanced.");
  }
}

export async function postJournalEntry(input: PostJournalEntryInput) {
  assertBalanced(input.lines);

  const entryId = createId("glje");
  const entryNumber = `GL-${Date.now()}`;

  await db.transaction(async (tx) => {
    await tx.insert(schema.glJournalEntries).values({
      id: entryId,
      postingPeriodId: input.postingPeriodId ?? null,
      entryNumber,
      entryDate: input.entryDate,
      sourceType: input.sourceType,
      sourceId: input.sourceId ?? null,
      description: input.description,
      status: "posted",
      currencyCode: input.currencyCode ?? "USD",
      postedAt: now(),
      createdAt: now(),
      updatedAt: now(),
    });

    await tx.insert(schema.glJournalLines).values(
      input.lines.map((line, index) => ({
        id: createId("gljl"),
        journalEntryId: entryId,
        lineNo: index + 1,
        accountId: line.accountId,
        side: line.side,
        amount: line.amount,
        description: line.description ?? null,
        customerId: line.customerId ?? null,
        vendorId: line.vendorId ?? null,
        assetId: line.assetId ?? null,
        contractId: line.contractId ?? null,
        branchId: line.branchId ?? null,
        sourceDocumentType: line.sourceDocumentType ?? null,
        sourceDocumentNo: line.sourceDocumentNo ?? null,
        createdAt: now(),
      })),
    );
  });

  return entryId;
}

export async function postArInvoice(input: PostArInvoiceInput) {
  const invoice = await db.query.invoices.findFirst({
    where: eq(schema.invoices.id, input.invoiceId),
  });

  if (!invoice) {
    throw new ApiError(404, `Invoice ${input.invoiceId} was not found.`);
  }

  const totalAmount = numericToNumber(invoice.totalAmount);
  const taxAmount = numericToNumber(invoice.taxAmount);
  const revenueAmount = Math.max(0, totalAmount - taxAmount);

  return postJournalEntry({
    entryDate: invoice.invoiceDate,
    description: `AR invoice ${invoice.invoiceNumber}`,
    sourceType: "ar_invoice",
    sourceId: invoice.id,
    lines: [
      {
        accountId: input.accounts.arAccountId,
        side: "debit",
        amount: totalAmount.toFixed(2),
        customerId: invoice.customerId,
        contractId: invoice.contractId ?? null,
        sourceDocumentType: invoice.sourceDocumentType ?? "invoice",
        sourceDocumentNo: invoice.sourceDocumentNo ?? invoice.invoiceNumber,
      },
      {
        accountId: input.accounts.revenueAccountId,
        side: "credit",
        amount: revenueAmount.toFixed(2),
        customerId: invoice.customerId,
        contractId: invoice.contractId ?? null,
        sourceDocumentType: invoice.sourceDocumentType ?? "invoice",
        sourceDocumentNo: invoice.sourceDocumentNo ?? invoice.invoiceNumber,
      },
      ...(taxAmount > 0 && input.accounts.taxAccountId
        ? [
            {
              accountId: input.accounts.taxAccountId,
              side: "credit" as const,
              amount: taxAmount.toFixed(2),
              customerId: invoice.customerId,
              contractId: invoice.contractId ?? null,
              sourceDocumentType: invoice.sourceDocumentType ?? "invoice",
              sourceDocumentNo: invoice.sourceDocumentNo ?? invoice.invoiceNumber,
            },
          ]
        : []),
    ],
  });
}

export async function postArReceipt(input: PostArReceiptInput) {
  const receipt = await db.query.arReceipts.findFirst({
    where: eq(schema.arReceipts.id, input.receiptId),
  });

  if (!receipt) {
    throw new ApiError(404, `AR receipt ${input.receiptId} was not found.`);
  }

  const entryId = await postJournalEntry({
    entryDate: receipt.receiptDate,
    description: `AR receipt ${receipt.receiptNumber}`,
    sourceType: "ar_receipt",
    sourceId: receipt.id,
    lines: [
      {
        accountId: input.accounts.cashAccountId,
        side: "debit",
        amount: String(receipt.amount),
        customerId: receipt.customerId,
        sourceDocumentNo: receipt.sourceDocumentNo ?? receipt.receiptNumber,
      },
      {
        accountId: input.accounts.arAccountId,
        side: "credit",
        amount: String(receipt.amount),
        customerId: receipt.customerId,
        sourceDocumentNo: receipt.sourceDocumentNo ?? receipt.receiptNumber,
      },
    ],
  });

  await db.transaction(async (tx) => {
    await tx
      .update(schema.arReceipts)
      .set({
        status: "posted",
        updatedAt: now(),
      })
      .where(eq(schema.arReceipts.id, receipt.id));

    await tx.insert(schema.cashTransactions).values({
      id: createId("cash"),
      cashAccountId: input.accounts.cashAccountId,
      arReceiptId: receipt.id,
      transactionType: "receipt",
      transactionDate: receipt.receiptDate,
      amount: receipt.amount,
      description: `Cash receipt for ${receipt.receiptNumber}`,
      createdAt: now(),
    });
  });

  return entryId;
}

export async function postApBill(input: PostApBillInput) {
  const bill = await db.query.apBills.findFirst({
    where: eq(schema.apBills.id, input.billId),
  });

  if (!bill) {
    throw new ApiError(404, `AP bill ${input.billId} was not found.`);
  }

  const entryId = await postJournalEntry({
    entryDate: bill.billDate,
    description: `AP bill ${bill.billNumber}`,
    sourceType: "ap_bill",
    sourceId: bill.id,
    lines: [
      {
        accountId: input.accounts.expenseAccountId,
        side: "debit",
        amount: String(bill.totalAmount),
        vendorId: bill.vendorId,
        sourceDocumentNo: bill.sourceDocumentNo ?? bill.billNumber,
      },
      {
        accountId: input.accounts.apAccountId,
        side: "credit",
        amount: String(bill.totalAmount),
        vendorId: bill.vendorId,
        sourceDocumentNo: bill.sourceDocumentNo ?? bill.billNumber,
      },
    ],
  });

  await db
    .update(schema.apBills)
    .set({
      status: "posted",
      updatedAt: now(),
    })
    .where(eq(schema.apBills.id, bill.id));

  return entryId;
}

export async function postApPayment(input: PostApPaymentInput) {
  const payment = await db.query.apPayments.findFirst({
    where: eq(schema.apPayments.id, input.paymentId),
  });

  if (!payment) {
    throw new ApiError(404, `AP payment ${input.paymentId} was not found.`);
  }

  const entryId = await postJournalEntry({
    entryDate: payment.paymentDate,
    description: `AP payment ${payment.paymentNumber}`,
    sourceType: "ap_payment",
    sourceId: payment.id,
    lines: [
      {
        accountId: input.accounts.apAccountId,
        side: "debit",
        amount: String(payment.amount),
        vendorId: payment.vendorId,
        sourceDocumentNo: payment.sourceDocumentNo ?? payment.paymentNumber,
      },
      {
        accountId: input.accounts.cashAccountId,
        side: "credit",
        amount: String(payment.amount),
        vendorId: payment.vendorId,
        sourceDocumentNo: payment.sourceDocumentNo ?? payment.paymentNumber,
      },
    ],
  });

  await db.transaction(async (tx) => {
    await tx
      .update(schema.apPayments)
      .set({
        status: "posted",
        updatedAt: now(),
      })
      .where(eq(schema.apPayments.id, payment.id));

    if (payment.cashAccountId) {
      await tx.insert(schema.cashTransactions).values({
        id: createId("cash"),
        cashAccountId: payment.cashAccountId,
        apPaymentId: payment.id,
        transactionType: "disbursement",
        transactionDate: payment.paymentDate,
        amount: payment.amount,
        description: `Cash disbursement for ${payment.paymentNumber}`,
        createdAt: now(),
      });
    }
  });

  return entryId;
}

export async function postFaPosting(input: PostFaPostingInput) {
  const faPosting = await db.query.faPostings.findFirst({
    where: eq(schema.faPostings.id, input.faPostingId),
  });

  if (!faPosting) {
    throw new ApiError(404, `Fixed asset posting ${input.faPostingId} was not found.`);
  }

  const entryId = await postJournalEntry({
    entryDate: faPosting.postingDate,
    description: faPosting.description || `FA posting ${faPosting.id}`,
    sourceType: "fa_posting",
    sourceId: faPosting.id,
    lines: [
      {
        accountId: input.accounts.fixedAssetAccountId,
        side: "debit",
        amount: String(faPosting.amount),
      },
      {
        accountId: input.accounts.offsetAccountId,
        side: "credit",
        amount: String(faPosting.amount),
      },
    ],
  });

  await db
    .update(schema.faPostings)
    .set({
      journalEntryId: entryId,
    })
    .where(eq(schema.faPostings.id, faPosting.id));

  return entryId;
}
