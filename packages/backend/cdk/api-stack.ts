import * as cdk from 'aws-cdk-lib';
import * as apigateway from 'aws-cdk-lib/aws-apigateway';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as nodejs from 'aws-cdk-lib/aws-lambda-nodejs';
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

    // Create Lambda functions using NodejsFunction for automatic bundling
    const getTasksLambda = new nodejs.NodejsFunction(this, 'GetTasksFunction', {
      entry: 'src/handlers/tasks.ts',
      handler: 'getTasksHandler',
      runtime: lambda.Runtime.NODEJS_20_X,
      environment: lambdaEnvironment,
      role: lambdaRole,
      timeout: cdk.Duration.seconds(30),
      bundling: {
        minify: false,
        sourceMap: true,
        externalModules: ['aws-sdk'],
      },
    });

    const getTaskLambda = new nodejs.NodejsFunction(this, 'GetTaskFunction', {
      entry: 'src/handlers/tasks.ts',
      handler: 'getTaskHandler',
      runtime: lambda.Runtime.NODEJS_20_X,
      environment: lambdaEnvironment,
      role: lambdaRole,
      timeout: cdk.Duration.seconds(30),
      bundling: {
        minify: false,
        sourceMap: true,
        externalModules: ['aws-sdk'],
      },
    });

    const createTaskLambda = new nodejs.NodejsFunction(
      this,
      'CreateTaskFunction',
      {
        entry: 'src/handlers/tasks.ts',
        handler: 'createTaskHandler',
        runtime: lambda.Runtime.NODEJS_20_X,
        environment: lambdaEnvironment,
        role: lambdaRole,
        timeout: cdk.Duration.seconds(30),
        bundling: {
          minify: false,
          sourceMap: true,
          externalModules: ['aws-sdk'],
        },
      }
    );

    const updateTaskLambda = new nodejs.NodejsFunction(
      this,
      'UpdateTaskFunction',
      {
        entry: 'src/handlers/tasks.ts',
        handler: 'updateTaskHandler',
        runtime: lambda.Runtime.NODEJS_20_X,
        environment: lambdaEnvironment,
        role: lambdaRole,
        timeout: cdk.Duration.seconds(30),
        bundling: {
          minify: false,
          sourceMap: true,
          externalModules: ['aws-sdk'],
        },
      }
    );

    const deleteTaskLambda = new nodejs.NodejsFunction(
      this,
      'DeleteTaskFunction',
      {
        entry: 'src/handlers/tasks.ts',
        handler: 'deleteTaskHandler',
        runtime: lambda.Runtime.NODEJS_20_X,
        environment: lambdaEnvironment,
        role: lambdaRole,
        timeout: cdk.Duration.seconds(30),
        bundling: {
          minify: false,
          sourceMap: true,
          externalModules: ['aws-sdk'],
        },
      }
    );

    const addCommentLambda = new nodejs.NodejsFunction(
      this,
      'AddCommentFunction',
      {
        entry: 'src/handlers/tasks.ts',
        handler: 'addCommentHandler',
        runtime: lambda.Runtime.NODEJS_20_X,
        environment: lambdaEnvironment,
        role: lambdaRole,
        timeout: cdk.Duration.seconds(30),
        bundling: {
          minify: false,
          sourceMap: true,
          externalModules: ['aws-sdk'],
        },
      }
    );

    const linkTaskLambda = new nodejs.NodejsFunction(this, 'LinkTaskFunction', {
      entry: 'src/handlers/tasks.ts',
      handler: 'linkTaskHandler',
      runtime: lambda.Runtime.NODEJS_20_X,
      environment: lambdaEnvironment,
      role: lambdaRole,
      timeout: cdk.Duration.seconds(30),
      bundling: {
        minify: false,
        sourceMap: true,
        externalModules: ['aws-sdk'],
      },
    });

    const unlinkTaskLambda = new nodejs.NodejsFunction(
      this,
      'UnlinkTaskFunction',
      {
        entry: 'src/handlers/tasks.ts',
        handler: 'unlinkTaskHandler',
        runtime: lambda.Runtime.NODEJS_20_X,
        environment: lambdaEnvironment,
        role: lambdaRole,
        timeout: cdk.Duration.seconds(30),
        bundling: {
          minify: false,
          sourceMap: true,
          externalModules: ['aws-sdk'],
        },
      }
    );

    const getTicketsLambda = new nodejs.NodejsFunction(
      this,
      'GetTicketsFunction',
      {
        entry: 'src/handlers/tasks.ts',
        handler: 'getTicketsHandler',
        runtime: lambda.Runtime.NODEJS_20_X,
        environment: lambdaEnvironment,
        role: lambdaRole,
        timeout: cdk.Duration.seconds(30),
        bundling: {
          minify: false,
          sourceMap: true,
          externalModules: ['aws-sdk'],
        },
      }
    );

    const getTicketLambda = new nodejs.NodejsFunction(
      this,
      'GetTicketFunction',
      {
        entry: 'src/handlers/tasks.ts',
        handler: 'getTicketHandler',
        runtime: lambda.Runtime.NODEJS_20_X,
        environment: lambdaEnvironment,
        role: lambdaRole,
        timeout: cdk.Duration.seconds(30),
        bundling: {
          minify: false,
          sourceMap: true,
          externalModules: ['aws-sdk'],
        },
      }
    );

    const createTicketLambda = new nodejs.NodejsFunction(
      this,
      'CreateTicketFunction',
      {
        entry: 'src/handlers/tasks.ts',
        handler: 'createTicketHandler',
        runtime: lambda.Runtime.NODEJS_20_X,
        environment: lambdaEnvironment,
        role: lambdaRole,
        timeout: cdk.Duration.seconds(30),
        bundling: {
          minify: false,
          sourceMap: true,
          externalModules: ['aws-sdk'],
        },
      }
    );

    const updateTicketLambda = new nodejs.NodejsFunction(
      this,
      'UpdateTicketFunction',
      {
        entry: 'src/handlers/tasks.ts',
        handler: 'updateTicketHandler',
        runtime: lambda.Runtime.NODEJS_20_X,
        environment: lambdaEnvironment,
        role: lambdaRole,
        timeout: cdk.Duration.seconds(30),
        bundling: {
          minify: false,
          sourceMap: true,
          externalModules: ['aws-sdk'],
        },
      }
    );

    const deleteTicketLambda = new nodejs.NodejsFunction(
      this,
      'DeleteTicketFunction',
      {
        entry: 'src/handlers/tasks.ts',
        handler: 'deleteTicketHandler',
        runtime: lambda.Runtime.NODEJS_20_X,
        environment: lambdaEnvironment,
        role: lambdaRole,
        timeout: cdk.Duration.seconds(30),
        bundling: {
          minify: false,
          sourceMap: true,
          externalModules: ['aws-sdk'],
        },
      }
    );

    // Create API Gateway
    this.api = new apigateway.RestApi(this, 'ParoviewApi', {
      restApiName: 'Paroview API',
      description: 'API for the Paroview project management app',
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
    const tickets = this.api.root.addResource('tickets');
    const ticket = tickets.addResource('{id}');

    // GET /tasks
    tasks.addMethod('GET', new apigateway.LambdaIntegration(getTasksLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // POST /tasks
    tasks.addMethod(
      'POST',
      new apigateway.LambdaIntegration(createTaskLambda),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

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
    task.addMethod(
      'DELETE',
      new apigateway.LambdaIntegration(deleteTaskLambda),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    // POST /tasks/{id}/comments
    comments.addMethod(
      'POST',
      new apigateway.LambdaIntegration(addCommentLambda),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    // POST /tasks/{id}/link
    link.addMethod('POST', new apigateway.LambdaIntegration(linkTaskLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // DELETE /tasks/{id}/link/{linkedTaskId}
    unlinkResource.addMethod(
      'DELETE',
      new apigateway.LambdaIntegration(unlinkTaskLambda),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    // Tickets endpoints
    tickets.addMethod(
      'GET',
      new apigateway.LambdaIntegration(getTicketsLambda),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    tickets.addMethod(
      'POST',
      new apigateway.LambdaIntegration(createTicketLambda),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    ticket.addMethod('GET', new apigateway.LambdaIntegration(getTicketLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    ticket.addMethod(
      'PUT',
      new apigateway.LambdaIntegration(updateTicketLambda),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    ticket.addMethod(
      'DELETE',
      new apigateway.LambdaIntegration(deleteTicketLambda),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    // User Lambda functions (reusing the same Lambda pattern as tasks)
    const getUsersLambda = new nodejs.NodejsFunction(this, 'GetUsersFunction', {
      entry: 'src/handlers/tasks.ts',
      handler: 'getUsersHandler',
      runtime: lambda.Runtime.NODEJS_20_X,
      environment: lambdaEnvironment,
      role: lambdaRole,
      timeout: cdk.Duration.seconds(30),
      bundling: {
        minify: false,
        sourceMap: true,
        externalModules: ['aws-sdk'],
      },
    });

    const getUserLambda = new nodejs.NodejsFunction(this, 'GetUserFunction', {
      entry: 'src/handlers/tasks.ts',
      handler: 'getUserHandler',
      runtime: lambda.Runtime.NODEJS_20_X,
      environment: lambdaEnvironment,
      role: lambdaRole,
      timeout: cdk.Duration.seconds(30),
      bundling: {
        minify: false,
        sourceMap: true,
        externalModules: ['aws-sdk'],
      },
    });

    const createUserLambda = new nodejs.NodejsFunction(
      this,
      'CreateUserFunction',
      {
        entry: 'src/handlers/tasks.ts',
        handler: 'createUserHandler',
        runtime: lambda.Runtime.NODEJS_20_X,
        environment: lambdaEnvironment,
        role: lambdaRole,
        timeout: cdk.Duration.seconds(30),
        bundling: {
          minify: false,
          sourceMap: true,
          externalModules: ['aws-sdk'],
        },
      }
    );

    const updateUserLambda = new nodejs.NodejsFunction(
      this,
      'UpdateUserFunction',
      {
        entry: 'src/handlers/tasks.ts',
        handler: 'updateUserHandler',
        runtime: lambda.Runtime.NODEJS_20_X,
        environment: lambdaEnvironment,
        role: lambdaRole,
        timeout: cdk.Duration.seconds(30),
        bundling: {
          minify: false,
          sourceMap: true,
          externalModules: ['aws-sdk'],
        },
      }
    );

    const deleteUserLambda = new nodejs.NodejsFunction(
      this,
      'DeleteUserFunction',
      {
        entry: 'src/handlers/tasks.ts',
        handler: 'deleteUserHandler',
        runtime: lambda.Runtime.NODEJS_20_X,
        environment: lambdaEnvironment,
        role: lambdaRole,
        timeout: cdk.Duration.seconds(30),
        bundling: {
          minify: false,
          sourceMap: true,
          externalModules: ['aws-sdk'],
        },
      }
    );

    // User endpoints
    const users = this.api.root.addResource('users');
    const user = users.addResource('{id}');

    // GET /users
    users.addMethod('GET', new apigateway.LambdaIntegration(getUsersLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // POST /users
    users.addMethod(
      'POST',
      new apigateway.LambdaIntegration(createUserLambda),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    // GET /users/{id}
    user.addMethod('GET', new apigateway.LambdaIntegration(getUserLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // PUT /users/{id}
    user.addMethod('PUT', new apigateway.LambdaIntegration(updateUserLambda), {
      authorizer,
      authorizationType: apigateway.AuthorizationType.COGNITO,
    });

    // DELETE /users/{id}
    user.addMethod(
      'DELETE',
      new apigateway.LambdaIntegration(deleteUserLambda),
      {
        authorizer,
        authorizationType: apigateway.AuthorizationType.COGNITO,
      }
    );

    // Output the API endpoint
    new cdk.CfnOutput(this, 'ApiEndpoint', {
      value: this.api.url,
      description: 'API Gateway endpoint URL',
      exportName: 'ParoviewApiEndpoint',
    });
  }
}
