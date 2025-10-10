#!/usr/bin/env node
'use strict';

const { spawn } = require('node:child_process');
const { join, dirname } = require('node:path');
const { readFile, writeFile, mkdir } = require('node:fs/promises');
const {
  CloudFormationClient,
  DescribeStacksCommand,
  DeleteStackCommand,
  waitUntilStackDeleteComplete,
} = require('@aws-sdk/client-cloudformation');
const {
  S3Client,
  HeadBucketCommand,
  ListObjectVersionsCommand,
  DeleteObjectsCommand,
  DeleteBucketCommand,
} = require('@aws-sdk/client-s3');
const { STSClient, GetCallerIdentityCommand } = require('@aws-sdk/client-sts');
const {
  IAMClient,
  GetRoleCommand,
  ListAttachedRolePoliciesCommand,
  DetachRolePolicyCommand,
  ListRolePoliciesCommand,
  DeleteRolePolicyCommand,
  DeleteRoleCommand,
} = require('@aws-sdk/client-iam');

const root = join(__dirname, '..');
const backendDir = join(root, 'packages', 'backend');
const frontendDir = join(root, 'packages', 'frontend');

const DEFAULT_DOMAINS = 'paroview.com';
const DEFAULT_DOMAIN_NAME = 'paroview.com';
const DEFAULT_REGION = 'us-east-1';
const DEFAULT_CERT_REGION = 'us-east-1';
const DEFAULT_CLOUDFRONT_STACK = 'ParoviewCloudFrontStack';
const BOOTSTRAP_STACK_NAME = process.env.CDK_TOOLKIT_STACK_NAME || 'CDKToolkit';
const BOOTSTRAP_QUALIFIER = process.env.CDK_QUALIFIER || 'hnb659fds';
const CONFIGURED_ACCOUNT_ID = process.env.CDK_ACCOUNT_ID;
const isWindows = process.platform === 'win32';

let cachedAccountId;
const stsClient = new STSClient({});
const iamClient = new IAMClient({});

function formatBucketName(accountId, region) {
  return `cdk-${BOOTSTRAP_QUALIFIER}-assets-${accountId}-${region}`;
}

async function resolveAccountId() {
  if (CONFIGURED_ACCOUNT_ID) {
    return CONFIGURED_ACCOUNT_ID;
  }

  if (cachedAccountId) {
    return cachedAccountId;
  }

  try {
    const identity = await stsClient.send(new GetCallerIdentityCommand({}));
    if (identity && identity.Account) {
      cachedAccountId = identity.Account;
      return cachedAccountId;
    }
  } catch (error) {
    console.warn(
      '⚠️  Failed to resolve account id via STS, using fallback account id 098593159941.'
    );
    console.warn(error instanceof Error ? error.message : error);
  }

  cachedAccountId = '098593159941';
  return cachedAccountId;
}

function parseArgs(argv = process.argv.slice(2)) {
  const config = {
    allowedEmailDomains: undefined,
    githubToken: undefined,
    skipBootstrap: false,
    domainName: undefined,
    region: undefined,
    certificateRegion: undefined,
    cloudFrontStackName: undefined,
    mode: 'all',
  };

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];

    if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }

    if (arg === '--frontend-only') {
      config.mode = 'frontend';
      continue;
    }

    if (arg === '--backend-only') {
      config.mode = 'backend';
      continue;
    }

    if (arg.startsWith('--allowed-email-domains=')) {
      config.allowedEmailDomains = arg.split('=')[1] || DEFAULT_DOMAINS;
      continue;
    }

    if (arg === '--allowed-email-domains' || arg === '--allowedEmailDomains') {
      config.allowedEmailDomains = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg.startsWith('--github-token=')) {
      config.githubToken = arg.split('=')[1] || undefined;
      continue;
    }

    if (arg === '--github-token' || arg === '--githubToken') {
      config.githubToken = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg === '--skip-bootstrap' || arg === '--skipBootstrap') {
      config.skipBootstrap = true;
      continue;
    }

    if (arg.startsWith('--domain=')) {
      config.domainName = arg.split('=')[1] || DEFAULT_DOMAIN_NAME;
      continue;
    }

    if (arg === '--domain' || arg === '--domain-name') {
      config.domainName = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg.startsWith('--region=')) {
      config.region = arg.split('=')[1] || DEFAULT_REGION;
      continue;
    }

    if (arg === '--region') {
      config.region = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg.startsWith('--certificate-region=')) {
      config.certificateRegion = arg.split('=')[1] || DEFAULT_CERT_REGION;
      continue;
    }

    if (arg === '--certificate-region') {
      config.certificateRegion = argv[i + 1];
      i += 1;
      continue;
    }

    if (arg.startsWith('--cloudfront-stack=')) {
      config.cloudFrontStackName =
        arg.split('=')[1] || DEFAULT_CLOUDFRONT_STACK;
      continue;
    }

    if (arg === '--cloudfront-stack') {
      config.cloudFrontStackName = argv[i + 1];
      i += 1;
      continue;
    }

    console.error(`Unknown argument: ${arg}`);
    printHelp();
    process.exit(1);
  }

  return config;
}

function printHelp() {
  console.log(`Usage: node scripts/deploy-all.js [options]

Options:
  --allowed-email-domains <domains>  Comma separated business email domains (default: ${DEFAULT_DOMAINS})
  --domain <domain>                  Domain name for CloudFront and Route53 (default: ${DEFAULT_DOMAIN_NAME})
  --region <region>                  Primary AWS region for stacks (default: ${DEFAULT_REGION})
  --certificate-region <region>      Region for ACM certificates (default: ${DEFAULT_CERT_REGION})
  --cloudfront-stack <name>          Override CloudFront stack name (default: ${DEFAULT_CLOUDFRONT_STACK})
  --github-token <token>             GitHub PAT to deploy Amplify stack (optional)
  --skip-bootstrap                   Skip CDK bootstrap steps (optional)
  --frontend-only                    Build and publish frontend without touching backend stacks
  --backend-only                     Deploy backend stacks (skips Amplify + frontend publish)
  -h, --help                         Show this help message
`);
}

const PNPM = 'pnpm';

function loadDeployConfigFromEnv() {
  const raw = process.env.DEPLOY_CONFIG;
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') {
      return parsed;
    }
  } catch (error) {
    console.warn(
      'Failed to parse DEPLOY_CONFIG environment variable; falling back to defaults.'
    );
    console.warn(error instanceof Error ? error.message : error);
  }

  return {};
}

function toArray(value) {
  if (!value) {
    return [];
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === 'string') {
    return value.split(',');
  }

  return [];
}

function createDeployConfig(options) {
  const envConfig = loadDeployConfigFromEnv();

  const cliDomains = toArray(options.allowedEmailDomains).map((domain) =>
    domain.trim()
  );
  const envDomains = toArray(envConfig.allowedEmailDomains).map((domain) =>
    domain.trim()
  );

  const resolvedDomains = cliDomains.length > 0 ? cliDomains : envDomains;

  const normalisedDomains = Array.from(
    new Set(
      (resolvedDomains.length > 0 ? resolvedDomains : [DEFAULT_DOMAINS])
        .map((domain) => domain.toLowerCase())
        .filter((domain) => domain.length > 0)
    )
  );

  if (normalisedDomains.length === 0) {
    normalisedDomains.push(DEFAULT_DOMAINS);
  }

  return {
    allowedEmailDomains: normalisedDomains,
    domainName:
      options.domainName || envConfig.domainName || DEFAULT_DOMAIN_NAME,
    region: options.region || envConfig.region || DEFAULT_REGION,
    certificateRegion:
      options.certificateRegion ||
      envConfig.certificateRegion ||
      DEFAULT_CERT_REGION,
    githubToken:
      options.githubToken || envConfig.githubToken || process.env.GITHUB_TOKEN,
  };
}

function run(command, args, options = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: 'inherit',
      cwd: options.cwd || root,
      env: options.env || process.env,
      shell: isWindows,
      windowsHide: false,
    });

    child.on('close', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(
          new Error(
            `Command failed: ${command} ${args.join(' ')} (exit code ${code})`
          )
        );
      }
    });

    child.on('error', (err) => {
      reject(err);
    });
  });
}

function logStep(message) {
  console.log(`\n=== ${message} ===`);
}

function logInfo(message) {
  console.log(`   • ${message}`);
}

async function generateFrontendEnvFile(deployConfig, options = {}) {
  const outputsPath = options.outputsPath ?? join(backendDir, 'outputs.json');
  const envPath = options.envPath ?? join(frontendDir, '.env');

  let raw;
  try {
    raw = await readFile(outputsPath, 'utf8');
  } catch (error) {
    throw new Error(
      `Missing CDK outputs file at ${outputsPath}. Deploy ParoviewCognitoStack first.`
    );
  }

  let outputs;
  try {
    outputs = JSON.parse(raw);
  } catch (error) {
    throw new Error('Unable to parse backend outputs.json.');
  }

  const cognitoOutputs = outputs?.ParoviewCognitoStack || {};
  const userPoolId = cognitoOutputs.UserPoolId;
  const userPoolClientId = cognitoOutputs.UserPoolClientId;

  if (!userPoolId || !userPoolClientId) {
    throw new Error(
      'Cognito outputs not found. Ensure ParoviewCognitoStack is deployed with outputs.json saved.'
    );
  }

  const allowedDomains = deployConfig.allowedEmailDomains.join(',');
  const envContents = [
    `VITE_COGNITO_USER_POOL_ID=${userPoolId}`,
    `VITE_COGNITO_USER_POOL_CLIENT_ID=${userPoolClientId}`,
    `VITE_ALLOWED_EMAIL_DOMAINS=${allowedDomains}`,
  ].join('\n');

  await mkdir(dirname(envPath), { recursive: true });
  await writeFile(`${envPath}`, `${envContents}\n`, 'utf8');

  logInfo(`Frontend environment written to ${envPath}`);
}

async function fetchStackOutputs(stackName, region) {
  const cf = new CloudFormationClient({ region });
  const response = await cf.send(
    new DescribeStacksCommand({ StackName: stackName })
  );
  const stack = response.Stacks?.[0];

  if (!stack) {
    throw new Error(
      `Stack ${stackName} not found in ${region}. Deploy CloudFront stack first.`
    );
  }

  const outputs = {};
  for (const output of stack.Outputs || []) {
    if (output.OutputKey) {
      outputs[output.OutputKey] = output.OutputValue;
    }
  }

  return outputs;
}

async function deployFrontendAssets({
  deployConfig,
  stackName = DEFAULT_CLOUDFRONT_STACK,
  env,
}) {
  const outputs = await fetchStackOutputs(stackName, deployConfig.region);
  const bucketName = outputs.BucketName;

  if (!bucketName) {
    throw new Error(
      'Unable to resolve frontend bucket name from stack outputs or DEPLOY_CONFIG.'
    );
  }

  const distributionId = outputs.DistributionId;
  const distDir = join(frontendDir, 'dist');

  logInfo(`Uploading dist assets to s3://${bucketName}`);
  await run(
    'aws',
    [
      's3',
      'sync',
      distDir,
      `s3://${bucketName}`,
      '--delete',
      '--cache-control',
      'public, max-age=31536000, immutable',
      '--exclude',
      'index.html',
    ],
    {
      env,
    }
  );

  await run(
    'aws',
    [
      's3',
      'cp',
      join(distDir, 'index.html'),
      `s3://${bucketName}/index.html`,
      '--cache-control',
      'public, max-age=0, must-revalidate',
      '--content-type',
      'text/html',
    ],
    {
      env,
    }
  );

  if (distributionId) {
    logInfo(`Creating CloudFront invalidation for ${distributionId}`);
    await run(
      'aws',
      [
        'cloudfront',
        'create-invalidation',
        '--distribution-id',
        distributionId,
        '--paths',
        '/*',
      ],
      {
        env,
      }
    );
  } else {
    logInfo('No CloudFront distribution ID found; skipping invalidation.');
  }
}

async function emptyBootstrapBucket(region, accountId) {
  const bucketName = formatBucketName(accountId, region);
  const s3 = new S3Client({ region });

  try {
    await s3.send(new HeadBucketCommand({ Bucket: bucketName }));
  } catch (error) {
    if (
      error?.$metadata?.httpStatusCode === 404 ||
      error?.name === 'NotFound'
    ) {
      return;
    }

    if (error?.name === 'Forbidden') {
      logInfo(
        `Insufficient permissions to inspect bootstrap bucket ${bucketName}; continuing.`
      );
      return;
    }

    throw error;
  }

  logInfo(`Cleaning bootstrap bucket ${bucketName} in ${region}`);

  let keyMarker;
  let versionIdMarker;

  while (true) {
    const response = await s3.send(
      new ListObjectVersionsCommand({
        Bucket: bucketName,
        KeyMarker: keyMarker,
        VersionIdMarker: versionIdMarker,
      })
    );

    const deletions = [];

    if (response.Versions) {
      for (const version of response.Versions) {
        if (version.Key && version.VersionId) {
          deletions.push({ Key: version.Key, VersionId: version.VersionId });
        }
      }
    }

    if (response.DeleteMarkers) {
      for (const marker of response.DeleteMarkers) {
        if (marker.Key && marker.VersionId) {
          deletions.push({ Key: marker.Key, VersionId: marker.VersionId });
        }
      }
    }

    if (deletions.length > 0) {
      await s3.send(
        new DeleteObjectsCommand({
          Bucket: bucketName,
          Delete: {
            Objects: deletions,
            Quiet: true,
          },
        })
      );
    }

    if (!response.IsTruncated) {
      break;
    }

    keyMarker = response.NextKeyMarker;
    versionIdMarker = response.NextVersionIdMarker;
  }

  await s3.send(new DeleteBucketCommand({ Bucket: bucketName }));
  logInfo(`Deleted bootstrap bucket ${bucketName}.`);
}

async function cleanupBootstrapArtifacts(region, accountId) {
  const cf = new CloudFormationClient({ region });

  try {
    await cf.send(new DeleteStackCommand({ StackName: BOOTSTRAP_STACK_NAME }));
    await waitUntilStackDeleteComplete(
      { client: cf, maxDelay: 15, maxWaitTime: 600 },
      { StackName: BOOTSTRAP_STACK_NAME }
    );
    logInfo(
      `Deleted stale bootstrap stack ${BOOTSTRAP_STACK_NAME} in ${region}.`
    );
  } catch (error) {
    if (
      error?.name === 'ValidationError' &&
      /does not exist/i.test(error.message || '')
    ) {
      // Stack already gone; continue.
    } else {
      logInfo(
        `Unable to delete bootstrap stack automatically (${
          error?.message || error
        }).`
      );
    }

    await cleanupBootstrapIamResources(accountId, region).catch((error) => {
      logInfo(
        `Unable to clean bootstrap IAM roles automatically (${
          error?.message || error
        }).`
      );
    });
  }

  try {
    await emptyBootstrapBucket(region, accountId);
  } catch (error) {
    logInfo(
      `Unable to clean bootstrap bucket automatically (${
        error?.message || error
      }).`
    );
  }

  await cleanupBootstrapIamResources(accountId, region).catch((error) => {
    logInfo(
      `Unable to clean bootstrap IAM roles automatically (${
        error?.message || error
      }).`
    );
  });
}

async function ensureBootstrap(region, accountId, env) {
  logStep(`Reviewing CDK bootstrap state in ${region}`);
  const cf = new CloudFormationClient({ region });

  let stack;

  try {
    const response = await cf.send(
      new DescribeStacksCommand({ StackName: BOOTSTRAP_STACK_NAME })
    );
    if (response.Stacks && response.Stacks.length > 0) {
      stack = response.Stacks[0];
    }
  } catch (error) {
    if (
      !(
        error?.name === 'ValidationError' &&
        /does not exist/i.test(error.message || '')
      )
    ) {
      throw error;
    }
  }

  if (stack) {
    const status = stack.StackStatus;

    if (
      [
        'CREATE_COMPLETE',
        'UPDATE_COMPLETE',
        'UPDATE_ROLLBACK_COMPLETE',
      ].includes(status)
    ) {
      logInfo(`Bootstrap stack already ready (${status}).`);
      return;
    }

    if (status === 'ROLLBACK_COMPLETE' || status === 'ROLLBACK_FAILED') {
      logInfo(`Bootstrap stack is ${status}; cleaning up before retry.`);
      await cleanupBootstrapArtifacts(region, accountId);
    } else if (
      status.endsWith('_IN_PROGRESS') ||
      status === 'DELETE_IN_PROGRESS'
    ) {
      logInfo(
        `Bootstrap stack currently ${status}; skipping automatic bootstrap.`
      );
      return;
    } else {
      logInfo(
        `Bootstrap stack in unexpected status ${status}; attempting cleanup before retry.`
      );
      await cleanupBootstrapArtifacts(region, accountId);
    }
  } else {
    await emptyBootstrapBucket(region, accountId).catch((error) => {
      logInfo(
        `No bootstrap stack found; bucket cleanup skipped (${
          error?.message || error
        }).`
      );
    });

    await cleanupBootstrapIamResources(accountId, region).catch((error) => {
      logInfo(
        `No bootstrap stack found; IAM cleanup skipped (${
          error?.message || error
        }).`
      );
    });
  }

  logStep(`Bootstrapping CDK environment in ${region}`);
  await run(PNPM, ['cdk', 'bootstrap', `aws://${accountId}/${region}`], {
    cwd: backendDir,
    env,
  });
}

async function deleteAttachedPolicies(roleName) {
  let marker;

  do {
    const response = await iamClient.send(
      new ListAttachedRolePoliciesCommand({
        RoleName: roleName,
        Marker: marker,
      })
    );

    for (const policy of response.AttachedPolicies || []) {
      if (policy.PolicyArn) {
        await iamClient.send(
          new DetachRolePolicyCommand({
            RoleName: roleName,
            PolicyArn: policy.PolicyArn,
          })
        );
      }
    }

    marker = response.IsTruncated ? response.Marker : undefined;
  } while (marker);
}

async function deleteInlinePolicies(roleName) {
  let marker;

  do {
    const response = await iamClient.send(
      new ListRolePoliciesCommand({ RoleName: roleName, Marker: marker })
    );

    for (const policyName of response.PolicyNames || []) {
      await iamClient.send(
        new DeleteRolePolicyCommand({
          RoleName: roleName,
          PolicyName: policyName,
        })
      );
    }

    marker = response.IsTruncated ? response.Marker : undefined;
  } while (marker);
}

async function deleteIamRoleIfExists(roleName) {
  try {
    await iamClient.send(new GetRoleCommand({ RoleName: roleName }));
  } catch (error) {
    if (error?.name === 'NoSuchEntityException') {
      return;
    }
    throw error;
  }

  await deleteAttachedPolicies(roleName);
  await deleteInlinePolicies(roleName);

  try {
    await iamClient.send(new DeleteRoleCommand({ RoleName: roleName }));
    logInfo(`Deleted IAM role ${roleName}.`);
  } catch (error) {
    if (error?.name === 'NoSuchEntityException') {
      return;
    }
    throw error;
  }
}

async function cleanupBootstrapIamResources(accountId, region) {
  const roleNames = [
    `cdk-${BOOTSTRAP_QUALIFIER}-cfn-exec-role-${accountId}-${region}`,
    `cdk-${BOOTSTRAP_QUALIFIER}-deploy-role-${accountId}-${region}`,
    `cdk-${BOOTSTRAP_QUALIFIER}-file-publishing-role-${accountId}-${region}`,
    `cdk-${BOOTSTRAP_QUALIFIER}-image-publishing-role-${accountId}-${region}`,
    `cdk-${BOOTSTRAP_QUALIFIER}-lookup-role-${accountId}-${region}`,
  ];

  for (const roleName of roleNames) {
    await deleteIamRoleIfExists(roleName);
  }
}

async function ensurePnpm() {
  try {
    await run(PNPM, ['--version']);
  } catch (error) {
    console.error(
      'pnpm is required but was not found on PATH. Install it from https://pnpm.io/installation'
    );
    throw error;
  }
}

function buildEnv(deployConfig, extraEnv = {}) {
  const serializedConfig = JSON.stringify(deployConfig);

  return {
    ...process.env,
    AWS_REGION: deployConfig.region,
    AWS_DEFAULT_REGION: deployConfig.region,
    CDK_DEFAULT_REGION: deployConfig.region,
    DEPLOY_CONFIG: serializedConfig,
    ...extraEnv,
  };
}

async function main() {
  await ensurePnpm();

  const options = parseArgs();
  const deployConfig = createDeployConfig(options);
  const envForDeploy = buildEnv(deployConfig);
  const accountId = await resolveAccountId();
  const cloudFrontStackName =
    options.cloudFrontStackName || DEFAULT_CLOUDFRONT_STACK;
  const shouldDeployAmplify =
    options.mode === 'all' && Boolean(deployConfig.githubToken);

  logStep('Installing dependencies');
  await run(PNPM, ['install']);

  if (options.mode !== 'frontend') {
    if (!options.skipBootstrap) {
      await ensureBootstrap(deployConfig.region, accountId, envForDeploy);
      if (deployConfig.certificateRegion !== deployConfig.region) {
        await ensureBootstrap(
          deployConfig.certificateRegion,
          accountId,
          envForDeploy
        );
      }
    } else {
      logStep('Skipping CDK bootstrap');
    }

    const domainsLabel = deployConfig.allowedEmailDomains.join(', ');

    logStep(
      `Deploying ParoviewCognitoStack (allowed domains: ${domainsLabel})`
    );
    await run(
      PNPM,
      [
        'cdk',
        'deploy',
        'ParoviewCognitoStack',
        '--outputs-file',
        'outputs.json',
        '--require-approval',
        'never',
      ],
      {
        cwd: backendDir,
        env: envForDeploy,
      }
    );

    logStep('Deploying ParoviewDynamoDBStack');
    await run(
      PNPM,
      ['cdk', 'deploy', 'ParoviewDynamoDBStack', '--require-approval', 'never'],
      {
        cwd: backendDir,
        env: envForDeploy,
      }
    );

    logStep('Deploying ParoviewApiStack');
    await run(
      PNPM,
      ['cdk', 'deploy', 'ParoviewApiStack', '--require-approval', 'never'],
      {
        cwd: backendDir,
        env: envForDeploy,
      }
    );

    logStep(`Deploying ${cloudFrontStackName}`);
    await run(
      PNPM,
      [
        'cdk',
        'deploy',
        cloudFrontStackName,
        '--outputs-file',
        'outputs.json',
        '--require-approval',
        'never',
      ],
      {
        cwd: backendDir,
        env: envForDeploy,
      }
    );

    if (shouldDeployAmplify) {
      logStep('Deploying ParoviewAmplifyStack');
      await run(
        PNPM,
        [
          'cdk',
          'deploy',
          'ParoviewAmplifyStack',
          '--require-approval',
          'never',
        ],
        {
          cwd: backendDir,
          env: envForDeploy,
        }
      );
    } else if (options.mode === 'all') {
      console.log('ParoviewAmplifyStack skipped (no GitHub token provided).');
    } else {
      console.log('ParoviewAmplifyStack skipped (backend-only mode).');
    }
  } else {
    logStep('Frontend-only mode: skipping backend deployment.');
  }

  if (options.mode !== 'backend') {
    logStep('Generating frontend environment file');
    await generateFrontendEnvFile(deployConfig);

    logStep('Building frontend');
    await run(PNPM, ['build'], { cwd: frontendDir, env: envForDeploy });

    logStep('Deploying frontend assets');
    await deployFrontendAssets({
      deployConfig,
      stackName: cloudFrontStackName,
      env: envForDeploy,
    });
  } else {
    logStep('Backend-only mode: skipping frontend build and publish.');
  }

  console.log('\n✅ Deployment complete.');
  console.log(
    `   • Verify ACM certificate status in ${deployConfig.certificateRegion}`
  );
  console.log('   • Confirm Route53 nameservers at your registrar');
  console.log('   • Visit the CloudFront URL from stack outputs');
}

main().catch((error) => {
  console.error('\n❌ Deployment failed.');
  if (error instanceof Error) {
    console.error(error.message);
  } else {
    console.error(error);
  }
  process.exit(1);
});
