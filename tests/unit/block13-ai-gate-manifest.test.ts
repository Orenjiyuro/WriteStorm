import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AI_GATE_MANIFEST,
  AI_GATE_STATE,
  AI_GATE_VERDICT,
} from '../../src/shared/contracts/ai-gate';
import { UNKNOWN_AI_CONNECTION_CHECK_DATA } from '../../src/shared/contracts/ai';
import { AI_CONNECTION_GATE } from '../../src/main/ai/ai-connection-check-service';

const rootDir = path.resolve(__dirname, '../..');

describe('Block 13 Gate manifest authority', () => {
  it('strictly projects one versioned authority into Main and renderer defaults', () => {
    expect(AI_GATE_MANIFEST).toEqual({
      schemaVersion: 1,
      authority: 'block13-ai-gate-v1',
      status: 'passed',
      feasibility: 'windows_passed',
      platform: 'macos_deferred',
      overallVerdict: 'conditional_go',
      verdictText:
        'Conditional Go — Windows feasibility verified; macOS packaged runtime deferred-by-user.',
    });
    expect(AI_GATE_STATE).toEqual({
      status: AI_GATE_MANIFEST.status,
      feasibility: AI_GATE_MANIFEST.feasibility,
      platform: AI_GATE_MANIFEST.platform,
      overallVerdict: AI_GATE_MANIFEST.overallVerdict,
    });
    expect(AI_GATE_VERDICT).toBe(AI_GATE_MANIFEST.verdictText);
    expect(AI_CONNECTION_GATE).toBe(AI_GATE_STATE);
    expect(UNKNOWN_AI_CONNECTION_CHECK_DATA.gate).toBe(AI_GATE_STATE);
  });

  it('keeps Gate values out of duplicate production definitions', () => {
    const aiContract = readFileSync(
      path.join(rootDir, 'src/shared/contracts/ai.ts'),
      'utf8',
    );
    const connectionService = readFileSync(
      path.join(rootDir, 'src/main/ai/ai-connection-check-service.ts'),
      'utf8',
    );
    const releaseMatrix = JSON.parse(readFileSync(
      path.join(rootDir, 'config/block13-release-limitations-v1.json'),
      'utf8',
    )) as Record<string, unknown>;

    expect(aiContract).not.toMatch(/windows_passed|macos_deferred|conditional_go/);
    expect(connectionService).not.toMatch(/windows_passed|macos_deferred|conditional_go/);
    expect(releaseMatrix).not.toHaveProperty('verdict');
    expect(releaseMatrix).toMatchObject({
      gateAuthority: 'config/block13-ai-gate-v1.json',
    });
  });
});
