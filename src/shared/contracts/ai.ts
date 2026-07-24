import { z } from 'zod';
import { contractResponseSchema, emptyRequestSchema, isoDateTimeStringSchema } from './common';

export const aiGateStateSchema = z.object({
  status: z.enum(['passed', 'failed', 'blocked']),
  feasibility: z.enum(['windows_passed', 'failed', 'unknown']),
  platform: z.enum(['macos_deferred', 'cross_platform_verified', 'unknown']),
  overallVerdict: z.enum(['conditional_go', 'go', 'no_go', 'unknown']),
}).strict();

export const aiCompatibilityStateSchema = z.discriminatedUnion('state', [
  z.object({
    state: z.literal('fresh'),
    fingerprint: z.string().regex(/^[0-9a-f]{64}$/),
  }).strict(),
  z.object({
    state: z.enum(['stale', 'blocked', 'unknown']),
    fingerprint: z.null(),
  }).strict(),
]);

export const aiRuntimeAuthStateSchema = z.enum([
  'authenticated',
  'auth_required',
  'auth_expired',
  'permission_denied',
  'auth_runtime_unavailable',
  'unknown',
]);

export const aiRuntimeObservationDtoSchema = z.object({
  authState: aiRuntimeAuthStateSchema,
  observedAt: isoDateTimeStringSchema.nullable(),
}).strict();

export const aiConnectionCheckDataSchema = z.object({
  gate: aiGateStateSchema,
  compatibility: aiCompatibilityStateSchema,
  runtime: aiRuntimeObservationDtoSchema,
}).strict();

export const aiCheckConnectionRequestSchema = emptyRequestSchema;
export const aiCheckConnectionResponseSchema =
  contractResponseSchema(aiConnectionCheckDataSchema);

export type AiGateStateDto = z.infer<typeof aiGateStateSchema>;
export type AiCompatibilityStateDto = z.infer<typeof aiCompatibilityStateSchema>;
export type AiRuntimeObservationDto = z.infer<typeof aiRuntimeObservationDtoSchema>;
export type AiConnectionCheckData = z.infer<typeof aiConnectionCheckDataSchema>;

export const UNKNOWN_AI_CONNECTION_CHECK_DATA: AiConnectionCheckData = deepFreeze({
  gate: {
    status: 'passed',
    feasibility: 'windows_passed',
    platform: 'macos_deferred',
    overallVerdict: 'conditional_go',
  },
  compatibility: {
    state: 'unknown',
    fingerprint: null,
  },
  runtime: {
    authState: 'unknown',
    observedAt: null,
  },
});

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object') {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
