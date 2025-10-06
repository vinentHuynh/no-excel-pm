#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CognitoStack } from './cognito-stack';
import { AmplifyStack } from './amplify-stack';
import { DynamoDBStack } from './dynamodb-stack';
import { ApiStack } from './api-stack';

const app = new cdk.App();

// Get GitHub token from context (you'll pass this as a parameter)
const githubToken = app.node.tryGetContext('githubToken');

if (!githubToken) {
  console.warn(
    'Warning: GitHub token not provided. Amplify stack will not be deployed.\n' +
      'To deploy Amplify stack, run: pnpm cdk deploy --all --context githubToken=YOUR_GITHUB_TOKEN'
  );
}

// Deploy Cognito Stack
const cognitoStack = new CognitoStack(app, 'CognitoStack');

// Deploy DynamoDB Stack
const dynamoDBStack = new DynamoDBStack(app, 'DynamoDBStack');

// Deploy API Stack
const apiStack = new ApiStack(app, 'ApiStack', {
  table: dynamoDBStack.table,
  userPool: cognitoStack.userPool,
});

// Deploy Amplify Stack (only if GitHub token is provided)
if (githubToken) {
  new AmplifyStack(app, 'AmplifyStack', {
    userPoolId: cognitoStack.userPoolId,
    userPoolClientId: cognitoStack.userPoolClientId,
    githubToken: githubToken,
  });
}
