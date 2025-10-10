import { PreSignUpTriggerEvent } from 'aws-lambda';

const envDomains = process.env.ALLOWED_EMAIL_DOMAINS ?? '';
const allowedEmailDomains = envDomains
  .split(',')
  .map((domain) => domain.trim().toLowerCase())
  .filter(Boolean);

function assertAllowedDomainsConfigured(): void {
  if (allowedEmailDomains.length === 0) {
    throw new Error(
      'No allowed email domains configured for pre-signup validation. Set ALLOWED_EMAIL_DOMAINS env variable.'
    );
  }
}

function extractDomain(email: string | undefined): string {
  if (!email) {
    throw new Error('Email address is required for registration.');
  }

  const atIndex = email.lastIndexOf('@');
  if (atIndex === -1 || atIndex === email.length - 1) {
    throw new Error('A valid business email address is required.');
  }

  return email.slice(atIndex + 1).toLowerCase();
}

export const handler = async (
  event: PreSignUpTriggerEvent
): Promise<PreSignUpTriggerEvent> => {
  assertAllowedDomainsConfigured();

  const email = event.request.userAttributes.email;
  const domain = extractDomain(email);

  if (!allowedEmailDomains.includes(domain)) {
    throw new Error(
      `The email domain "${domain}" is not enabled for this workspace. Please contact your administrator.`
    );
  }

  return event;
};
