import { describe, expect, it } from 'vitest';
import { toSourceTextTargetConflict } from '../../src/main/source-text/source-text-conflicts';

describe('source text import conflict mapping', () => {
  it('maps source copy target conflicts to a stable import conflict result', () => {
    expect(toSourceTextTargetConflict({
      ok: false,
      reason: 'target_conflict',
      message: 'Copied source target already exists.',
      relativePath: 'source/source-1/Example.md',
    })).toEqual({
      ok: false,
      reason: 'target_conflict',
      message: 'The library already contains a copied source at the target path.',
      relativePath: 'source/source-1/Example.md',
    });
  });

  it('does not turn copy failures into filename conflicts', () => {
    expect(toSourceTextTargetConflict({
      ok: false,
      reason: 'copy_failed',
      message: 'Source file could not be copied into the library.',
    })).toBeNull();
  });
});
