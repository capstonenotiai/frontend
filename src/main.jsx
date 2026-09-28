import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { AppDataProvider } from './context/AppDataContext';
import { UserProvider } from './context/UserContext';
import './styles/index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <UserProvider>
        <AppDataProvider>
          <App />
        </AppDataProvider>
      </UserProvider>
    </BrowserRouter>
  </StrictMode>,
);
