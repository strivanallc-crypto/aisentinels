#!/usr/bin/env node
const cdk = require('aws-cdk-lib');
const { AisentinelsStack } = require('../lib/aisentinels-stack');

const app = new cdk.App();

new AisentinelsStack(app, 'AisentinelsStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION || 'us-east-1',
  },
  tags: {
    Project: 'aisentinels',
    Environment: 'production',
  },
});

app.synth();
