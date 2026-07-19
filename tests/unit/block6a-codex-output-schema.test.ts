import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  isCodexFeasibilityRequest,
  isCodexFeasibilityResponse,
} from '../../src/main/codex-feasibility/protocol';
import { validateMinimalStructuredOutput } from '../../src/main/codex-feasibility/structured-output';

const rootDir = path.resolve(__dirname, '../..');

describe('Block 6A.6 minimal outputSchema boundary', () => {
  it('locks real SDK and local fixture evidence as separate provenance classes', () => {
    const realEvidence = JSON.parse(readFileSync(path.join(
      rootDir,
      'docs/engineering/evidence/block6a-task6a6-real-output-schema.json',
    ), 'utf8')) as Record<string, unknown> & { assertions: Record<string, boolean>; scenarios: unknown[] };
    const fixtureEvidence = JSON.parse(readFileSync(path.join(
      rootDir,
      'docs/engineering/evidence/block6a-task6a6-validator-fixtures.json',
    ), 'utf8')) as Record<string, unknown> & { assertions: Record<string, boolean>; cases: unknown[] };

    expect(realEvidence.source).toBe('real_sdk');
    expect(realEvidence.classification).toBe('output_schema_probe_completed');
    expect(Object.values(realEvidence.assertions).every(Boolean)).toBe(true);
    expect(realEvidence.scenarios).toEqual([
      expect.objectContaining({
        scenario: 'valid-minimal',
        outcome: 'success',
        finalJsonParsed: true,
        strictValidatorAccepted: true,
        expectedValueMatched: true,
      }),
      expect.objectContaining({
        scenario: 'invalid-schema',
        outcome: 'invalid_schema_rejected',
        invalidSchemaRejectedBySdk: true,
      }),
    ]);
    expect(fixtureEvidence.source).toBe('local_validator_fixture');
    expect(Object.values(fixtureEvidence.assertions).every(Boolean)).toBe(true);
    expect(fixtureEvidence.cases).toEqual(expect.arrayContaining([
      expect.objectContaining({ case: 'missing-field', classification: 'missing_field' }),
      expect.objectContaining({ case: 'extra-field', classification: 'extra_field' }),
    ]));
    const serializedRealEvidence = JSON.stringify(realEvidence);
    expect(serializedRealEvidence).not.toContain('WRITESTORM_PROBE_OK');
    expect(serializedRealEvidence).not.toMatch(/[A-Z]:\\\\/);
    expect(serializedRealEvidence).not.toMatch(/"(?:prompt|responseBody|stdout|stderr|token|utilityPid)"\s*:/i);

    const authority = readFileSync(
      path.join(rootDir, 'docs/engineering/V1-BLOCK-6A-CODEX-SDK-FEASIBILITY.md'),
      'utf8',
    );
    expect(authority).toContain('Task 6A.6 completed the minimal structured-output gate');
    expect(authority).not.toContain('Tasks 6A.6 and 6A.8a remain blocked');
  });

  it('admits only closed output-schema scenarios without prompt or schema injection', () => {
    const request = {
      version: 1,
      origin: 'main',
      requestId: 'output-schema-1',
      command: 'run-output-schema-probe',
      input: {
        scenario: 'valid-minimal',
        workingDirectory: 'C:\\probe\\explicit-git',
      },
    };

    expect(isCodexFeasibilityRequest(request)).toBe(true);
    expect(isCodexFeasibilityRequest({ ...request, prompt: 'rejected' })).toBe(false);
    expect(isCodexFeasibilityRequest({
      ...request,
      input: { ...request.input, outputSchema: { type: 'object' } },
    })).toBe(false);
    expect(isCodexFeasibilityResponse({
      version: 1,
      requestId: request.requestId,
      command: 'run-output-schema-probe',
      ok: true,
      utilityPid: 1,
      result: {
        scenario: 'valid-minimal',
        outcome: 'success',
        authClassification: 'authenticated',
        finalJsonParsed: true,
        strictValidatorAccepted: true,
        expectedValueMatched: true,
        invalidSchemaRejectedBySdk: false,
      },
    })).toBe(true);
  });

  it('maps success, missing field and extra field through the same strict local validator', () => {
    expect(validateMinimalStructuredOutput('{"status":"expected"}', 'expected')).toEqual({
      classification: 'accepted',
      accepted: true,
      expectedValueMatched: true,
    });
    expect(validateMinimalStructuredOutput('{}', 'expected')).toEqual({
      classification: 'missing_field',
      accepted: false,
      expectedValueMatched: false,
    });
    expect(validateMinimalStructuredOutput(
      '{"status":"expected","extra":"rejected"}',
      'expected',
    )).toEqual({
      classification: 'extra_field',
      accepted: false,
      expectedValueMatched: false,
    });
  });

  it('keeps the real probe prompt out of committed source and evidence', () => {
    const source = readFileSync(
      path.join(rootDir, 'src/main/codex-feasibility/output-schema-probe-main.ts'),
      'utf8',
    );
    expect(source).not.toContain('WRITESTORM_PROBE_OK');
    expect(source).not.toMatch(/Return exactly|Thread\.run\(['"]/);
    expect(source).not.toContain('BrowserWindow');
  });
});
