import ts from 'typescript';

/**
 * @typedef {'import' | 'export' | 'import-type' | 'dynamic-import' | 'require'} ModuleLoadKind
 * @typedef {{ readonly kind: ModuleLoadKind, readonly specifier: string | null }} ModuleLoad
 */

/**
 * Finds forbidden module loads and treats a computed runtime target that cannot
 * be reduced to a string as forbidden. This guard is used only for restricted
 * renderer/preload/shared source boundaries, not as a general-purpose parser.
 *
 * @param {string} source
 * @param {readonly string[]} forbiddenPackages
 * @returns {ModuleLoad[]}
 */
export function findRestrictedModuleLoads(source, forbiddenPackages) {
  return collectModuleLoads(source).filter(({ specifier }) => (
    specifier === null
    || specifier.startsWith('@openai/')
    || forbiddenPackages.some((packageName) => (
      specifier === packageName || specifier.startsWith(`${packageName}/`)
    ))
  ));
}

/** @param {string} source @returns {ModuleLoad[]} */
function collectModuleLoads(source) {
  const sourceFile = ts.createSourceFile(
    'block6a-security-guard.tsx',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
  /** @type {ModuleLoad[]} */
  const loads = [];

  /** @param {import('typescript').Node} node */
  function visit(node) {
    if (ts.isImportDeclaration(node)) {
      loads.push({ kind: 'import', specifier: evaluateStaticString(node.moduleSpecifier) });
    } else if (ts.isExportDeclaration(node) && node.moduleSpecifier) {
      loads.push({ kind: 'export', specifier: evaluateStaticString(node.moduleSpecifier) });
    } else if (ts.isImportEqualsDeclaration(node)
      && ts.isExternalModuleReference(node.moduleReference)
      && node.moduleReference.expression) {
      loads.push({
        kind: 'require',
        specifier: evaluateStaticString(node.moduleReference.expression),
      });
    } else if (ts.isImportTypeNode(node)) {
      loads.push({ kind: 'import-type', specifier: evaluateImportTypeArgument(node.argument) });
      return;
    } else if (ts.isCallExpression(node) && node.expression.kind === ts.SyntaxKind.ImportKeyword) {
      loads.push({
        kind: 'dynamic-import',
        specifier: node.arguments.length === 1 ? evaluateStaticString(node.arguments[0]) : null,
      });
      return;
    } else if (ts.isCallExpression(node)
      && ts.isIdentifier(node.expression)
      && node.expression.text === 'require') {
      loads.push({
        kind: 'require',
        specifier: node.arguments.length === 1 ? evaluateStaticString(node.arguments[0]) : null,
      });
      return;
    }

    ts.forEachChild(node, visit);
  }

  visit(sourceFile);
  return loads;
}

/** @param {import('typescript').TypeNode} argument @returns {string | null} */
function evaluateImportTypeArgument(argument) {
  return ts.isLiteralTypeNode(argument) ? evaluateStaticString(argument.literal) : null;
}

/** @param {import('typescript').Node} node @returns {string | null} */
function evaluateStaticString(node) {
  if (ts.isStringLiteral(node) || ts.isNoSubstitutionTemplateLiteral(node)) return node.text;
  if (ts.isParenthesizedExpression(node)) return evaluateStaticString(node.expression);
  if (ts.isAsExpression(node) || ts.isTypeAssertionExpression(node) || ts.isSatisfiesExpression(node)) {
    return evaluateStaticString(node.expression);
  }
  if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.PlusToken) {
    const left = evaluateStaticString(node.left);
    const right = evaluateStaticString(node.right);
    return left === null || right === null ? null : left + right;
  }
  if (ts.isTemplateExpression(node)) {
    let result = node.head.text;
    for (const span of node.templateSpans) {
      const expression = evaluateStaticString(span.expression);
      if (expression === null) return null;
      result += expression + span.literal.text;
    }
    return result;
  }
  return null;
}
