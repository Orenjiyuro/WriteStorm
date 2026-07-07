export const rendererLocale = 'en-US';

export const rendererFormats = {
  date: new Intl.DateTimeFormat(rendererLocale, { dateStyle: 'medium' }),
} as const;

export const rendererText = {
  appName: 'WriteStorm',
  emptyLibrary: {
    title: 'No library open',
    description: 'Create or open a local library to start using the breakdown shelf.',
  },
} as const;
