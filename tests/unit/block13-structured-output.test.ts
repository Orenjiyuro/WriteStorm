import { describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  AI_STRUCTURED_OUTPUT_MAX_FINAL_BYTES,
  AiStructuredOutputSchemaError,
  createAiStructuredOutputContract,
  readAiStructuredOutputJsonSchema,
  validateAiStructuredOutput,
} from '../../src/main/ai/ai-structured-output';
import { createCodexStructuredOutputOptions } from
  '../../src/main/ai/providers/codex/codex-structured-output';
import { CODEX_PROVIDER_CAPABILITIES } from
  '../../src/main/ai/providers/codex/codex-provider-adapter';

const strictSchema = z.strictObject({
  status: z.literal('ready'),
});

describe('Block 13.7 provider-neutral structured output contract', () => {
  it('derives one deeply frozen strict JSON Schema and maps it privately to outputSchema', () => {
    const contract = createAiStructuredOutputContract({
      schema: strictSchema,
      maxFinalBytes: 1_024,
    });
    const jsonSchema = readAiStructuredOutputJsonSchema(contract);

    expect(jsonSchema).toEqual({
      type: 'object',
      properties: {
        status: {
          type: 'string',
          const: 'ready',
        },
      },
      required: ['status'],
      additionalProperties: false,
    });
    expect(Object.isFrozen(jsonSchema)).toBe(true);
    expect(Object.isFrozen(jsonSchema.properties)).toBe(true);
    expect(createCodexStructuredOutputOptions(contract)).toEqual({
      outputSchema: jsonSchema,
    });
  });

  it.each([
    ['not-json', 'invalid_json'],
    ['[]', 'invalid_shape'],
    ['{}', 'missing_field'],
    ['{"status":"ready","extra":true}', 'extra_field'],
    ['{"status":"wrong"}', 'invalid_value'],
  ] as const)('classifies %s as %s without returning raw output', (raw, classification) => {
    const contract = createAiStructuredOutputContract({
      schema: strictSchema,
      maxFinalBytes: 1_024,
    });
    const result = validateAiStructuredOutput(contract, raw);

    expect(result).toEqual({ accepted: false, classification });
    expect(result).not.toHaveProperty('raw');
    expect(result).not.toHaveProperty('message');
    expect(result).not.toHaveProperty('issues');
  });

  it('brands and deeply freezes only a locally accepted value', () => {
    const contract = createAiStructuredOutputContract({
      schema: z.strictObject({
        status: z.literal('ready'),
        detail: z.strictObject({ count: z.number().int().nonnegative() }),
      }),
      maxFinalBytes: 1_024,
    });
    const result = validateAiStructuredOutput(
      contract,
      '{"status":"ready","detail":{"count":1}}',
    );

    expect(result.accepted).toBe(true);
    if (!result.accepted) throw new Error('Expected structured output acceptance.');
    expect(result.classification).toBe('accepted');
    expect(result.value.data).toEqual({
      status: 'ready',
      detail: { count: 1 },
    });
    expect(Object.isFrozen(result.value)).toBe(true);
    expect(Object.isFrozen(result.value.data)).toBe(true);
    expect(Object.isFrozen((result.value.data as { detail: object }).detail)).toBe(true);
  });

  it('rejects oversized UTF-8 output before parsing and enforces a global cap', () => {
    const contract = createAiStructuredOutputContract({
      schema: strictSchema,
      maxFinalBytes: 20,
    });
    expect(validateAiStructuredOutput(contract, '{"status":"准备完成"}')).toEqual({
      accepted: false,
      classification: 'output_too_large',
    });
    expect(() => createAiStructuredOutputContract({
      schema: strictSchema,
      maxFinalBytes: AI_STRUCTURED_OUTPUT_MAX_FINAL_BYTES + 1,
    })).toThrow(AiStructuredOutputSchemaError);
  });

  it.each([
    z.array(z.string()),
    z.object({ status: z.string() }).passthrough(),
    z.strictObject({
      nested: z.object({ value: z.string() }).passthrough(),
    }),
  ])('rejects a non-object or non-strict application schema locally', (schema) => {
    expect(() => createAiStructuredOutputContract({
      schema,
      maxFinalBytes: 1_024,
    })).toThrow(AiStructuredOutputSchemaError);
  });

  it('keeps schema/validation offline and leaves runtime capability false', () => {
    expect(createCodexStructuredOutputOptions).toBeTypeOf('function');
    expect(CODEX_PROVIDER_CAPABILITIES.structuredOutput).toBe(false);
    expect(JSON.stringify(readAiStructuredOutputJsonSchema(
      createAiStructuredOutputContract({
        schema: strictSchema,
        maxFinalBytes: 1_024,
      }),
    ))).not.toMatch(/codex|jsonl|workingDirectory/i);
  });
});
