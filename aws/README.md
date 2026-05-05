# Metro Trailer AWS Sync Backend

This folder contains the AWS infrastructure and runtime code for the unified sync backend.

## Architecture

- API Gateway accepts on-demand sync requests from Business Central or WordPress.
- A Lambda handler validates the API key, writes request status to DynamoDB, enqueues work to SQS, and starts one ECS queue worker task.
- ECS Fargate runs one reusable worker image for both daily scheduled jobs and queued on-demand jobs.
- EventBridge Scheduler starts daily ECS tasks for SkyBitz, Record360, and Trailer Documents.
- Secrets Manager stores Business Central, SkyBitz, Record360, SharePoint, and API caller credentials.

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
- `metro-trailer/record360`
- `metro-trailer/sharepoint`
- `metro-trailer/sync-api`

This workstation currently does not have Docker installed, so the stack includes an AWS CodeBuild project that builds and pushes the worker image inside AWS.

Worker image build flow:

1. Create a source archive with POSIX paths.
2. Upload it to `WorkerSourceBucketName` at `source/metro-trailer-sync-worker.zip`.
3. Start the `WorkerImageBuildProjectName` CodeBuild project.
4. The project builds `aws/Dockerfile` and pushes `latest` to `WorkerRepositoryUri`.

The SkyBitz, Record360, and trailer-documents daily schedules are enabled. Trailer documents uses the SharePoint delta/backfill state files so the daily run does not intentionally rescan every folder.

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
- `daily:record360`
- `daily:trailer-documents`
- `ondemand:skybitz`
- `ondemand:record360`
- `ondemand:trailer-documents`
- `queue`

The queue mode receives messages from `metro-trailer-sync-requests` and dispatches to one of the on-demand modes. The queue worker is started by the intake Lambda per request instead of polling every minute, so idle Fargate cost stays at zero.

## Current Deployment

Deployed stack:

- API URL: `https://t2u05hxf4c.execute-api.us-east-2.amazonaws.com/prod/`
- Worker ECR repo: `452391802972.dkr.ecr.us-east-2.amazonaws.com/metro-trailer-sync-worker`
- Worker source bucket: `metro-trailer-sync-worker-source-452391802972-us-east-2`
- Worker image build project: `metro-trailer-sync-worker-image`

The API intake and queue worker have been smoke-tested with an on-demand SkyBitz request for fixed asset `533442`.

## Business Central Buttons

Each BC extension now includes a small setup page and `Request Sync` actions on the Fixed Asset Card and related FactBox:

- `SkyBitz Sync API Setup`
- `Record360 Sync API Setup`
- `Trailer Document Sync API Setup`

Set `API Base URL` to the deployed API Gateway URL without a trailing slash, and set `API Key` to the `apiKey` value stored in `metro-trailer/sync-api`.

The actions call:

- `POST /sync/skybitz`
- `POST /sync/record360`
- `POST /sync/trailer-documents`

The action returns after the request is queued. The ECS worker processes the queue asynchronously and writes the refreshed rows back to the existing Business Central integration tables.

Business Central may require enabling outbound HTTP requests for each extension in Extension Management before these actions can call AWS.
