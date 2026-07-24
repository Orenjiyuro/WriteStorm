import { describe, expect, it } from 'vitest';
import {
  isCodexProductProbeRequest,
  isCodexProductProbeResponse,
} from '../../src/main/ai/providers/codex/codex-product-probe-protocol';
import {
  loadCodexProductProbeFixture,
} from '../../src/main/ai/providers/codex/codex-product-probe-fixture';

const token = { attempt: 1, generation: 1 } as const;

describe('Block 13.11 product utility probe protocol', () => {
  it.each(['success', 'cancel', 'timeout'] as const)(
    'accepts one exact fixed-fixture start request for %s',
    (scenario) => {
      expect(isCodexProductProbeRequest({
        version: 1,
        origin: 'main',
        type: 'ai.product-probe.start',
        token,
        scenario,
        fixtureId: 'block13-product-packaged-probe-v1',
      })).toBe(true);
    },
  );

  it('rejects paths, prompts, schemas and extra fields in the utility protocol', () => {
    for (const extra of [
      { prompt: 'secret' },
      { workingDirectory: 'C:\\Library' },
      { outputSchema: {} },
      { expected: 'WS13' },
    ]) {
      expect(isCodexProductProbeRequest({
        version: 1,
        origin: 'main',
        type: 'ai.product-probe.start',
        token,
        scenario: 'success',
        fixtureId: 'block13-product-packaged-probe-v1',
        ...extra,
      })).toBe(false);
    }
  });

  it('admits only closed sanitized started and result responses', () => {
    expect(isCodexProductProbeResponse({
      version: 1,
      origin: 'utility',
      type: 'ai.product-probe.started',
      token,
      scenario: 'cancel',
    })).toBe(true);
    expect(isCodexProductProbeResponse({
      version: 1,
      origin: 'utility',
      type: 'ai.product-probe.result',
      token,
      scenario: 'success',
      outcome: 'success',
      assertions: {
        sdkImported: true,
        clientConstructed: true,
        scratchInsideOsTemp: true,
        nonGitWorkspace: true,
        skipGitRepoCheck: true,
        environmentAllowlisted: true,
        finalJsonParsed: true,
        strictValidatorAccepted: true,
        expectedValueMatched: true,
        abortObserved: false,
        scratchCleanupCompleted: true,
      },
    })).toBe(true);
    expect(isCodexProductProbeResponse({
      version: 1,
      origin: 'utility',
      type: 'ai.product-probe.result',
      token,
      scenario: 'success',
      outcome: 'success',
      assertions: {},
      rawError: 'secret',
    })).toBe(false);
  });

  it('loads only the hash-pinned synthetic fixture and strict schema', () => {
    const fixture = loadCodexProductProbeFixture();
    expect(fixture).toMatchObject({
      schemaVersion: 1,
      fixtureId: 'block13-product-packaged-probe-v1',
      classification: 'public_non_sensitive',
      inputSha256: '59aa434b8ea52837a69ea3108fed8b68ba88d1619a52a2238beba6131f4c652d',
      expectedSha256: 'a7f22d406f5cfb05b2d81c85aa8a8672196fb79e98ab44da89c45450bf9f344a',
      schemaSha256: '519d24096fd78b806b351fd28ef4c0167acf3c035e91fc9abacadadcd76f0ed8',
    });
    expect(fixture.outputSchema).toEqual({
      type: 'object',
      properties: { status: { type: 'string', const: 'WS13' } },
      required: ['status'],
      additionalProperties: false,
    });
  });
});
