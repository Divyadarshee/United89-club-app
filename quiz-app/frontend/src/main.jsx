import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Dynamic favicon based on hostname
const setFavicon = () => {
  const hostname = window.location.hostname;
  const isUCE = hostname.includes('uce-quiz');
  const faviconPath = isUCE ? '/favicon-uce.svg' : '/favicon.svg';

  const link = document.querySelector("link[rel~='icon']");
  if (link) {
    link.href = faviconPath;
  }
};

// Set favicon on load
setFavicon();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
