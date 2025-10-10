import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as route53Targets from 'aws-cdk-lib/aws-route53-targets';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import { Construct } from 'constructs';

interface CloudFrontStackProps extends cdk.StackProps {
  domainName: string;
  certificateRegion?: string;
  hostedZoneId?: string;
  hostedZoneName?: string;
}

export class CloudFrontStack extends cdk.Stack {
  public readonly distribution: cloudfront.Distribution;
  public readonly bucket: s3.IBucket;
  public readonly hostedZone: route53.IHostedZone;

  constructor(scope: Construct, id: string, props: CloudFrontStackProps) {
    super(scope, id, props);

    const { domainName } = props;
    const normalizedDomain = domainName
      .replace(/[^a-z0-9-]/gi, '-')
      .toLowerCase();
    const desiredBucketName = `${normalizedDomain}-frontend-cdk`;

    // Always create new S3 bucket for frontend hosting
    this.bucket = new s3.Bucket(this, 'FrontendBucket', {
      bucketName: desiredBucketName,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      autoDeleteObjects: false,
      enforceSSL: true,
    });

    // Look up the pre-registered Route53 hosted zone for the domain
    const hostedZoneName = props.hostedZoneName ?? domainName;
    const envAccount = props.env?.account ?? process.env.CDK_DEFAULT_ACCOUNT;
    const envRegion = props.env?.region ?? process.env.CDK_DEFAULT_REGION;

    if (props.hostedZoneId) {
      this.hostedZone = route53.HostedZone.fromHostedZoneAttributes(
        this,
        'HostedZone',
        {
          hostedZoneId: props.hostedZoneId,
          zoneName: hostedZoneName,
        }
      );
    } else if (envAccount && envRegion) {
      this.hostedZone = route53.HostedZone.fromLookup(this, 'HostedZone', {
        domainName: hostedZoneName,
        privateZone: false,
      });
    } else {
      throw new Error(
        'CloudFrontStack requires either hostedZoneId/hostedZoneName props or an environment with account and region set to perform a hosted zone lookup.'
      );
    }

    // CloudFront custom domains still require the certificate to reside in us-east-1
    const certificateRegion = props.certificateRegion ?? 'us-east-1';

    const stackRegion = cdk.Stack.of(this).region;

    if (
      certificateRegion &&
      !cdk.Token.isUnresolved(stackRegion) &&
      certificateRegion !== stackRegion
    ) {
      cdk.Annotations.of(this).addWarning(
        `certificateRegion (${certificateRegion}) differs from stack region (${stackRegion}). ` +
          'ACM certificates must be created in the stack region. Deploy this stack in the certificate region or manage the certificate in a separate stack.'
      );
    }

    const certificate = new acm.Certificate(this, 'Certificate', {
      domainName,
      subjectAlternativeNames: [`www.${domainName}`],
      validation: acm.CertificateValidation.fromDns(this.hostedZone),
    });

    // Create CloudFront Origin Access Identity
    const oai = new cloudfront.OriginAccessIdentity(this, 'OAI', {
      comment: `OAI for ${domainName}`,
    });

    // Grant CloudFront access to the S3 bucket
    this.bucket.grantRead(oai);

    // Create CloudFront distribution
    this.distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: new origins.S3Origin(this.bucket, {
          originAccessIdentity: oai,
        }),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
        allowedMethods: cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
        cachedMethods: cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
        compress: true,
        cachePolicy: cloudfront.CachePolicy.CACHING_OPTIMIZED,
      },
      domainNames: [domainName, `www.${domainName}`],
      certificate: certificate,
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 403,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
          ttl: cdk.Duration.minutes(5),
        },
      ],
      priceClass: cloudfront.PriceClass.PRICE_CLASS_100,
      enableIpv6: true,
    });

    // Create Route53 A record for root domain
    new route53.ARecord(this, 'ARecord', {
      zone: this.hostedZone,
      recordName: domainName,
      target: route53.RecordTarget.fromAlias(
        new route53Targets.CloudFrontTarget(this.distribution)
      ),
    });

    // Create Route53 A record for www subdomain
    new route53.ARecord(this, 'WWWARecord', {
      zone: this.hostedZone,
      recordName: `www.${domainName}`,
      target: route53.RecordTarget.fromAlias(
        new route53Targets.CloudFrontTarget(this.distribution)
      ),
    });

    // Outputs
    new cdk.CfnOutput(this, 'BucketName', {
      value: this.bucket.bucketName,
      description: 'S3 Bucket for frontend',
      exportName: 'FrontendBucketName',
    });

    new cdk.CfnOutput(this, 'DistributionId', {
      value: this.distribution.distributionId,
      description: 'CloudFront Distribution ID',
      exportName: 'CloudFrontDistributionId',
    });

    new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: this.distribution.distributionDomainName,
      description: 'CloudFront Distribution Domain Name',
    });

    new cdk.CfnOutput(this, 'WebsiteURL', {
      value: `https://${domainName}`,
      description: 'Website URL',
    });

    new cdk.CfnOutput(this, 'HostedZoneId', {
      value: this.hostedZone.hostedZoneId,
      description: 'Route53 Hosted Zone ID',
    });

    const hostedZoneNameServers = this.hostedZone.hostedZoneNameServers;

    new cdk.CfnOutput(this, 'NameServers', {
      value:
        hostedZoneNameServers && hostedZoneNameServers.length > 0
          ? cdk.Fn.join(', ', hostedZoneNameServers)
          : 'Name servers managed outside of this deployment. Check the Route53 console if needed.',
      description: 'Name servers for your domain registrar',
    });

    // Output note about environment configuration
    new cdk.CfnOutput(this, 'FrontendConfigNote', {
      value:
        'Configure frontend .env.local with values from CognitoStack and ApiStack outputs',
      description: 'Frontend environment setup instructions',
    });
  }
}
