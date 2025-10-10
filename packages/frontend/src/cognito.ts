import { Amplify } from 'aws-amplify';

const userPoolId = import.meta.env.VITE_COGNITO_USER_POOL_ID;

const userPoolClientId = import.meta.env.VITE_COGNITO_USER_POOL_CLIENT_ID;
const allowedEmailDomainsEnv = import.meta.env.VITE_ALLOWED_EMAIL_DOMAINS;

if (!userPoolId || !userPoolClientId) {
  throw new Error(
    'Missing Cognito configuration: ensure VITE_COGNITO_USER_POOL_ID and VITE_COGNITO_USER_POOL_CLIENT_ID are defined in your environment.'
  );
}

if (!allowedEmailDomainsEnv) {
  throw new Error(
    'Missing Cognito configuration: ensure VITE_ALLOWED_EMAIL_DOMAINS is defined in your environment.'
  );
}

export const allowedEmailDomains = allowedEmailDomainsEnv
  .split(',')
  .map((domain: string) => domain.trim().toLowerCase())
  .filter(Boolean);

if (allowedEmailDomains.length === 0) {
  throw new Error(
    'Invalid Cognito configuration: VITE_ALLOWED_EMAIL_DOMAINS must include at least one domain.'
  );
}

export function getEmailDomain(email: string): string | null {
  const trimmed = email.trim();
  const atIndex = trimmed.lastIndexOf('@');
  if (atIndex === -1 || atIndex >= trimmed.length - 1) {
    return null;
  }

  return trimmed.slice(atIndex + 1).toLowerCase();
}

export function isAllowedBusinessEmail(email: string): boolean {
  const domain = getEmailDomain(email);
  if (!domain) {
    return false;
  }

  return allowedEmailDomains.includes(domain);
}

let configured = false;

export function ensureAmplifyConfigured() {
  if (configured) {
    return;
  }

  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId,
        loginWith: {
          email: true,
        },
      },
    },
  });

  configured = true;
}

ensureAmplifyConfigured();
