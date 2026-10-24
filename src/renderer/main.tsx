import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { TooltipProvider } from './components/ui/Tooltip';
import './styles/tokens.css';
import './styles/globals.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <TooltipProvider delayDuration={400} skipDelayDuration={200}>
      <App />
    </TooltipProvider>
  </React.StrictMode>
);
