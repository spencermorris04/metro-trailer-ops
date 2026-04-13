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
  customerSite: z.string().min(2),
  scheduledFor: z.string().min(3),
});

export const dispatchConfirmationSchema = z.object({
  outcome: z.enum(["delivery_confirmed", "pickup_confirmed", "swap_confirmed"]),
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
});

export const workOrderSchema = z.object({
  title: z.string().min(3),
  assetNumber: z.string().min(3),
  branch: z.string().min(2),
  priority: z.string().min(2),
  source: z.string().min(2),
});

export const invoicePaymentSchema = z.object({
  amount: z.number().positive(),
});

export const paymentIntentSchema = z.object({
  invoiceId: z.string().min(1),
});

export const paymentMethodSchema = z.object({
  customerNumber: z.string().min(3),
  methodType: z.enum(["card", "ach", "wire", "check"]),
  label: z.string().min(2),
  last4: z.string().length(4),
});

export const collectionUpdateSchema = z.object({
  status: z.string().min(2).optional(),
  promisedPaymentDate: z.string().nullable().optional(),
  note: z.string().optional(),
});

export const documentSchema = z.object({
  contractNumber: z.string().min(3),
  customerName: z.string().min(2),
  documentType: z.string().min(3),
  filename: z.string().min(5),
});

export const signatureRequestSchema = z.object({
  contractNumber: z.string().min(3),
  signers: z.array(z.string().email()).min(1),
});
