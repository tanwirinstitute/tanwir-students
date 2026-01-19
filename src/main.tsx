import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './components/App'; // Use the React version
import { UserRoleProvider } from './context/UserRoleContext';
import { PageProvider } from './context/PageContext';
import './styles/main.css';

const queryClient = new QueryClient();
const root = ReactDOM.createRoot(document.getElementById('app')!);

root.render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <UserRoleProvider>
        <PageProvider>
          <App />
        </PageProvider>
      </UserRoleProvider>
    </QueryClientProvider>
  </React.StrictMode>
);