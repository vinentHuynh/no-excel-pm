import { useAuthenticator } from '@aws-amplify/ui-react';
import {
  Alert,
  Button,
  Center,
  Group,
  Loader,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
  useComputedColorScheme,
} from '@mantine/core';
import { useEffect, useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import {
  confirmResetPassword,
  confirmSignUp,
  resendSignUpCode,
  resetPassword,
  signIn,
  signUp,
  getCurrentUser,
  fetchAuthSession,
} from 'aws-amplify/auth';
import { Link, Navigate } from 'react-router-dom';
import { getEmailDomain, isAllowedBusinessEmail } from '../cognito';

export default function LoginPage() {
  const { authStatus, user } = useAuthenticator((context) => [
    context.authStatus,
    context.user,
  ]);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [emailTouched, setEmailTouched] = useState(false);
  const [approvedEmail, setApprovedEmail] = useState<string | null>(null);
  const isEmailApproved = Boolean(approvedEmail);

  type AuthStep =
    | 'signIn'
    | 'signUp'
    | 'confirmSignUp'
    | 'forgotPassword'
    | 'confirmForgotPassword';

  type PendingAction =
    | 'signIn'
    | 'signUp'
    | 'confirmSignUp'
    | 'resendSignUpCode'
    | 'forgotPassword'
    | 'confirmForgotPassword'
    | 'checkAccountStatus'
    | null;

  const [authStep, setAuthStep] = useState<AuthStep>('signUp');
  const [pendingAction, setPendingAction] = useState<PendingAction>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [authErrorMessage, setAuthErrorMessage] = useState<string | null>(null);

  const [signInPassword, setSignInPassword] = useState('');
  const [signUpPassword, setSignUpPassword] = useState('');
  const [signUpPasswordConfirm, setSignUpPasswordConfirm] = useState('');
  const [signUpCode, setSignUpCode] = useState('');
  const [resetCode, setResetCode] = useState('');
  const [resetPasswordValue, setResetPasswordValue] = useState('');
  const [resetPasswordConfirm, setResetPasswordConfirm] = useState('');
  const computedColorScheme = useComputedColorScheme('dark');
  const backgroundColor =
    computedColorScheme === 'dark'
      ? 'var(--mantine-color-dark-7)'
      : 'var(--mantine-color-gray-1)';

  useEffect(() => {
    console.log('Login page - auth state changed:', {
      authStatus,
      hasUser: Boolean(user),
    });

    // If authenticated, redirect even if user object hasn't loaded yet
    if (authStatus === 'authenticated') {
      console.log('Auth status is authenticated, redirecting...');
    }
  }, [authStatus, user]);

  const isActionLoading = (action: Exclude<PendingAction, null>) =>
    pendingAction === action;

  const submitOnEnter =
    (action: () => void | Promise<void>) =>
    (event: KeyboardEvent<HTMLInputElement>) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        void action();
      }
    };

  const changeStep = (step: AuthStep) => {
    setAuthStep(step);
    setAuthErrorMessage(null);
    setPendingAction(null);
  };

  const resetToEmailEntry = () => {
    setApprovedEmail(null);
    setAuthStep('signUp');
    setPendingAction(null);
    setStatusMessage(null);
    setAuthErrorMessage(null);
    setSignInPassword('');
    setSignUpPassword('');
    setSignUpPasswordConfirm('');
    setSignUpCode('');
    setResetCode('');
    setResetPasswordValue('');
    setResetPasswordConfirm('');
  };

  const handleEmailSubmit = async (mode: 'signIn' | 'signUp') => {
    const normalizedEmail = email.trim().toLowerCase();
    const basicEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    if (!normalizedEmail) {
      setError('Enter your business email.');
      return;
    }

    if (!basicEmailRegex.test(normalizedEmail)) {
      setError('Enter a valid email address.');
      return;
    }

    if (!isAllowedBusinessEmail(normalizedEmail)) {
      const domain = getEmailDomain(normalizedEmail);
      if (!domain) {
        setError('Enter a valid business email address.');
        return;
      }

      setError(
        `Could not find the specified domain. Contact an admin for assistance.`
      );
      return;
    }

    setError(null);
    setEmailTouched(false);
    setApprovedEmail(normalizedEmail);
    setStatusMessage(null);
    setAuthErrorMessage(null);
    setSignUpCode('');
    setResetCode('');
    setResetPasswordValue('');
    setResetPasswordConfirm('');
    if (mode === 'signIn') {
      setSignInPassword('');
      setPendingAction('checkAccountStatus');
      try {
        const accountStatus = await checkAccountStatus(normalizedEmail);
        setPendingAction(null);

        if (accountStatus === 'not-found') {
          setStatusMessage(
            `We couldn't find an account for ${normalizedEmail}. Let's create one for you.`
          );
          setSignUpPassword('');
          setSignUpPasswordConfirm('');
          changeStep('signUp');
          return;
        }

        if (accountStatus === 'unconfirmed') {
          setPendingAction('resendSignUpCode');
          try {
            await resendSignUpCode({ username: normalizedEmail });
          } catch (resendError) {
            console.error('Failed to resend verification code', resendError);
          } finally {
            setPendingAction(null);
          }

          setStatusMessage(
            'Confirm your account to finish signing in. We just sent you a new verification code.'
          );
          setSignUpCode('');
          changeStep('confirmSignUp');
          return;
        }
      } catch (checkError) {
        console.error('Failed to check account status', checkError);
        setPendingAction(null);
        setApprovedEmail(null);
        setError('We ran into a problem checking your account. Try again.');
        return;
      }

      changeStep('signIn');
    } else {
      setSignUpPassword('');
      setSignUpPasswordConfirm('');
      changeStep('signUp');
    }
  };

  const handleSignInSubmit = async () => {
    if (!approvedEmail) {
      return;
    }

    if (!signInPassword) {
      setAuthErrorMessage('Enter your password.');
      return;
    }

    setPendingAction('signIn');
    setStatusMessage(null);
    setAuthErrorMessage(null);

    try {
      await signIn({ username: approvedEmail, password: signInPassword });
      console.log(
        'Sign in successful, fetching auth session to trigger context update...'
      );

      // Force refresh the auth session to trigger Hub events and update Authenticator context
      try {
        await fetchAuthSession({ forceRefresh: true });
        await getCurrentUser();
        console.log('Auth session refreshed and user fetched');

        // Give the Authenticator context a moment to update
        await new Promise((resolve) => setTimeout(resolve, 100));
      } catch (userErr) {
        console.error('Failed to refresh session after sign-in', userErr);
      }

      // Don't navigate here - let the useAuthenticator hook update and trigger the redirect
    } catch (err) {
      if (isAmplifyError(err) && err.name === 'UserNotConfirmedException') {
        setStatusMessage(
          'Confirm your account to finish signing in. We just sent you a new verification code.'
        );
        changeStep('confirmSignUp');
        setSignUpCode('');
        try {
          await resendSignUpCode({ username: approvedEmail });
        } catch (resendError) {
          console.error('Failed to resend verification code', resendError);
        }
      } else if (isAmplifyError(err) && err.name === 'UserNotFoundException') {
        // Drive users without existing accounts directly into the sign-up flow
        setStatusMessage(
          `We couldn't find an account for ${approvedEmail}. Let's create one for you.`
        );
        setSignUpPassword('');
        setSignUpPasswordConfirm('');
        changeStep('signUp');
      } else {
        console.error('Sign in failed', err);
        setAuthErrorMessage(getAmplifyErrorMessage(err, approvedEmail));
      }
    } finally {
      setPendingAction(null);
    }
  };

  const handleSignUpSubmit = async () => {
    if (!approvedEmail) {
      return;
    }

    if (!signUpPassword || !signUpPasswordConfirm) {
      setAuthErrorMessage('Enter and confirm your password.');
      return;
    }

    if (signUpPassword !== signUpPasswordConfirm) {
      setAuthErrorMessage('Passwords do not match.');
      return;
    }

    setPendingAction('signUp');
    setStatusMessage(null);
    setAuthErrorMessage(null);

    try {
      const result = await signUp({
        username: approvedEmail,
        password: signUpPassword,
        options: {
          userAttributes: { email: approvedEmail },
          autoSignIn: { enabled: true },
        },
      });

      if (result.isSignUpComplete) {
        setStatusMessage('Account created. Signing you in…');
      } else {
        setStatusMessage('Enter the verification code we just emailed you.');
        setSignUpCode('');
        changeStep('confirmSignUp');
      }
    } catch (err) {
      console.error('Sign up failed', err);
      if (isAmplifyError(err) && err.name === 'UsernameExistsException') {
        setStatusMessage(
          'An account already exists for this email. Try signing in.'
        );
        setSignInPassword('');
        changeStep('signIn');
      } else {
        setAuthErrorMessage(getAmplifyErrorMessage(err, approvedEmail));
      }
    } finally {
      setPendingAction(null);
    }
  };

  const handleConfirmSignUp = async () => {
    if (!approvedEmail) {
      return;
    }

    const trimmedCode = signUpCode.trim();
    if (!trimmedCode) {
      setAuthErrorMessage('Enter the verification code.');
      return;
    }

    setPendingAction('confirmSignUp');
    setStatusMessage(null);
    setAuthErrorMessage(null);

    try {
      await confirmSignUp({
        username: approvedEmail,
        confirmationCode: trimmedCode,
      });

      setStatusMessage('Account confirmed. You can sign in now.');
      setSignUpCode('');
      changeStep('signIn');
      if (signUpPassword) {
        setSignInPassword(signUpPassword);
      }
    } catch (err) {
      console.error('Confirm sign up failed', err);
      setAuthErrorMessage(getAmplifyErrorMessage(err, approvedEmail));
    } finally {
      setPendingAction(null);
    }
  };

  const handleResendSignUpCode = async () => {
    if (!approvedEmail) {
      return;
    }

    setPendingAction('resendSignUpCode');
    setAuthErrorMessage(null);

    try {
      await resendSignUpCode({ username: approvedEmail });
      setStatusMessage('Verification code resent. Check your email.');
    } catch (err) {
      console.error('Resend sign up code failed', err);
      setAuthErrorMessage(getAmplifyErrorMessage(err, approvedEmail));
    } finally {
      setPendingAction(null);
    }
  };

  const handleStartReset = async () => {
    if (!approvedEmail) {
      return;
    }

    setPendingAction('forgotPassword');
    setStatusMessage(null);
    setAuthErrorMessage(null);

    try {
      await resetPassword({ username: approvedEmail });
      setStatusMessage('We emailed you a reset code.');
      setResetCode('');
      setResetPasswordValue('');
      setResetPasswordConfirm('');
      changeStep('confirmForgotPassword');
    } catch (err) {
      console.error('Reset password request failed', err);
      setAuthErrorMessage(getAmplifyErrorMessage(err, approvedEmail));
    } finally {
      setPendingAction(null);
    }
  };

  const handleConfirmReset = async () => {
    if (!approvedEmail) {
      return;
    }

    const trimmedCode = resetCode.trim();
    if (!trimmedCode) {
      setAuthErrorMessage('Enter the reset code.');
      return;
    }

    if (!resetPasswordValue || !resetPasswordConfirm) {
      setAuthErrorMessage('Enter and confirm your new password.');
      return;
    }

    if (resetPasswordValue !== resetPasswordConfirm) {
      setAuthErrorMessage('Passwords do not match.');
      return;
    }

    setPendingAction('confirmForgotPassword');
    setStatusMessage(null);
    setAuthErrorMessage(null);

    try {
      await confirmResetPassword({
        username: approvedEmail,
        confirmationCode: trimmedCode,
        newPassword: resetPasswordValue,
      });
      setStatusMessage('Password updated. Sign in with your new password.');
      setSignInPassword(resetPasswordValue);
      changeStep('signIn');
    } catch (err) {
      console.error('Confirm reset password failed', err);
      setAuthErrorMessage(getAmplifyErrorMessage(err, approvedEmail));
    } finally {
      setPendingAction(null);
    }
  };

  const stepCopy = useMemo(() => {
    switch (authStep) {
      case 'signIn':
        return {
          title: 'Welcome back',
          description: 'Enter your password to access Paroview.',
        };
      case 'signUp':
        return {
          title: 'Create your Paroview account',
          description: 'Set a password to activate your workspace.',
        };
      case 'confirmSignUp':
        return {
          title: 'Verify your email',
          description: 'Enter the verification code we sent to your inbox.',
        };
      case 'forgotPassword':
        return {
          title: 'Reset your password',
          description: 'We will email you a reset code for your account.',
        };
      case 'confirmForgotPassword':
        return {
          title: 'Set a new password',
          description: 'Enter the reset code and choose a new password.',
        };
      default:
        return {
          title: 'Welcome back',
          description: 'Enter your password to access Paroview.',
        };
    }
  }, [authStep]);

  const hasPendingAction = pendingAction !== null;

  const renderAuthForm = () => {
    switch (authStep) {
      case 'signIn':
        return (
          <Stack gap='md'>
            <PasswordInput
              label='Password'
              placeholder='Enter your password'
              value={signInPassword}
              onChange={(event) => setSignInPassword(event.currentTarget.value)}
              onKeyDown={submitOnEnter(handleSignInSubmit)}
              required
            />
            <Group justify='space-between' align='center'>
              <Button
                onClick={handleSignInSubmit}
                loading={isActionLoading('signIn')}
              >
                Sign in
              </Button>
            </Group>
            <Group justify='space-between' gap='xs'>
              <Button
                variant='subtle'
                size='xs'
                onClick={() => changeStep('forgotPassword')}
                disabled={hasPendingAction}
              >
                Forgot password?
              </Button>
              <Button
                variant='subtle'
                size='xs'
                onClick={resetToEmailEntry}
                disabled={hasPendingAction}
              >
                Back
              </Button>
            </Group>
          </Stack>
        );
      case 'signUp':
        return (
          <Stack gap='md'>
            <PasswordInput
              label='Password'
              placeholder='Create a password'
              value={signUpPassword}
              onChange={(event) => setSignUpPassword(event.currentTarget.value)}
              onKeyDown={submitOnEnter(handleSignUpSubmit)}
              required
            />
            <PasswordInput
              label='Confirm password'
              placeholder='Re-enter your password'
              value={signUpPasswordConfirm}
              onChange={(event) =>
                setSignUpPasswordConfirm(event.currentTarget.value)
              }
              onKeyDown={submitOnEnter(handleSignUpSubmit)}
              required
            />
            <Button
              onClick={handleSignUpSubmit}
              loading={isActionLoading('signUp')}
            >
              Create account
            </Button>
            <Button
              variant='subtle'
              onClick={resetToEmailEntry}
              disabled={hasPendingAction}
            >
              Back
            </Button>
          </Stack>
        );
      case 'confirmSignUp':
        return (
          <Stack gap='md'>
            <Text size='sm' c='dimmed'>
              Enter the verification code sent to {approvedEmail}.
            </Text>
            <TextInput
              label='Verification code'
              placeholder='123456'
              value={signUpCode}
              onChange={(event) => setSignUpCode(event.currentTarget.value)}
              onKeyDown={submitOnEnter(handleConfirmSignUp)}
              required
            />
            <Group justify='space-between' align='center'>
              <Button
                onClick={handleConfirmSignUp}
                loading={isActionLoading('confirmSignUp')}
              >
                Confirm account
              </Button>
              <Button
                variant='subtle'
                onClick={handleResendSignUpCode}
                loading={isActionLoading('resendSignUpCode')}
              >
                Resend code
              </Button>
            </Group>
            <Button
              variant='subtle'
              onClick={() => changeStep('signIn')}
              disabled={hasPendingAction}
            >
              Back to sign in
            </Button>
            <Button
              variant='subtle'
              size='xs'
              onClick={resetToEmailEntry}
              disabled={hasPendingAction}
              style={{ alignSelf: 'flex-start' }}
            >
              Back to email entry
            </Button>
          </Stack>
        );
      case 'forgotPassword':
        return (
          <Stack gap='md'>
            <Text size='sm' c='dimmed'>
              We’ll send a reset code to {approvedEmail}. Use it to update your
              password.
            </Text>
            <Button
              onClick={handleStartReset}
              loading={isActionLoading('forgotPassword')}
            >
              Send reset code
            </Button>
            <Button
              variant='subtle'
              onClick={() => changeStep('signIn')}
              disabled={hasPendingAction}
            >
              Back to sign in
            </Button>
            <Button
              variant='subtle'
              size='xs'
              onClick={resetToEmailEntry}
              disabled={hasPendingAction}
              style={{ alignSelf: 'flex-start' }}
            >
              Back to email entry
            </Button>
          </Stack>
        );
      case 'confirmForgotPassword':
        return (
          <Stack gap='md'>
            <TextInput
              label='Reset code'
              placeholder='Enter the code you received'
              value={resetCode}
              onChange={(event) => setResetCode(event.currentTarget.value)}
              onKeyDown={submitOnEnter(handleConfirmReset)}
              required
            />
            <PasswordInput
              label='New password'
              placeholder='Enter a new password'
              value={resetPasswordValue}
              onChange={(event) =>
                setResetPasswordValue(event.currentTarget.value)
              }
              onKeyDown={submitOnEnter(handleConfirmReset)}
              required
            />
            <PasswordInput
              label='Confirm new password'
              placeholder='Re-enter the new password'
              value={resetPasswordConfirm}
              onChange={(event) =>
                setResetPasswordConfirm(event.currentTarget.value)
              }
              onKeyDown={submitOnEnter(handleConfirmReset)}
              required
            />
            <Button
              onClick={handleConfirmReset}
              loading={isActionLoading('confirmForgotPassword')}
            >
              Update password
            </Button>
            <Button
              variant='subtle'
              onClick={() => changeStep('signIn')}
              disabled={hasPendingAction}
            >
              Back to sign in
            </Button>
            <Button
              variant='subtle'
              size='xs'
              onClick={resetToEmailEntry}
              disabled={hasPendingAction}
              style={{ alignSelf: 'flex-start' }}
            >
              Back to email entry
            </Button>
          </Stack>
        );
      default:
        return null;
    }
  };

  // Redirect if authenticated, regardless of whether user object has loaded
  if (authStatus === 'authenticated') {
    console.log('Rendering Navigate component to redirect to home');
    return <Navigate to='/' replace />;
  }

  if (authStatus === 'configuring') {
    return (
      <Center h='100vh' bg={backgroundColor}>
        <Stack align='center' gap='xs'>
          <Loader />
          <Text size='sm' c='dimmed'>
            Loading your session…
          </Text>
        </Stack>
      </Center>
    );
  }

  if (!isEmailApproved) {
    return (
      <Center h='100vh' bg={backgroundColor}>
        <Paper maw={420} w='100%' p='xl' radius='md' shadow='md' withBorder>
          <Stack gap='lg'>
            <Stack gap='xs'>
              <Title order={2} ta='center'>
                Sign in to Paroview
              </Title>
              <Text ta='center' c='dimmed'>
                Use your business email to continue.
              </Text>
            </Stack>

            {error ? (
              <Alert color='red' title='Check your email'>
                {error}
              </Alert>
            ) : null}

            <TextInput
              label='Business email'
              placeholder='you@company.com'
              type='email'
              value={email}
              onChange={(event) => {
                setEmail(event.currentTarget.value);
                if (!emailTouched) {
                  setEmailTouched(true);
                }
              }}
              onBlur={() => setEmailTouched(true)}
              error={
                emailTouched && !email ? 'Enter your business email.' : error
              }
              onKeyDown={submitOnEnter(() => handleEmailSubmit('signIn'))}
              required
            />

            <Button
              fullWidth
              onClick={() => void handleEmailSubmit('signIn')}
              loading={isActionLoading('checkAccountStatus')}
              disabled={isActionLoading('checkAccountStatus')}
            >
              Continue
            </Button>

            <Stack gap={2}>
              <Button variant='outline' size='md' component={Link} to='/demo'>
                Demo
              </Button>
              <Text size='xs' c='dimmed' ta='center'>
                Takes 60 seconds — move work across stages and feel the flow.
              </Text>
            </Stack>
          </Stack>
        </Paper>
      </Center>
    );
  }

  const { title, description } = stepCopy;

  return (
    <Center h='100vh' bg={backgroundColor}>
      <Paper maw={420} w='100%' p='xl' radius='md' shadow='md' withBorder>
        <Stack gap='lg'>
          <Stack gap='xs' align='center'>
            <Title order={2} ta='center'>
              {title}
            </Title>
            {description ? (
              <Text ta='center' c='dimmed'>
                {description}
              </Text>
            ) : null}
            <Text size='sm' c='dimmed'>
              Business email: {approvedEmail}
            </Text>
          </Stack>

          {statusMessage ? (
            <Alert color='teal' variant='light'>
              {statusMessage}
            </Alert>
          ) : null}

          {authErrorMessage ? (
            <Alert color='red' variant='light'>
              {authErrorMessage}
            </Alert>
          ) : null}

          {renderAuthForm()}
        </Stack>
      </Paper>
    </Center>
  );
}

type AmplifyError = {
  name: string;
  message: string;
};

function isAmplifyError(error: unknown): error is AmplifyError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'name' in error &&
    typeof (error as { name: unknown }).name === 'string'
  );
}

function getAmplifyErrorMessage(error: unknown, email?: string): string {
  if (isAmplifyError(error)) {
    const normalizedMessage =
      typeof error.message === 'string' ? error.message.toLowerCase() : '';

    switch (error.name) {
      case 'UserNotFoundException':
        return email
          ? `We couldn't find an account for ${email}. Try creating one instead.`
          : "We couldn't find an account for that email.";
      case 'NotAuthorizedException':
        return 'Incorrect email or password. Try again or reset your password.';
      case 'PasswordResetRequiredException':
        return 'You need to reset your password before signing in.';
      case 'UsernameExistsException':
        return 'An account with this email already exists.';
      case 'CodeMismatchException':
        return 'The verification code you entered is incorrect.';
      case 'ExpiredCodeException':
        return 'That code has expired. Request a new one.';
      case 'LimitExceededException':
      case 'TooManyFailedAttemptsException':
        return 'Too many attempts. Please wait a moment and try again.';
      case 'InvalidPasswordException':
        return 'Your password does not meet the complexity requirements.';
      case 'InvalidStateException':
        if (
          normalizedMessage.includes('already') &&
          normalizedMessage.includes('signed in user')
        ) {
          return 'We are finishing sign out from your last session. Try again in a moment.';
        }
        return 'We ran into an unexpected authentication state. Please try again.';
      default:
        return error.message || 'Something went wrong. Please try again.';
    }
  }

  return 'Something went wrong. Please try again.';
}

type AccountStatus = 'exists' | 'not-found' | 'unconfirmed';

async function checkAccountStatus(email: string): Promise<AccountStatus> {
  try {
    await signIn({ username: email, password: generateTempPassword() });
    return 'exists';
  } catch (error) {
    if (isAmplifyError(error)) {
      switch (error.name) {
        case 'UserNotFoundException':
          return 'not-found';
        case 'UserNotConfirmedException':
          return 'unconfirmed';
        case 'NotAuthorizedException':
        case 'PasswordResetRequiredException':
        case 'TooManyFailedAttemptsException':
        case 'LimitExceededException':
          return 'exists';
        default:
          throw error;
      }
    }

    throw error;
  }
}

function generateTempPassword(): string {
  const cryptoObj =
    typeof globalThis !== 'undefined'
      ? (globalThis as { crypto?: { randomUUID?: () => string } }).crypto
      : undefined;

  if (cryptoObj && typeof cryptoObj.randomUUID === 'function') {
    return cryptoObj.randomUUID();
  }

  return (
    Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)
  );
}
