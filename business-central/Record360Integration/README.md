Record360 Integration

This AL project creates the Business Central write surface for the Record360 nightly sync:

- `Record360 Inspection`
- `Record360 Sync Run`
- `Record360 Sync Error`
- API pages for each table
- `R360 INTEGRATION` permission set

Trailer lookup is intentionally not implemented as a custom AL API in this project.

The existing WordPress Business Central integration already uses app-only OAuth against the standard BC OData `FixedAssets` endpoint and performs exact lookups by:

- `No`
- `RMI_Service_Item_No`
- `Serial_No`
- `Vehicle_Registration_No`

That existing surface is the preferred lookup path for trailer matching unless the Business Central data model changes.
