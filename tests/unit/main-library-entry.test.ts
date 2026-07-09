import { describe, expect, it } from 'vitest';
import { createLibraryEntryIpcDependencies } from '../../src/main/library/library-entry';
import { LibraryService } from '../../src/main/library/library-service';

describe('main library entry providers', () => {
  it('uses the e2e dialog stub only when the explicit main-process env flag is enabled', async () => {
    const service = new LibraryService({ appVersion: '0.1.0-test' });
    let dialogCalls = 0;
    const library = createLibraryEntryIpcDependencies({
      service,
      env: {
        WRITESTORM_E2E_LIBRARY_DIALOG_STUB: '1',
        WRITESTORM_E2E_LIBRARY_ROOT: 'C:\\Temp\\WriteStorm E2E Library',
        WRITESTORM_E2E_LIBRARY_NAME: 'Stubbed Library',
      },
      showOpenDialog: async () => {
        dialogCalls += 1;

        return {
          canceled: false,
          filePaths: ['C:\\Unsafe\\Dialog'],
        };
      },
    });

    await expect(library.selectCreateRoot()).resolves.toEqual({
      rootPath: 'C:\\Temp\\WriteStorm E2E Library',
      name: 'Stubbed Library',
    });
    await expect(library.selectOpenRoot()).resolves.toBe('C:\\Temp\\WriteStorm E2E Library');
    expect(dialogCalls).toBe(0);
  });

  it('falls back to system directory dialogs without accepting renderer paths', async () => {
    const service = new LibraryService({ appVersion: '0.1.0-test' });
    const dialogOptions: unknown[] = [];
    const library = createLibraryEntryIpcDependencies({
      service,
      env: {},
      showOpenDialog: async (options) => {
        dialogOptions.push(options);

        return {
          canceled: false,
          filePaths: ['C:\\Libraries\\Story Lab'],
        };
      },
    });

    await expect(library.selectCreateRoot()).resolves.toEqual({
      rootPath: 'C:\\Libraries\\Story Lab',
      name: 'Story Lab',
    });
    await expect(library.selectOpenRoot()).resolves.toBe('C:\\Libraries\\Story Lab');
    expect(dialogOptions).toEqual([
      {
        title: 'Create WriteStorm library',
        buttonLabel: 'Create library',
        properties: ['openDirectory', 'createDirectory'],
      },
      {
        title: 'Open WriteStorm library',
        buttonLabel: 'Open library',
        properties: ['openDirectory'],
      },
    ]);
  });
});
