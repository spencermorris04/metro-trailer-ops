# Cutover Playbook

## Goal

Provide a branch-by-branch path from the legacy Dynamics 365 Business Central + RMI workflow to Metro Trailer as the production operational system of record.

## Delivery Sequence

1. Run a dry-run import from legacy exports into normalized Metro Trailer snapshots.
2. Reconcile normalized legacy data against the Metro Trailer production database.
3. Execute performance and security harnesses before each pilot branch.
4. Enable feature flags for one branch at a time.
5. Run dual-entry or dual-observation for the pilot branch until parity gates pass.
6. Freeze legacy writes for the pilot branch, then cut over Metro Trailer to primary.

## Dry-Run Import

Expected legacy export directory contents:

- `assets.csv` or `assets.json`
- `customers.csv` or `customers.json`
- `contracts.csv` or `contracts.json`
- `contract_lines.csv` or `contract_lines.json`
- `invoices.csv` or `invoices.json`
- `invoice_lines.csv` or `invoice_lines.json`

Run:

```bash
npm run legacy:import -- --source ./legacy-export
```

Artifacts:

- `artifacts/legacy-import/<timestamp>/summary.json`
- `artifacts/legacy-import/<timestamp>/normalized-snapshot.json`

## Reconciliation

Use either a production snapshot JSON file or the live PostgreSQL database.

Run against the database:

```bash
npm run legacy:reconcile -- --legacy-snapshot ./artifacts/legacy-import/<timestamp>/normalized-snapshot.json
```

Run against a saved production snapshot:

```bash
npm run legacy:reconcile -- --legacy-snapshot ./artifacts/legacy-import/<timestamp>/normalized-snapshot.json --production-snapshot ./artifacts/production-snapshot.json
```

Required parity gates:

- asset count delta is `0`
- open contract count delta is `0`
- invoice count delta is `0`
- open invoice count delta is `0`
- invoice total amount delta is `0.00`
- invoice balance amount delta is `0.00`
- missing asset, contract, and invoice samples are empty

## Performance Gate

Run the synthetic benchmark:

```bash
npm run perf:harness
```

Optional live endpoint benchmark:

```bash
npm run perf:harness -- --base-url http://localhost:3000
```

Pilot threshold:

- synthetic benchmark passes all defined budgets
- live endpoint p95 remains within the local rollout budget for assets, contracts, invoices, and dispatch

## Security Gate

Run the repository security audit:

```bash
npm run security:audit
```

Review:

- direct demo-store imports in routes
- mutating routes without explicit auth guard helpers
- webhook routes performing inline provider processing
- document download routes without obvious scope checks

## Smoke Verification

Configure environment variables and run:

```bash
npm run e2e:smoke
```

The smoke harness is intentionally environment-driven. It is designed for pilot validation against a deployed branch environment, not for local seeded-demo assumptions.

## Pilot Branch Checklist

- Legacy export captured and archived for the pilot branch.
- Normalized import snapshot generated.
- Reconciliation report passes with zero delta or approved exceptions.
- Feature flags enabled only for the pilot branch workflows under test.
- Stripe, QuickBooks, Record360, and SkyBitz credentials are configured for the pilot environment.
- Audit backlog is empty and webhook backlog is within target.
- S3 Object Lock retention is enabled for retained documents.
- Staff training completed for dispatch, accounting, and maintenance users.
- Rollback contact list and fallback procedure are documented.

## Rollback

- Freeze new Metro Trailer writes for the affected branch.
- Export current Metro Trailer operational snapshot.
- Re-enable legacy entry for the branch.
- Reconcile the partial-cutover delta before attempting another pilot.

## Ownership

- Operations: branch readiness and staff training
- Engineering: data migration, parity reporting, and incident response
- Accounting: invoice and payment reconciliation
- Compliance: audit evidence and retained document validation
