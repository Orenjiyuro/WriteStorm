import { readFileSync, readdirSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import {
  JOB_STATES,
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
