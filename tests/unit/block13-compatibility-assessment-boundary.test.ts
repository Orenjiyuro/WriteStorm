import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const rootDir = path.resolve(__dirname, '../..');
const mainAiRoot = path.join(rootDir, 'src/main/ai');
const canonicalRelativePath = 'src/main/ai/ai-compatibility-assessment.ts';
const canonicalPath = path.join(rootDir, canonicalRelativePath);

describe('Block 13 canonical compatibility assessment boundary', () => {
  it('owns the only Main compatibility assessment declaration in an import-free leaf', () => {
    const canonical = parseSource(canonicalPath);
    expect(canonical.statements.some((statement) => (
      ts.isImportDeclaration(statement)
      || ts.isImportEqualsDeclaration(statement)
      || ts.isExportDeclaration(statement)
    ))).toBe(false);

    const declarations = productionTypeScriptFiles(mainAiRoot).filter((filePath) => (
      /\b(?:type|interface)\s+AiCompatibilityAssessment\b/.test(
        readFileSync(filePath, 'utf8'),
      )
    ));
    expect(declarations.map(relativeToRoot)).toEqual([canonicalRelativePath]);
  });

  it('keeps runtime evaluation, observation and connection service pointed at the leaf', () => {
    for (const relativePath of [
      'src/main/ai/ai-runtime-compatibility.ts',
      'src/main/ai/ai-runtime-observation.ts',
      'src/main/ai/ai-connection-check-service.ts',
    ]) {
      const source = parseSource(path.join(rootDir, relativePath));
      const imports = source.statements
        .filter(ts.isImportDeclaration)
        .map((statement) => statement.moduleSpecifier)
        .filter(ts.isStringLiteral)
        .map((specifier) => specifier.text);
      expect(imports, relativePath).toContain('./ai-compatibility-assessment');
    }
  });
});

function parseSource(filePath: string): ts.SourceFile {
  return ts.createSourceFile(
    filePath,
    readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  );
}

function productionTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const filePath = path.join(directory, entry);
    if (statSync(filePath).isDirectory()) return productionTypeScriptFiles(filePath);
    return filePath.endsWith('.ts') ? [filePath] : [];
  });
}

function relativeToRoot(filePath: string): string {
  return path.relative(rootDir, filePath).replaceAll('\\', '/');
}
