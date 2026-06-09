#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";

import { LumpkinImageAssetsStack } from "../lib/lumpkin-image-assets-stack";

const app = new cdk.App();

new LumpkinImageAssetsStack(app, "LumpkinImageAssets", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT ?? "452391802972",
    region: process.env.CDK_DEFAULT_REGION ?? process.env.AWS_REGION ?? "us-east-2",
  },
});
