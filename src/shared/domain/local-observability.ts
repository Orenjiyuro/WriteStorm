export const LOCAL_OBSERVABILITY_POLICY = {
  storageScope: 'local_only',
  remoteUploadByDefault: {
    crashReports: false,
    usageStatistics: false,
    sourceTextSnippets: false,
  },
  sourceTextSnippetsMayBeRecorded: false,
  clearRequiresExplicitUserAction: true,
  manualExportRequiresExplicitUserAction: true,
  execution: 'not_admitted',
} as const;

export const LOCAL_OBSERVABILITY_SHELL_STATE = {
  recentErrorSummary: {
    status: 'unavailable',
    errorCount: null,
    reasonCode: 'local_log_reader_not_admitted',
  },
  clearLogs: {
    status: 'unavailable',
    reasonCode: 'local_log_clear_not_admitted',
  },
  manualExport: {
    status: 'unavailable',
    reasonCode: 'manual_log_export_not_admitted',
  },
} as const;
