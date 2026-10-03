import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { browserPreviewApi } from './browser-api';
import './styles.css';
import { withPersistenceClient } from './domain/persistence-client';

window.desktop = (window as any).desktopTransport ? withPersistenceClient((window as any).desktopTransport) : browserPreviewApi;

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
