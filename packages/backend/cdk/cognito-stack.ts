/// <reference types="node" />
import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as lambdaNodejs from 'aws-cdk-lib/aws-lambda-nodejs';
import * as path from 'path';

interface CognitoStackProps extends cdk.StackProps {
  allowedEmailDomains: string[];
}

export class CognitoStack extends cdk.Stack {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolId: string;
  public readonly userPoolClientId: string;

  constructor(scope: Construct, id: string, props: CognitoStackProps) {
    super(scope, id, props);

    if (!props.allowedEmailDomains || props.allowedEmailDomains.length === 0) {
      throw new Error(
        'CognitoStack requires at least one allowed email domain.'
      );
    }

    const userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: 'no-excel-pm-user-pool',
      selfSignUpEnabled: true,
      accountRecovery: cognito.AccountRecovery.PHONE_AND_EMAIL,
      userVerification: {
        emailStyle: cognito.VerificationEmailStyle.CODE,
      },
      autoVerify: {
        email: true,
      },
      standardAttributes: {
        email: {
          required: true,
          mutable: true,
        },
      },
    });

    const userPoolClient = new cognito.UserPoolClient(this, 'UserPoolClient', {
      userPool,
    });

    const preSignUpTrigger = new lambdaNodejs.NodejsFunction(
      this,
      'PreSignUpDomainCheckFunction',
      {
        runtime: lambda.Runtime.NODEJS_20_X,
        entry: path.join(
          __dirname,
          '..',
          'src',
          'handlers',
          'pre-signup-domain-check.ts'
        ),
        handler: 'handler',
        environment: {
          ALLOWED_EMAIL_DOMAINS: props.allowedEmailDomains.join(','),
        },
        bundling: {
          externalModules: ['aws-sdk'],
        },
      }
    );

    userPool.addTrigger(
      cognito.UserPoolOperation.PRE_SIGN_UP,
      preSignUpTrigger
    );

    // Store the IDs and instance for use in other stacks
    this.userPool = userPool;
    this.userPoolId = userPool.userPoolId;
    this.userPoolClientId = userPoolClient.userPoolClientId;

    new cdk.CfnOutput(this, 'UserPoolId', {
      value: userPool.userPoolId,
    });

    new cdk.CfnOutput(this, 'UserPoolClientId', {
      value: userPoolClient.userPoolClientId,
    });

    new cdk.CfnOutput(this, 'AllowedEmailDomains', {
      value: props.allowedEmailDomains.join(','),
    });
  }
}
