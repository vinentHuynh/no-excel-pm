import * as cdk from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import { Construct } from 'constructs';

export class DynamoDBStack extends cdk.Stack {
  public readonly table: dynamodb.Table;

  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Single table design with domain isolation
    this.table = new dynamodb.Table(this, 'ParoviewTable', {
      tableName: 'paroview-table',
      partitionKey: {
        name: 'PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'SK',
        type: dynamodb.AttributeType.STRING,
      },
      billingMode: dynamodb.BillingMode.PAY_PER_REQUEST, // On-demand pricing
    });

    // Global Secondary Index for querying by domain and entity type
    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: {
        name: 'GSI1PK',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'GSI1SK',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Global Secondary Index for querying by domain
    this.table.addGlobalSecondaryIndex({
      indexName: 'DomainIndex',
      partitionKey: {
        name: 'domain',
        type: dynamodb.AttributeType.STRING,
      },
      sortKey: {
        name: 'createdAt',
        type: dynamodb.AttributeType.STRING,
      },
      projectionType: dynamodb.ProjectionType.ALL,
    });

    // Output the table name
    new cdk.CfnOutput(this, 'ParoviewTableNameOutput', {
      value: this.table.tableName,
      description: 'DynamoDB Table Name',
      exportName: 'ParoviewTableName',
    });

    new cdk.CfnOutput(this, 'ParoviewTableArnOutput', {
      value: this.table.tableArn,
      description: 'DynamoDB Table ARN',
      exportName: 'ParoviewTableArn',
    });
  }
}
