export const JOB_STATES = [
  'queued',
  'estimating',
  'waiting_confirmation',
  'running',
  'paused',
  'failed',
  'resumable',
  'cancelled',
  'completed',
] as const;

export type JobState = (typeof JOB_STATES)[number];

/**
 * Persisted Job kinds. Existing values are immutable application-file data.
 * `analysis_module_instance_analysis` and `export` are vocabulary-only until
 * their explicitly gated runtimes are admitted.
 */
export const JOB_TYPES = [
  'source_import',
  'structure_detection',
  'structure_edition',
  'analysis_module_shell_creation',
  'analysis_module_instance_analysis',
  'export',
] as const;

export type JobType = (typeof JOB_TYPES)[number];

export const JOB_CHECKPOINT_UNITS = [
  'source_copy_and_metadata',
  'structure_draft',
  'structure_edition',
  'analysis_module_instance_batch',
  'export_manifest_and_blocked_reason',
] as const;

export type JobCheckpointUnit = (typeof JOB_CHECKPOINT_UNITS)[number];

export const JOB_IMPLEMENTATION_STAGES = [
  'implemented',
  'planned',
  'contract_only',
] as const;

export type JobImplementationStage = (typeof JOB_IMPLEMENTATION_STAGES)[number];

export const JOB_CHECKPOINT_APPEND_STATES = [
  'running',
  'paused',
  'resumable',
] as const satisfies readonly JobState[];

export const JOB_PROGRESS_POLICY = {
  minimumCompletedUnits: 0,
  minimumKnownTotalUnits: 0,
  completedUnitsMonotonic: true,
  completedUnitsMayExceedKnownTotal: false,
  totalUnitsMayStartUnknown: true,
  totalUnitsMayBecomeKnownOnce: true,
  totalUnitsMayReturnToUnknown: false,
  totalUnitsMayChangeOnceKnown: false,
} as const;

/**
 * A state is only a candidate for direct cancellation. If a runtime owner is
 * attached, that owner must stop and clean up before cancellation is persisted.
 */
export const JOB_CANCELLATION_POLICY = {
  dormantStateCandidates: ['queued', 'paused', 'resumable'],
  runtimeOwnerMustConfirmStopped: true,
  ipcMayPersistBeforeRuntimeOwnerStops: false,
} as const satisfies {
  readonly dormantStateCandidates: readonly JobState[];
  readonly runtimeOwnerMustConfirmStopped: true;
  readonly ipcMayPersistBeforeRuntimeOwnerStops: false;
};

export type JobCapability = {
  readonly implementation: JobImplementationStage;
  readonly creatable: boolean;
  readonly checkpointUnit: JobCheckpointUnit;
  readonly runtimeOwner:
    | 'source_import_service'
    | 'structure_service'
    | 'structure_freeze_transaction'
    | 'analysis_module_instance_edition_change_port'
    | 'future_analysis_runtime'
    | 'future_export_service';
  readonly cancellation:
    | 'runtime_owner_first'
    | 'transactional_not_cancellable'
    | 'contract_only';
  readonly allowsQueuedPreparationCheckpoint: boolean;
  readonly restartPolicy:
    | 'fail_abandoned_runtime'
    | 'preserve_for_explicit_recovery'
    | 'preserve_terminal'
    | 'contract_only';
  readonly resume: 'disabled' | 'contract_only';
  readonly keepDraft: 'not_applicable' | 'structure_disabled' | 'contract_only';
};

export const JOB_CAPABILITIES = {
  source_import: {
    implementation: 'implemented',
    creatable: true,
    checkpointUnit: 'source_copy_and_metadata',
    runtimeOwner: 'source_import_service',
    cancellation: 'runtime_owner_first',
    allowsQueuedPreparationCheckpoint: false,
    restartPolicy: 'fail_abandoned_runtime',
    resume: 'disabled',
    keepDraft: 'not_applicable',
  },
  structure_detection: {
    implementation: 'implemented',
    creatable: true,
    checkpointUnit: 'structure_draft',
    runtimeOwner: 'structure_service',
    cancellation: 'runtime_owner_first',
    allowsQueuedPreparationCheckpoint: false,
    restartPolicy: 'preserve_for_explicit_recovery',
    resume: 'disabled',
    keepDraft: 'structure_disabled',
  },
  structure_edition: {
    implementation: 'implemented',
    creatable: true,
    checkpointUnit: 'structure_edition',
    runtimeOwner: 'structure_freeze_transaction',
    cancellation: 'transactional_not_cancellable',
    allowsQueuedPreparationCheckpoint: false,
    restartPolicy: 'preserve_terminal',
    resume: 'disabled',
    keepDraft: 'structure_disabled',
  },
  analysis_module_shell_creation: {
    implementation: 'implemented',
    creatable: true,
    checkpointUnit: 'analysis_module_instance_batch',
    runtimeOwner: 'analysis_module_instance_edition_change_port',
    cancellation: 'transactional_not_cancellable',
    allowsQueuedPreparationCheckpoint: false,
    restartPolicy: 'preserve_terminal',
    resume: 'disabled',
    keepDraft: 'not_applicable',
  },
  analysis_module_instance_analysis: {
    implementation: 'contract_only',
    creatable: false,
    checkpointUnit: 'analysis_module_instance_batch',
    runtimeOwner: 'future_analysis_runtime',
    cancellation: 'contract_only',
    allowsQueuedPreparationCheckpoint: false,
    restartPolicy: 'contract_only',
    resume: 'contract_only',
    keepDraft: 'contract_only',
  },
  export: {
    implementation: 'contract_only',
    creatable: false,
    checkpointUnit: 'export_manifest_and_blocked_reason',
    runtimeOwner: 'future_export_service',
    cancellation: 'contract_only',
    allowsQueuedPreparationCheckpoint: false,
    restartPolicy: 'contract_only',
    resume: 'contract_only',
    keepDraft: 'not_applicable',
  },
} as const satisfies Readonly<Record<JobType, JobCapability>>;

export const JOB_TRANSITIONS = {
  queued: ['estimating', 'running', 'failed', 'cancelled'],
  estimating: ['waiting_confirmation', 'running', 'failed', 'cancelled'],
  waiting_confirmation: ['running', 'cancelled'],
  running: ['paused', 'failed', 'cancelled', 'completed'],
  paused: ['running', 'cancelled'],
  failed: ['resumable'],
  resumable: ['running', 'cancelled'],
  cancelled: [],
  completed: [],
} as const satisfies Readonly<Record<JobState, readonly JobState[]>>;

export function canTransitionJob(from: JobState, to: JobState): boolean {
  return (JOB_TRANSITIONS[from] as readonly JobState[]).includes(to);
}
