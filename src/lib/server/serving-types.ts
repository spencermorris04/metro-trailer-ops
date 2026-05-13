export type RentalBillingFactRow = {
  id: string;
  documentNo: string;
  lineNo: number;
  leaseKey: string | null;
  customerNumber: string | null;
  assetNumber: string | null;
  postingDate: string | null;
  grossAmount: number;
};

export type EquipmentDetailServingView = {
  assetId: string;
  assetNumber: string;
  invoiceLineCount: number;
  invoiceCount: number;
  leaseCount: number;
  lifetimeRevenue: number;
};

export type CustomerDetailServingView = {
  customerId: string;
  customerNumber: string;
  invoiceCount: number;
  leaseCount: number;
  equipmentCount: number;
  lifetimeRevenue: number;
  arBalance: number;
};

export type InvoiceDetailServingView = {
  invoiceNumber: string;
  customerNumber: string | null;
  leaseKey: string | null;
  lineCount: number;
  totalAmount: number;
  balanceAmount: number | null;
};

export type LeaseDetailServingView = {
  leaseKey: string;
  customerNumber: string | null;
  invoiceCount: number;
  equipmentCount: number;
  grossRevenue: number;
};
