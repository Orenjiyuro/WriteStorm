import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('Block 10 durable engineering status', () => {
  it('records the Task 10.1 Job vocabulary and capability boundary', () => {
    const context = readFileSync('docs/engineering/CONTEXT.md', 'utf8');
    const decisions = readFileSync('docs/engineering/DECISIONS.md', 'utf8');

    for (const document of [context, decisions]) {
      expect(document).toContain('Task 10.1');
      expect(document).toContain('analysis_module_shell_creation');
      expect(document).toContain('analysis_module_instance_analysis');
      expect(document).toContain('contract_only');
      expect(document).toContain('analysis_module_instance_batch');
      expect(document).toContain('runtime owner');
      expect(document).toContain('totalUnits');
    }
    expect(decisions).toContain('D033: Job Vocabulary And Capability Policy');
  });

  it('records the Task 10.2 no-migration persistence read boundary', () => {
    const context = readFileSync('docs/engineering/CONTEXT.md', 'utf8');
    const decisions = readFileSync('docs/engineering/DECISIONS.md', 'utf8');
    const migrations = readFileSync('src/main/db/migrations/index.ts', 'utf8');

    for (const document of [context, decisions]) {
      expect(document).toContain('Task 10.2');
      expect(document).toContain('migration 001');
      expect(document).toContain('book_id = null');
      expect(document).toContain('updatedAt DESC');
      expect(document).toContain('invalid_persisted_json');
      expect(document).toContain('schema version remains 5');
    }
    expect(decisions).toContain('D034: Existing Job Persistence Read Boundary');
    expect(migrations).not.toContain('006_');
  });

  it('records the Task 10.3 JobService policy without claiming runtime cancellation', () => {
    const context = readFileSync('docs/engineering/CONTEXT.md', 'utf8');
    const decisions = readFileSync('docs/engineering/DECISIONS.md', 'utf8');

    for (const document of [context, decisions]) {
      expect(document).toContain('Task 10.3');
      expect(document).toContain("runtimeOwner: 'none' | 'confirmed_stopped'");
      expect(document).toContain('invalid_checkpoint_state');
      expect(document).toContain('invalid_progress');
      expect(document).toContain('invalid_failure');
      expect(document).toContain('Task 10.5');
      expect(document).toContain('runtime owner');
    }
    expect(decisions).toContain('D035: JobService Progress, Checkpoint, And Cancellation Policy');
  });

  it('records the Task 10.4 runtime-only module-shell Job boundary', () => {
    const context = readFileSync('docs/engineering/CONTEXT.md', 'utf8');
    const decisions = readFileSync('docs/engineering/DECISIONS.md', 'utf8');

    for (const document of [context, decisions]) {
      expect(document).toContain('Task 10.4');
      expect(document).toContain('analysis_module_shell_creation');
      expect(document).toContain('seven-instance batch');
      expect(document).toContain('migration 004');
      expect(document).toContain('must not fabricate');
      expect(document).toContain('same freeze transaction');
      expect(document).toContain('Task 10.5');
    }
    expect(decisions).toContain('D036: Existing Flow Job Records And Runtime Module Shell Audit');
  });

  it('records the pre-10.5 ownership and persisted DTO remediation', () => {
    const context = readFileSync('docs/engineering/CONTEXT.md', 'utf8');
    const decisions = readFileSync('docs/engineering/DECISIONS.md', 'utf8');

    for (const document of [context, decisions]) {
      expect(document).toContain('invalid_book_ownership');
      expect(document).toContain('invalid_checkpoint_kind');
      expect(document).toContain('job_not_creatable');
      expect(document).toContain('null -> imported Book');
      expect(document).toContain('final checkpoints');
      expect(document).toContain('atomic checkpoint + progress');
      expect(document).toContain('persisted JobRecord');
      expect(document).toContain('Task 10.5');
    }
    expect(decisions).toContain('D037: Pre-10.5 Job Integrity Remediation');
  });

  it('records Task 10.5 typed IPC and owner-first cancellation', () => {
    const context = readFileSync('docs/engineering/CONTEXT.md', 'utf8');
    const decisions = readFileSync('docs/engineering/DECISIONS.md', 'utf8');

    for (const document of [context, decisions]) {
      expect(document).toContain('Task 10.5');
      expect(document).toContain('jobs:list');
      expect(document).toContain('jobs:get');
      expect(document).toContain('jobs:cancel');
      expect(document).toContain('JobDetail');
      expect(document).toContain('JOB_ERROR');
      expect(document).toContain('cancelImport(jobId)');
      expect(document).toContain('cancelDetectionAndWait(jobId)');
      expect(document).toContain('owner-first');
      expect(document).toContain('Task 10.6');
    }
    expect(decisions).toContain('D038: Typed Job IPC And Runtime-Owner Cancellation');
  });

  it('records Task 10.6 natural-entry recovery UI and honest disabled actions', () => {
    const context = readFileSync('docs/engineering/CONTEXT.md', 'utf8');
    const decisions = readFileSync('docs/engineering/DECISIONS.md', 'utf8');

    for (const document of [context, decisions]) {
      expect(document).toContain('Task 10.6');
      expect(document).toContain('Breakdown shelf');
      expect(document).toContain('Library-wide');
      expect(document).toContain('Jobs & recovery');
      expect(document).toContain('Keep draft');
      expect(document).toContain('Resume');
      expect(document).toContain('Task 10.7');
    }
    expect(decisions).toContain('D039: Natural-Entry Job Recovery UI');
  });

  it('records Task 10.7 successful-activation restart recovery', () => {
    const context = readFileSync('docs/engineering/CONTEXT.md', 'utf8');
    const decisions = readFileSync('docs/engineering/DECISIONS.md', 'utf8');

    for (const document of [context, decisions]) {
      expect(document).toContain('Task 10.7');
      expect(document).toContain('successful Library activation');
      expect(document).toContain('SOURCE_IMPORT_ABANDONED');
      expect(document).toContain('library_activation_mismatch');
      expect(document).toContain('restart_recovery_failed');
      expect(document).toContain('failed/resumable');
      expect(document).toContain('Task 10.8');
    }
    expect(decisions).toContain('D040: Successful Library Activation Restart Recovery');
  });

  it('records Task 10.8 regression certification and the complete Block 10 boundary', () => {
    const context = readFileSync('docs/engineering/CONTEXT.md', 'utf8');
    const decisions = readFileSync('docs/engineering/DECISIONS.md', 'utf8');
    const status = readFileSync('docs/engineering/V1-BLOCK-10-STATUS.md', 'utf8');

    for (const document of [context, decisions, status]) {
      expect(document).toContain('Task 10.8');
      expect(document).toContain('state machine');
      expect(document).toContain('checkpoint safety');
      expect(document).toContain('invalid payload');
      expect(document).toContain('import guards');
      expect(document).toContain('npm run check');
    }
    for (let task = 1; task <= 8; task += 1) {
      expect(status).toContain(`10.${task}`);
    }
    expect(status).toContain('Jobs & recovery');
    expect(status).toContain('13/13');
    expect(status).toContain('resumable fixture');
    expect(status).toContain('no natural resumable producer');
    expect(decisions).toContain('D041: Block 10 Regression Gate And Completion Boundary');
  });
});
