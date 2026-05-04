import { randomUUID } from "node:crypto";

import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { DynamoDBDocumentClient, GetCommand, PutCommand } from "@aws-sdk/lib-dynamodb";
import { ECSClient, RunTaskCommand } from "@aws-sdk/client-ecs";
import { GetSecretValueCommand, SecretsManagerClient } from "@aws-sdk/client-secrets-manager";
import { SendMessageCommand, SQSClient } from "@aws-sdk/client-sqs";

type Integration = "skybitz" | "record360" | "trailerDocuments";
type RequestedBy = "bc" | "wordpress" | "scheduler" | "manual";

type RequestBody = {
  fixedAssetNo?: string;
  requestedBy?: RequestedBy;
  mode?: "daily" | "ondemand";
};

const queueUrl = mustEnv("SYNC_REQUEST_QUEUE_URL");
const tableName = mustEnv("SYNC_REQUEST_TABLE_NAME");
const apiSecretArn = mustEnv("SYNC_API_SECRET_ARN");
const workerClusterArn = mustEnv("SYNC_WORKER_CLUSTER_ARN");
const workerTaskDefinitionArn = mustEnv("SYNC_WORKER_TASK_DEFINITION_ARN");
const workerContainerName = mustEnv("SYNC_WORKER_CONTAINER_NAME");
const workerSecurityGroupId = mustEnv("SYNC_WORKER_SECURITY_GROUP_ID");
const workerSubnetIds = mustEnv("SYNC_WORKER_SUBNET_IDS").split(",").filter(Boolean);

const sqs = new SQSClient({});
const ecs = new ECSClient({});
const secrets = new SecretsManagerClient({});
const dynamo = DynamoDBDocumentClient.from(new DynamoDBClient({}));

let cachedApiKey: string | null = null;

export async function handler(event: any) {
  try {
    if (event.httpMethod === "OPTIONS") {
      return response(204, {});
    }

    const path = String(event.path ?? "");
    if (event.httpMethod === "GET" && path.includes("/sync/status/")) {
      await validateApiKey(event);
      const requestId = event.pathParameters?.requestId;
      if (!requestId) {
        return response(400, { message: "Missing requestId." });
      }

      const result = await dynamo.send(
        new GetCommand({
          TableName: tableName,
          Key: { requestId },
        }),
      );
      return response(result.Item ? 200 : 404, result.Item ?? { message: "Request not found." });
    }

    if (event.httpMethod !== "POST") {
      return response(405, { message: "Method not allowed." });
    }

    await validateApiKey(event);
    const integration = parseIntegration(path);
    const body = parseBody(event.body);
    const mode = body.mode ?? "ondemand";

    if (mode === "ondemand" && !body.fixedAssetNo?.trim()) {
      return response(400, { message: "fixedAssetNo is required for on-demand sync requests." });
    }

    const now = new Date().toISOString();
    const request = {
      requestId: randomUUID(),
      integration,
      mode,
      fixedAssetNo: body.fixedAssetNo?.trim() ?? "",
      requestedBy: body.requestedBy ?? "bc",
      requestedAt: now,
      status: "Queued",
      updatedAt: now,
    };

    await dynamo.send(
      new PutCommand({
        TableName: tableName,
        Item: request,
      }),
    );

    await sqs.send(
      new SendMessageCommand({
        QueueUrl: queueUrl,
        MessageBody: JSON.stringify(request),
      }),
    );

    await startQueueWorker();

    return response(202, request);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const statusCode = message === "Unauthorized" ? 401 : 500;
    return response(statusCode, { message });
  }
}

async function startQueueWorker() {
  if (workerSubnetIds.length === 0) {
    throw new Error("SYNC_WORKER_SUBNET_IDS is empty.");
  }

  await ecs.send(
    new RunTaskCommand({
      cluster: workerClusterArn,
      taskDefinition: workerTaskDefinitionArn,
      launchType: "FARGATE",
      count: 1,
      networkConfiguration: {
        awsvpcConfiguration: {
          assignPublicIp: "ENABLED",
          securityGroups: [workerSecurityGroupId],
          subnets: workerSubnetIds,
        },
      },
      overrides: {
        containerOverrides: [
          {
            name: workerContainerName,
            environment: [{ name: "SYNC_JOB_MODE", value: "queue" }],
          },
        ],
      },
    }),
  );
}

function mustEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing environment variable: ${name}`);
  }
  return value;
}

async function validateApiKey(event: any) {
  const provided = getHeader(event.headers, "x-metro-sync-key");
  const expected = await getApiKey();
  if (!provided || provided !== expected) {
    throw new Error("Unauthorized");
  }
}

async function getApiKey() {
  if (cachedApiKey) {
    return cachedApiKey;
  }

  const result = await secrets.send(new GetSecretValueCommand({ SecretId: apiSecretArn }));
  const raw = result.SecretString ?? "{}";
  const parsed = JSON.parse(raw) as { apiKey?: string };
  if (!parsed.apiKey) {
    throw new Error("Sync API secret does not contain apiKey.");
  }

  cachedApiKey = parsed.apiKey;
  return cachedApiKey;
}

function getHeader(headers: Record<string, string | undefined> | undefined, name: string) {
  if (!headers) {
    return "";
  }

  const found = Object.entries(headers).find(([key]) => key.toLowerCase() === name.toLowerCase());
  return found?.[1] ?? "";
}

function parseIntegration(path: string): Integration {
  if (path.endsWith("/sync/skybitz")) {
    return "skybitz";
  }
  if (path.endsWith("/sync/record360")) {
    return "record360";
  }
  if (path.endsWith("/sync/trailer-documents")) {
    return "trailerDocuments";
  }
  throw new Error(`Unsupported sync path: ${path}`);
}

function parseBody(body: string | null | undefined): RequestBody {
  if (!body) {
    return {};
  }

  return JSON.parse(body) as RequestBody;
}

function response(statusCode: number, body: unknown) {
  return {
    statusCode,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers": "Content-Type,X-Metro-Sync-Key",
      "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
      "Content-Type": "application/json",
    },
    body: statusCode === 204 ? "" : JSON.stringify(body),
  };
}
