import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import './styles/variables.css';
import './styles/fonts.css';
import App from './App.tsx';
import { AuthProvider } from './auth/AuthProvider.tsx';

createRoot(document.getElementById('root')!).render(
  // <StrictMode>
  <AuthProvider>
    <App />
  </AuthProvider>
  // </StrictMode>
);
