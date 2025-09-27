import { createRoot } from 'react-dom/client';
import './index.css';
import './styles/variables.css';
import './styles/fonts.css';
import App from './App.tsx';
import { AuthProvider } from './auth/AuthProvider.tsx';
import { FontLoaderProvider } from './contexts/FontLoaderContext';

createRoot(document.getElementById('root')!).render(
  // <StrictMode>
  <FontLoaderProvider>
    <AuthProvider>
      <App />
    </AuthProvider>
  </FontLoaderProvider>
  // </StrictMode>
);
