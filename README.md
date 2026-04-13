# Metro Trailer

Metro Trailer is a domain-first Next.js platform for managing large trailer and container rental fleets across multiple branches. It is designed to replace a legacy rental stack with a single operational backbone for asset lifecycle, reservations, contracts, dispatch, invoicing, inspections, maintenance, collections, and customer self-service.

## What Is Included

- A Next.js 16 App Router foundation with TypeScript and Tailwind CSS 4
- A PostgreSQL-ready Drizzle schema covering the core rental, financial, operational, and audit entities
- Domain lifecycle rules for assets and rental contracts
- Route Handlers that expose starter REST endpoints for assets, customers, contracts, and lifecycle transitions
- Product shell pages for assets, customers, contracts, financials, operations, and integrations
- Environment scaffolding for Stripe, QuickBooks Online, Record360, SkyBitz, and object storage

## Local Development

1. Copy `.env.example` to `.env`.
2. Leave `METRO_TRAILER_RUNTIME_MODE="demo"` to run the full workflow against the in-memory demo runtime, or point `DATABASE_URL` at your PostgreSQL instance for the next persistence step.
3. Install dependencies with `npm install`.
4. Generate Drizzle migrations with `npm run db:generate`.
5. Start the app with `npm run dev`.

Open [http://localhost:3000](http://localhost:3000) to view the application.

## Runtime Notes

- The current application includes a broad demo runtime that exercises the end-to-end modules without requiring live third-party credentials.
- Stripe, QuickBooks Online, Record360, SkyBitz, Dropbox Sign, and S3-compatible storage are represented through integration adapters and job tracking. Live credentials are still required before those providers can perform real external calls.
- The App Router pages call the same server-side platform service used by the REST endpoints, so demo interactions from the UI and API stay aligned.

## Scripts

- `npm run dev` starts the Next.js development server.
- `npm run build` builds the production app.
- `npm run lint` runs ESLint across the project.
- `npm run typecheck` runs TypeScript without emitting files.
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
- `src/lib/server`: demo runtime store, platform services, integration adapters, API helpers, and PDF generation
- `docs/architecture.md`: architecture notes and phase-by-phase implementation mapping

## Implementation Direction

The current scaffold emphasizes Phase 0 and the early parts of Phase 1 from the implementation plan:

- Domain model first
- Explicit state transitions
- Auditability as a built-in concern
- Strong boundaries around third-party integrations
- Postgres and Drizzle as the system-of-record foundation

The next delivery steps are persistence-backed CRUD flows, authentication and role-based access, invoice generation, and external system synchronization.
