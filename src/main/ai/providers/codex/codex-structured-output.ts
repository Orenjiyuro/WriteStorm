import {
  type AiJsonObject,
  type AiStructuredOutputContract,
  readAiStructuredOutputJsonSchema,
} from '../../ai-structured-output';

export type CodexStructuredOutputOptions = {
  readonly outputSchema: AiJsonObject;
};

export function createCodexStructuredOutputOptions(
  contract: AiStructuredOutputContract,
): CodexStructuredOutputOptions {
  return Object.freeze({
    outputSchema: readAiStructuredOutputJsonSchema(contract),
  });
}
