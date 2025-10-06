# Local Development Setup Script
# This script extracts CDK outputs and creates a .env file for local development

param(
    [string]$OutputsFile = "packages/backend/outputs.json"
)

Write-Host "🔧 Setting up local environment..." -ForegroundColor Cyan

# Check if outputs.json exists
if (-Not (Test-Path $OutputsFile)) {
    Write-Host "❌ outputs.json not found!" -ForegroundColor Red
    Write-Host "   Run this first: cd packages/backend && pnpm cdk deploy CognitoStack --outputs-file outputs.json" -ForegroundColor Yellow
    exit 1
}

# Read the outputs file
$outputs = Get-Content $OutputsFile -Raw | ConvertFrom-Json

# Extract Cognito values
$userPoolId = $outputs.CognitoStack.UserPoolId
$userPoolClientId = $outputs.CognitoStack.UserPoolClientId

if (-Not $userPoolId -or -Not $userPoolClientId) {
    Write-Host "❌ Could not find Cognito values in outputs.json" -ForegroundColor Red
    exit 1
}

# Create .env file
$envFile = "packages/frontend/.env"
$envContent = @"
VITE_COGNITO_USER_POOL_ID=$userPoolId
VITE_COGNITO_USER_POOL_CLIENT_ID=$userPoolClientId
"@

$envContent | Out-File -FilePath $envFile -Encoding UTF8

Write-Host "✅ Environment file created successfully!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Created: $envFile" -ForegroundColor White
Write-Host "   VITE_COGNITO_USER_POOL_ID: $userPoolId" -ForegroundColor Gray
Write-Host "   VITE_COGNITO_USER_POOL_CLIENT_ID: $userPoolClientId" -ForegroundColor Gray
Write-Host ""
Write-Host "🚀 You can now run: cd packages/frontend && pnpm dev" -ForegroundColor Cyan
