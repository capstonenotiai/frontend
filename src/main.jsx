import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, useLocation } from 'react-router-dom';
import App from './App';
import { AppDataProvider } from './context/AppDataContext';
import { UserProvider, useUser } from './context/UserContext';
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css';
import './styles/index.css';

function AppWithData() {
  const { sessionVersion } = useUser();
  const { pathname } = useLocation();
  const enabled = !['/', '/privacy', '/terms'].includes(pathname);
  return <AppDataProvider key={sessionVersion} enabled={enabled}><App /></AppDataProvider>;
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <UserProvider>
        <AppWithData />
      </UserProvider>
    </BrowserRouter>
  </StrictMode>,
);
