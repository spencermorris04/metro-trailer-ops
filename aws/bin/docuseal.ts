#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";

import { DocusealRuntimeStack, LeaseSigningArchiveStack } from "../lib/docuseal-stack";

const app = new cdk.App();

const env = {
  account: process.env.CDK_DEFAULT_ACCOUNT ?? "452391802972",
  region: process.env.CDK_DEFAULT_REGION ?? process.env.AWS_REGION ?? "us-east-2",
};

new LeaseSigningArchiveStack(app, "MetroTrailerLeaseSigningArchive", { env });
new DocusealRuntimeStack(app, "MetroTrailerDocuseal", { env });
