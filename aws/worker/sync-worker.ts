import { spawn } from "node:child_process";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { DeleteMessageCommand, ReceiveMessageCommand, SQSClient } from "@aws-sdk/client-sqs";

type Integration = "skybitz" | "skybitzReconcile" | "record360" | "trailerDocuments";
type Mode = "daily" | "ondemand";

type SyncRequest = {
  requestId: string;
  integration: Integration;
  mode: Mode;
  fixedAssetNo?: string;
  requestedBy?: string;
  requestedAt?: string;
};

const queueUrl = process.env.SYNC_REQUEST_QUEUE_URL ?? "";
const tableName = process.env.SYNC_REQUEST_TABLE_NAME ?? "";
const sqs = new SQSClient({});
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

async function main() {
  const mode = process.env.SYNC_JOB_MODE ?? "queue";
  console.log(`Starting sync worker mode: ${mode}`);

  if (mode === "queue") {
    await processQueue();
    return;
  }

  await runJob(parseDirectMode(mode));
}

async function processQueue() {
  if (!queueUrl) {
    throw new Error("SYNC_REQUEST_QUEUE_URL is required for queue mode.");
  }

  let processedCount = 0;

  while (true) {
    const received = await sqs.send(
      new ReceiveMessageCommand({
        QueueUrl: queueUrl,
        MaxNumberOfMessages: 5,
        WaitTimeSeconds: 5,
        VisibilityTimeout: 7200,
      }),
    );

    const messages = received.Messages ?? [];
    if (messages.length === 0) {
      console.log(processedCount === 0 ? "No queued sync requests." : `Queue drained after ${processedCount} request(s).`);
      return;
    }

    console.log(`Received ${messages.length} queued sync request(s).`);
    for (const message of messages) {
      if (!message.Body || !message.ReceiptHandle) {
        continue;
      }

      const request = JSON.parse(message.Body) as SyncRequest;
      await updateRequest(request.requestId, "Running", "");
      try {
        await runJob(request);
        await updateRequest(request.requestId, "Succeeded", "");
        await sqs.send(
          new DeleteMessageCommand({
            QueueUrl: queueUrl,
            ReceiptHandle: message.ReceiptHandle,
          }),
        );
        processedCount += 1;
      } catch (error) {
        const messageText = error instanceof Error ? error.message : String(error);
        await updateRequest(request.requestId, "Failed", messageText);
        console.error(`Sync request ${request.requestId} failed: ${messageText}`);
      }
    }
  }
}

function parseDirectMode(value: string): SyncRequest {
  const [mode, rawIntegration] = value.split(":");
  if ((mode !== "daily" && mode !== "ondemand") || !rawIntegration) {
    throw new Error(`Unsupported SYNC_JOB_MODE: ${value}`);
  }

  const integration = normalizeIntegration(rawIntegration);
  return {
    requestId: `direct-${Date.now()}`,
    integration,
    mode,
    fixedAssetNo: process.env.SYNC_FIXED_ASSET_NO,
    requestedBy: "scheduler",
    requestedAt: new Date().toISOString(),
  };
}

function normalizeIntegration(value: string): Integration {
  if (value === "skybitz") {
    return "skybitz";
  }
  if (value === "skybitz-reconcile" || value === "skybitzReconcile") {
    return "skybitzReconcile";
  }
  if (value === "record360") {
    return "record360";
  }
  if (value === "trailer-documents" || value === "trailerDocuments") {
    return "trailerDocuments";
  }

  throw new Error(`Unsupported integration: ${value}`);
}

async function runJob(request: SyncRequest) {
  const command = buildCommand(request);
  console.log(`Running ${request.mode}:${request.integration}: ${command.join(" ")}`);
  await run(command[0], command.slice(1));
}

function buildCommand(request: SyncRequest) {
  if (request.mode === "daily") {
    if (request.integration === "skybitz") {
      return [
        "npm",
        "run",
        "skybitz:sync:bc:history",
        "--",
        "--write",
        "--since-last-successful-run",
        "--window-chunk-minutes=60",
        "--overlap-minutes=15",
        "--safety-lag-minutes=5",
        "--max-lookback-hours=24",
        "--stale-after-hours=24",
        "--concurrency=3",
      ];
    }
    if (request.integration === "skybitzReconcile") {
      return ["npm", "run", "skybitz:sync:bc:latest", "--", "--write", "--concurrency=3"];
    }
    if (request.integration === "record360") {
      return ["npm", "run", "record360:sync:bc", "--", "--write", "--concurrency=3"];
    }
    if (request.integration === "trailerDocuments") {
      return ["npm", "run", "sharepoint:sync:bc", "--", "--write", "--delta", "--concurrency=6"];
    }
  }

  const fixedAssetNo = request.fixedAssetNo?.trim();
  if (!fixedAssetNo) {
    throw new Error("fixedAssetNo is required for on-demand sync requests.");
  }

  if (request.integration === "skybitz") {
    return ["npm", "run", "skybitz:sync:bc:latest", "--", "--write", `--assetid=${fixedAssetNo}`, "--concurrency=1"];
  }
  if (request.integration === "record360") {
    return ["npm", "run", "record360:sync:bc", "--", "--write", `--trailer-no=${fixedAssetNo}`, "--concurrency=2"];
  }
  if (request.integration === "trailerDocuments") {
    return ["npm", "run", "sharepoint:sync:bc", "--", "--write", `--folders=${fixedAssetNo}`, "--concurrency=1"];
  }

  throw new Error(`Unsupported sync request: ${request.mode}:${request.integration}`);
}

function run(command: string, args: string[]) {
  return new Promise<void>((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      shell: process.platform === "win32",
      env: process.env,
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${command} exited with code ${code}`));
      }
    });
  });
}

async function updateRequest(requestId: string, status: string, errorMessage: string) {
  if (!tableName || requestId.startsWith("direct-")) {
    return;
  }

  await dynamo.send(
    new UpdateCommand({
      TableName: tableName,
      Key: { requestId },
      UpdateExpression: "set #status = :status, updatedAt = :updatedAt, errorMessage = :errorMessage",
      ExpressionAttributeNames: {
        "#status": "status",
      },
      ExpressionAttributeValues: {
        ":status": status,
        ":updatedAt": new Date().toISOString(),
        ":errorMessage": errorMessage,
      },
    }),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack : String(error));
  process.exit(1);
});
