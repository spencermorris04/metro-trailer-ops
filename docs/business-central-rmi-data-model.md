# Business Central and RMI Data Model Reference

Last reviewed: 2026-05-09

This document explains how Metro's Business Central tenant, the Rental Advantage 365/RMI rental extension, and the new Metro ERP schema fit together. It is based on the tables currently seeded into the hosted Postgres database and on the importer mappings in `business-central/scripts/bc-seed-raw-history.ts`.

The important design conclusion is that Business Central/RMI is document-centric, while the new system needs to be asset/contract-line-centric. BC records invoices and accounting postings as documents and ledger entries. Our new system needs to preserve those documents for audit, but revenue attribution must follow the trailer, the contract line, and the billed service period.

## Current Seeded State

The raw BC/RMI header history is substantially seeded. The posted rental line import is still running and checkpointing, so line counts will continue to grow.

Snapshot while the import was running:

| Table | Rows | Notes |
| --- | ---: | --- |
| `assets` | 54,380 | Canonical asset master seeded from BC fixed assets. |
| `customers` | 15,582 | Canonical customer master seeded from available BC surfaces. |
| `customer_locations` | 2,102 | Canonical ship-to/site records. |
| `branches` | 32 | Canonical branch/location master. |
| `contracts` | 73 | Early canonical synthesis from sample/imported BC documents. |
| `contract_lines` | 208 | Early canonical synthesis. |
| `invoices` | 60 | Early canonical synthesis, all `bc_posted_rental`. |
| `invoice_lines` | 185 | Early canonical synthesis. |
| `commercial_events` | 208 | Early canonical billing-event synthesis. |
| `bc_rmi_posted_rental_invoice_headers` | 865,929 | Complete posted rental invoice header export. |
| `bc_rmi_posted_rental_headers` | 898,827 | Complete posted rental header export, including posted invoices and credit memos. |
| `bc_rmi_posted_rental_lines` | 151,499 at last check | Import running. Source total reported by BC was 4,039,808 rows. |
| `bc_rmi_rental_ledger_entries` | 5,000 | Early partial import. |
| `bc_rmi_ws_rental_ledger_entries` | 0 | Pending. |
| `bc_customer_cards` | 250 | Partial customer card source. |
| `bc_gl_accounts` | 582 | Chart of accounts seeded. |
| `bc_dimension_sets` | 6,000 | Partial dimension set headers. |
| `bc_dimension_set_entries` | 0 | Pending. |
| `bc_gl_entries` | 0 | Pending. |
| `bc_customer_ledger_entries` | 0 | Pending. |
| `bc_bank_ledger_entries` | 566,252 | Seeded from an earlier accounting export. |
| `bc_vendor_ledger_entries` | 3,162 | Seeded from an earlier accounting export. |
| `bc_fa_ledger_entries` | 68,032 | Seeded from an earlier accounting export. |
| `bc_vendors` | 185 | Seeded vendor master. |
| `bc_sales_documents` | 15 | Small discovery/sample set. |
| `bc_sales_document_lines` | 24 | Small discovery/sample set. |
| `bc_source_documents` | 75 | Generic lineage index from earlier importer. |
| `bc_source_document_lines` | 213 | Generic lineage line index from earlier importer. |

Known import status:

| Dataset | Status |
| --- | --- |
| `posted-rental-invoice` | Completed: 865,929 rows. |
| `posted-rental-header` | Completed: 898,827 rows. |
| `posted-rental-line` | Running with checkpoints. It resumed correctly after page-level ID dedupe was added. |
| `chart-of-accounts` | Completed: 582 rows. |
| `dimension-sets` | Partial: 6,000 rows. |
| `dimension-set-entries` | Pending. |
| `rental-ledger-entries` | Partial: 5,000 rows. |
| `ws-rental-ledger-entries` | Pending. |
| `customer-ledger-entries` | Pending. |
| `gl-entries` | Pending. |

## Business Central/RMI Mental Model

Business Central is not organized around a single "rental" table. It is organized around several related concepts:

| Concept | BC/RMI representation | Meaning |
| --- | --- | --- |
| Customer master | Customer card pages/tables, currently `bc_customer_cards` and canonical `customers` | Who is billed or serviced. |
| Asset/trailer master | Fixed Asset data, canonical `assets` | The rentable trailer/container/equipment. |
| Rental order lineage | `PreviousNo`, often `RO...` | The original rental order or legacy order identifier. |
| Posted rental invoice | `RI...` document number | The posted invoice document sent/posted for billing. |
| Posted rental credit memo | `RC...` document number | Posted credit memo document. |
| Invoice/rental line | `WSPostedRentalLine`, stored in `bc_rmi_posted_rental_lines` | The itemized billed line: trailer rent, resource fee, sale, etc. |
| Rental ledger entry | `RentalLedgerEntries` / `WSRentalLedgerEntries` | RMI operational ledger of rental activity and billed rental periods. |
| Customer ledger entry | `CustomerLedgerEntries` | AR ledger entries by customer and document. Pending import. |
| General ledger entry | `G_LEntries` | Final accounting postings by G/L account, dimensions, debit/credit. Pending import. |
| Dimension set | `DimensionSets` and `DimensionSetEntries` | BC's way of attaching branch/department/location/reporting dimensions to ledger/document records. |
| Bank/vendor/FA ledgers | Bank, vendor, and fixed asset ledger entries | Subsidiary ledgers for cash, AP, and fixed assets. |

The BC/RMI data is not normalized the way we would design a new ERP from scratch. The same business event can appear in multiple places:

| Business fact | Where it appears |
| --- | --- |
| Invoice `RI1012922` exists | `bc_rmi_posted_rental_invoice_headers`, `bc_rmi_posted_rental_headers`, rental lines, rental ledger, later customer ledger, later G/L entries. |
| Invoice belongs to order `RO58815` | Header `previous_no`, line `previous_no`, sometimes rental ledger `order_no`. |
| A trailer was billed | Rental line `type = Fixed Asset` and `item_no = trailer/asset number`; rental ledger `no_shipped`. |
| Service period billed | Rental line `invoice_from_date` and `invoice_thru_date`; rental ledger `from_date` and `thru_date`. |
| Revenue amount | Rental line `gross_amount`; rental ledger `gross_amount`; later G/L entry amount by revenue account. |
| Accounting dimensions | Header/line shortcut dimensions and `dimension_set_id`; full details come from dimension set entries. |

## Raw BC/RMI Tables We Preserve

The raw `bc_*` tables are append/update import stores. They are intentionally close to the BC/RMI source shapes and include `source_payload` or `payload` JSON so we do not lose fields that are not yet first-class columns.

### `bc_rmi_posted_rental_invoice_headers`

This is the clean posted rental invoice header source from the RMI page `Posted_Rental_Invoice_Excel`.

Key fields:

| Field | Meaning |
| --- | --- |
| `document_type` | Currently all seeded rows are `Posted Invoice`. |
| `document_no` | The invoice number, usually `RI...`. |
| `previous_doc_type` | Usually `Order`, sometimes `Invoice`. |
| `previous_no` | Usually the rental order number, often `RO...`. |
| `sell_to_customer_no` | Selling customer. |
| `bill_to_customer_no` | Customer used for AR/billing. This is the customer match key. |
| `posting_date` | Accounting posting date. |
| `document_date` | Document date. |
| `due_date` | AR due date. |
| `location_code` | BC location code. |
| `responsibility_center` | Operational/responsibility center. |
| `shortcut_dimension1_code` / `shortcut_dimension2_code` | BC shortcut dimensions. |
| `external_document_no` | External/customer reference when present. |
| `source_payload` | Full raw BC/RMI JSON row. |

Observed data:

| Pattern | Count |
| --- | ---: |
| Total invoice headers | 865,929 |
| `previous_doc_type = Order` and `previous_no` starts with `RO` | 848,486 |
| `previous_doc_type = Invoice` and `previous_no` starts with `RI` | 13,783 |
| `previous_doc_type = Order` with numeric legacy prefixes like `38`, `35`, `34`, etc. | Several thousand |

Interpretation:

Most rental invoices descend from rental orders (`RO...`). Some records chain from a prior invoice (`RI...`) or from legacy numeric order identifiers. The canonical order/agreement key should normally be `previous_no` when `previous_doc_type = Order`, but the importer must preserve the exact `previous_doc_type` and not assume everything is `RO...`.

### `bc_rmi_posted_rental_headers`

This is the broader posted rental document header source from `WSPostedRentalHeader`.

Key fields are similar to invoice headers, with additional operational dates:

| Field | Meaning |
| --- | --- |
| `document_type` | `Posted Invoice` or `Posted Credit Memo`. |
| `document_no` | `RI...` invoice or `RC...` credit memo. |
| `previous_doc_type` / `previous_no` | Prior order/invoice/credit memo lineage. |
| `ship_to_code` | Customer site/ship-to code. |
| `order_date` | Original/order date when available. |
| `select_thru_date` | RMI selected billing-through date. |
| `shipment_date` / `return_date` | Rental movement dates when available. |
| `status`, `source_code`, `dimension_set_id` | BC/RMI status and accounting metadata. |

Observed data:

| Type | Count |
| --- | ---: |
| Posted Invoice | 865,929 |
| Posted Credit Memo | 32,898 |
| Total | 898,827 |

Relationship to invoice headers:

Every `Posted Invoice` row in `bc_rmi_posted_rental_headers` matched a row in `bc_rmi_posted_rental_invoice_headers` by `(document_type, document_no)` in the seeded data. Credit memos are present only in `bc_rmi_posted_rental_headers` so far.

Use:

This table should be the complete posted rental document header history. Use it when credit memos matter. Use `bc_rmi_posted_rental_invoice_headers` when you specifically need the invoice-only RMI page.

### `bc_rmi_posted_rental_lines`

This is the line-level posted rental source from `WSPostedRentalLine`. It is the most important table for building trailer-based revenue history.

Key fields:

| Field | Meaning |
| --- | --- |
| `document_type` | Usually `Posted Invoice`; credit memo lines may appear as later import proceeds if the source exposes them. |
| `document_no` | Parent invoice/document number, usually `RI...`. |
| `line_no` | BC/RMI line number. Often increments by 10000. |
| `sequence_no` | Additional RMI sequence when present. |
| `line_type` | RMI line category, such as `Rental` or `Sale`. |
| `type` | BC item type, such as `Fixed Asset` or `Resource`. |
| `item_no` | For `Fixed Asset`, this is the trailer/container/asset number. |
| `description` | Line description. |
| `quantity` | Billed quantity. |
| `unit_of_measure_code` | Unit of measure. |
| `unit_price` | Unit price. |
| `gross_amount` / `gross_amount_lcy` | Line gross amount. |
| `line_discount_amount`, `invoice_discount_amount` | Discounts. |
| `tax_amount` | Tax amount. |
| `damage_waiver_amount` | RMI damage waiver amount. |
| `from_date`, `thru_date` | Rental/service period dates from RMI. |
| `invoice_from_date`, `invoice_thru_date` | Invoice service period dates. These are the best current period attribution fields. |
| `shipment_date`, `return_date` | Movement dates. |
| `posting_date` | Posting date. |
| `previous_doc_type`, `previous_no` | Prior order lineage, usually `Order` and `RO...`. |
| `deal_code`, `deal_length`, `billing_for` | RMI pricing/term metadata. |
| `location_code`, shortcut dimensions, `dimension_set_id` | Operational/accounting dimensions. |
| `source_payload` | Full raw row. |

Observed line mix at 151,499 loaded rows:

| `line_type` | `type` | Rows | Gross amount |
| --- | --- | ---: | ---: |
| Rental | Fixed Asset | 122,221 | 52,827,505.87 |
| Sale | Resource | 17,518 | 5,913,482.12 |
| Rental | Resource | 9,662 | 983,873.98 |
| Rental | null | 1,469 | 0.00 |
| Sale | null | 455 | 0.00 |
| Sale | Fixed Asset | 174 | 1,376,275.71 |

Observed asset matching:

| Metric | Count |
| --- | ---: |
| Loaded fixed-asset lines | 123,424 |
| Matched to canonical `assets` by `assets.asset_number = item_no` | 123,421 |
| Unmatched | 3 |

This is the strongest evidence so far that the correct trailer matching method for posted rental lines is:

```text
bc_rmi_posted_rental_lines.type = 'Fixed Asset'
bc_rmi_posted_rental_lines.item_no = assets.asset_number
```

Parent invoice match:

```text
bc_rmi_posted_rental_lines.document_type = bc_rmi_posted_rental_invoice_headers.document_type
bc_rmi_posted_rental_lines.document_no = bc_rmi_posted_rental_invoice_headers.document_no
```

Rental order/agreement match:

```text
agreement_key = previous_no when previous_doc_type = 'Order'
fallback agreement_key = document_no when previous_no is missing or previous_doc_type is not usable
preserve previous_doc_type exactly for audit
```

Example from seeded data:

| Invoice | Previous/order | Customer | Line count | Fixed asset lines | Service period | Gross |
| --- | --- | --- | ---: | ---: | --- | ---: |
| `RI1012922` | `RO58815` | `C27252` | 2 | 2 | 2023-12-01 to 2023-12-31 | 500.00 |
| `RI1014429` | `RO60822` | `C15016` | 15 | 15 | 2023-12-01 to 2023-12-31 | 2,925.00 |
| `RI1015748` | `RO59764` | `C16232` | 29 | 29 | 2023-12-01 to 2023-12-31 | 8,555.00 |

Example trailer line:

| Invoice | Order | Line | Asset no. | Asset type | Invoice period | Gross |
| --- | --- | ---: | --- | --- | --- | ---: |
| `RI1012922` | `RO58815` | 10000 | `7019380` | `storage_container` | 2023-12-01 to 2023-12-31 | 250.00 |
| `RI1012922` | `RO58815` | 20000 | `5551307` | `storage_container` | 2023-12-01 to 2023-12-31 | 250.00 |

### `bc_rmi_rental_ledger_entries`

This table stores RMI rental ledger entries from `RentalLedgerEntries`. It is currently only partially seeded.

Key fields:

| Field | Meaning |
| --- | --- |
| `external_entry_no` | Rental ledger entry number. |
| `document_type` | Posted invoice or posted credit memo. |
| `document_no` | Posted document number, usually `RI...` or `RC...`. |
| `order_no` | Original rental order where available. |
| `bill_to_customer_no` | Billing customer. |
| `type_ordered`, `no_ordered` | Ordered item type/number. |
| `type_shipped`, `no_shipped` | Shipped/billed item type/number. For trailers, `no_shipped` is the asset number. |
| `serial_no_shipped` | Serial number/VIN-like value if available. |
| `quantity` | Quantity. |
| `from_date`, `thru_date` | Rental period. |
| `rental_days` | Rental day count. |
| `unit_price`, `gross_amount`, discounts | Pricing. |
| `deal_code` | RMI deal/rate code. |
| shortcut dimensions | BC dimensions. |
| `source_payload` | Full raw row. |

Observed partial data:

| Metric | Count |
| --- | ---: |
| Entries imported | 5,000 |
| Entries with `no_shipped` | 5,000 |
| Entries matching assets by `assets.asset_number = no_shipped` | 4,486 |

The lower match rate is expected because some `no_shipped` values are not assets. Examples include resource/service markers like `UNIT TRACKING` or `CCS`.

Relationship to invoices:

```text
bc_rmi_rental_ledger_entries.document_no = RI/RC document number
bc_rmi_rental_ledger_entries.order_no = rental order when present
bc_rmi_rental_ledger_entries.no_shipped = trailer/asset number when the entry is asset-related
```

Example rows:

| Entry | Document | Order | Customer | Shipped no. | Asset matched | Period | Gross |
| --- | --- | --- | --- | --- | --- | --- | ---: |
| `7` | `RI374602` | `RO29390` | `C20979` | `530169` | yes | 2014-12-19 to 2015-05-18 | 1,625.00 |
| `8` | `RI374602` | `RO29390` | `C20979` | `530530` | yes | 2014-12-19 to 2015-05-18 | 1,625.00 |
| `13` | `RI374604` | `38286` | `C01193` | `UNIT TRACKING` | no | 2014-12-09 to 2015-01-08 | 10.00 |

Use:

Rental ledger entries are useful for validating rental periods and asset/service history. For canonical billing lines, the posted rental lines are currently better because they join directly to invoice headers and carry richer line-level fields. Ledger entries should be used as an audit/reconciliation layer and, after full import, as a second source to validate trailer/service-period revenue.

### `bc_rmi_ws_rental_ledger_entries`

This is planned for `WSRentalLedgerEntries`, which should expose rental ledger data with additional web-service/RMI metadata. It has the same schema shape as `bc_rmi_rental_ledger_entries`.

Current state: not seeded yet.

Expected use:

Use this if it has better order/deal metadata than `RentalLedgerEntries`. If both tables overlap, preserve both raw sources and choose one canonical synthesis source after comparing counts and fields.

### `bc_customer_cards`

This is a typed raw customer card table.

Key fields:

| Field | Meaning |
| --- | --- |
| `customer_no` | BC customer number. |
| `name` | Customer name. |
| `customer_type` | Customer classification. |
| `parent_no`, `parent_name` | Parent customer relationship. |
| `blocked` | BC blocked status. |
| `responsibility_center` | Default responsibility center. |
| `salesperson_code`, `default_sales_team` | Sales assignment. |
| `default_deal_code` | RMI deal/rate default. |
| `damage_waiver_declined` | RMI/customer insurance setting. |
| `insurance_cert_required`, `insurance_expiration_date`, `insurance_policy_no` | Insurance metadata. |
| `balance_lcy`, `balance_due_lcy`, `credit_limit_lcy` | Financial customer fields. |
| `source_payload` | Full raw BC row. |

Current state:

Only 250 rows are loaded in `bc_customer_cards`, but canonical `customers` has 15,582 rows. Invoice headers match canonical customers very well:

| Metric | Count |
| --- | ---: |
| Posted rental invoice headers | 865,929 |
| Headers matching canonical `customers.customer_number = bill_to_customer_no` | 865,914 |
| Headers matching current `bc_customer_cards.customer_no` | 15,819 |

This means canonical customer coverage is good, but the typed customer-card raw table is incomplete and should not be treated as the complete customer history yet.

### `bc_sales_documents` and `bc_sales_document_lines`

These are standard BC sales document discovery/sample tables.

Current state:

| Table | Rows |
| --- | ---: |
| `bc_sales_documents` | 15 |
| `bc_sales_document_lines` | 24 |

Use:

These are not yet authoritative for rental orders. They are useful for comparing whether active/open rental orders are represented in standard BC Sales Order pages or only in RMI pages. Do not design the migration around these tables until we confirm they cover open rentals.

### `bc_source_documents` and `bc_source_document_lines`

These generic lineage tables predate the more typed RMI raw tables.

Use:

They are useful as a lightweight index and for generic source-document UI. They should not replace typed RMI tables because typed tables preserve stronger extracted columns, indexes, and RMI-specific semantics.

### `bc_gl_accounts`

This is the BC chart of accounts.

Key fields:

| Field | Meaning |
| --- | --- |
| `account_no` | G/L account number. |
| `name` | Account name. |
| `account_type` | BC account type. |
| `income_balance` | Income Statement or Balance Sheet. |
| `category`, `subcategory` | BC category fields when available. |
| `blocked` | Whether the account is blocked. |
| `payload` | Full source row. |

Observed data:

| `income_balance` | Rows |
| --- | ---: |
| Income Statement | 354 |
| Balance Sheet | 228 |

The `category` field is currently null in the seeded rows. The account number and `income_balance` are the reliable classification fields so far.

### `bc_dimension_sets` and `bc_dimension_set_entries`

BC uses dimension sets to attach reporting dimensions to documents and ledger entries. A document or ledger line can have a `Dimension Set ID`; that ID expands into multiple dimension code/value pairs in dimension set entries.

Current state:

| Table | Rows | Status |
| --- | ---: | --- |
| `bc_dimension_sets` | 6,000 | Partial |
| `bc_dimension_set_entries` | 0 | Pending |

Expected relationship:

```text
document_or_ledger.dimension_set_id -> bc_dimension_sets.external_dimension_set_id
bc_dimension_sets.id -> bc_dimension_set_entries.dimension_set_id
bc_dimension_set_entries.dimension_code + dimension_value_code -> reporting dimension
```

For the new system, dimensions should become explicit `gl_dimensions`, `gl_dimension_values`, and `gl_entry_dimensions` records. Until the entries are imported, shortcut dimensions on headers/lines are the practical fallback.

### `bc_gl_entries`

This will store final Business Central general ledger entries from `G_LEntries`.

Current state: 0 rows.

Expected fields:

| Field | Meaning |
| --- | --- |
| `external_entry_no` | BC G/L Entry No. |
| `posting_date` | Posting date. |
| `document_no` | Document number, usually invoice/payment/journal document. |
| `account_no` | G/L account number. |
| `amount`, `debit_amount`, `credit_amount` | Accounting amounts. |
| `dimension_set_id` | Link to dimension set. |
| `payload` | Full source row. |

Use:

These rows are the authoritative BC accounting history for trial balance/account activity once imported. They should remain read-only BC history unless we deliberately build a historical journal migration into app-native `gl_journal_entries` and `gl_journal_lines`.

### `bc_customer_ledger_entries`

This will store AR/customer subledger history.

Current state: 0 rows.

Expected use:

Customer ledger entries will reconcile posted rental invoices, credit memos, payments, applications, and open balances by customer. They are the missing piece for historical AR aging and customer balance reconciliation.

### `bc_bank_ledger_entries`

This table is already populated from an earlier accounting export.

Current state:

| Metric | Value |
| --- | ---: |
| Rows | 566,252 |
| Date range | 2014-12-05 to 2029-12-29 |
| Sum of `amount` | 1,245,629,893.54 |

Some rows have future dates like 2029-12-29, for example credit card processor/master bank transfers. That is a source-data fact we should preserve and flag in reconciliation/reporting, not silently rewrite.

Use:

Bank ledger entries are BC cash/bank subledger history. In the new system they should support read-only imported cash history, cash reconciliation views, and later migration into app-native `cash_transactions` only if we define a reliable mapping.

### `bc_vendor_ledger_entries`

This table stores AP/vendor ledger history from the earlier accounting export.

Current state:

| Metric | Value |
| --- | ---: |
| Rows | 3,162 |
| Date range | 2014-12-03 to 2026-04-27 |
| Sum of `amount` | -836,491,303.56 |

Use:

This is read-only AP history until app-native AP bill/payment migration is defined.

### `bc_fa_ledger_entries`

This table stores fixed asset ledger history.

Current state:

| Metric | Value |
| --- | ---: |
| Rows | 68,032 |
| Date range | 2014-01-01 to 2026-04-27 |
| Sum of `amount` | 795,713,978.14 |

Observed sample:

Rows with documents like `RI1236582` and assets like `48F807` show fixed asset ledger entries tied to sale/disposal or asset accounting postings. Rows with vendor voucher documents like `VCH03177` show asset acquisition/cost activity.

Use:

This is the imported fixed asset accounting subledger. It should remain raw/auditable and can later feed canonical `fa_books` and `fa_postings` if we build explicit migration rules.

### `bc_vendor_ledger_entries` and `bc_vendors`

`bc_vendors` is the vendor master. `bc_vendor_ledger_entries` is AP ledger history by vendor/document.

Use:

For V1 ERP, vendors and AP history should live in back-office/accounting views. They are not part of rental revenue attribution, but they matter for full ERP replacement.

## How Rental Invoices, Lines, Trailers, and Customers Match

### Invoice Header to Invoice Lines

The real parent-child relationship is:

```sql
select *
from bc_rmi_posted_rental_invoice_headers h
join bc_rmi_posted_rental_lines l
  on l.document_type = h.document_type
 and l.document_no = h.document_no;
```

In practical terms:

```text
RI invoice header -> many WSPostedRentalLine rows
```

`document_no` is the posted invoice identity. `line_no` is the line identity within the invoice.

Canonical target:

```text
bc_rmi_posted_rental_invoice_headers -> invoices
bc_rmi_posted_rental_lines -> invoice_lines
```

But canonical invoice creation should happen only when we know the lines for that invoice are fully loaded. Until then, headers remain raw history.

### Invoice/Header to Rental Order/Agreement

The dominant lineage is:

```text
RI... invoice -> previous_no RO... order
```

Observed:

| Source | Dominant lineage |
| --- | --- |
| Invoice headers | 848,486 rows are `previous_doc_type = Order` and `previous_no` starts with `RO`. |
| Posted rental headers | 865,289 rows are `previous_doc_type = Order` and `previous_no` starts with `RO`. |
| Posted rental lines loaded so far | Nearly all use `previous_doc_type = Order` and `previous_no` starts with `RO`. |

Canonical target:

```text
contracts.contract_number = RO... when a valid order lineage exists
contracts.legacy_document_no = RO...
contracts.legacy_previous_document_no = RO...
invoices.legacy_invoice_no = RI...
invoices.legacy_order_no = RO...
invoice_lines.contract_line_id -> contract_lines.id
commercial_events.contract_id -> contracts.id
```

Important exception:

Some invoices use prior invoice lineage (`previous_doc_type = Invoice`, `previous_no = RI...`). These should not be forced into fake rental orders. They should be preserved as invoice-chained documents and given an `import_completeness`/lineage flag until we define the correct business interpretation.

### Rental Line to Trailer/Asset

The actual matching rule is:

```sql
select *
from bc_rmi_posted_rental_lines l
join assets a
  on a.asset_number = l.item_no
where l.type = 'Fixed Asset';
```

Current evidence:

| Metric | Count |
| --- | ---: |
| Loaded fixed-asset rental/sale lines | 123,424 |
| Matched to canonical assets | 123,421 |
| Unmatched | 3 |

This is strong enough to make `item_no` the primary trailer match key for posted rental lines.

Do not use customer location as the primary revenue attribution. Customer/site is a reporting dimension. The asset line is what tells us which trailer earned the revenue.

### Rental Ledger Entry to Trailer/Asset

For rental ledger entries:

```sql
select *
from bc_rmi_rental_ledger_entries r
left join assets a
  on a.asset_number = r.no_shipped;
```

The match rate is lower because ledger rows can represent non-asset charges/resources:

| Metric | Count |
| --- | ---: |
| Partial rental ledger entries | 5,000 |
| Entries with `no_shipped` | 5,000 |
| Matched to assets | 4,486 |

Use `no_shipped` for trailer matching only when it actually matches an asset. Preserve non-asset values as resource/service lines.

### Invoice/Header to Customer

The reliable customer match is:

```sql
bc_rmi_posted_rental_invoice_headers.bill_to_customer_no = customers.customer_number
```

Current evidence:

| Metric | Count |
| --- | ---: |
| Posted rental invoice headers | 865,929 |
| Matched to canonical customers | 865,914 |
| Unmatched | 15 |

`sell_to_customer_no` is also useful, but `bill_to_customer_no` is the AR/customer ledger identity.

### Header/Line to Branch, Location, and Dimensions

BC/RMI spreads operational/accounting attribution across several fields:

| Field | Use |
| --- | --- |
| `location_code` | BC inventory/location/service location code. |
| `responsibility_center` | Responsibility center, often closer to operational branch/reporting center. |
| `shortcut_dimension1_code` | Shortcut dimension 1, tenant-specific meaning. |
| `shortcut_dimension2_code` | Shortcut dimension 2, tenant-specific meaning. |
| `dimension_set_id` | Full BC dimension-set pointer. |

For the new system, branch/revenue attribution should prefer trailer/service context over customer billing geography:

```text
1. Use explicit line/service branch if available.
2. Else use line location/responsibility center.
3. Else use asset branch/current service branch.
4. Else fall back to customer/home branch only as a reporting fallback.
```

## Business Central Accounting Data Organization

Business Central accounting data is layered, but the final source of accounting truth is the G/L Entry table.

### BC Accounting Layers

| Layer | BC tables/pages | Purpose |
| --- | --- | --- |
| Source documents | Posted rental headers/lines, sales documents, purchase documents, journals | Business documents users recognize. |
| Subledgers | Customer Ledger, Vendor Ledger, Bank Ledger, Fixed Asset Ledger, Rental Ledger | Domain-specific accounting/detail ledgers. |
| General ledger | G/L Entries and Chart of Accounts | Final debit/credit accounting truth. |
| Dimensions | Dimension Sets and Dimension Set Entries | Reporting dimensions attached to documents and ledger entries. |

### Rental Revenue Accounting Flow in BC/RMI

The expected flow is:

```text
Rental order RO...
  -> posted rental invoice RI...
  -> posted rental invoice/rental lines
  -> RMI rental ledger entries
  -> customer ledger entries
  -> G/L entries
  -> dimensions via dimension set id
```

In current seeded data:

| Stage | Status |
| --- | --- |
| Posted rental invoice headers | Complete. |
| Posted rental broader headers including credit memos | Complete. |
| Posted rental lines | Running, partial. |
| Rental ledger entries | Partial. |
| Customer ledger entries | Not imported yet. |
| G/L entries | Not imported yet. |
| Dimension set entries | Not imported yet. |

This means we can already understand invoices, order lineage, many line items, and trailer attribution. We cannot yet fully reconcile historical AR, trial balance, or dimensional G/L reporting from the hosted raw tables until customer ledger, G/L entries, and dimension set entries are imported.

### Why G/L Entries Are Still Needed

Posted rental lines tell us what was billed. They are not the complete accounting posting.

For example, one invoice line can eventually produce multiple accounting effects:

| Posting effect | Likely accounting layer |
| --- | --- |
| Debit accounts receivable | Customer ledger and G/L. |
| Credit rental revenue | G/L revenue account. |
| Credit sales tax payable | G/L liability account. |
| Damage waiver or fee revenue | G/L revenue/fee account. |
| Credit memo reversal | Customer ledger and G/L reversal/credit postings. |
| Payment/application | Customer ledger, bank ledger, and G/L. |

So the new system should not pretend rental lines are balanced accounting entries. Rental lines become commercial events and invoice lines. Posting those into accounting requires explicit posting rules that create balanced journal lines.

## Our New System Model

The new system is organized around three layers:

| Layer | Tables | Purpose |
| --- | --- | --- |
| Operational | `assets`, `customers`, `customer_locations`, `branches`, `contracts`, `contract_lines`, dispatch/inspection/work-order tables | Business operations and current state. |
| Commercial/subledger | `commercial_events`, `invoices`, `invoice_lines`, `ar_receipts`, `ar_applications`, AP/cash/FA subledger tables | Billing and receivable/payable/cash/fixed-asset subledgers. |
| General ledger | `gl_accounts`, `gl_journal_batches`, `gl_journal_entries`, `gl_journal_lines`, dimensions, posting rules | Balanced accounting. |

Raw BC history remains in `bc_*` tables and is not rewritten into app-native journals by default.

### Canonical Asset Model

`assets` is the trailer/equipment master.

Relevant seeded fields:

| Field | Purpose |
| --- | --- |
| `asset_number` | BC fixed asset number and primary rental-line matching key. |
| `type`, `subtype` | App-native classification. |
| `serial_number` | VIN/serial where present. |
| `manufacturer`, `model_year`, `registration_number` | Enriched asset details. |
| `fa_class_code`, `fa_subclass_code` | BC fixed asset class/subclass. |
| `bc_location_code`, `bc_dimension1_code` | BC operational/reporting identifiers. |
| `bc_product_no`, `bc_service_item_no` | BC/RMI product/service item identifiers. |
| lifecycle flags | `is_blocked`, `is_inactive`, `is_disposed`, `is_on_rent`, `is_in_service`, `under_maintenance`. |
| `book_value` | BC book value hint. |
| `source_payload` | Raw BC fixed asset payload. |

Observed type/class distribution:

| Asset type | Class | Subclass | Rows |
| --- | --- | --- | ---: |
| `road_trailer` | `ROAD TRL` | `RDT 53 SD` | 22,432 |
| `cartage_trailer` | `CARTAG TRL` | `CAT 53 SD` | 7,699 |
| `road_trailer` | `ROAD TRL` | `RDT 53 RD` | 2,639 |
| `storage_container` | `STORAGE CO` | `SC 40` | 2,226 |
| `road_trailer` | `ROAD TRL` | `CAT 28 RD` | 2,098 |
| `storage_trailer` | `STORAG TRL` | `STT 53 SD` | 1,963 |
| `flatbed_trailer` | `FLATBD TRL` | `FB 48` | 1,431 |

The asset model is already richer than BC's raw fixed asset page in the ways the app needs: it classifies equipment for operations while preserving BC fields.

### Canonical Agreement Model

We use `contracts` as the canonical agreement layer. It should represent rental orders, leases, legacy posted invoice groupings, quotes, credit memos, and future app-native agreements.

Relevant fields:

| Field | Purpose |
| --- | --- |
| `contract_number` | App agreement number, preferably `RO...` for legacy rental orders. |
| `agreement_kind` | `quote`, `rental_order`, `lease`, `legacy_posted_invoice`, `credit_memo`, etc. |
| `legacy_source_system` | `business_central` for imported legacy records. |
| `legacy_document_no` | Legacy agreement/order/document number. |
| `legacy_previous_document_no` / `legacy_previous_document_type` | Raw BC lineage. |
| `service_branch_id`, `service_location_code` | Service/revenue attribution branch/location. |
| `agreement_state` | Legacy/app state. |
| `import_completeness` | Whether header/lines/ledger are complete. |
| `source_provider`, `source_document_type`, `source_document_no`, `source_status`, `source_snapshot` | Reconciliation/debug lineage. |

Canonical contract rule:

```text
If RI invoice has previous_doc_type = Order and previous_no is present:
  contract_number = previous_no
  agreement_kind = rental_order
Else:
  create/import as legacy_posted_invoice or chained legacy document with explicit lineage.
```

### Canonical Contract Lines

`contract_lines` should represent the billable/service line under the agreement.

For RMI lines:

| RMI source | Canonical field |
| --- | --- |
| `document_no` / `line_no` | `source_document_no`, `source_line_no`, `source_snapshot` |
| `type = Fixed Asset`, `item_no` | `asset_id`, `source_item_no` |
| `line_type` | `line_kind` after mapping |
| `unit_price`, `quantity` | `unit_price`, `quantity` |
| `invoice_from_date`, `invoice_thru_date` | `invoice_from_date`, `invoice_thru_date`, and event service period |
| `deal_code`, `deal_length`, `billing_for` | `source_deal_code`, `source_deal_length`, `billing_for` |
| `tax_group_code`, `damage_waiver_amount` | Tax/fee metadata in fields or snapshot |

Line-kind mapping should be explicit:

| RMI line | Canonical line kind |
| --- | --- |
| `line_type = Rental`, `type = Fixed Asset` | `rental` or `lease`, depending on agreement/rate semantics. |
| `line_type = Sale`, `type = Fixed Asset` | `buyout` or `sale`. |
| `type = Resource`, delivery description | `delivery`. |
| `type = Resource`, pickup description | `pickup`. |
| Damage waiver amount/line | `damage_waiver`. |
| Tax line/group | `tax`. |
| Credit memo lines | `credit`. |

Do not infer too aggressively from descriptions alone. Preserve `source_snapshot` and add deterministic mapping rules over time.

### Canonical Invoices and Invoice Lines

`invoices` and `invoice_lines` are app-native AR invoice tables, not raw BC document clones.

For imported BC posted rental invoices:

| BC/RMI source | Canonical field |
| --- | --- |
| `RI...` | `invoice_number` or `legacy_invoice_no` |
| `previous_no = RO...` | `legacy_order_no`, `contract_id` |
| `bill_to_customer_no` | `customer_id` |
| `posting_date` | `posting_date`, usually also invoice date if no better field exists |
| `due_date` | `due_date` |
| line sums | `subtotal_amount`, `tax_amount`, `total_amount`, `balance_amount` only when lines are complete |
| raw header | `source_snapshot` |

Important rule:

Do not fabricate canonical invoices from header-only data unless they are explicitly flagged partial. Full canonical invoices should be created when line completeness is known.

Current canonical invoices:

| Source kind | Completeness | Count | Total |
| --- | --- | ---: | ---: |
| `bc_posted_rental` | `lines_complete` | 60 | 72,303.50 |

This is a small early synthesis set and should not be interpreted as the complete invoice migration.

### Commercial Events

`commercial_events` is the new system's billing-event layer. It is not the G/L.

For each meaningful RMI line, especially trailer rental lines, we should synthesize a commercial event:

| Source | Commercial event field |
| --- | --- |
| `previous_no` | `legacy_order_no`, `contract_id` |
| `document_no` | `legacy_invoice_no`, `source_document_no` |
| `line_no` | `legacy_line_no` |
| matched asset | `asset_id` |
| matched contract line | `contract_line_id` |
| `invoice_from_date`, `invoice_thru_date` | `service_period_start`, `service_period_end` |
| service branch/location | `service_branch_id`, `service_location_code` |
| `gross_amount` | `amount` |
| `line_type/type` | `event_type`, `revenue_recognition_basis` |
| raw row | `source_snapshot` |

Revenue attribution rule:

```text
Primary: asset_id + contract_line_id + service period
Secondary: service branch/location from trailer/service context
Reporting: customer and customer location
Never primary: customer billing address geography
```

This is the major intentional departure from Business Central's methodology. BC can post revenue with dimensions from responsibility center/location/customer context. Our system needs revenue to follow the trailer and service period first.

### App-Native Accounting Layer

The new accounting layer should be generated from app-native commercial/subledger records using posting rules.

Core tables:

| Table | Purpose |
| --- | --- |
| `gl_accounts` | App-native chart of accounts. Can seed from `bc_gl_accounts`. |
| `gl_posting_periods` | Open/closed posting periods. |
| `gl_journal_batches` | Batch/container for journal entries. |
| `gl_journal_entries` | Journal entry headers. |
| `gl_journal_lines` | Balanced debit/credit lines. |
| `gl_dimensions` | App-native dimension definitions. |
| `gl_dimension_values` | App-native dimension values. |
| `gl_entry_dimensions` | Dimension assignments at journal-line level. |
| `posting_rules` and `posting_rule_lines` | Deterministic rules from commercial/subledger events to GL postings. |

Accounting rule:

```text
Commercial event -> AR invoice line -> posted AR invoice -> balanced GL journal lines
Receipt/payment/application -> AR/cash subledger -> balanced GL journal lines
AP bill/payment -> AP/cash subledger -> balanced GL journal lines
FA acquisition/disposal/depreciation -> FA subledger -> balanced GL journal lines
```

Imported BC accounting history should stay read-only in `bc_*` tables unless a separate migration creates app-native journals. That migration must preserve BC entry numbers and source payloads.

## Required Extensions Beyond BC Methodology

BC/RMI can tell us what was posted, but the new system needs stronger operational semantics.

### 1. Trailer-Based Revenue Attribution

BC documents are customer/document-led. The new system must be trailer/service-period-led.

Required implementation:

| Need | Implementation |
| --- | --- |
| Revenue by trailer | Every rental commercial event should have `asset_id`. |
| Revenue by period | Every rental event should have `service_period_start` and `service_period_end`. |
| Revenue by branch | Use service/asset branch, not customer billing geography. |
| Revenue by agreement | Every event should point to `contract_id` and ideally `contract_line_id`. |
| Audit to BC | Preserve `legacy_invoice_no`, `legacy_order_no`, `legacy_line_no`, and `source_snapshot`. |

### 2. Complete Raw First, Canonical Second

The migration should continue to run in deterministic passes:

| Pass | Action |
| --- | --- |
| Raw BC/RMI ingestion | Import all readable source rows into typed `bc_*` tables with payloads. |
| Canonical master synthesis | Build/update branches, customers, locations, assets, external mappings. |
| Canonical commercial synthesis | Build contracts, contract lines, invoices, invoice lines, commercial events from complete raw data. |
| Accounting synthesis | Keep BC accounting history raw; create app-native accounting only for new app-originated postings unless deliberate migration rules exist. |

Do not synthesize full canonical invoices from a moving partial line import. Use `import_completeness`.

### 3. Explicit Completeness States

Because some sources are partial or pending, canonical records need visible completeness markers:

| Completeness | Meaning |
| --- | --- |
| `header_only` | We have document header but not complete lines. |
| `lines_complete` | Header and lines are complete enough for canonical invoice/event synthesis. |
| `ledger_complete` | Ledger rows are also loaded and reconcile. |
| `fully_reconciled` | Header, lines, subledger, G/L, and dimensions reconcile. |

### 4. Preserve Document Identity

BC document identity must remain visible in app-native tables:

| Canonical table | BC identity fields |
| --- | --- |
| `contracts` | `legacy_document_no`, `legacy_previous_document_no`, `source_document_no`, `source_snapshot`. |
| `contract_lines` | `source_line_no`, `source_item_no`, `source_sequence_no`, `source_snapshot`. |
| `invoices` | `legacy_invoice_no`, `legacy_order_no`, `source_document_no`, `source_snapshot`. |
| `invoice_lines` | `source_line_no`, `source_item_no`, `source_sequence_no`, `source_snapshot`. |
| `commercial_events` | `legacy_order_no`, `legacy_invoice_no`, `legacy_line_no`, `source_document_no`, `source_snapshot`. |
| `external_entity_mappings` | Stable cross-system lookup for `business_central` IDs. |

Current `external_entity_mappings` counts:

| Entity type | Count |
| --- | ---: |
| `bc_asset` | 54,380 |
| `bc_customer` | 15,372 |
| `bc_customer_location` | 2,102 |
| `bc_customer_card` | 210 |
| `bc_invoice_line` | 185 |
| `bc_invoice` | 60 |
| `bc_branch` | 29 |
| `bc_contract_line` | 23 |
| `bc_contract` | 13 |

## Recommended Canonical Synthesis Rules

### For Posted Rental Lines

Use this matching order:

1. Match parent invoice by `(document_type, document_no)`.
2. Match customer by `bill_to_customer_no -> customers.customer_number`.
3. Determine agreement key from `previous_no` when `previous_doc_type = Order`.
4. Match asset when `type = Fixed Asset` using `item_no -> assets.asset_number`.
5. Create/update `contracts` by agreement key.
6. Create/update `contract_lines` by agreement key plus source invoice/line identity.
7. Create/update `invoice_lines` only when parent invoice line completeness is known.
8. Create/update `commercial_events` for each revenue-bearing line.
9. Preserve source row in `source_snapshot`.

### For Rental Ledger Entries

Use this matching order:

1. Match document by `document_no`.
2. Match order by `order_no` when present.
3. Match asset by `no_shipped -> assets.asset_number` only if it exists.
4. Treat unmatched `no_shipped` values as resource/service references, not failed trailers.
5. Use ledger entries to validate periods, quantities, and amounts against posted rental lines.

### For Customer Ledger and G/L Entries

After import:

1. Match customer ledger entries by `document_no` to invoices/credit memos.
2. Match G/L entries by `document_no` to posted documents.
3. Expand dimensions through `dimension_set_id`.
4. Reconcile AR totals, G/L revenue, tax, bank, and applications.
5. Keep raw BC entries read-only unless building a deliberate app-native historical journal migration.

## Open Data Gaps

| Gap | Why it matters |
| --- | --- |
| Full `bc_rmi_posted_rental_lines` import | Required for complete invoice line, trailer revenue, and commercial event synthesis. |
| `bc_customer_ledger_entries` | Required for historical AR balance, payments, applications, and aging. |
| `bc_gl_entries` | Required for trial balance and full historical accounting. |
| `bc_dimension_set_entries` | Required for accurate dimensional reporting. |
| `bc_rmi_ws_rental_ledger_entries` | May provide better RMI order/deal metadata than the current rental ledger source. |
| Open/unposted rental orders | Still needs authoritative source discovery if not represented by posted RMI history. |
| Posted rental invoice subforms | Current direct subform tables are empty; `WSPostedRentalLine` is the practical line source for now. |

## Practical UI Implications

Day-to-day pages should use canonical tables:

| UI area | Primary tables |
| --- | --- |
| Assets | `assets`, plus linked `commercial_events`, `contract_lines`, Record360 tables, work orders. |
| Customers | `customers`, `customer_locations`, `contracts`, `invoices`, AR tables. |
| Contracts/leases | `contracts`, `contract_lines`, `commercial_events`, `invoices`. |
| Invoices | `invoices`, `invoice_lines`, with source lineage back to `bc_rmi_*`. |
| Transactions/commercial events | `commercial_events`, grouped by asset, contract line, invoice, customer. |
| Accounting | App-native subledger/GL tables for new transactions; `bc_*` pages for imported historical accounting. |
| Business Central admin | `bc_import_runs`, `bc_import_errors`, `bc_import_checkpoints`, raw `bc_*` tables. |
| Source documents | `bc_rmi_posted_rental_headers`, `bc_rmi_posted_rental_invoice_headers`, `bc_rmi_posted_rental_lines`, `bc_source_documents`. |

Raw BC payloads should be visible in admin/debug panels, not in normal operator workflows.

## Summary

Business Central/RMI's usable rental history is centered on posted documents:

```text
RI invoice header
  -> WSPostedRentalLine rows
  -> fixed asset item numbers
  -> assets/trailers
  -> rental ledger entries
  -> customer ledger entries
  -> G/L entries
  -> dimensions
```

The seeded data confirms the core matching strategy:

```text
Invoice lines join to invoice headers by document_type + document_no.
Rental order lineage usually comes from previous_doc_type = Order and previous_no = RO...
Trailer matching for posted rental lines is type = Fixed Asset and item_no = assets.asset_number.
Customer matching is bill_to_customer_no = customers.customer_number.
Branch/dimension attribution must come from line/service/asset context before customer geography.
```

The new system should preserve BC document identity and raw history, but it should not copy BC's document-first accounting model as the internal operating model. Metro's ERP needs to be contract-line and trailer driven, with commercial events as the bridge from operations to invoices and posting rules as the bridge from invoices/subledgers to balanced G/L entries.
