import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as cognito from 'aws-cdk-lib/aws-cognito';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

interface ApiStackProps extends cdk.StackProps {
  table: dynamodb.Table;
  userPool: cognito.UserPool;
}

export class ApiStack extends cdk.Stack {
  public readonly api: apigateway.RestApi;

  constructor(scope: Construct, id: string, props: ApiStackProps) {
    super(scope, id, props);

    const { table, userPool } = props;

    // Create Lambda execution role
    const lambdaRole = new iam.Role(this, 'LambdaExecutionRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          'service-role/AWSLambdaBasicExecutionRole'
        ),
      ],
    });

    // Grant DynamoDB permissions to Lambda role
    table.grantReadWriteData(lambdaRole);

    // Common Lambda environment variables
    const lambdaEnvironment = {
      TABLE_NAME: table.tableName,
    };

    // Create Lambda functions
    const getTasksLambda = new lambda.Function(this, 'GetTasksFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'tasks.getTasksHandler',
      code: lambda.Code.fromAsset('src/handlers'),
      environment: lambdaEnvironment,
      role: lambdaRole,
      timeout: cdk.Duration.seconds(30),
    });

    const getTaskLambda = new lambda.Function(this, 'GetTaskFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'tasks.getTaskHandler',
      code: lambda.Code.fromAsset('src/handlers'),
      environment: lambdaEnvironment,
      role: lambdaRole,
      timeout: cdk.Duration.seconds(30),
    });

    const createTaskLambda = new lambda.Function(this, 'CreateTaskFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'tasks.createTaskHandler',
      code: lambda.Code.fromAsset('src/handlers'),
      environment: lambdaEnvironment,
      role: lambdaRole,
      timeout: cdk.Duration.seconds(30),
    });

    const updateTaskLambda = new lambda.Function(this, 'UpdateTaskFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'tasks.updateTaskHandler',
      code: lambda.Code.fromAsset('src/handlers'),
      environment: lambdaEnvironment,
      role: lambdaRole,
      timeout: cdk.Duration.seconds(30),
    });

    const deleteTaskLambda = new lambda.Function(this, 'DeleteTaskFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'tasks.deleteTaskHandler',
      code: lambda.Code.fromAsset('src/handlers'),
      environment: lambdaEnvironment,
      role: lambdaRole,
      timeout: cdk.Duration.seconds(30),
    });

    const addCommentLambda = new lambda.Function(this, 'AddCommentFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'tasks.addCommentHandler',
      code: lambda.Code.fromAsset('src/handlers'),
      environment: lambdaEnvironment,
      role: lambdaRole,
      timeout: cdk.Duration.seconds(30),
    });

    const linkTaskLambda = new lambda.Function(this, 'LinkTaskFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'tasks.linkTaskHandler',
      code: lambda.Code.fromAsset('src/handlers'),
      environment: lambdaEnvironment,
      role: lambdaRole,
      timeout: cdk.Duration.seconds(30),
    });

    const unlinkTaskLambda = new lambda.Function(this, 'UnlinkTaskFunction', {
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'tasks.unlinkTaskHandler',
      code: lambda.Code.fromAsset('src/handlers'),
      environment: lambdaEnvironment,
      role: lambdaRole,
      timeout: cdk.Duration.seconds(30),
    });

    // Create API Gateway
    this.api = new apigateway.RestApi(this, 'NoExcelPMApi', {
      restApiName: 'No Excel PM API',
      description: 'API for No Excel PM project management app',
      defaultCorsPreflightOptions: {
        allowOrigins: apigateway.Cors.ALL_ORIGINS,
        allowMethods: apigateway.Cors.ALL_METHODS,
        allowHeaders: [
          'Content-Type',
          'Authorization',
          'X-Amz-Date',
          'X-Api-Key',
          'X-Amz-Security-Token',
        ],
      },
    });

    // Create Cognito authorizer
    const authorizer = new apigateway.CognitoUserPoolsAuthorizer(
      this,
      'CognitoAuthorizer',
      {
        cognitoUserPools: [userPool],
        authorizerName: 'CognitoAuthorizer',
        identitySource: 'method.request.header.Authorization',
      }
    );

    // Define API routes
    const tasks = this.api.root.addResource('tasks');
    const task = tasks.addResource('{id}');
    const comments = task.addResource('comments');
    const link = task.addResource('link');
    const unlinkResource = link.addResource('{linkedTaskId}');

    // GET /tasks
    tasks.addMethod('GET', new apigateway.LambdaIntegration(getTasksLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // POST /tasks
    tasks.addMethod('POST', new apigateway.LambdaIntegration(createTaskLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // GET /tasks/{id}
    task.addMethod('GET', new apigateway.LambdaIntegration(getTaskLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // PUT /tasks/{id}
    task.addMethod('PUT', new apigateway.LambdaIntegration(updateTaskLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // DELETE /tasks/{id}
    task.addMethod('DELETE', new apigateway.LambdaIntegration(deleteTaskLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // POST /tasks/{id}/comments
    comments.addMethod('POST', new apigateway.LambdaIntegration(addCommentLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // POST /tasks/{id}/link
    link.addMethod('POST', new apigateway.LambdaIntegration(linkTaskLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // DELETE /tasks/{id}/link/{linkedTaskId}
    unlinkResource.addMethod('DELETE', new apigateway.LambdaIntegration(unlinkTaskLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // Output the API endpoint
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: this.api.url,
      description: 'API Gateway endpoint URL',
      exportName: 'NoExcelPMApiEndpoint',
    });
  }
}
