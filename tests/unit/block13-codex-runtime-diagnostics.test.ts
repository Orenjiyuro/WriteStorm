import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';
import { mapAiFailureToDomainError } from '../../src/main/ai/ai-runtime-diagnostics';
import { CodexStreamEventProjector } from '../../src/main/ai/providers/codex/codex-event-projection';
import { CodexRuntimeDiagnosticAuthority } from '../../src/main/ai/providers/codex/codex-runtime-diagnostics';

const rootDir = path.resolve(__dirname, '../..');
const diagnosticsPath = path.join(
  rootDir,
  'src/main/ai/providers/codex/codex-runtime-diagnostics.ts',
);

describe('Block 13.10 Codex-private runtime diagnostics', () => {
  it('exposes producers only for local schema rejection and unknown runtime failure', () => {
    const authority = new CodexRuntimeDiagnosticAuthority();
    expect(Object.getOwnPropertyNames(CodexRuntimeDiagnosticAuthority.prototype).sort()).toEqual([
      'constructor',
      'observeLocalSchemaFailure',
      'observeUnknownRuntimeFailure',
      'observeUsage',
    ]);

    expect(mapAiFailureToDomainError(
      authority.observeLocalSchemaFailure('2026-07-24T10:00:00.000Z'),
    ).code).toBe('AI_SCHEMA_INVALID');
    expect(mapAiFailureToDomainError(
      authority.observeUnknownRuntimeFailure('2026-07-24T10:00:00.000Z'),
    ).code).toBe('AI_RUNTIME_UNAVAILABLE');
  });

  it('does not parse raw errors or English messages into auth, rate or network facts', () => {
    const source = readFileSync(diagnosticsPath, 'utf8');

    expect(source).not.toMatch(/\.message\b|String\s*\(\s*error|instanceof\s+Error/i);
    expect(source).not.toMatch(/login required|rate limit|network error|ECONN|ENOTFOUND/i);
    expect(source).not.toMatch(/observe(?:Auth|Rate|Network)/);
  });

  it('maps exact Codex usage fields or returns provider-neutral unknown', () => {
    const authority = new CodexRuntimeDiagnosticAuthority();

    expect(authority.observeUsage({
      input_tokens: 10,
      cached_input_tokens: 4,
      output_tokens: 3,
    })).toEqual({
      availability: 'reported',
      inputTokens: 10,
      cachedInputTokens: 4,
      outputTokens: 3,
    });
    for (const input of [
      undefined,
      { input_tokens: 10, output_tokens: 3 },
      { input_tokens: 10, cached_input_tokens: '4', output_tokens: 3 },
      { input_tokens: 10, cached_input_tokens: 4, output_tokens: 3, total_tokens: 17 },
    ]) {
      expect(authority.observeUsage(input)).toEqual({ availability: 'unknown' });
    }
  });

  it('projects reported or unknown usage without leaking provider fields', () => {
    expect(projectCompleted({
      input_tokens: 10,
      cached_input_tokens: 4,
      output_tokens: 3,
    })).toMatchObject({
      kind: 'final',
      usage: {
        availability: 'reported',
        inputTokens: 10,
        cachedInputTokens: 4,
        outputTokens: 3,
      },
    });
    expect(projectCompleted({ input_tokens: 10, output_tokens: 3 })).toMatchObject({
      kind: 'final',
      usage: { availability: 'unknown' },
    });
    expect(projectCompleted(undefined)).toMatchObject({
      kind: 'final',
      usage: { availability: 'unknown' },
    });
  });

  it('restricts the failure-mint authority import across all production Main files', () => {
    const consumers = productionTypeScriptFiles(path.join(rootDir, 'src/main'))
      .filter((filePath) => importsAuthorityCapability(
        filePath,
        'createAiFailureObservationAuthority',
      ));

    expect(consumers.map((filePath) => path.relative(rootDir, filePath).replaceAll('\\', '/')))
      .toEqual(['src/main/ai/providers/codex/codex-runtime-diagnostics.ts']);
  });
});

function projectCompleted(usage: unknown) {
  const projector = new CodexStreamEventProjector({
    token: { attempt: 1, generation: 1 },
    maxEventBytes: 512,
    maxTotalBytes: 2_048,
    maxEventCount: 8,
  });
  projector.project(JSON.stringify({
    type: 'item.completed',
    item: { id: 'private-provider-id', type: 'agent_message', text: '{"summary":"done"}' },
  }));
  return projector.project(JSON.stringify({
    type: 'turn.completed',
    ...(usage === undefined ? {} : { usage }),
  }));
}

function productionTypeScriptFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true })
    .flatMap((entry) => {
      const resolved = path.join(directory, entry.name);
      if (entry.isDirectory()) return productionTypeScriptFiles(resolved);
      return entry.isFile() && /\.tsx?$/.test(entry.name) ? [resolved] : [];
    })
    .sort();
}

function importsAuthorityCapability(filePath: string, importedName: string): boolean {
  const source = ts.createSourceFile(
    filePath,
    readFileSync(filePath, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
  );
  let found = false;
  const visit = (node: ts.Node): void => {
    if (ts.isImportDeclaration(node)
      && ts.isStringLiteral(node.moduleSpecifier)
      && node.moduleSpecifier.text.endsWith('ai-runtime-diagnostics')) {
      const clause = node.importClause;
      if (clause?.name || (clause?.namedBindings && ts.isNamespaceImport(clause.namedBindings))) {
        found = true;
      }
      if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
        found ||= clause.namedBindings.elements.some(
          (element) => (element.propertyName?.text ?? element.name.text) === importedName,
        );
      }
    }
    if (ts.isCallExpression(node) && node.arguments.length === 1) {
      const argument = node.arguments[0];
      const isTarget = ts.isStringLiteral(argument)
        && argument.text.endsWith('ai-runtime-diagnostics');
      if (isTarget
        && (node.expression.kind === ts.SyntaxKind.ImportKeyword
          || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
        found = true;
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return found;
}
