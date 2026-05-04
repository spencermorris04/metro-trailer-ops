#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";

import { MetroSyncBackendStack } from "../lib/metro-sync-backend-stack";

const app = new cdk.App();

new MetroSyncBackendStack(app, "MetroTrailerSyncBackend", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT ?? "452391802972",
    region: process.env.CDK_DEFAULT_REGION ?? process.env.AWS_REGION ?? "us-east-2",
  },
});
