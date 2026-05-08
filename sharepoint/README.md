# SharePoint

This folder contains SharePoint and Microsoft Graph scripts that seed or maintain trailer document metadata in Business Central.

## What lives here

- `scripts/sharepoint-sync-bc.ts`
  Main Graph-to-Business-Central sync script for trailer registration and FHWA inspection documents.

## Methodology

The integration is intentionally split into two parts:

- external sync script
  authenticates to Microsoft Graph and Business Central, reads SharePoint folders/files, matches them to fixed assets, and writes normalized rows into BC
- AL extension in `business-central/TrailerDocumentsIntegration`
  stores the document metadata and surfaces it on the Fixed Asset Card through FactBoxes and actions

This keeps the BC UI fast and local. The Fixed Asset Card reads BC tables only; it does not make live Graph calls.

## SharePoint assumptions

The current implementation follows the same conventions already proven by the WordPress plugin:

- trailer folders live under a base SharePoint folder, usually `FixedAssets`
- each trailer folder may contain registration and FHWA inspection PDFs
- document type is inferred from file naming
  - `Registration` when the name looks like `..._R.pdf` or contains `REGISTRATION`
  - `FHWA Inspection` when the name looks like `..._I.pdf` or contains `INSPECTION` or `FHWA`

## Sync behavior

The sync script supports:

- full folder scans
- delta-driven rescans using Microsoft Graph delta links
- deterministic fixed-asset matching using BC fixed asset identifiers
- row-level sync error logging
- sync-run logging
- document removal detection within rescanned folders

## Environment

The sync script accepts either the direct Graph variable names used by the CLI scripts or the `METRO_*` names used by the WordPress plugin.

Graph / SharePoint:

- `GRAPH_TENANT_ID` or `METRO_GRAPH_TENANT_ID`
- `GRAPH_CLIENT_ID` or `METRO_GRAPH_CLIENT_ID`
- `GRAPH_CLIENT_SECRET` or `METRO_GRAPH_CLIENT_SECRET`
- `SHAREPOINT_SITE_ID` or `METRO_SHAREPOINT_SITE_ID`
- `SHAREPOINT_HOSTNAME` or `METRO_SHAREPOINT_HOSTNAME`
- `SHAREPOINT_SITE_PATH` or `METRO_SHAREPOINT_SITE_PATH`
- `SHAREPOINT_DRIVE_ID` or `METRO_SHAREPOINT_DRIVE_ID`
- `SHAREPOINT_LIBRARY_NAME` or `METRO_SHAREPOINT_LIBRARY_NAME`
- `SHAREPOINT_BASE_FOLDER_PATH` or `METRO_SHAREPOINT_BASE_FOLDER`

Business Central:

- `METRO_BC_ENVIRONMENT`
- `METRO_BC_COMPANY`

Optional BC API overrides:

- `METRO_BC_TRAILER_DOCS_API_PUBLISHER`
- `METRO_BC_TRAILER_DOCS_API_GROUP`
- `METRO_BC_TRAILER_DOCS_API_VERSION`

## Commands

Dry run:

```bash
npm run sharepoint:sync:bc
```

Write:

```bash
npm run sharepoint:sync:bc -- --write
```

Delta mode:

```bash
npm run sharepoint:sync:bc -- --write --delta
```

Single-folder test:

```bash
npm run sharepoint:sync:bc -- --write --folders=5318190
```
