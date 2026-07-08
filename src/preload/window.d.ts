import type { WritestormApi } from '../shared/contracts';

declare global {
  interface Window {
    writestorm: WritestormApi;
  }
}

export {};
