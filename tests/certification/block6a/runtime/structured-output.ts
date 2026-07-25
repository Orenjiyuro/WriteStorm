export type MinimalStructuredOutputClassification =
  | 'accepted'
  | 'invalid_json'
  | 'invalid_shape'
  | 'missing_field'
  | 'extra_field'
  | 'invalid_value';

export type MinimalStructuredOutputValidation = {
  readonly classification: MinimalStructuredOutputClassification;
  readonly accepted: boolean;
  readonly expectedValueMatched: boolean;
};

export function validateMinimalStructuredOutput(
  text: string,
  expectedValue: string,
): MinimalStructuredOutputValidation {
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return rejected('invalid_json');
  }

  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return rejected('invalid_shape');
  }
  const record = value as Record<string, unknown>;
  if (!Object.hasOwn(record, 'status')) return rejected('missing_field');
  if (Object.keys(record).some((key) => key !== 'status')) return rejected('extra_field');
  if (typeof record.status !== 'string' || record.status !== expectedValue) {
    return rejected('invalid_value');
  }
  return { classification: 'accepted', accepted: true, expectedValueMatched: true };
}

function rejected(
  classification: Exclude<MinimalStructuredOutputClassification, 'accepted'>,
): MinimalStructuredOutputValidation {
  return { classification, accepted: false, expectedValueMatched: false };
}
