#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { CognitoStack } from './cognito-stack';
import { AmplifyStack } from './amplify-stack';
import { DynamoDBStack } from './dynamodb-stack';
import { ApiStack } from './api-stack';
import { CloudFrontStack } from './cloudfront-stack';

type DeployConfigInput = {
  allowedEmailDomains?: string[] | string;
  allowedEmailOverrides?: string[] | string;
  domainName?: string;
  region?: string;
  certificateRegion?: string;
  githubToken?: string;
  hostedZoneId?: string;
  hostedZoneName?: string;
};

type DeployConfig = {
  allowedEmailDomains: string[];
  allowedEmailOverrides: string[];
  domainName: string;
  region: string;
  certificateRegion: string;
  githubToken?: string;
  hostedZoneId?: string;
  hostedZoneName?: string;
};

const DEFAULT_DEPLOY_CONFIG: DeployConfig = {
  allowedEmailDomains: ['paroview.com'],
  allowedEmailOverrides: [],
  domainName: 'paroview.com',
  region: 'us-east-1',
  certificateRegion: 'us-east-1',
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
    domainName:
      (select('domainName') as string | undefined) ??
      DEFAULT_DEPLOY_CONFIG.domainName,
    region:
      (select('region') as string | undefined) ?? DEFAULT_DEPLOY_CONFIG.region,
    certificateRegion:
      (select('certificateRegion') as string | undefined) ??
      DEFAULT_DEPLOY_CONFIG.certificateRegion,
    githubToken: select('githubToken') as string | undefined,
    hostedZoneId: select('hostedZoneId') as string | undefined,
    hostedZoneName: select('hostedZoneName') as string | undefined,
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

// Deploy CloudFront Stack for custom domain
// Stack executes in us-east-1; certificate is provisioned cross-region (us-east-1) as required by CloudFront
// Environment variables are configured separately to avoid cross-region references
new CloudFrontStack(app, 'ParoviewCloudFrontStack', {
  domainName: deployConfig.domainName,
  certificateRegion: deployConfig.certificateRegion,
  hostedZoneId: deployConfig.hostedZoneId,
  hostedZoneName: deployConfig.hostedZoneName,
  env: {
    region: deployConfig.region,
  },
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
