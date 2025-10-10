import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import {
  Alert,
  Anchor,
  Button,
  Center,
  Group,
  Modal,
  Paper,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core';
import { useMemo, useState } from 'react';
import { Navigate } from 'react-router-dom';
import {
  allowedEmailDomains,
  getEmailDomain,
  isAllowedBusinessEmail,
} from '../cognito';
import { useDisclosure } from '@mantine/hooks';
import { DemoWorkspace } from '../components/DemoWorkspace';

export default function LoginPage() {
  const { authStatus } = useAuthenticator((context) => [context.authStatus]);
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [approvedEmail, setApprovedEmail] = useState<string | null>(null);
  const [initialAuthState, setInitialAuthState] = useState<'signIn' | 'signUp'>(
    'signUp'
  );
  const [demoOpened, { open: openDemo, close: closeDemo }] =
    useDisclosure(false);

  const allowedDomainSet = useMemo(
    () => new Set<string>(allowedEmailDomains),
    []
  );

  const handleEmailSubmit = (mode: 'signIn' | 'signUp') => {
    const normalizedEmail = email.trim().toLowerCase();

    if (!normalizedEmail) {
      setError('Enter your business email.');
      return;
    }

    if (!isAllowedBusinessEmail(normalizedEmail)) {
      const domain = getEmailDomain(normalizedEmail);
      if (!domain) {
        setError('Enter a valid business email address.');
        return;
      }

      setError(
        `The domain ${domain} is not registered with No Excel PM yet. Ask your workspace admin to enable it.`
      );
      return;
    }

    setError(null);
    setApprovedEmail(normalizedEmail);
    setInitialAuthState(mode);
  };

  const resetEmailStep = () => {
    setApprovedEmail(null);
    setEmail('');
    setError(null);
  };

  const authenticatorFormFields = useMemo(() => {
    if (!approvedEmail) {
      return undefined;
    }

    const readOnlyEmailField = {
      label: 'Business email',
      value: approvedEmail,
      type: 'email' as const,
      isRequired: true,
      isDisabled: true,
    };

    return {
      signIn: {
        username: readOnlyEmailField,
      },
      signUp: {
        email: readOnlyEmailField,
      },
      forgotPassword: {
        username: readOnlyEmailField,
      },
      resetPassword: {
        username: readOnlyEmailField,
      },
    };
  }, [approvedEmail]);

  const authenticatorComponents = useMemo(
    () => ({
      Header: () => (
        <Stack gap='xs' py='md'>
          <Title order={3} ta='center'>
            {initialAuthState === 'signUp'
              ? 'Create your account'
              : 'Welcome back'}
          </Title>
          <Text ta='center' c='dimmed'>
            Business email: {approvedEmail}
          </Text>
        </Stack>
      ),
      Footer: () => (
        <Center>
          <Anchor component='button' type='button' onClick={resetEmailStep}>
            Use a different email
          </Anchor>
        </Center>
      ),
    }),
    [approvedEmail, initialAuthState]
  );

  if (authStatus === 'authenticated') {
    return <Navigate to='/' replace />;
  }

  return (
    <Center h='100vh' bg='var(--mantine-color-gray-1)'>
      <Paper maw={420} w='100%' p='xl' radius='md' shadow='md' withBorder>
        <Stack gap='xs'>
          <Title order={2} ta='center'>
            Sign in to No Excel PM
          </Title>
          <Text ta='center' c='dimmed'>
            We currently support business domains:{' '}
            {Array.from(allowedDomainSet).join(', ')}
          </Text>
        </Stack>

        {!approvedEmail ? (
          <Stack gap='md'>
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
              onChange={(event) => setEmail(event.currentTarget.value)}
              required
            />

            <Group justify='space-between' gap='sm' grow>
              <Button onClick={() => handleEmailSubmit('signUp')}>
                Continue
              </Button>
              <Button
                variant='default'
                onClick={() => handleEmailSubmit('signIn')}
              >
                I already have a password
              </Button>
            </Group>

            <Stack gap={2}>
              <Button variant='outline' size='md' onClick={openDemo}>
                Explore interactive demo
              </Button>
              <Text size='xs' c='dimmed' ta='center'>
                Takes 60 seconds — move work across stages and feel the flow.
              </Text>
            </Stack>
          </Stack>
        ) : (
          <Authenticator
            initialState={initialAuthState}
            formFields={authenticatorFormFields}
            components={authenticatorComponents}
          />
        )}
      </Paper>

      <Modal
        opened={demoOpened}
        onClose={closeDemo}
        size='xl'
        radius='lg'
        padding='xl'
        overlayProps={{ opacity: 0.55, blur: 4 }}
        withinPortal
        title={null}
        withCloseButton
      >
        <DemoWorkspace />
      </Modal>
    </Center>
  );
}
