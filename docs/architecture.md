# Architecture Notes

## Product Intent

Metro Trailer is the operational system of record for a multi-branch rental business managing roughly 50,000 trailers and containers. The application owns the business workflow and internal state transitions, while specialized vendors own narrow external concerns:

- Stripe handles card and ACH payment processing.
- QuickBooks Online remains the accounting system of record.
- Record360 handles inspection capture, damage media, and check-in/check-out workflows.
- SkyBitz supplies telematics and location visibility.

## Primary Design Principles

1. Domain first. The data model and lifecycle rules are treated as product infrastructure, not incidental implementation details.
2. Explicit state transitions. Contract and asset changes should happen through well-defined actions with guardrails.
3. Auditable operations. Sensitive changes need append-only history with user attribution and timestamps.
4. Strong consistency. PostgreSQL and Drizzle provide transactional integrity for fleet, contract, and financial state.
5. Integration boundaries. External systems sync from a clear internal model rather than driving the core workflow.

## Code Map

- `src/db/schema.ts`
  Defines the foundational relational model across branches, assets, customers, contracts, invoice entities, dispatch tasks, inspections, work orders, payment methods, collections, telematics, and integration sync jobs.
- `src/lib/db.ts`
  Exposes the shared Drizzle Postgres client and typed schema registration for future repositories and services.
- `src/lib/domain/models.ts`
  Holds the TypeScript domain vocabulary used in the UI and route handlers.
- `src/lib/domain/lifecycle.ts`
  Encodes the allowed asset and contract state transitions along with lifecycle guardrails.
- `src/lib/domain/validators.ts`
  Provides Zod schemas for inbound asset, customer, and contract payloads.
- `src/app/api/*`
  Starter REST surface that currently validates requests and returns representative sample data.
- `src/lib/platform-data.ts`
  Supplies sample operational snapshots so the product shell communicates the target system clearly before persistence is wired in.

## Phase Mapping

### Phase 0: Domain Modeling and Design

- Completed in the initial scaffold through the Drizzle schema, TypeScript domain types, lifecycle transition maps, and architecture docs.

### Phase 1: Core Asset and Rental Lifecycle Backend

- Started through route handler scaffolding, asset and contract validation, and explicit transition logic.
- Next step: replace sample data with repository-backed reads and writes.

### Phase 2: Financial Event Engine and Invoice Generation

- Modeled through rate cards, financial events, invoices, and invoice lines.
- Next step: build invoice generation services and QuickBooks synchronization jobs.

### Phase 3+: Dispatch, Inspections, Maintenance, Portal, Collections, Reporting

- Represented in the schema and product shell so the later phases have a place to land without requiring a structural rewrite.

## Recommended Near-Term Build Order

1. Add authentication and role-based authorization.
2. Connect Drizzle to a real Postgres database and run the first migration.
3. Implement repository-backed CRUD for assets, customers, customer locations, and contracts.
4. Add audit-event writes to every mutation path.
5. Introduce financial event generation and invoice draft creation.
6. Wire QuickBooks and Stripe after the internal billing lifecycle is stable.
