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
          /@openai\/codex(?:-sdk)?|CodexUtility(?:Transport|Launcher)|codex-feasibility/i,
        );
      }
    }
  });

  it('keeps renderer and shared DTOs independent from branded Main-only protocol types', () => {
    for (const relativeRoot of ['src/renderer', 'src/shared']) {
      for (const filePath of sourceFiles(path.join(rootDir, relativeRoot))) {
        const source = readFileSync(filePath, 'utf8');
        expect(source, filePath).not.toMatch(
          /AiExecution(?:Request|Event|Handle)|from\s+['"][^'"]*main\/ai/i,
        );
      }
    }
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
