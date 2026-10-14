import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { CurrencyProvider } from './context/CurrencyContext.jsx';
import './styles/index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <CurrencyProvider><App /></CurrencyProvider>
  </StrictMode>,
);
