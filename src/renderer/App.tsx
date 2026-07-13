import { QueryClientProvider } from '@tanstack/react-query';
import type { ReactElement } from 'react';
import { AppRouter } from './app/AppRouter';
import { rendererQueryClient } from './app/query-client';

export function App(): ReactElement {
  return (
    <QueryClientProvider client={rendererQueryClient}>
      <AppRouter />
    </QueryClientProvider>
  );
}
