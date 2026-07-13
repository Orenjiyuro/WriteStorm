import type { ReactElement } from 'react';
import type { DomainError } from '../../../shared/errors';
import { rendererText } from '../../i18n';

export type SourceImportFailureAction =
  | {
    readonly kind: 'open_library';
    readonly label: string;
  }
  | {
    readonly kind: 'choose_file';
    readonly label: string;
  }
  | {
    readonly kind: 'choose_smaller_file';
    readonly label: string;
  }
  | {
    readonly kind: 'retry_import';
    readonly label: string;
  }
  | {
    readonly kind: 'retry_encoding';
    readonly label: string;
    readonly pendingImportId: string;
    readonly encodingOverride: 'utf-8' | 'gb18030';
  }
  | {
    readonly kind: 'open_existing_book';
    readonly label: string;
    readonly existingBookId: string;
    readonly existingSourceTextId: string;
  };

export type SourceImportFailureViewModel = {
  readonly title: string;
  readonly message: string;
  readonly repair: string;
  readonly actions: readonly SourceImportFailureAction[];
};

export type SourceImportFailurePanelProps = {
  readonly failure: SourceImportFailureViewModel;
  readonly onAction: (action: SourceImportFailureAction) => void;
};

export function createSourceImportFailureViewModel(error: DomainError): SourceImportFailureViewModel {
  const text = rendererText.sourceImport.failure;

  if (error.code !== 'IMPORT_ERROR') {
    return {
      title: text.genericTitle,
      message: error.message,
      repair: text.genericRepair,
      actions: [retryImportAction()],
    };
  }

  const details = error.details ?? {};

  switch (details.reason) {
    case 'no_current_library':
      return {
        title: text.openLibraryTitle,
        message: error.message,
        repair: text.openLibraryRepair,
        actions: [{ kind: 'open_library', label: text.openLibraryAction }],
      };
    case 'dialog_cancelled':
      return {
        title: text.cancelledTitle,
        message: error.message,
        repair: text.cancelledRepair,
        actions: [chooseFileAction()],
      };
    case 'invalid_extension':
      return {
        title: text.invalidExtensionTitle,
        message: error.message,
        repair: text.invalidExtensionRepair,
        actions: [chooseFileAction()],
      };
    case 'not_readable':
      return {
        title: text.notReadableTitle,
        message: error.message,
        repair: text.notReadableRepair,
        actions: [chooseFileAction()],
      };
    case 'file_too_large':
      return {
        title: text.tooLargeTitle,
        message: error.message,
        repair: text.tooLargeRepair(formatBytes(asNumber(details.maxSizeBytes) ?? 20 * 1024 * 1024), formatBytes(asNumber(details.sizeBytes))),
        actions: [{ kind: 'choose_smaller_file', label: text.smallerFileAction }],
      };
    case 'empty_file':
      return {
        title: text.emptyTitle,
        message: error.message,
        repair: text.emptyRepair,
        actions: [chooseFileAction()],
      };
    case 'encoding_required':
      return encodingRequiredViewModel(error.message, details);
    case 'pending_import_not_found':
      return {
        title: text.pendingTitle,
        message: error.message,
        repair: text.pendingRepair,
        actions: [chooseFileAction()],
      };
    case 'library_session_changed':
      return {
        title: text.sessionChangedTitle,
        message: error.message,
        repair: text.sessionChangedRepair,
        actions: [chooseFileAction()],
      };
    case 'duplicate_source_hash':
      return duplicateSourceViewModel(error.message, details);
    case 'target_conflict':
      return {
        title: text.targetConflictTitle,
        message: error.message,
        repair: text.targetConflictRepair(asString(details.relativePath) ?? text.unknownTargetPath),
        actions: [retryImportAction()],
      };
    case 'copy_failed':
      return {
        title: text.copyFailedTitle,
        message: error.message,
        repair: text.copyFailedRepair,
        actions: [retryImportAction()],
      };
    case 'database_write_failed':
      return {
        title: text.databaseFailedTitle,
        message: error.message,
        repair: text.databaseFailedRepair,
        actions: [retryImportAction()],
      };
    default:
      return {
        title: text.genericTitle,
        message: error.message,
        repair: text.genericRepair,
        actions: [retryImportAction()],
      };
  }
}

export function SourceImportFailurePanel({ failure, onAction }: SourceImportFailurePanelProps): ReactElement {
  return (
    <section className="source-import-failure" role="alert" aria-label={failure.title}>
      <h3>{failure.title}</h3>
      <p>{failure.message}</p>
      <p>{failure.repair}</p>
      <ul aria-label="Import recovery actions">
        {failure.actions.map((action) => (
          <li key={sourceImportFailureActionKey(action)}>
            <button type="button" onClick={() => onAction(action)}>{action.label}</button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function encodingRequiredViewModel(
  message: string,
  details: Record<string, unknown>,
): SourceImportFailureViewModel {
  const pendingImportId = asString(details.pendingImportId);
  const supportedEncodings = asSupportedEncodings(details.supportedEncodings);

  return {
    title: rendererText.sourceImport.failure.encodingTitle,
    message,
    repair: pendingImportId
      ? rendererText.sourceImport.failure.encodingRepair
      : rendererText.sourceImport.failure.encodingFallbackRepair,
    actions: pendingImportId
      ? supportedEncodings.map((encoding) => ({
        kind: 'retry_encoding',
        label: rendererText.sourceImport.failure.retryEncodingAction(encoding),
        pendingImportId,
        encodingOverride: encoding,
      }))
      : [chooseFileAction()],
  };
}

function duplicateSourceViewModel(
  message: string,
  details: Record<string, unknown>,
): SourceImportFailureViewModel {
  const existingBookId = asString(details.existingBookId) ?? '';
  const existingSourceTextId = asString(details.existingSourceTextId) ?? '';

  return {
    title: rendererText.sourceImport.failure.duplicateTitle,
    message,
    repair: rendererText.sourceImport.failure.duplicateRepair,
    actions: [{
      kind: 'open_existing_book',
      label: rendererText.sourceImport.failure.openExistingAction,
      existingBookId,
      existingSourceTextId,
    }],
  };
}

function chooseFileAction(): SourceImportFailureAction {
  return { kind: 'choose_file', label: rendererText.sourceImport.failure.chooseFileAction };
}

function retryImportAction(): SourceImportFailureAction {
  return { kind: 'retry_import', label: rendererText.sourceImport.failure.retryAction };
}

function sourceImportFailureActionKey(action: SourceImportFailureAction): string {
  switch (action.kind) {
    case 'retry_encoding':
      return `${action.kind}:${action.pendingImportId}:${action.encodingOverride}`;
    case 'open_existing_book':
      return `${action.kind}:${action.existingBookId}:${action.existingSourceTextId}`;
    default:
      return action.kind;
  }
}

function asString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function asSupportedEncodings(value: unknown): Array<'utf-8' | 'gb18030'> {
  if (!Array.isArray(value)) {
    return ['utf-8', 'gb18030'];
  }

  return value.filter((encoding): encoding is 'utf-8' | 'gb18030' => (
    encoding === 'utf-8' || encoding === 'gb18030'
  ));
}

function formatBytes(value: number | null): string {
  if (value === null) {
    return 'unknown';
  }

  const mebibytes = value / (1024 * 1024);

  return Number.isInteger(mebibytes)
    ? `${mebibytes} MiB`
    : `${mebibytes.toFixed(1)} MiB`;
}
