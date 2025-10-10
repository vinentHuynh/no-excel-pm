import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as amplify from 'aws-cdk-lib/aws-amplify';
import * as codebuild from 'aws-cdk-lib/aws-codebuild';

interface AmplifyStackProps extends cdk.StackProps {
  userPoolId: string;
  userPoolClientId: string;
  githubToken: string;
  allowedEmailDomains: string[];
}

export class AmplifyStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: AmplifyStackProps) {
    super(scope, id, props);

    // Create Amplify App
    const amplifyApp = new amplify.CfnApp(this, 'ParoviewApp', {
      name: 'paroview',
      repository: 'https://github.com/vinentHuynh/paroview',
      accessToken: props.githubToken,
      buildSpec: `version: 1
frontend:
  phases:
    preBuild:
      commands:
        - npm i -g pnpm
        - pnpm install
    build:
      commands:
        - pnpm --filter "frontend" build
  artifacts:
    baseDirectory: packages/frontend/dist
    files:
      - '**/*'
  cache:
    paths:
      - node_modules/**/*`,
      environmentVariables: [
        {
          name: 'VITE_COGNITO_USER_POOL_ID',
          value: props.userPoolId,
        },
        {
          name: 'VITE_COGNITO_USER_POOL_CLIENT_ID',
          value: props.userPoolClientId,
        },
        {
          name: 'VITE_ALLOWED_EMAIL_DOMAINS',
          value: props.allowedEmailDomains.join(','),
        },
      ],
      platform: 'WEB_COMPUTE',
    });

    // Create main branch
    const mainBranch = new amplify.CfnBranch(this, 'MainBranch', {
      appId: amplifyApp.attrAppId,
      branchName: 'main',
      enableAutoBuild: true,
      enablePullRequestPreview: false,
      stage: 'PRODUCTION',
    });

    // Output Amplify App URL
    new cdk.CfnOutput(this, 'AmplifyAppId', {
      value: amplifyApp.attrAppId,
      description: 'Amplify App ID',
    });

    new cdk.CfnOutput(this, 'AmplifyAppUrl', {
      value: `https://main.${amplifyApp.attrDefaultDomain}`,
      description: 'Amplify App URL',
    });
  }
}
