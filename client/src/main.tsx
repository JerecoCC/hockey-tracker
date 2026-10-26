import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@jerecocc/tracker-ui/style.css';
import './index.scss';
import App from './App';
import { installStaleBuildReload } from './lib/staleBuildReload';

installStaleBuildReload();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
