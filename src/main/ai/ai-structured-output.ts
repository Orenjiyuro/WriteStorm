import { Buffer } from 'node:buffer';
import { z } from 'zod';

declare const contractBrand: unique symbol;
declare const valueBrand: unique symbol;

export const AI_STRUCTURED_OUTPUT_MAX_FINAL_BYTES = 1_048_576 as const;

export type AiJsonPrimitive = string | number | boolean | null;
export type AiJsonValue =
  | AiJsonPrimitive
  | readonly AiJsonValue[]
  | { readonly [key: string]: AiJsonValue };
export type AiJsonObject = { readonly [key: string]: AiJsonValue };

export interface AiStructuredOutputContract {
  readonly [contractBrand]: never;
}

export interface AiStructuredOutputValue {
  readonly [valueBrand]: never;
  readonly data: AiJsonValue;
}

export type AiStructuredOutputRejection =
  | 'output_too_large'
  | 'invalid_json'
  | 'invalid_shape'
  | 'missing_field'
  | 'extra_field'
  | 'invalid_value';

export type AiStructuredOutputValidation =
  | {
    readonly accepted: true;
    readonly classification: 'accepted';
    readonly value: AiStructuredOutputValue;
  }
  | {
    readonly accepted: false;
    readonly classification: AiStructuredOutputRejection;
  };

type ContractDefinition = {
  readonly schema: z.ZodObject;
  readonly jsonSchema: AiJsonObject;
  readonly maxFinalBytes: number;
};

const contractDefinitions = new WeakMap<AiStructuredOutputContract, ContractDefinition>();

export class AiStructuredOutputSchemaError extends Error {
  readonly code = 'AI_STRUCTURED_OUTPUT_SCHEMA_INVALID' as const;

  constructor() {
    super('AI structured output schema is invalid.');
    this.name = 'AiStructuredOutputSchemaError';
  }
}

export function createAiStructuredOutputContract(input: {
  readonly schema: unknown;
  readonly maxFinalBytes: number;
}): AiStructuredOutputContract {
  if (!(input.schema instanceof z.ZodObject)
    || !Number.isSafeInteger(input.maxFinalBytes)
    || input.maxFinalBytes < 1
    || input.maxFinalBytes > AI_STRUCTURED_OUTPUT_MAX_FINAL_BYTES) {
    throw new AiStructuredOutputSchemaError();
  }

  let generated: unknown;
  try {
    generated = z.toJSONSchema(input.schema);
  } catch {
    throw new AiStructuredOutputSchemaError();
  }
  if (!isPlainRecord(generated)) throw new AiStructuredOutputSchemaError();
  const { $schema: _dialect, ...schemaWithoutDialect } = generated;
  if (!isJsonObject(schemaWithoutDialect)
    || !isStrictObjectJsonSchema(schemaWithoutDialect, true)) {
    throw new AiStructuredOutputSchemaError();
  }

  const jsonSchema = deepFreeze(cloneJson(schemaWithoutDialect)) as AiJsonObject;
  const contract = Object.freeze({}) as AiStructuredOutputContract;
  contractDefinitions.set(contract, {
    schema: input.schema,
    jsonSchema,
    maxFinalBytes: input.maxFinalBytes,
  });
  return contract;
}

export function readAiStructuredOutputJsonSchema(
  contract: AiStructuredOutputContract,
): AiJsonObject {
  return definitionFor(contract).jsonSchema;
}

export function validateAiStructuredOutput(
  contract: AiStructuredOutputContract,
  raw: string,
): AiStructuredOutputValidation {
  const definition = definitionFor(contract);
  if (typeof raw !== 'string'
    || Buffer.byteLength(raw, 'utf8') > definition.maxFinalBytes) {
    return rejected('output_too_large');
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return rejected('invalid_json');
  }
  if (!isPlainRecord(parsed)) return rejected('invalid_shape');

  const validation = definition.schema.safeParse(parsed);
  if (!validation.success) {
    if (validation.error.issues.some((issue) => issue.code === 'unrecognized_keys')) {
      return rejected('extra_field');
    }
    if (validation.error.issues.some((issue) => isMissingPath(parsed, issue.path))) {
      return rejected('missing_field');
    }
    return rejected('invalid_value');
  }
  if (!isJsonValue(validation.data)) return rejected('invalid_value');

  const value = Object.freeze({
    data: deepFreeze(validation.data),
  }) as AiStructuredOutputValue;
  return Object.freeze({
    accepted: true,
    classification: 'accepted',
    value,
  });
}

function definitionFor(contract: AiStructuredOutputContract): ContractDefinition {
  const definition = contractDefinitions.get(contract);
  if (!definition) throw new AiStructuredOutputSchemaError();
  return definition;
}

function rejected(classification: AiStructuredOutputRejection): AiStructuredOutputValidation {
  return Object.freeze({ accepted: false, classification });
}

function isStrictObjectJsonSchema(value: AiJsonObject, isRoot: boolean): boolean {
  if ('$ref' in value) return false;
  if (isRoot && value.type !== 'object') return false;
  if (value.type === 'object') {
    if (value.additionalProperties !== false || !isPlainRecord(value.properties)) {
      return false;
    }
    for (const child of Object.values(value.properties)) {
      if (!isJsonObject(child) || !isStrictObjectJsonSchema(child, false)) return false;
    }
  }
  if (value.type === 'array') {
    if (!isJsonObject(value.items) || !isStrictObjectJsonSchema(value.items, false)) {
      return false;
    }
  }
  for (const composition of ['anyOf', 'oneOf', 'allOf'] as const) {
    const children = value[composition];
    if (children === undefined) continue;
    if (!Array.isArray(children)
      || children.some((child) => (
        !isJsonObject(child) || !isStrictObjectJsonSchema(child, false)
      ))) {
      return false;
    }
  }
  return true;
}

function isMissingPath(root: Readonly<Record<string, unknown>>, path: PropertyKey[]): boolean {
  if (path.length === 0) return false;
  let current: unknown = root;
  for (const segment of path) {
    if (!isPlainRecord(current) && !Array.isArray(current)) return false;
    if (!Object.hasOwn(current, segment)) return true;
    current = current[segment as keyof typeof current];
  }
  return false;
}

function isJsonObject(value: unknown): value is AiJsonObject {
  return isPlainRecord(value) && Object.values(value).every(isJsonValue);
}

function isJsonValue(value: unknown): value is AiJsonValue {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return true;
  if (typeof value === 'number') return Number.isFinite(value);
  if (Array.isArray(value)) return value.every(isJsonValue);
  return isJsonObject(value);
}

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value)
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.getPrototypeOf(value) === Object.prototype;
}

function cloneJson<T extends AiJsonValue>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    for (const child of Object.values(value)) deepFreeze(child);
    Object.freeze(value);
  }
  return value;
}
