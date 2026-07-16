import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  JOB_CAPABILITIES,
  JOB_CANCELLATION_POLICY,
  JOB_CHECKPOINT_APPEND_STATES,
  JOB_CHECKPOINT_UNITS,
  JOB_PROGRESS_POLICY,
  JOB_STATES,
  JOB_TYPES,
  canTransitionJob,
} from '../../src/shared/domain';
import {
  jobCheckpointSchema,
  jobSummarySchema,
  versionedJobPayloadEnvelopeSchema,
} from '../../src/shared/contracts';

const validJobSummary = {
  id: 'job-1',
  bookId: null,
  state: 'estimating',
  title: 'Estimate import',
  completedUnits: 0,
  totalUnits: null,
  checkpointSummary: null,
  failureReason: null,
  updatedAt: '2026-07-11T00:00:00.000Z',
};

const validCheckpoint = {
  id: 'checkpoint-1',
  jobId: 'job-1',
  sequence: 1,
  kind: 'source_imported',
  payloadSchemaVersion: 1,
  payload: {
    sourceTextId: 'source-1',
  },
  createdAt: '2026-07-11T00:00:00.000Z',
};

describe('V1 Job and checkpoint contracts', () => {
  it('freezes persisted Job types without admitting future execution paths', () => {
    expect(JOB_TYPES).toEqual([
      'source_import',
      'structure_detection',
      'structure_edition',
      'analysis_module_shell_creation',
      'analysis_module_instance_analysis',
      'export',
    ]);

    expect(JOB_CAPABILITIES.analysis_module_shell_creation).toMatchObject({
      implementation: 'implemented',
      creatable: true,
      checkpointUnit: 'analysis_module_instance_batch',
    });
    expect(JOB_CAPABILITIES.analysis_module_instance_analysis).toMatchObject({
      implementation: 'contract_only',
      creatable: false,
      checkpointUnit: 'analysis_module_instance_batch',
    });
    expect(JOB_CAPABILITIES.export).toMatchObject({
      implementation: 'contract_only',
      creatable: false,
      checkpointUnit: 'export_manifest_and_blocked_reason',
    });

    const jobService = readFileSync('src/main/jobs/job-service.ts', 'utf8');
    expect(jobService).not.toContain("'analysis_module_instance_analysis@1'");
    expect(jobService).not.toContain("'export@1'");
  });

  it('freezes checkpoint units and append-state policy separately from Job state', () => {
    expect(JOB_CHECKPOINT_UNITS).toEqual([
      'source_copy_and_metadata',
      'structure_draft',
      'structure_edition',
      'analysis_module_instance_batch',
      'export_manifest_and_blocked_reason',
    ]);
    expect(JOB_CHECKPOINT_APPEND_STATES).toEqual(['running', 'paused', 'resumable']);

    for (const capability of Object.values(JOB_CAPABILITIES)) {
      expect(capability.allowsQueuedPreparationCheckpoint).toBe(false);
    }
    for (const state of ['failed', 'cancelled', 'completed'] as const) {
      expect(JOB_CHECKPOINT_APPEND_STATES).not.toContain(state);
    }
  });

  it('records cancellation, restart, resume, and draft ownership per Job type', () => {
    expect(JOB_CANCELLATION_POLICY).toEqual({
      dormantStateCandidates: ['queued', 'paused', 'resumable'],
      runtimeOwnerMustConfirmStopped: true,
      ipcMayPersistBeforeRuntimeOwnerStops: false,
    });
    expect(JOB_CAPABILITIES.source_import).toMatchObject({
      implementation: 'implemented',
      creatable: true,
      cancellation: 'runtime_owner_first',
      restartPolicy: 'fail_abandoned_runtime',
      resume: 'disabled',
      keepDraft: 'not_applicable',
    });
    expect(JOB_CAPABILITIES.structure_detection).toMatchObject({
      cancellation: 'runtime_owner_first',
      restartPolicy: 'preserve_for_explicit_recovery',
      keepDraft: 'structure_disabled',
    });
    expect(JOB_CAPABILITIES.structure_edition).toMatchObject({
      cancellation: 'transactional_not_cancellable',
      keepDraft: 'structure_disabled',
    });
  });

  it('freezes monotonic progress and one-way total discovery', () => {
    expect(JOB_PROGRESS_POLICY).toEqual({
      minimumCompletedUnits: 0,
      minimumKnownTotalUnits: 0,
      completedUnitsMonotonic: true,
      completedUnitsMayExceedKnownTotal: false,
      totalUnitsMayStartUnknown: true,
      totalUnitsMayBecomeKnownOnce: true,
      totalUnitsMayReturnToUnknown: false,
      totalUnitsMayChangeOnceKnown: false,
    });
  });

  it('freezes the complete Job state vocabulary and transition policy', () => {
    expect(JOB_STATES).toEqual([
      'queued',
      'estimating',
      'waiting_confirmation',
      'running',
      'paused',
      'failed',
      'resumable',
      'cancelled',
      'completed',
    ]);

    expect(canTransitionJob('queued', 'estimating')).toBe(true);
    expect(canTransitionJob('queued', 'running')).toBe(true);
    expect(canTransitionJob('running', 'completed')).toBe(true);
    expect(canTransitionJob('failed', 'resumable')).toBe(true);
    expect(canTransitionJob('completed', 'running')).toBe(false);
    expect(canTransitionJob('cancelled', 'running')).toBe(false);
  });

  it('validates JobSummary from the canonical Zod-first schema', () => {
    expect(jobSummarySchema.safeParse(validJobSummary).success).toBe(true);
    expect(jobSummarySchema.safeParse({ ...validJobSummary, state: 'unknown' }).success).toBe(
      false,
    );
    expect(jobSummarySchema.safeParse({ ...validJobSummary, completedUnits: -1 }).success).toBe(
      false,
    );
    expect(jobSummarySchema.safeParse({ ...validJobSummary, completedUnits: 0.5 }).success).toBe(
      false,
    );
    expect(jobSummarySchema.safeParse({ ...validJobSummary, totalUnits: -1 }).success).toBe(
      false,
    );
    expect(jobSummarySchema.safeParse({ ...validJobSummary, extra: true }).success).toBe(false);
  });

  it('validates positive, versioned checkpoint payload envelopes', () => {
    expect(jobCheckpointSchema.safeParse(validCheckpoint).success).toBe(true);
    expect(jobCheckpointSchema.safeParse({ ...validCheckpoint, sequence: 0 }).success).toBe(false);
    expect(
      jobCheckpointSchema.safeParse({ ...validCheckpoint, payloadSchemaVersion: 0 }).success,
    ).toBe(false);
    expect(jobCheckpointSchema.safeParse({ ...validCheckpoint, extra: true }).success).toBe(false);
    expect(
      versionedJobPayloadEnvelopeSchema.safeParse({
        payloadSchemaVersion: 1,
        payload: validCheckpoint.payload,
      }).success,
    ).toBe(true);
  });

  it('keeps the domain layer independent from IPC contracts', () => {
    const dtos = readFileSync('src/shared/domain/dtos.ts', 'utf8');
    expect(dtos).not.toContain('export type JobSummary = {');
    expect(dtos).not.toContain('contracts/');

    const domainFiles = readdirSync('src/shared/domain').filter((fileName) =>
      fileName.endsWith('.ts'),
    );
    const contractReferences = domainFiles.flatMap((fileName) => {
      const source = readFileSync(`src/shared/domain/${fileName}`, 'utf8');
      return source.includes('contracts/') ? [fileName] : [];
    });

    expect(contractReferences).toEqual([]);
  });
});
