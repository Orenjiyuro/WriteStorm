import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  AI_EXECUTION_PORT_CONTRACT_VERSION,
  type AiExecutionPort,
} from '../../src/main/ai/ai-execution-port';

const rootDir = path.resolve(__dirname, '../..');
const portPath = path.join(rootDir, 'src/main/ai/ai-execution-port.ts');

describe('Block 13.3 provider-neutral AI execution port', () => {
  it('provides a thin injected execution seam without fixing later lifecycle details', async () => {
    type Request = {
      readonly executionId: string;
      readonly instruction: string;
    };
    type AcceptedExecution = {
      readonly status: 'accepted';
      readonly executionId: string;
    };

    const port: AiExecutionPort<Request, Promise<AcceptedExecution>> = {
      contractVersion: AI_EXECUTION_PORT_CONTRACT_VERSION,
      capabilities: {
        structuredOutput: true,
        streamedEvents: true,
        cancellation: true,
      },
      execute: async (request) => ({
        status: 'accepted',
        executionId: request.executionId,
      }),
    };

    await expect(port.execute({
      executionId: 'attempt-1',
      instruction: 'fixed synthetic input',
    })).resolves.toEqual({
      status: 'accepted',
      executionId: 'attempt-1',
    });
  });

  it('keeps the production contract independent from provider and feasibility details', () => {
    const source = readFileSync(portPath, 'utf8');

    expect(source).not.toMatch(/codex/i);
    expect(source).not.toMatch(/openai/i);
    expect(source).not.toMatch(/jsonl/i);
    expect(source).not.toMatch(/child_process/i);
    expect(source).not.toMatch(/codex-feasibility/i);
    expect(source).not.toMatch(/from\s+['"][^'"]*(jobs|db|renderer|shared)[^'"]*['"]/i);
  });
});
