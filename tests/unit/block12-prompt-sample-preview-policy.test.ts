import { describe, expect, it } from 'vitest';
import {
  PROMPT_SAMPLE_PREVIEW_BLOCKER_CODES,
  PROMPT_SAMPLE_PREVIEW_POLICY,
} from '../../src/shared/domain';

describe('Block 12 Task 12.10 Prompt sample preview policy', () => {
  it('blocks execution only on the still-unadmitted Block 17 owners', () => {
    expect(PROMPT_SAMPLE_PREVIEW_BLOCKER_CODES).toEqual([
      'prompt_template_instance_unavailable',
      'sample_preview_runtime_not_admitted',
    ]);
    expect(PROMPT_SAMPLE_PREVIEW_POLICY).toEqual({
      status: 'blocked',
      blockerCodes: PROMPT_SAMPLE_PREVIEW_BLOCKER_CODES,
      publicationRequiresPassedSample: true,
      realPreviewExecution: false,
      codexSdkCall: false,
      providerCall: false,
      runtimeOwner: 'block_17',
    });
  });
});
