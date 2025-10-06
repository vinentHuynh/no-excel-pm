import { Authenticator, useAuthenticator } from '@aws-amplify/ui-react';
import { Center, Title } from '@mantine/core';
import { Navigate } from 'react-router-dom';

export default function LoginPage() {
  const { authStatus } = useAuthenticator((context) => [context.authStatus]);

  if (authStatus === 'authenticated') {
    return <Navigate to='/' replace />;
  }

  return (
    <Center h='100vh' bg='var(--mantine-color-gray-1)'>
      <div>
        <Title order={2} ta='center' mb='lg'>
          Sign in to No Excel PM
        </Title>
        <Authenticator />
      </div>
    </Center>
  );
}
