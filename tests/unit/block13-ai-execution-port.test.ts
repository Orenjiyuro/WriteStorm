import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  type AiExecutionEvent,
  type AiExecutionHandle,
  type AiExecutionPort,
  type AiExecutionRequest,
} from '../../src/main/ai/ai-execution-port';

const rootDir = path.resolve(__dirname, '../..');
const portPath = path.join(rootDir, 'src/main/ai/ai-execution-port.ts');

describe('Block 13.3 provider-neutral AI execution port', () => {
  it('provides one sealed application protocol without fixing later business fields', () => {
    const request = Object.freeze({}) as AiExecutionRequest;
    const handle = Object.freeze({}) as AiExecutionHandle;
    const port: AiExecutionPort = {
      capabilities: {
        structuredOutput: false,
        streamedEvents: false,
        cancellation: false,
      },
      execute: (received) => {
        expect(received).toBe(request);
        return handle;
      },
    };

    expect(port.execute(request)).toBe(handle);
    expectTypeOnly<AiExecutionEvent>();
  });

  it('keeps the production contract independent from provider and feasibility details', () => {
    const source = readFileSync(portPath, 'utf8');

    expect(source).not.toMatch(/codex/i);
    expect(source).not.toMatch(/openai/i);
    expect(source).not.toMatch(/jsonl/i);
    expect(source).not.toMatch(/child_process/i);
    expect(source).not.toMatch(/codex-feasibility/i);
    expect(source).not.toMatch(/from\s+['"][^'"]*(jobs|db|renderer|shared)[^'"]*['"]/i);
    expect(source).toContain('declare const requestBrand: unique symbol');
    expect(source).toContain('declare const eventBrand: unique symbol');
    expect(source).toContain('declare const handleBrand: unique symbol');
    expect(source).not.toMatch(/AiExecutionPort\s*</);
  });
});

function expectTypeOnly<_Type>(): void {
  // Compile-time witness only.
}
