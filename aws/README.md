# Metro Trailer AWS Sync Backend

This folder contains the AWS infrastructure and runtime code for the unified sync backend.

## Architecture

- API Gateway accepts on-demand sync requests from Business Central or WordPress.
- A Lambda handler validates the API key, writes request status to DynamoDB, enqueues work to SQS, and starts one ECS queue worker task.
- ECS Fargate runs one reusable worker image for both daily scheduled jobs and queued on-demand jobs.
- EventBridge Scheduler starts daily ECS tasks for SkyBitz, Record360, and Trailer Documents, plus an hourly ORBCOMM ECS task.
- Secrets Manager stores Business Central, SkyBitz, ORBCOMM, Record360, SharePoint, and API caller credentials.

## Deployment Notes

The CDK stack creates the ECR repository, ECS cluster, task definition, schedules, queue, API, and secrets. By default the ECS task definition references the `latest` image tag, but GitHub Actions deployments pass `workerImageTag=<git-sha>` so production tasks use immutable image tags.

Synthesize the stack:

```bash
$env:AWS_PROFILE="metro-trailer-deploy-admin"; npm run aws:synth
```

Deploy the stack:

```bash
$env:AWS_PROFILE="metro-trailer-deploy-admin"; npm run aws:deploy
```

After deployment, fill the generated Secrets Manager secrets:

- `metro-trailer/business-central`
- `metro-trailer/skybitz`
- `metro-trailer/orbcomm`
- `metro-trailer/record360`
- `metro-trailer/sharepoint`
- `metro-trailer/sync-api`

This workstation currently does not have Docker installed, so the stack includes an AWS CodeBuild project that builds and pushes the worker image inside AWS.

Worker image build flow:

1. Create a source archive with POSIX paths.
2. Upload it to `WorkerSourceBucketName` at `source/metro-trailer-sync-worker.zip`.
3. Start the `WorkerImageBuildProjectName` CodeBuild project.
4. The project builds `aws/Dockerfile` and pushes `latest` to `WorkerRepositoryUri`.

The SkyBitz, Record360, and trailer-documents daily schedules are enabled. ORBCOMM runs hourly with a 75-minute rolling lookback so the job stays inside the provider's practical request size and polling limits. Trailer documents uses the SharePoint delta/backfill state files so the daily run does not intentionally rescan every folder.

## GitHub Actions Deployment

The preferred deployment path is the manual GitHub Actions workflow:

- workflow: `.github/workflows/deploy-aws-sync-backend.yml`
- trigger: manual `workflow_dispatch`
- repo: `spencermorris04/metro-trailer-ops`
- branch: `main`
- AWS role: `arn:aws:iam::452391802972:role/metro-trailer-github-actions-deploy`

The workflow:

1. checks out the repo
2. installs npm dependencies
3. type-checks the AWS worker/CDK/SkyBitz sync code
4. assumes the AWS deploy role using GitHub OIDC
5. builds `aws/Dockerfile`
6. pushes the worker image to ECR using the Git commit SHA as the image tag
7. deploys CDK with `-c workerImageTag=<git-sha>`

That means future ECS tasks use an immutable image tag tied to a Git commit, not a mutable `latest` tag.

The S3 + CodeBuild worker image flow above remains available as a local fallback, but it should not be the normal deployment method once the GitHub workflow has been verified.

## Runtime Modes

- `daily:skybitz`
- `daily:orbcomm`
- `daily:record360`
- `daily:trailer-documents`
- `ondemand:skybitz`
- `ondemand:orbcomm`
- `ondemand:telematics`
- `ondemand:record360`
- `ondemand:trailer-documents`
- `queue`

The queue mode receives messages from `metro-trailer-sync-requests` and dispatches to one of the on-demand modes. The queue worker is started by the intake Lambda per request instead of polling every minute, so idle Fargate cost stays at zero.

ORBCOMM's scheduled mode intentionally does not use a 24-hour catch-up window. The provider throttles repeated polling requests and large history windows can time out, so production uses one hourly run at minute 30 with `--max-lookback-hours=1.25` and `--window-chunk-minutes=75`. The 15-minute overlap is safe because telematics rows are upserted by provider/tracker and unchanged source hashes are skipped. If a longer outage occurs, run a manual backfill window intentionally instead of making every hourly job try to catch up a full day.

## Current Deployment

Deployed stack:

- API URL: `https://t2u05hxf4c.execute-api.us-east-2.amazonaws.com/prod/`
- Worker ECR repo: `452391802972.dkr.ecr.us-east-2.amazonaws.com/metro-trailer-sync-worker`
- Worker source bucket: `metro-trailer-sync-worker-source-452391802972-us-east-2`
- Worker image build project: `metro-trailer-sync-worker-image`

The API intake and queue worker have been smoke-tested with an on-demand SkyBitz request for fixed asset `533442`.

## DocuSeal Self-Hosted Deployment

DocuSeal OSS was cloned locally at `C:\Users\NewOwner\Software\docuseal` from `https://github.com/docusealco/docuseal`.

The self-hosted AWS deployment is managed separately from the sync backend so it can be deployed without touching the SQS/ECS worker platform:

```bash
$env:AWS_PROFILE="metro-trailer-deploy-admin"; npm run docuseal:synth -- --all
$env:AWS_PROFILE="metro-trailer-deploy-admin"; npm run docuseal:deploy -- --all --require-approval never
```

Deployed stacks:

- `MetroTrailerDocuseal`
- `MetroTrailerLeaseSigningArchive`

DocuSeal runtime:

- Public URL: `https://esign.lumpkindevelopment.com`
- Public ALB DNS: `MetroT-LoadB-LalZP5zYG7S5-765696422.us-east-2.elb.amazonaws.com`
- ACM certificate: `arn:aws:acm:us-east-2:452391802972:certificate/dbc186a4-eed8-4b21-8dd1-ece6a1ebdedd`
- ECS cluster: `metro-trailer-docuseal`
- ECR repository: `452391802972.dkr.ecr.us-east-2.amazonaws.com/metro-trailer-docuseal`
- Current deployed image tag: `48bed3c53f3a7eaf15c8ca61258ae568c6584162`
- Active Storage bucket: `metro-trailer-docuseal-attachments-452391802972-us-east-2`
- Secrets:
  - `metro-trailer/docuseal/app`
  - `metro-trailer/docuseal/database`
  - `metro-trailer/docuseal/smtp`

DocuSeal email is configured through Resend SMTP using the already verified `lumpkindevelopment.com` domain. The ECS task reads `SMTP_PASSWORD` and `SMTP_FROM` from `metro-trailer/docuseal/smtp`; the current sender is `Metro Trailer E-Sign <documents@lumpkindevelopment.com>`. Email invitation links use `EMAIL_HOST=esign.lumpkindevelopment.com`, and DocuSeal runs with `APP_URL=https://esign.lumpkindevelopment.com` and `FORCE_SSL=true`.

Metro Trailer branding is maintained in the private GitHub repository `spencermorris04/metro-trailer-esign`, with a local clone at `C:\Users\NewOwner\Software\docuseal`. Normal app-only changes should be committed and pushed to that repo's `main` branch. Its `.github/workflows/deploy-metro-esign.yml` workflow builds the Docker image, pushes it to the ECR repository above using the commit SHA as the tag, registers a new ECS task definition revision, and updates the `metro-trailer-docuseal` ECS service.

Use the CDK deploy path below when the AWS infrastructure itself changes or when manually pinning a known image tag:

```bash
npm run docuseal:deploy -- MetroTrailerDocuseal --require-approval never -c docusealDomainName=esign.lumpkindevelopment.com -c docusealCertificateArn=arn:aws:acm:us-east-2:452391802972:certificate/dbc186a4-eed8-4b21-8dd1-ece6a1ebdedd -c docusealUseCustomImage=true -c docusealImageTag=<image-tag>
```

The older S3/CodeBuild image flow remains available as a fallback: upload a ZIP of the DocuSeal repo to `s3://metro-trailer-docuseal-source-452391802972-us-east-2/source/docuseal.zip`, run the CodeBuild project `metro-trailer-docuseal-image`, then deploy the resulting tag with the CDK command above.

Completed lease evidence archive:

- Bucket: `metro-trailer-docuseal-archive-452391802972-us-east-2`
- Trail bucket: `metro-trailer-docuseal-archive-trail-452391802972-us-east-2`
- KMS key: `arn:aws:kms:us-east-2:452391802972:key/691fb2f2-5838-4830-bb18-e97ffc65cfb9`
- Writer role: `arn:aws:iam::452391802972:role/metro-trailer-lease-archive-writer`
- Reader role: `arn:aws:iam::452391802972:role/metro-trailer-lease-archive-reader`

DocuSeal working attachments use the Active Storage bucket above via the ECS task role and `S3_ATTACHMENTS_BUCKET`. The archive bucket is configured with S3 Object Lock, versioning, SSE-KMS, blocked public access, and default 7-year Governance retention. CloudTrail data-event logging is enabled for object-level archive access. Do not use DocuSeal's working storage as the evidentiary archive; archive completed signed PDFs, certificates, metadata, and hashes into the locked bucket from the backend workflow.

## Business Central Buttons

Each BC extension now includes a small setup page and `Request Sync` actions on the Fixed Asset Card and related FactBox:

- `SkyBitz Sync API Setup`
- `Record360 Sync API Setup`
- `Trailer Document Sync API Setup`
- `Telematics Sync API Setup`

Set `API Base URL` to the deployed API Gateway URL without a trailing slash, and set `API Key` to the `apiKey` value stored in `metro-trailer/sync-api`.

The actions call:

- `POST /sync/skybitz`
- `POST /sync/record360`
- `POST /sync/trailer-documents`
- `POST /sync/telematics`

The action returns after the request is queued. The ECS worker processes the queue asynchronously and writes the refreshed rows back to the existing Business Central integration tables.

Business Central may require enabling outbound HTTP requests for each extension in Extension Management before these actions can call AWS.
