import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@jerecocc/tracker-ui/style.css';
import './index.scss';
import App from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
