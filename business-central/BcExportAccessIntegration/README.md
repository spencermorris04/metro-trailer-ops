# BC Export Access

This extension packages the Microsoft/base-application permissions needed by the app-only export principal used in the ERP migration scripts.

## What it adds

- `BC EXPORT READ`
  Covers the standard Microsoft objects that were blocked during live export:
  - Customer pages and customer table data
  - Sales order pages and sales header/line table data
  - Sales document API pages
  - G/L account and G/L entry read surface
  - Dimension set entry read surface

## What it does not include

The rental objects that are still blocked come from non-Microsoft apps in this environment:

- `Rental Advantage 365`
- `METR01-Multiple-Extension`

This repo does not include those symbol packages, so this extension cannot compile direct AL permissions for those third-party pages/tables yet.

Those rental endpoints still need one of:

1. assign the vendor-provided read/export permission sets for those apps to the application user, or
2. add the vendor symbol packages and extend this project with the exact rental tabledata permissions.

## Deployment

1. Compile and upload this app to the current BC version.
2. In Business Central, open the application user / Entra app entry used by the export scripts.
3. Assign:
   - `BC EXPORT READ`
4. Separately assign the vendor or custom-app read permission sets that cover the rental/export pages listed below.
5. Re-run:

```bash
npm run bc:export -- --datasets=customers,customer-card,customer-ledger-entries,sales-order,sales-order-lines,sales-documents,sales-document-lines,posted-rental-header,posted-rental-line,rental-ledger-entries,ws-rental-ledger-entries,posted-rental-invoice,posted-rental-invoice-rentals-subform,posted-rental-invoice-sales-subform
```

## Live blocked objects this app addresses

From the current tenant run:

- Page `22` `Customer List`
- Page `21` `Customer Card`
- Page `25` `Customer Ledger Entries`
- Page `42` `Sales Order`
- Page `46` `Sales Order Subform Lines`
- Page `6402` `Sales Document Entity`
- Page `6403` `Sales Document Line Entity`

## Rental/custom pages still requiring vendor-side permission coverage

- Page `50008` `RMIPostedRentalHeaderAPI`
- Page `50009` `RMIPostedRentalLineAPI`
- Page `50012` `WS Rental Ledger Entries`
- Page `37000013` `Posted Rental Invoice`
- Page `37000014` `Posted Rent. Inv. Rent Subform`
- Page `37000019` `Rental Ledger Entries`
- Page `37000025` `Posted Rent. Inv. Sale Subform`
