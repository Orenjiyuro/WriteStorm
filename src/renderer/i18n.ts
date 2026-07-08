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
  analysisContractReadout: {
    title: 'Analysis module contract readout',
    source: 'Source: shared domain contract',
    moduleCountSuffix: 'contract modules',
    secondarySystemPage: 'Secondary system page',
    disabledPlaceholder: 'Disabled placeholder',
    unsupportedScopeTitle: 'Unsupported scope and target exclusions',
    categoryLabels: {
      structure_input: 'structure/input',
      analysis: 'analysis',
    },
  },
  techniqueLibraryContractReadout: {
    title: 'Technique library contract readout',
    source: 'Source: shared technique domain contract',
    emptyStateLabel: 'Technique library empty state',
    detailShellTitle: 'Source snapshot secondary information',
    provenancePosition: 'Read-only provenance position',
    snapshotFieldLabel: 'Snapshot field',
    evidenceSummaryLabel: 'Evidence summary source',
    ownerBoundaryLabel: 'TechniqueEntry owner',
    ownerBoundaryPrefix: 'TechniqueEntry belongs to',
    ownerBoundarySuffix: 'while observations and candidates stay with breakdown books.',
    manualActionUnavailable: 'Manual primary action unavailable',
    futureManualDecision: 'Future manual creation requires a new product decision.',
  },
  perspectiveContractReadout: {
    title: 'Perspective contract readout',
    source: 'Source: shared perspective domain contract',
    viewCountSuffix: 'derived views',
    boundaryLabel: 'Derived view, not an AnalysisModule',
    factSourceLabel: 'not a fact source',
    scopeMeaningLabel: 'Scope meaning',
    viewKindLabel: 'View kind',
    blockedShellLabel: 'Blocked shell',
    dependencyStatusTitle: 'Dependency status shell',
    missingAssetLabel: 'Missing asset',
  },
} as const;
