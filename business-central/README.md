# Business Central

This folder contains Business Central-specific tooling and AL extensions that back the integration work in this repo.

## What lives here

- `Record360Integration/`
  AL extension project that creates the custom tables, API pages, page extensions, FactBoxes, and permission sets used by the Record360 integration.
- `SkyBitzIntegration/`
  AL extension project for SkyBitz tracker data and Fixed Asset card UI.
- `TrailerDocumentsIntegration/`
  AL extension project for SharePoint-hosted trailer registration and FHWA inspection documents.
- `scripts/bc-export.ts`
  Discovery/export utility for Business Central OData and API surfaces.

Generated outputs from the export script still land in `artifacts/business-central/` at the repo root.

## AL extension methodology

The integrations here follow the same split:

- AL extension
  creates schema and UI inside BC
- external sync script
  writes external system data into those BC objects

`Record360Integration` defines:

- `Record360 Inspection`
- `Record360 Sync Run`
- `Record360 Sync Error`
- custom API pages for those tables
- Fixed Asset Card UI integration
  - summary FactBox
  - recent history FactBox
  - inspection list/card pages
  - open latest PDF/dashboard actions

The active AL project is in:

- `Record360Integration/app.json`
- `Record360Integration/src/...`

`TrailerDocumentsIntegration` defines:

- `Trailer Document`
- `Trailer Document Sync Run`
- `Trailer Document Sync Error`
- custom API pages for those tables
- Fixed Asset Card UI integration
  - summary FactBox
  - document history FactBox
  - trailer document list/card pages
  - open registration / FHWA / folder actions

## BC export script

`scripts/bc-export.ts` is a general-purpose BC surface explorer. It uses the same app-only OAuth model as the WordPress plugin and Record360 sync, then exports datasets from:

- API root metadata
- OData catalog
- fixed assets
- customers
- orders
- rentals
- and other published services that are accessible in the tenant

Use it when you need to answer questions like:

- which services are actually published in this BC environment
- what fields are available on a given OData endpoint
- whether a standard or custom service is accessible to the current app registration

## Environment

The BC tooling here uses:

- `METRO_GRAPH_TENANT_ID`
- `METRO_GRAPH_CLIENT_ID`
- `METRO_GRAPH_CLIENT_SECRET`
- `METRO_BC_ENVIRONMENT`
- `METRO_BC_COMPANY`

Some flows also use:

- `METRO_BC_COMPANY_ID`

## Matching strategy used by Record360

The Record360 sync does not add a separate trailer lookup API to BC. Instead, it relies on the existing BC OData `FixedAssets` surface and the custom Record360 API pages created by the AL extension.

That means:

- asset lookup happens through BC OData
- inspection writes happen through the custom AL API pages
- UI presentation happens through the AL page extension on the Fixed Asset Card
