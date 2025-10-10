#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CognitoStack } from './cognito-stack';
import { AmplifyStack } from './amplify-stack';
import { DynamoDBStack } from './dynamodb-stack';
import { ApiStack } from './api-stack';
import { CloudFrontStack } from './cloudfront-stack';

const app = new cdk.App();

// Get GitHub token from context (you'll pass this as a parameter)
const githubToken = app.node.tryGetContext('githubToken');
const allowedEmailDomainsContext = app.node.tryGetContext(
  'allowedEmailDomains'
);

const allowedEmailDomains = (() => {
  if (Array.isArray(allowedEmailDomainsContext)) {
    return allowedEmailDomainsContext;
  }

  if (typeof allowedEmailDomainsContext === 'string') {
    return allowedEmailDomainsContext.split(',');
  }

  const envDomains = process.env.ALLOWED_EMAIL_DOMAINS;
  if (envDomains) {
    return envDomains.split(',');
  }

  return ['noexcelpm.com'];
})()
  .map((domain) => domain.trim().toLowerCase())
  .filter((domain) => domain.length > 0);

if (allowedEmailDomains.length === 0) {
  throw new Error(
    'No allowed email domains configured. Provide context allowedEmailDomains or set ALLOWED_EMAIL_DOMAINS env variable.'
  );
}

if (!githubToken) {
  console.warn(
    'Warning: GitHub token not provided. Amplify stack will not be deployed.\n' +
      'To deploy Amplify stack, run: pnpm cdk deploy --all --context githubToken=YOUR_GITHUB_TOKEN'
  );
}

// Deploy Cognito Stack
const cognitoStack = new CognitoStack(app, 'CognitoStack', {
  allowedEmailDomains,
});

// Deploy DynamoDB Stack
const dynamoDBStack = new DynamoDBStack(app, 'DynamoDBStack');

// Deploy API Stack
const apiStack = new ApiStack(app, 'ApiStack', {
  table: dynamoDBStack.table,
  userPool: cognitoStack.userPool,
});

// Deploy CloudFront Stack for custom domain
// Note: This stack is in us-east-1 (required for ACM certificate with CloudFront)
// Environment variables are configured separately to avoid cross-region references
new CloudFrontStack(app, 'CloudFrontStack', {
  domainName: 'no-excel-pm.com',
  env: {
    // Certificate must be in us-east-1 for CloudFront
    region: 'us-east-2',
  },
});

// Deploy Amplify Stack (only if GitHub token is provided)
if (githubToken) {
  new AmplifyStack(app, 'AmplifyStack', {
    userPoolId: cognitoStack.userPoolId,
    userPoolClientId: cognitoStack.userPoolClientId,
    githubToken: githubToken,
    allowedEmailDomains,
  });
}
