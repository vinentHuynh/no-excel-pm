#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CognitoStack } from './cognito-stack';
import { AmplifyStack } from './amplify-stack';
import { DynamoDBStack } from './dynamodb-stack';
import { ApiStack } from './api-stack';

type DeployConfigInput = {
  allowedEmailDomains?: string[] | string;
  allowedEmailOverrides?: string[] | string;
  region?: string;
  githubToken?: string;
};

type DeployConfig = {
  allowedEmailDomains: string[];
  allowedEmailOverrides: string[];
  region: string;
  githubToken?: string;
};

const DEFAULT_DEPLOY_CONFIG: DeployConfig = {
  allowedEmailDomains: [],
  allowedEmailOverrides: [],
  region: 'us-east-1',
};

const app = new cdk.App();

const rawDeployConfigFromContext = app.node.tryGetContext('deployConfig');

function coerceDeployConfig(input: unknown): DeployConfigInput {
  if (!input) {
    return {};
  }

  if (typeof input === 'string') {
    try {
      const parsed = JSON.parse(input);
      if (parsed && typeof parsed === 'object') {
        return parsed as DeployConfigInput;
      }
    } catch (error) {
      console.warn(
        'Warning: Failed to parse DEPLOY_CONFIG JSON. Falling back to defaults.'
      );
      console.warn(error instanceof Error ? error.message : error);
    }
    return {};
  }

  if (Array.isArray(input)) {
    return { allowedEmailDomains: input as string[] };
  }

  if (typeof input === 'object') {
    return input as DeployConfigInput;
  }

  return {};
}

function normaliseStringList(
  value: string[] | string | undefined,
  fallback: string[]
): string[] {
  if (!value) {
    return [...fallback];
  }

  const domains = Array.isArray(value)
    ? value
    : value
        .split(',')
        .map((domain) => domain.trim())
        .filter((domain) => domain.length > 0);

  return domains.map((domain) => domain.toLowerCase());
}

function buildDeployConfig(): DeployConfig {
  const envConfig = coerceDeployConfig(process.env.DEPLOY_CONFIG);
  const contextConfig = coerceDeployConfig(rawDeployConfigFromContext);

  const select = <K extends keyof DeployConfigInput>(key: K) =>
    envConfig[key] ?? contextConfig[key];

  const allowedEmailDomains = normaliseStringList(
    select('allowedEmailDomains'),
    DEFAULT_DEPLOY_CONFIG.allowedEmailDomains
  );
  const allowedEmailOverrides = normaliseStringList(
    select('allowedEmailOverrides'),
    DEFAULT_DEPLOY_CONFIG.allowedEmailOverrides
  );

  if (allowedEmailDomains.length === 0) {
    throw new Error(
      'No allowed email domains configured. Provide DEPLOY_CONFIG.allowedEmailDomains or include them in deployConfig context.'
    );
  }

  return {
    allowedEmailDomains,
    allowedEmailOverrides,
    region:
      (select('region') as string | undefined) ?? DEFAULT_DEPLOY_CONFIG.region,
    githubToken: select('githubToken') as string | undefined,
  };
}

const deployConfig = buildDeployConfig();

// Get GitHub token from deploy config or context
const githubToken =
  deployConfig.githubToken ?? app.node.tryGetContext('githubToken');

if (!githubToken) {
  console.warn(
    'Warning: GitHub token not provided. Amplify stack will not be deployed.\n' +
      'Set githubToken in DEPLOY_CONFIG or run: pnpm cdk deploy --all --context githubToken=YOUR_GITHUB_TOKEN'
  );
}

// Deploy Cognito Stack
const cognitoStack = new CognitoStack(app, 'ParoviewCognitoStack', {
  allowedEmailDomains: deployConfig.allowedEmailDomains,
  allowedEmailOverrides: deployConfig.allowedEmailOverrides,
});

// Deploy DynamoDB Stack
const dynamoDBStack = new DynamoDBStack(app, 'ParoviewDynamoDBStack');

// Deploy API Stack
const apiStack = new ApiStack(app, 'ParoviewApiStack', {
  table: dynamoDBStack.table,
  userPool: cognitoStack.userPool,
});

// Deploy Amplify Stack (only if GitHub token is provided)
if (githubToken) {
  new AmplifyStack(app, 'ParoviewAmplifyStack', {
    userPoolId: cognitoStack.userPoolId,
    userPoolClientId: cognitoStack.userPoolClientId,
    githubToken: githubToken,
    allowedEmailDomains: deployConfig.allowedEmailDomains,
    allowedEmailOverrides: deployConfig.allowedEmailOverrides,
  });
}
