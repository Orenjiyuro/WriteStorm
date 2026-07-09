import path from 'node:path';
import type { LibraryIpcDependencies } from '../ipc';
import type {
  CreateLibraryInput,
  LibraryService,
} from './library-service';

export const E2E_LIBRARY_DIALOG_STUB_ENV = 'WRITESTORM_E2E_LIBRARY_DIALOG_STUB';
export const E2E_LIBRARY_ROOT_ENV = 'WRITESTORM_E2E_LIBRARY_ROOT';
export const E2E_LIBRARY_NAME_ENV = 'WRITESTORM_E2E_LIBRARY_NAME';

export type DirectoryDialogOptions = {
  readonly title: string;
  readonly buttonLabel: string;
  readonly properties: ('openDirectory' | 'createDirectory')[];
};

export type DirectoryDialogResult = {
  readonly canceled: boolean;
  readonly filePaths: readonly string[];
};

export type ShowOpenDialog = (options: DirectoryDialogOptions) => Promise<DirectoryDialogResult>;

export type LibraryEntryIpcOptions = {
  readonly service: LibraryService;
  readonly env?: Record<string, string | undefined>;
  readonly showOpenDialog: ShowOpenDialog;
};

export function createLibraryEntryIpcDependencies(
  options: LibraryEntryIpcOptions,
): LibraryIpcDependencies {
  const env = options.env ?? process.env;

  return {
    service: options.service,
    selectCreateRoot: async () => {
      const stubSelection = resolveE2eStubSelection(env);

      if (stubSelection) {
        return stubSelection;
      }

      const rootPath = await selectDirectory(options.showOpenDialog, {
        title: 'Create WriteStorm library',
        buttonLabel: 'Create library',
        properties: ['openDirectory', 'createDirectory'],
      });

      return rootPath
        ? {
          rootPath,
          name: path.basename(rootPath) || 'WriteStorm Library',
        }
        : null;
    },
    selectOpenRoot: async () => {
      const stubSelection = resolveE2eStubSelection(env);

      if (stubSelection) {
        return stubSelection.rootPath;
      }

      return selectDirectory(options.showOpenDialog, {
        title: 'Open WriteStorm library',
        buttonLabel: 'Open library',
        properties: ['openDirectory'],
      });
    },
  };
}

async function selectDirectory(
  showOpenDialog: ShowOpenDialog,
  dialogOptions: DirectoryDialogOptions,
): Promise<string | null> {
  const result = await showOpenDialog(dialogOptions);

  if (result.canceled) {
    return null;
  }

  return result.filePaths[0] ?? null;
}

function resolveE2eStubSelection(env: Record<string, string | undefined>): CreateLibraryInput | null {
  if (env[E2E_LIBRARY_DIALOG_STUB_ENV] !== '1') {
    return null;
  }

  const rootPath = env[E2E_LIBRARY_ROOT_ENV]?.trim();

  if (!rootPath) {
    throw new Error(`${E2E_LIBRARY_ROOT_ENV} is required when ${E2E_LIBRARY_DIALOG_STUB_ENV}=1.`);
  }

  return {
    rootPath,
    name: env[E2E_LIBRARY_NAME_ENV]?.trim() || path.basename(rootPath) || 'WriteStorm Library',
  };
}
