# Trailer Documents Integration

This Business Central extension creates the SharePoint trailer document data model, integration API surface, and Fixed Asset user experience for registration and FHWA inspection documents.

## What it adds

- `Trailer Document` table
  One row per SharePoint document keyed by SharePoint item id.
- `Trailer Document Sync Run` table
  One row per sync execution.
- `Trailer Document Sync Error` table
  Row-level sync failures for operational debugging.
- Custom API pages
  - `trailerDocuments`
  - `trailerDocumentSyncRuns`
  - `trailerDocumentSyncErrors`
- User-facing pages
  - `Trailer Document List`
  - `Trailer Document Card`
  - `Trailer Document Summary FactBox`
  - `Trailer Document History FactBox`
  - `Trailer Document Unmatched`
- Fixed Asset card extension
  Adds trailer document FactBoxes and actions to the standard `Fixed Asset Card`.

## Join strategy

The sync job matches SharePoint trailer folders to Business Central fixed assets by:

1. exact `FixedAssets.No`
2. exact `FixedAssets.RMI_Service_Item_No`
3. exact `FixedAssets.Serial_No`
4. exact `FixedAssets.Vehicle_Registration_No`
5. unique numeric/alphanumeric fallback only when the candidate resolves to one asset

The Fixed Asset card FactBoxes themselves are linked by:

- `Trailer Document."Fixed Asset No." = Fixed Asset."No."`

## Packaging

Compile output lands in `build/`.
