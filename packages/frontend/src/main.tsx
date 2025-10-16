import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@aws-amplify/ui-react/styles.css';
import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import App from './App.tsx';
import './cognito';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
