#!/bin/bash
# Local Development Setup Script (Unix/Mac)
# This script extracts CDK outputs and creates a .env file for local development

OUTPUTS_FILE="packages/backend/outputs.json"

echo "🔧 Setting up local environment..."

# Check if outputs.json exists
if [ ! -f "$OUTPUTS_FILE" ]; then
    echo "❌ outputs.json not found!"
    echo "   Run this first: cd packages/backend && pnpm cdk deploy CognitoStack --outputs-file outputs.json"
    exit 1
fi

# Extract Cognito values using jq (or basic grep/sed if jq not available)
if command -v jq &> /dev/null; then
    USER_POOL_ID=$(jq -r '.CognitoStack.UserPoolId' "$OUTPUTS_FILE")
    USER_POOL_CLIENT_ID=$(jq -r '.CognitoStack.UserPoolClientId' "$OUTPUTS_FILE")
    ALLOWED_EMAIL_DOMAINS=$(jq -r '.CognitoStack.AllowedEmailDomains // empty' "$OUTPUTS_FILE")
else
    # Fallback without jq
    USER_POOL_ID=$(grep -oP '"UserPoolId":\s*"\K[^"]+' "$OUTPUTS_FILE")
    USER_POOL_CLIENT_ID=$(grep -oP '"UserPoolClientId":\s*"\K[^"]+' "$OUTPUTS_FILE")
    ALLOWED_EMAIL_DOMAINS=$(grep -oP '"AllowedEmailDomains":\s*"\K[^"]+' "$OUTPUTS_FILE")
fi

if [ -z "$USER_POOL_ID" ] || [ -z "$USER_POOL_CLIENT_ID" ]; then
    echo "❌ Could not find Cognito values in outputs.json"
    exit 1
fi

if [ -z "$ALLOWED_EMAIL_DOMAINS" ]; then
    echo "⚠️ Allowed email domains not found in outputs.json; defaulting to noexcelpm.com"
    ALLOWED_EMAIL_DOMAINS="noexcelpm.com"
fi

# Create .env file
ENV_FILE="packages/frontend/.env"
cat > "$ENV_FILE" << EOF
VITE_COGNITO_USER_POOL_ID=$USER_POOL_ID
VITE_COGNITO_USER_POOL_CLIENT_ID=$USER_POOL_CLIENT_ID
VITE_ALLOWED_EMAIL_DOMAINS=$ALLOWED_EMAIL_DOMAINS
EOF

echo "✅ Environment file created successfully!"
echo ""
echo "📝 Created: $ENV_FILE"
echo "   VITE_COGNITO_USER_POOL_ID: $USER_POOL_ID"
echo "   VITE_COGNITO_USER_POOL_CLIENT_ID: $USER_POOL_CLIENT_ID"
echo "   VITE_ALLOWED_EMAIL_DOMAINS: $ALLOWED_EMAIL_DOMAINS"
echo ""
echo "🚀 You can now run: cd packages/frontend && pnpm dev"
