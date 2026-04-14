import { z } from "zod";

import {
  assetAvailabilities,
  assetStatuses,
  assetTypes,
  billingUnits,
  contractStatuses,
  customerTypes,
  financialEventStatuses,
  financialEventTypes,
  invoiceStatuses,
  maintenanceStatuses,
  workOrderBillableDispositions,
  workOrderBillingApprovalStatuses,
  workOrderSourceTypes,
  workOrderVerificationResults,
} from "@/lib/domain/models";

const addressSchema = z.object({
  line1: z.string().min(1),
  line2: z.string().optional(),
  city: z.string().min(1),
  state: z.string().min(2).max(2),
  postalCode: z.string().min(5),
  country: z.string().default("US"),
});

const contactSchema = z.object({
  name: z.string().min(1),
  email: z.string().email().optional(),
  phone: z.string().min(7).optional(),
});

const signatureAppearanceModes = [
  "handwriting_font",
  "drawn",
  "uploaded_image",
] as const;

export const assetSchema = z.object({
  assetNumber: z.string().min(3),
  type: z.enum(assetTypes),
  branchId: z.string().min(1),
  status: z.enum(assetStatuses).default("available"),
  availability: z.enum(assetAvailabilities).default("rentable"),
  maintenanceStatus: z.enum(maintenanceStatuses).default("clear"),
  gpsDeviceId: z.string().optional(),
  dimensions: z.string().optional(),
  ageInMonths: z.number().int().nonnegative().optional(),
  features: z.array(z.string()).default([]),
});

export const assetUpdateSchema = assetSchema.partial();

export const assetTransitionSchema = z.object({
  toStatus: z.enum(assetStatuses),
  reason: z.string().min(3).default("Manual asset lifecycle transition"),
  idempotencyKey: z.string().min(8).max(200).optional(),
});

export const customerLocationInputSchema = z.object({
  name: z.string().min(1),
  address: addressSchema,
  contactPerson: contactSchema,
});

export const customerSchema = z.object({
  customerNumber: z.string().min(3),
  name: z.string().min(2),
  customerType: z.enum(customerTypes),
  contactInfo: contactSchema,
  billingAddress: addressSchema,
  locations: z.array(customerLocationInputSchema).default([]),
});

export const customerUpdateSchema = z.object({
  name: z.string().min(2).optional(),
  customerType: z.enum(customerTypes).optional(),
  portalEnabled: z.boolean().optional(),
  branchCoverage: z.array(z.string()).optional(),
});

export const contractLineSchema = z
  .object({
    assetId: z.string().optional(),
    description: z.string().optional(),
    unitPrice: z.number().nonnegative(),
    unit: z.enum(billingUnits),
    quantity: z.number().positive().default(1),
    startDate: z.coerce.date(),
    endDate: z.coerce.date().nullable().optional(),
    adjustments: z.array(z.string()).default([]),
  })
  .refine(
    (line) => !line.endDate || line.endDate >= line.startDate,
    "Line end date must be after the line start date.",
  );

export const contractSchema = z
  .object({
    contractNumber: z.string().min(3),
    customerId: z.string().min(1),
    locationId: z.string().min(1),
    branchId: z.string().min(1),
    startDate: z.coerce.date(),
    endDate: z.coerce.date().nullable().optional(),
    status: z.enum(contractStatuses).default("quoted"),
    lines: z.array(contractLineSchema).min(1),
    idempotencyKey: z.string().min(8).max(200).optional(),
  })
  .refine(
    (contract) => !contract.endDate || contract.endDate >= contract.startDate,
    "Contract end date must be after the contract start date.",
  );

export const contractTransitionSchema = z.object({
  fromStatus: z.enum(contractStatuses),
  toStatus: z.enum(contractStatuses),
  reason: z.string().min(3),
  effectiveAt: z.coerce.date().optional(),
  idempotencyKey: z.string().min(8).max(200).optional(),
});

export const contractAmendmentSchema = z.object({
  amendmentType: z.enum([
    "extension",
    "asset_swap",
    "partial_return",
    "rate_adjustment",
  ]),
  notes: z.string().optional(),
  extendedEndDate: z.string().optional(),
  assetNumbersToAdd: z.array(z.string()).optional(),
  assetNumbersToRemove: z.array(z.string()).optional(),
  effectiveAt: z.coerce.date().optional(),
  idempotencyKey: z.string().min(8).max(200).optional(),
});

export const financialEventSchema = z.object({
  contractId: z.string().min(1),
  eventType: z.enum(financialEventTypes),
  description: z.string().min(3),
  amount: z.number(),
  eventDate: z.coerce.date(),
  status: z.enum(financialEventStatuses).default("pending"),
});

export const invoiceSchema = z.object({
  customerId: z.string().min(1),
  contractId: z.string().min(1),
  status: z.enum(invoiceStatuses).default("draft"),
  invoiceDate: z.coerce.date(),
  dueDate: z.coerce.date(),
});

export const dispatchTaskSchema = z.object({
  type: z.string().min(3),
  status: z.enum(["unassigned", "assigned", "in_progress", "completed", "cancelled"]).optional(),
  branch: z.string().min(2),
  assetNumber: z.string().min(3),
  contractNumber: z.string().min(3).optional(),
  customerSite: z.string().min(2),
  scheduledFor: z.string().min(3),
  scheduledEnd: z.string().min(3).optional(),
  driverName: z.string().min(2).max(120).optional(),
  notes: z.string().min(2).max(2000).optional(),
  idempotencyKey: z.string().min(8).max(200).optional(),
});

export const dispatchConfirmationSchema = z.object({
  outcome: z.enum(["delivery_confirmed", "pickup_confirmed", "swap_confirmed"]),
  notes: z.string().min(2).max(2000).optional(),
  completedAt: z.string().optional(),
  idempotencyKey: z.string().min(8).max(200).optional(),
});

export const inspectionRequestSchema = z.object({
  assetNumber: z.string().min(3),
  contractNumber: z.string().min(3),
  customerSite: z.string().min(2),
  inspectionType: z.string().min(3),
});

export const inspectionCompletionSchema = z.object({
  status: z.enum(["passed", "failed", "needs_review"]),
  damageSummary: z.string().min(3),
  photos: z.array(z.string().url()).optional(),
  damageScore: z.number().int().min(0).max(100).optional(),
  media: z.array(z.record(z.string(), z.unknown())).optional(),
  externalInspectionId: z.string().min(2).optional(),
});

export const workOrderSchema = z.object({
  title: z.string().min(3),
  assetNumber: z.string().min(3),
  branch: z.string().min(2).optional(),
  priority: z.string().min(2),
  source: z.string().min(2),
  sourceType: z.enum(workOrderSourceTypes).default("manual"),
  contractNumber: z.string().min(3).optional(),
  inspectionId: z.string().min(1).optional(),
  technicianUserId: z.string().min(1).optional(),
  vendorId: z.string().min(1).optional(),
  vendorName: z.string().min(2).max(200).optional(),
  symptomSummary: z.string().min(3).max(2000).optional(),
  diagnosis: z.string().max(4000).optional(),
  repairSummary: z.string().max(4000).optional(),
  dueAt: z.coerce.date().optional(),
  billableDisposition: z.enum(workOrderBillableDispositions).default("internal"),
  billingApprovalStatus: z
    .enum(workOrderBillingApprovalStatuses)
    .optional(),
  estimatedCost: z.number().nonnegative().optional(),
  laborHours: z.number().nonnegative().optional(),
  status: z.enum(["open", "assigned"]).optional(),
  laborEntries: z
    .array(
      z.object({
        technicianUserId: z.string().min(1).optional(),
        hours: z.number().positive(),
        hourlyRate: z.number().nonnegative().optional(),
        notes: z.string().max(2000).optional(),
      }),
    )
    .optional(),
  partEntries: z
    .array(
      z.object({
        partNumber: z.string().max(120).optional(),
        description: z.string().min(2).max(200),
        quantity: z.number().positive(),
        unitCost: z.number().nonnegative().optional(),
      }),
    )
    .optional(),
  notes: z.string().max(2000).optional(),
  idempotencyKey: z.string().min(8).max(200).optional(),
});

const workOrderLaborEntrySchema = z.object({
  technicianUserId: z.string().min(1).optional(),
  hours: z.number().positive(),
  hourlyRate: z.number().nonnegative().optional(),
  notes: z.string().max(2000).optional(),
});

const workOrderPartEntrySchema = z.object({
  partNumber: z.string().max(120).optional(),
  description: z.string().min(2).max(200),
  quantity: z.number().positive(),
  unitCost: z.number().nonnegative().optional(),
});

export const workOrderUpdateSchema = z.object({
  title: z.string().min(3).optional(),
  priority: z.string().min(2).optional(),
  source: z.string().min(2).optional(),
  sourceType: z.enum(workOrderSourceTypes).optional(),
  symptomSummary: z.string().min(3).max(2000).optional(),
  diagnosis: z.string().max(4000).optional(),
  repairSummary: z.string().max(4000).optional(),
  dueAt: z.coerce.date().nullable().optional(),
  estimatedCost: z.number().nonnegative().optional(),
  actualCost: z.number().nonnegative().optional(),
  laborHours: z.number().nonnegative().optional(),
  billableDisposition: z.enum(workOrderBillableDispositions).optional(),
  billingApprovalStatus: z
    .enum(workOrderBillingApprovalStatuses)
    .optional(),
  contractNumber: z.string().min(3).nullable().optional(),
  notes: z.string().max(2000).optional(),
  laborEntries: z.array(workOrderLaborEntrySchema).optional(),
  partEntries: z.array(workOrderPartEntrySchema).optional(),
  idempotencyKey: z.string().min(8).max(200).optional(),
});

export const workOrderAssignSchema = z.object({
  technicianUserId: z.string().min(1).optional(),
  vendorId: z.string().min(1).optional(),
  vendorName: z.string().min(2).max(200).optional(),
  notes: z.string().max(2000).optional(),
  idempotencyKey: z.string().min(8).max(200).optional(),
});

export const workOrderStartSchema = z.object({
  notes: z.string().max(2000).optional(),
  idempotencyKey: z.string().min(8).max(200).optional(),
});

export const workOrderAwaitingSchema = z.object({
  notes: z.string().min(2).max(2000),
  idempotencyKey: z.string().min(8).max(200).optional(),
});

export const workOrderRepairCompleteSchema = z.object({
  repairSummary: z.string().min(3).max(4000),
  notes: z.string().max(2000).optional(),
  actualCost: z.number().nonnegative().optional(),
  laborHours: z.number().nonnegative().optional(),
  technicianUserId: z.string().min(1).optional(),
  vendorId: z.string().min(1).optional(),
  vendorName: z.string().min(2).max(200).optional(),
  laborEntries: z.array(workOrderLaborEntrySchema).optional(),
  partEntries: z.array(workOrderPartEntrySchema).optional(),
  idempotencyKey: z.string().min(8).max(200).optional(),
});

export const workOrderVerifySchema = z.object({
  result: z.enum(workOrderVerificationResults),
  notes: z.string().max(2000).optional(),
  inspectionId: z.string().min(1).optional(),
  idempotencyKey: z.string().min(8).max(200).optional(),
});

export const workOrderCancelSchema = z.object({
  reason: z.string().min(3).max(2000),
  idempotencyKey: z.string().min(8).max(200).optional(),
});

export const workOrderCloseSchema = z.object({
  notes: z.string().max(2000).optional(),
  idempotencyKey: z.string().min(8).max(200).optional(),
});

export const invoicePaymentSchema = z.object({
  amount: z.number().positive(),
});

export const paymentIntentSchema = z.object({
  invoiceId: z.string().min(1),
  paymentMethodId: z.string().min(1).optional(),
});

export const paymentMethodSchema = z.object({
  customerNumber: z.string().min(3),
  stripePaymentMethodId: z.string().min(3).optional(),
  methodType: z.enum(["card", "ach", "wire", "check"]).optional(),
  label: z.string().min(2).optional(),
  last4: z.string().length(4).optional(),
  isDefault: z.boolean().optional(),
}).superRefine((value, ctx) => {
  if (!value.stripePaymentMethodId) {
    if (!value.methodType) {
      ctx.addIssue({
        code: "custom",
        message: "methodType is required when no Stripe payment method ID is provided.",
        path: ["methodType"],
      });
    }
    if (!value.label) {
      ctx.addIssue({
        code: "custom",
        message: "label is required when no Stripe payment method ID is provided.",
        path: ["label"],
      });
    }
    if (!value.last4) {
      ctx.addIssue({
        code: "custom",
        message: "last4 is required when no Stripe payment method ID is provided.",
        path: ["last4"],
      });
    }
  }
});

export const paymentSetupIntentSchema = z.object({
  customerNumber: z.string().min(3),
});

export const paymentMethodDefaultSchema = z.object({
  paymentMethodId: z.string().min(1),
});

export const paymentHistoryQuerySchema = z.object({
  customerNumber: z.string().min(3).optional(),
  invoiceId: z.string().min(1).optional(),
});

export const paymentRefundSchema = z.object({
  transactionId: z.string().min(1),
  amount: z.number().positive().optional(),
});

export const collectionUpdateSchema = z.object({
  status: z.string().min(2).optional(),
  promisedPaymentDate: z.string().nullable().optional(),
  promisedPaymentAmount: z.number().positive().optional(),
  note: z.string().optional(),
});

export const collectionsEvaluateSchema = z.object({
  collectionCaseId: z.string().min(1).optional(),
});

export const telematicsScheduleSchema = z.object({
  branchId: z.string().min(1).optional(),
});

export const documentSchema = z.object({
  contractNumber: z.string().min(3).optional(),
  workOrderId: z.string().min(1).optional(),
  customerName: z.string().min(2).optional(),
  documentType: z.string().min(3),
  filename: z.string().min(5),
  contentType: z.string().min(3).optional(),
  contentBase64: z.string().min(4).optional(),
  metadata: z.record(z.string(), z.union([z.string(), z.number(), z.boolean(), z.null()])).optional(),
}).superRefine((value, ctx) => {
  if (!value.contractNumber && !value.workOrderId) {
    ctx.addIssue({
      code: "custom",
      message: "Either contractNumber or workOrderId is required.",
      path: ["contractNumber"],
    });
  }
});

export const signatureSignerSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  title: z.string().min(2).max(120).optional(),
  routingOrder: z.number().int().positive().optional(),
});

export const signatureRequestSchema = z.object({
  contractNumber: z.string().min(3),
  signers: z.array(signatureSignerSchema).min(1),
  title: z.string().min(3).max(180).optional(),
  subject: z.string().min(3).max(180).optional(),
  message: z.string().min(3).max(2000).optional(),
  expiresInDays: z.number().int().min(1).max(90).default(14),
});

export const signatureReminderSchema = z.object({
  signerId: z.string().min(1).optional(),
});

export const signatureCancelSchema = z.object({
  reason: z.string().min(3).max(500),
});

export const signatureOtpRequestSchema = z.object({
  signerId: z.string().min(1),
  token: z.string().min(24),
});

export const signatureSignSchema = z.object({
  signerId: z.string().min(1),
  token: z.string().min(24),
  otpCode: z.string().regex(/^\d{6}$/, "Verification code must be 6 digits."),
  signatureText: z.string().min(2).max(160),
  signatureMode: z.enum(signatureAppearanceModes),
  signatureAppearanceDataUrl: z
    .string()
    .regex(
      /^data:image\/(?:png|jpeg);base64,[A-Za-z0-9+/=]+$/,
      "Signature appearance must be a PNG or JPEG data URL.",
    ),
  signerTitle: z.string().min(2).max(120).optional(),
  intentAccepted: z.literal(true),
  consentAccepted: z.literal(true),
  certificationAccepted: z.literal(true),
});
