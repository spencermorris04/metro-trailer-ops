# SkyBitz Integration

This Business Central extension creates the SkyBitz data model, integration API surface, and Fixed Asset user experience.

## What it adds

- `SkyBitz Tracker` table
  One current row per SkyBitz device/location payload keyed by `MTSN`.
- `SkyBitz Sync Run` table
  One row per sync execution.
- `SkyBitz Sync Error` table
  Row-level sync failures for operational debugging.
- Custom API pages
  - `skybitzTrackers`
  - `skybitzSyncRuns`
  - `skybitzSyncErrors`
- User-facing pages
  - `SkyBitz Tracker List`
  - `SkyBitz Tracker Card`
  - `SkyBitz Tracker FactBox`
- Fixed Asset card extension
  Adds the SkyBitz FactBox and actions to the standard `Fixed Asset Card`.

## Join strategy

The sync job matches SkyBitz rows to Business Central fixed assets by:

1. exact `FixedAssets.No`
2. exact `FixedAssets.RMI_Service_Item_No`
3. exact `FixedAssets.MTRZ`
4. numeric-only fallback on those same fields

The Fixed Asset card FactBox itself is linked by:

- `SkyBitz Tracker."Fixed Asset No." = Fixed Asset."No."`

## Packaging

Compile output lands in `build/`.
