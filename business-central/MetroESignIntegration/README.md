# Metro E-Sign Integration

This Business Central extension adds a native Metro E-Sign lease workspace. It stores searchable lease workflow records in Business Central and calls the Metro Trailer app to create, send, and invalidate DocuSeal-backed E-Sign documents.

## What it adds

- `Metro E-Sign Setup`
  Stores the Metro app API base URL and shared API key.
- `Metro E-Sign Template`
  Stores active template codes synced from the Metro app.
- `Metro E-Sign Lease`
  Stores one lease workflow record per E-Sign draft/submission.
- `Metro E-Sign Lease Field`
  Stores prefilled field values for each lease.
- Fixed Asset Card and Customer Card FactBoxes/actions for related leases.

## Setup

Open **Metro E-Sign Setup** in Business Central and set:

- API Base URL: the Metro Trailer app URL, without a trailing slash.
- API Key: the same value configured in the Metro app as `METRO_BC_ESIGN_API_KEY` or a compatible sync API key environment variable.
- Default Template Code: optional, after refreshing templates.

Use **Refresh Templates** from the template list or setup page before creating production leases.

## Packaging

Compile output lands in `build/`.
