# WordPress

This folder contains the trailer registration lookup plugin history and WordPress-adjacent integration scripts.

## What lives here

- `metro-registration-lookup-tool-v43/`
  Current working plugin version referenced by the recent Business Central and SharePoint integration work.
- `metro-registration-lookup-tool-v*`
  Historical version snapshots of the plugin.
- `scripts/test-sharepoint-registration.ts`
  CLI helper that validates the SharePoint registration PDF lookup path through Microsoft Graph.
- `scripts/test-sharepoint-availability-methodology.ts`
  CLI helper that explores SharePoint folder/document delta behavior and availability-detection strategy.

## Active plugin

The active plugin version in current use is:

- `metro-registration-lookup-tool-v43`

That plugin provides:

- WordPress REST endpoints for trailer lookup and document download
- SharePoint-backed registration PDF lookup through Microsoft Graph
- local WordPress indexing for fast trailer search
- Business Central fixed-asset indexing and live exact lookups through app-only OAuth

## Configuration model

The plugin resolves Business Central and SharePoint settings in this order:

1. PHP constants
2. environment variables
3. WordPress option storage

The main settings payload lives under the WordPress option:

- `metro_registration_lookup_tool_settings`

## Business Central usage inside the plugin

The plugin uses app-only OAuth against Business Central. There is no BC username/password flow in the plugin.

It requests an Entra token from:

- `https://login.microsoftonline.com/{tenantId}/oauth2/v2.0/token`

Then it queries BC OData, especially:

- `FixedAssets`

The fixed-asset lookup logic is used for:

- full asset index rebuilds
- exact live lookups by:
  - `No`
  - `RMI_Service_Item_No`
  - `Serial_No`
  - `Vehicle_Registration_No`

## SharePoint scripts

The scripts in `wordpress/scripts/` are for direct CLI verification outside WordPress:

- `test-sharepoint-registration.ts`
  validates the end-to-end lookup of a trailer folder and its registration PDF
- `test-sharepoint-availability-methodology.ts`
  inspects Graph folder enumeration and delta behavior to inform indexing strategy

These scripts use Microsoft Graph credentials and SharePoint identifiers directly from environment variables, not from WordPress option storage.

## Why the versioned folders remain

The plugin folders are intentionally versioned snapshots. They are useful when:

- comparing behavior changes across releases
- recovering a known-good package
- tracing when a lookup or indexing behavior changed

The top-level README here is meant to orient you to the active version and the surrounding helper scripts, not replace the per-plugin READMEs inside each version folder.
