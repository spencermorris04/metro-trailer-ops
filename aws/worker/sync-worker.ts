import { spawn } from "node:child_process";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, UpdateCommand } from "@aws-sdk/lib-dynamodb";
import { DeleteMessageCommand, ReceiveMessageCommand, SQSClient } from "@aws-sdk/client-sqs";

type Integration = "skybitz" | "record360" | "trailerDocuments";
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
    console.log("No queued sync requests.");
    return;
  }

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
    } catch (error) {
      const messageText = error instanceof Error ? error.message : String(error);
      await updateRequest(request.requestId, "Failed", messageText);
      throw error;
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
      return ["npm", "run", "skybitz:sync:bc:latest", "--", "--write", "--concurrency=3"];
    }
    if (request.integration === "record360") {
      return ["npm", "run", "record360:sync:bc", "--", "--write", "--concurrency=3"];
    }
    return ["npm", "run", "sharepoint:sync:bc", "--", "--write", "--delta", "--concurrency=6"];
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
  return ["npm", "run", "sharepoint:sync:bc", "--", "--write", `--folders=${fixedAssetNo}`, "--concurrency=1"];
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
