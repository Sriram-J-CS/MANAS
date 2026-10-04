import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';
import { DevAvatarCheckPage } from './pages/DevAvatarCheckPage.tsx';
import { DevLipSyncPage } from './pages/DevLipSyncPage.tsx';

// Simple lightweight route selector for developer pages
function RootRouter() {
  const pathname = typeof window !== 'undefined' ? window.location.pathname : '/';

  if (pathname.startsWith('/dev/avatar-check')) {
    return <DevAvatarCheckPage />;
  }

  if (pathname.startsWith('/dev/lipsync')) {
    return <DevLipSyncPage />;
  }

  return <App />;
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RootRouter />
  </StrictMode>,
);
