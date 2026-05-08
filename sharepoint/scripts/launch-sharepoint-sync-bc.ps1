param(
    [string]$SummaryPath,
    [string]$LogPath,
    [switch]$Write,
    [switch]$SkipExistingFolders,
    [int]$Concurrency = 10,
    [int]$ProgressIntervalSeconds = 15,
    [int]$BcHeartbeatSeconds = 60
)

$ErrorActionPreference = 'Stop'

Set-Location 'C:\Users\NewOwner\Software\metro-trailer'

function Require-Env([string]$Name) {
    if ([string]::IsNullOrWhiteSpace([Environment]::GetEnvironmentVariable($Name))) {
        throw "Missing required environment variable: $Name"
    }
}

$requiredEnv = @(
    'METRO_GRAPH_TENANT_ID',
    'METRO_GRAPH_CLIENT_ID',
    'METRO_GRAPH_CLIENT_SECRET',
    'METRO_BC_ENVIRONMENT',
    'METRO_BC_COMPANY',
    'SHAREPOINT_HOSTNAME',
    'SHAREPOINT_SITE_ID',
    'SHAREPOINT_LIBRARY_NAME',
    'SHAREPOINT_BASE_FOLDER'
)

foreach ($name in $requiredEnv) {
    Require-Env $name
}

$args = @('run', 'sharepoint:sync:bc', '--')

if ($Write) {
    $args += '--write'
}

if ($SkipExistingFolders) {
    $args += '--skip-existing-folders'
}

$args += "--summary=$SummaryPath"
$args += "--progress-interval-seconds=$ProgressIntervalSeconds"
$args += "--bc-heartbeat-seconds=$BcHeartbeatSeconds"
$args += "--concurrency=$Concurrency"

& npm.cmd @args *>> $LogPath
