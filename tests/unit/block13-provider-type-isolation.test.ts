import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const rootDir = path.resolve(__dirname, '../..');
const protectedRoots = [
  'src/main/jobs',
  'src/main/db',
  'src/main/modules',
  'src/renderer',
  'src/shared',
] as const;

describe('Block 13 sealed provider type isolation', () => {
  it('keeps SDK, CLI and provider-private utility types out of domain and UI layers', () => {
    for (const relativeRoot of protectedRoots) {
      const absoluteRoot = path.join(rootDir, relativeRoot);
      if (!existsSync(absoluteRoot)) continue;
      for (const filePath of sourceFiles(absoluteRoot)) {
        const source = readFileSync(filePath, 'utf8');
        expect(source, filePath).not.toMatch(
          /@openai\/codex(?:-sdk)?|CodexUtility(?:Transport|Launcher)|CodexStructuredOutput|codex-feasibility/i,
        );
      }
    }
  });

  it('keeps renderer and shared DTOs independent from branded Main-only protocol types', () => {
    for (const relativeRoot of ['src/renderer', 'src/shared']) {
      for (const filePath of sourceFiles(path.join(rootDir, relativeRoot))) {
        const source = readFileSync(filePath, 'utf8');
        expect(source, filePath).not.toMatch(
          /AiExecution(?:Request|Event|Handle)|AiStructuredOutput|from\s+['"][^'"]*main\/ai/i,
        );
      }
    }
  });

  it('restricts runtime observation receipt minting to the reviewed Codex mapper', () => {
    const aiRoot = path.join(rootDir, 'src/main/ai');
    const allowed = new Set([
      path.join(aiRoot, 'ai-runtime-observation.ts'),
      path.join(aiRoot, 'providers/codex/codex-auth-observation.ts'),
    ]);
    const consumers = sourceFiles(aiRoot).filter((filePath) => (
      readFileSync(filePath, 'utf8').includes('mintAiRuntimeObservationReceipt')
    ));
    expect(new Set(consumers)).toEqual(allowed);
  });
});

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const entryPath = path.join(directory, entry);
    return statSync(entryPath).isDirectory()
      ? sourceFiles(entryPath)
      : /\.(?:ts|tsx)$/.test(entryPath) ? [entryPath] : [];
  });
}
