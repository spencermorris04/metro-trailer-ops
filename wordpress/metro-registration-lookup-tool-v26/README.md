# Metro Registration Lookup Tool

Small WordPress plugin that exposes a trailer registration PDF lookup backed by Microsoft Graph and SharePoint.

## What It Adds

- REST endpoint: `/wp-json/metro/v1/trailers?query=531819`
- REST endpoint: `/wp-json/metro/v1/trailers/{folderId}/documents`
- REST endpoint: `/wp-json/metro/v1/documents/{documentId}/download`
- Legacy direct endpoint: `/wp-json/metro/v1/registration/{trailerNumber}`
- Shortcode: `[metro_registration_lookup]`
- Server-side Microsoft Graph client credentials flow
- Local indexed trailer list stored in WordPress for fast partial search
- Search-first interface that lists matching trailer folders before document links
- Document chooser that can expand to additional file types later

## Install

1. Zip the `metro-registration-lookup-tool` folder.
2. In WordPress Admin, go to `Plugins -> Add New Plugin -> Upload Plugin`.
3. Upload the zip and activate the plugin.
4. Add the shortcode `[metro_registration_lookup]` to a page.

## Setup In WordPress Admin

After activating the plugin, go to:

```text
Settings -> Metro Registration Lookup Tool
```

and fill in:

- Tenant ID
- Client ID
- Client Secret
- SharePoint Hostname
- SharePoint Site ID
- SharePoint Site Path
- SharePoint Drive ID
- Library Name
- Base Folder

For the current tested SharePoint layout, the minimum values are:

```text
SharePoint Hostname: metrotrailerleasing.sharepoint.com
Library Name: WebPortal
Base Folder: FixedAssets
SharePoint Site ID: metrotrailerleasing.sharepoint.com,36d1633f-ec13-4c65-a9dc-18ec62cd8679,c509d15b-1e9a-405f-80f6-e3315235f226
```

Then use the `Rebuild trailer index now` button on the same settings page. Partial search depends on that local index. Nightly refreshes are scheduled automatically after the first install.

## Optional wp-config.php / Environment Config

You can still set these in `wp-config.php` on the WordPress server if you prefer. Constants and environment variables take precedence over saved plugin settings.

```php
define('METRO_GRAPH_TENANT_ID', 'your-tenant-id');
define('METRO_GRAPH_CLIENT_ID', 'your-client-id');
define('METRO_GRAPH_CLIENT_SECRET', 'your-client-secret');

define('METRO_SHAREPOINT_HOSTNAME', 'metrotrailerleasing.sharepoint.com');
define('METRO_SHAREPOINT_LIBRARY_NAME', 'WebPortal');
define('METRO_SHAREPOINT_BASE_FOLDER', 'FixedAssets');
```

Optional, if you want to bypass discovery:

```php
define('METRO_SHAREPOINT_SITE_ID', 'metrotrailerleasing.sharepoint.com,...');
define('METRO_SHAREPOINT_DRIVE_ID', 'b!...');
```

Optional, if the SharePoint files move under a subsite:

```php
define('METRO_SHAREPOINT_SITE_PATH', '/sites/site-name');
```

The plugin also reads these same names from environment variables, which is useful for local CLI testing.

## Test Endpoint

After activation:

```text
https://your-wordpress-site.com/wp-json/metro/v1/registration/5318190
```

The response should be the registration PDF.

## Local PHP Test

From the plugin folder, with PHP installed:

```bash
export METRO_GRAPH_TENANT_ID="your-tenant-id"
export METRO_GRAPH_CLIENT_ID="your-client-id"
export METRO_GRAPH_CLIENT_SECRET="your-client-secret"
export METRO_SHAREPOINT_HOSTNAME="metrotrailerleasing.sharepoint.com"
export METRO_SHAREPOINT_LIBRARY_NAME="WebPortal"
export METRO_SHAREPOINT_BASE_FOLDER="FixedAssets"

php bin/test-lookup.php 5318190
```

On PowerShell:

```powershell
$env:METRO_GRAPH_TENANT_ID="your-tenant-id"
$env:METRO_GRAPH_CLIENT_ID="your-client-id"
$env:METRO_GRAPH_CLIENT_SECRET="your-client-secret"
$env:METRO_SHAREPOINT_HOSTNAME="metrotrailerleasing.sharepoint.com"
$env:METRO_SHAREPOINT_LIBRARY_NAME="WebPortal"
$env:METRO_SHAREPOINT_BASE_FOLDER="FixedAssets"

php bin/test-lookup.php 5318190
```

## Security Notes

- Do not put Microsoft secrets in a page builder, JavaScript, or committed plugin files.
- Rotate the Entra client secret before deploying because it was shared during testing.
- The public endpoint validates trailer numbers and only proxies PDFs found through the configured SharePoint path.
