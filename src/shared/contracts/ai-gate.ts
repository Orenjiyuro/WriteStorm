import { z } from 'zod';
import rawManifest from '../../../config/block13-ai-gate-v1.json';

export const aiGateStateSchema = z.object({
  status: z.enum(['passed', 'failed', 'blocked']),
  feasibility: z.enum(['windows_passed', 'failed', 'unknown']),
  platform: z.enum(['macos_deferred', 'cross_platform_verified', 'unknown']),
  overallVerdict: z.enum(['conditional_go', 'go', 'no_go', 'unknown']),
}).strict();

const aiGateManifestSchema = aiGateStateSchema.extend({
  schemaVersion: z.literal(1),
  authority: z.literal('block13-ai-gate-v1'),
  verdictText: z.literal(
    'Conditional Go — Windows feasibility verified; macOS packaged runtime deferred-by-user.',
  ),
}).strict();

export const AI_GATE_MANIFEST = deepFreeze(aiGateManifestSchema.parse(rawManifest));
export const AI_GATE_STATE = deepFreeze(aiGateStateSchema.parse({
  status: AI_GATE_MANIFEST.status,
  feasibility: AI_GATE_MANIFEST.feasibility,
  platform: AI_GATE_MANIFEST.platform,
  overallVerdict: AI_GATE_MANIFEST.overallVerdict,
}));
export const AI_GATE_VERDICT = AI_GATE_MANIFEST.verdictText;

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
