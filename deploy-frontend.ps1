#!/usr/bin/env pwsh
# Deploy frontend to S3 and invalidate CloudFront cache

param(
    [string]$StackName = "CloudFrontStack"
)

Write-Host "Building frontend..." -ForegroundColor Cyan
Set-Location packages/frontend
pnpm build

if ($LASTEXITCODE -ne 0) {
    Write-Host "Build failed!" -ForegroundColor Red
    exit 1
}

Write-Host "`nGetting CloudFront stack outputs..." -ForegroundColor Cyan
Set-Location ../backend

# Get bucket name and distribution ID from CloudFormation
Write-Host "Fetching stack outputs from AWS..." -ForegroundColor Cyan
$stackOutputs = aws cloudformation describe-stacks --stack-name $StackName --query "Stacks[0].Outputs" | ConvertFrom-Json

$bucketName = ($stackOutputs | Where-Object { $_.OutputKey -eq "BucketName" }).OutputValue
$distributionId = ($stackOutputs | Where-Object { $_.OutputKey -eq "DistributionId" }).OutputValue

if (-not $bucketName) {
    Write-Host "Error: Could not find bucket name. Make sure CloudFrontStack is deployed." -ForegroundColor Red
    exit 1
}

Write-Host "`nBucket: $bucketName" -ForegroundColor Green
Write-Host "Distribution: $distributionId" -ForegroundColor Green

# Sync build files to S3
Write-Host "`nUploading files to S3..." -ForegroundColor Cyan
aws s3 sync ../frontend/dist "s3://$bucketName" --delete --cache-control "public, max-age=31536000, immutable" --exclude "index.html"
aws s3 cp ../frontend/dist/index.html "s3://$bucketName/index.html" --cache-control "public, max-age=0, must-revalidate"

if ($LASTEXITCODE -ne 0) {
    Write-Host "Upload failed!" -ForegroundColor Red
    exit 1
}

# Invalidate CloudFront cache
if ($distributionId) {
    Write-Host "`nInvalidating CloudFront cache..." -ForegroundColor Cyan
    $invalidationId = aws cloudfront create-invalidation --distribution-id $distributionId --paths "/*" --query "Invalidation.Id" --output text
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "CloudFront invalidation created: $invalidationId" -ForegroundColor Green
        Write-Host "Cache invalidation may take a few minutes to complete." -ForegroundColor Yellow
    } else {
        Write-Host "Warning: CloudFront invalidation failed" -ForegroundColor Yellow
    }
}

Write-Host "`nDeployment complete!" -ForegroundColor Green
Write-Host "Your site will be available at https://no-excel-pm.com" -ForegroundColor Cyan

Set-Location ../..
