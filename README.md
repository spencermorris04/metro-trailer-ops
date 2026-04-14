# Metro Trailer

Metro Trailer is a domain-first Next.js platform for managing large trailer and container rental fleets across multiple branches. It is designed to replace a legacy rental stack with a single operational backbone for asset lifecycle, reservations, contracts, dispatch, invoicing, inspections, maintenance, collections, and customer self-service.

## What Is Included

- A Next.js 16 App Router foundation with TypeScript and Tailwind CSS 4
- A PostgreSQL-ready Drizzle schema covering the core rental, financial, operational, and audit entities
- Domain lifecycle rules for assets and rental contracts
- Route Handlers that expose starter REST endpoints for assets, customers, contracts, and lifecycle transitions
- Product shell pages for assets, customers, contracts, financials, operations, and integrations
- Environment scaffolding for Stripe, QuickBooks Online, Record360, SkyBitz, internal e-sign secrets, and AWS S3 object storage

## Local Development

1. Copy `.env.example` to `.env`.
2. Leave `METRO_TRAILER_RUNTIME_MODE="production"` and point `DATABASE_URL` at your PostgreSQL instance. Set `METRO_TRAILER_RUNTIME_MODE="demo"` only when you are explicitly working against the legacy in-memory adapters.
3. Install dependencies with `npm install`.
4. Generate Drizzle migrations with `npm run db:generate`.
5. Start the app with `npm run dev`.

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Runtime Notes

- The main app runtime now composes the production services only. Demo adapters remain available for explicit legacy/dev-only usage, but request-path code no longer switches between demo and production implementations.
- Stripe, QuickBooks Online, Record360, SkyBitz, and AWS S3-backed storage are represented through integration adapters and job tracking. QuickBooks now includes persisted OAuth connection state, external entity mappings, webhook receipt handling, replayable outbox jobs, and an accounting mismatch review queue. E-sign execution is now owned internally by Metro Trailer with signer tokens, consent capture, audit evidence, generated signature certificates, and S3-backed retained documents.
- Generated PDFs now flow through the shared object-storage adapter. Contract packets, signed agreements, signature certificates, manually created documents, and invoice PDFs will store to S3 when `S3_BUCKET` and `S3_REGION` are configured.
- Optional S3 object-lock retention can be applied per upload through `S3_OBJECT_LOCK_MODE` and `S3_OBJECT_LOCK_DAYS`. Review your bucket configuration against AWS S3 Object Lock requirements before enabling it in production.
- The App Router pages and Route Handlers now resolve through thin production composition modules that group functionality by domain.

## Scripts

- `npm run dev` starts the Next.js development server.
- `npm run build` builds the production app.
- `npm run lint` runs ESLint across the project.
- `npm run typecheck` runs TypeScript without emitting files.
- `npm test` runs the current unit and harness-level tests.
- `npm run legacy:import` normalizes Dynamics/RMI exports into a dry-run Metro Trailer snapshot.
- `npm run legacy:reconcile` compares a legacy snapshot against a production snapshot or live database.
- `npm run perf:harness` runs the 50,000-asset synthetic benchmark and optional live endpoint latency checks.
- `npm run security:audit` scans the API surface for auth, scope, and demo-runtime risks.
- `npm run e2e:smoke` runs environment-driven smoke scenarios for lifecycle, portal, payments, and signatures.
- `npm run db:generate` generates SQL migrations and Drizzle metadata from the TypeScript schema.
- `npm run db:validate` checks the generated migration history against the current Drizzle schema.
- `npm run db:push` syncs the schema directly to a database.
- `npm run db:migrate` applies generated migrations to the database.

## Project Map

- `src/db/schema.ts`: core relational model for assets, customers, contracts, invoicing, dispatch, inspections, work orders, collections, and audit history
- `drizzle.config.ts`: Drizzle Kit configuration for Postgres migrations
- `drizzle`: generated SQL migrations and schema snapshots
- `src/app`: App Router pages, route handlers, and generated icon
- `src/app/api`: REST surface for asset lifecycle, contracts, financial events, invoices, payments, dispatch, inspections, maintenance, portal, collections, telematics, reporting, documents, signatures, and integration jobs
- `src/components`: product shell, navigation, and reusable UI primitives
- `src/lib/domain`: domain entities, validation rules, and lifecycle constraints
- `src/lib/platform-data.ts`: seeded demo records and high-level platform content
- `src/lib/server`: production domain modules, legacy demo adapters, integration adapters, API helpers, PDF generation, and AWS S3 object storage
- `src/lib/legacy`: dry-run import normalization and parity-report helpers for legacy cutover
- `src/lib/testing`: performance and security harnesses used during rollout validation
- `scripts`: build, legacy import/reconciliation, performance, security audit, and smoke-test entrypoints
- `docs/architecture.md`: architecture notes and phase-by-phase implementation mapping
- `docs/cutover-playbook.md`: branch-by-branch rollout, reconciliation, performance, security, and rollback guidance

## Implementation Direction

The current scaffold emphasizes Phase 0 and the early parts of Phase 1 from the implementation plan:

- Domain model first
- Explicit state transitions
- Auditability as a built-in concern
- Strong boundaries around third-party integrations
- Postgres and Drizzle as the system-of-record foundation

The next delivery steps are persistence-backed CRUD flows, authentication and role-based access, invoice generation, and external system synchronization.
