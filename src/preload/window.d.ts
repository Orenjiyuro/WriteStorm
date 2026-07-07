export {};

declare global {
  interface Window {
    writestorm: {
      internal: {
        health: () => Promise<{ ok: true; app: 'WriteStorm' }>;
      };
    };
  }
}
