import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { browserPreviewApi } from './browser-api';
import './styles.css';

if (!window.desktop) window.desktop = browserPreviewApi;

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
