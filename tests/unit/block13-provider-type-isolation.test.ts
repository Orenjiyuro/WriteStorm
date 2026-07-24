import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
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

  it('restricts the observation write authority across the entire Main import graph', () => {
    const mainRoot = path.join(rootDir, 'src/main');
    const consumers = sourceFiles(mainRoot).filter((filePath) => (
      importsObservationModule(filePath)
    ));
    expect(consumers).toEqual([
      path.join(mainRoot, 'ai/providers/codex/codex-auth-observation.ts'),
    ]);
    const runtimeSource = readFileSync(
      path.join(mainRoot, 'ai/ai-runtime-observation.ts'),
      'utf8',
    );
    expect(runtimeSource).not.toContain('mintAiRuntimeObservationReceipt');
    expect(importsNamedAuthority(
      consumers[0],
      'createAiRuntimeObservationMemoryAuthority',
    )).toBe(true);
  });
});

function importsObservationModule(filePath: string): boolean {
  const source = parseSource(filePath);
  let found = false;
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)
      && ts.isStringLiteral(node.moduleSpecifier)
      && /ai-runtime-observation$/.test(node.moduleSpecifier.text)) {
      found = true;
      return;
    }
    if (ts.isCallExpression(node)
      && node.arguments.length > 0
      && ts.isStringLiteral(node.arguments[0])
      && /ai-runtime-observation$/.test(node.arguments[0].text)
      && (node.expression.kind === ts.SyntaxKind.ImportKeyword
        || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
      found = true;
      return;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}

function importsNamedAuthority(filePath: string, importedName: string): boolean {
  const source = parseSource(filePath);
  return source.statements.some((statement) => (
    ts.isImportDeclaration(statement)
    && ts.isStringLiteral(statement.moduleSpecifier)
    && /ai-runtime-observation$/.test(statement.moduleSpecifier.text)
    && statement.importClause?.namedBindings
    && ts.isNamedImports(statement.importClause.namedBindings)
    && statement.importClause.namedBindings.elements.some(
      (element) => element.name.text === importedName,
    )
  ));
}

function parseSource(filePath: string): ts.SourceFile {
  return ts.createSourceFile(
    filePath,
    readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    filePath.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function sourceFiles(directory: string): string[] {
  return readdirSync(directory).flatMap((entry) => {
    const entryPath = path.join(directory, entry);
    return statSync(entryPath).isDirectory()
      ? sourceFiles(entryPath)
      : /\.(?:ts|tsx)$/.test(entryPath) ? [entryPath] : [];
  });
}
