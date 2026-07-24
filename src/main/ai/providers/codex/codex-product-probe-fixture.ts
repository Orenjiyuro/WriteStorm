import { createHash } from 'node:crypto';
import fixtureJson from '../../../../../config/block13-product-packaged-probe-v1.json';

export type CodexProductProbeFixture = {
  readonly schemaVersion: 1;
  readonly fixtureId: 'block13-product-packaged-probe-v1';
  readonly classification: 'public_non_sensitive';
  readonly input: string;
  readonly inputSha256: string;
  readonly expectedJson: '{"status":"WS13"}';
  readonly expectedSha256: string;
  readonly outputSchema: {
    readonly type: 'object';
    readonly properties: {
      readonly status: {
        readonly type: 'string';
        readonly const: 'WS13';
      };
    };
    readonly required: readonly ['status'];
    readonly additionalProperties: false;
  };
  readonly schemaSha256: string;
};

const canonicalSchema =
  '{"type":"object","properties":{"status":{"type":"string","const":"WS13"}},"required":["status"],"additionalProperties":false}';

export function loadCodexProductProbeFixture(): CodexProductProbeFixture {
  const fixture = fixtureJson as unknown as CodexProductProbeFixture;
  assertFixture(fixture);
  return Object.freeze({
    ...fixture,
    outputSchema: Object.freeze({
      ...fixture.outputSchema,
      properties: Object.freeze({
        status: Object.freeze({ ...fixture.outputSchema.properties.status }),
      }),
      required: Object.freeze([...fixture.outputSchema.required]) as readonly ['status'],
    }),
  });
}

function assertFixture(fixture: CodexProductProbeFixture): void {
  if (
    fixture.schemaVersion !== 1
    || fixture.fixtureId !== 'block13-product-packaged-probe-v1'
    || fixture.classification !== 'public_non_sensitive'
    || fixture.expectedJson !== '{"status":"WS13"}'
    || JSON.stringify(fixture.outputSchema) !== canonicalSchema
    || sha256(fixture.input) !== fixture.inputSha256
    || sha256(fixture.expectedJson) !== fixture.expectedSha256
    || sha256(canonicalSchema) !== fixture.schemaSha256
  ) {
    throw new Error('Codex product packaged probe fixture failed its integrity check.');
  }
}

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}
