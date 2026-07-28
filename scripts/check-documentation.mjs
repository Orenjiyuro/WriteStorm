import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';
import process from 'node:process';

const root = process.cwd();
const failures = [];
const read = (relativePath) => readFileSync(path.join(root, relativePath), 'utf8');

checkCurrentFacts();
checkRelativeMarkdownLinks();

if (failures.length > 0) {
  for (const failure of failures) console.error(`DOC_CHECK_FAILED: ${failure}`);
  process.exitCode = 1;
} else {
  console.log('Documentation gate passed: current facts, authority classes, display policy and links.');
}

function checkCurrentFacts() {
  requireFile('README.md');
  requireFile('docs/engineering/CONTEXT.md');

  const context = read('docs/engineering/CONTEXT.md');
  const activeContext = markdownSection(context, '## Active V1 Current-State Authority');
  const product = read('docs/product/write-storm-product-design.md');
  const flows = read('docs/product/FLOWS.md');
  const technical = read('docs/engineering/TECHNICAL_DESIGN.md');
  const task000 = read('docs/tasks/TASK-000-pre-v1-hard-gates.md');
  const task001 = read('docs/tasks/TASK-001-breakdown-workbench-foundation.md');
  const task002 = read('docs/tasks/TASK-002-v1-work-breakdown-master-plan.md');
  const block14Tutorial = read('docs/engineering/V1-BLOCK-14-LITERARY-ANALYSIS-TUTORIAL.md');
  const block14QualityGate = read(
    'docs/engineering/V1-BLOCK-14-SYSTEM-PRODUCTION-QUALITY-GATE.md',
  );
  const packageJson = JSON.parse(read('package.json'));
  const playwrightConfig = read('playwright.config.ts');
  const displayPolicy = read('tests/e2e/display-policy.ts');
  const migrationRegistry = read('src/main/db/migrations/index.ts');
  const sourceTextMetadata = read('src/main/source-text/source-text-metadata.ts');
  const jobRecoveryPanel = read('src/renderer/features/job-recovery/JobRecoveryPanel.tsx');
  const exportStatusPanel = read('src/renderer/features/export-status/ExportStatusPanel.tsx');

  requireText(context, 'Active V1 Current-State Authority', 'CONTEXT current-state entry');
  requireText(
    activeContext,
    'production migration registry contains migrations 001–007',
    'CONTEXT active migration registry',
  );
  requireText(
    context,
    'Document class: **NON-CURRENT-STATE AUTHORITY / HISTORICAL EVIDENCE AND FUTURE DIRECTION**',
    'CONTEXT supplemental classification',
  );
  rejectPattern(activeContext, /^Current Block \d/m, 'CONTEXT checkpoint heading presented as current');
  rejectText(
    activeContext,
    'Task 20 fresh recertification',
    'CONTEXT dated evidence inside active current-state section',
  );
  rejectText(
    activeContext,
    'D122 and',
    'CONTEXT future Block 14 direction inside active current-state section',
  );
  requireText(
    context,
    '## 6. Historical Foundation Delivery Path',
    'CONTEXT historical foundation classification',
  );
  requireText(
    context,
    '## 8. Authority Documents To Read First',
    'CONTEXT authority reading order',
  );
  requireText(
    context,
    'The natural no-Library route must show only product entry/navigation surfaces',
    'CONTEXT natural-entry diagnostics boundary',
  );
  rejectText(
    context,
    '## 6. First Implementation Path',
    'CONTEXT obsolete active implementation-path heading',
  );
  rejectText(
    markdownSection(context, '## 8. Authority Documents To Read First'),
    'TASK-001-breakdown-workbench-foundation.md',
    'CONTEXT authority list includes superseded TASK-001',
  );

  for (const statusPath of [
    'docs/engineering/V1-BLOCK-1-STATUS.md',
    'docs/engineering/V1-BLOCK-6-STATUS.md',
    'docs/engineering/V1-BLOCK-7-STATUS.md',
    'docs/engineering/V1-BLOCK-8A-STATUS.md',
  ]) {
    requireText(read(statusPath), 'HISTORICAL', `${statusPath} historical classification`);
  }

  for (const [name, document] of [
    ['FLOWS', flows],
    ['product design', product],
    ['technical design', technical],
  ]) {
    requireText(
      document,
      'source/{sourceTextId}/{originalFileName}',
      `${name} canonical source-copy path`,
    );
    rejectText(document, 'breakdown-books/', `${name} obsolete source directory`);
    rejectText(document, 'original.txt', `${name} obsolete fixed source filename`);
  }

  requireText(
    technical,
    '## 12. Current Verification Strategy',
    'technical design current verification section',
  );
  requireText(
    technical,
    '## 13. Historical Foundation Delivery Sequence',
    'technical design historical foundation classification',
  );
  rejectText(
    technical,
    'Initial commands to define in the scaffold',
    'technical design obsolete scaffold instruction',
  );
  rejectText(
    technical,
    'The first implementation plan must add',
    'technical design obsolete first-plan instruction',
  );

  requireText(product, 'sqlite_is_transactional_source_of_truth: true', 'SQLite authority');
  requireText(product, 'json_is_derived_only: true', 'JSON derived-only boundary');
  rejectText(product, 'json_is_source_of_truth: true', 'obsolete JSON authority');
  requireText(
    product,
    '## Historical V1 foundation recertification boundary',
    'product-design historical foundation classification',
  );
  rejectText(
    product,
    '## V1 foundation recertification boundary',
    'product-design unclassified foundation checkpoint',
  );
  requireText(product, 'D122–D132', 'D132 product authority registration');
  requireText(
    product,
    'V1-BLOCK-14-SYSTEM-PRODUCTION-QUALITY-GATE.md',
    'REV3.2 quality-gate authority',
  );
  const task002AuthorityEntry = task002.slice(0, task002.indexOf('## 0A.'));
  requireText(task002AuthorityEntry, 'D122–D132', 'TASK-002 D132 authority registration');
  requireText(
    task002AuthorityEntry,
    'V1-BLOCK-14-SYSTEM-PRODUCTION-QUALITY-GATE.md',
    'TASK-002 REV3.2 authority link',
  );
  requireText(block14Tutorial, '截至 D132，当前状态是', 'Block 14 tutorial D132 status');
  requireText(
    block14Tutorial,
    'BLOCK14_NOT_FROZEN / QUALITY_UNPROVEN',
    'Block 14 tutorial quality boundary',
  );
  requireText(
    block14QualityGate,
    'USER_CONFIRMED_DIRECTION / REV3.2_CONFIRMED / BLOCK14_NOT_FROZEN / QUALITY_UNPROVEN',
    'Block 14 quality-gate status',
  );
  requireText(flows, 'Resume remains disabled', 'disabled Resume flow');
  requireText(flows, 'Export execution unavailable', 'disabled export execution');
  requirePattern(
    jobRecoveryPanel,
    /<button type="button" disabled aria-describedby=\{resumeReasonId\}>\{text\.resume\}<\/button>/,
    'renderer Resume control is natively disabled',
  );
  requirePattern(
    exportStatusPanel,
    /<button type="button" disabled aria-describedby=\{reasonId\}>/,
    'renderer export controls are natively disabled',
  );

  requireText(task000, 'HISTORICAL PRE-V1 GATE PLAN / SUPERSEDED', 'TASK-000 retirement');
  requireText(task001, 'HISTORICAL FIRST-INCREMENT PLAN / SUPERSEDED', 'TASK-001 retirement');
  rejectText(task000, '**Current status:** Open', 'TASK-000 left open');
  rejectText(task001, 'repository is currently docs-only', 'TASK-001 docs-only claim');
  requireText(
    task002,
    '本地开发阶段的 Playwright/真实 Electron 测试统一使用',
    'local secondary-display development gate',
  );
  requirePattern(
    task002,
    /普通用户启动\s+不加载 Playwright 配置、不要求副屏/,
    'product startup remains display-neutral',
  );

  const ordinaryE2E = packageJson.scripts?.['test:e2e'];
  const secondaryE2E = packageJson.scripts?.['test:e2e:secondary-display'];
  if (ordinaryE2E !== 'npm run build && playwright test') {
    failures.push('local test:e2e must run the complete Playwright suite');
  }
  if (secondaryE2E !== 'npm run build && playwright test --grep @secondary-display') {
    failures.push('dedicated secondary-display command is missing or changed');
  }
  requireText(
    playwrightConfig,
    'configureLocalE2EDisplayPolicy(process.env)',
    'local Playwright secondary-display policy',
  );
  requireFile('tests/e2e/display-policy.ts');
  requireText(
    displayPolicy,
    "environment[TEST_DISPLAY_TARGET_ENV] = 'secondary'",
    'local Playwright secondary target assignment',
  );
  requireText(displayPolicy, 'isCiEnvironment(environment.CI)', 'CI display-policy exemption');
  const productionDisplayPolicyImports = walkFiles(path.join(root, 'src'))
    .filter((file) => /\.(?:ts|tsx)$/.test(file))
    .filter((file) => readFileSync(file, 'utf8').includes('configureLocalE2EDisplayPolicy'))
    .map((file) => path.relative(root, file).replaceAll('\\', '/'));
  if (productionDisplayPolicyImports.length > 0) {
    failures.push(
      `product source imports Playwright display policy: ${productionDisplayPolicyImports.join(', ')}`,
    );
  }

  const taggedSpecs = walkFiles(path.join(root, 'tests/e2e'))
    .filter((file) => file.endsWith('.spec.ts'))
    .filter((file) => readFileSync(file, 'utf8').includes('@secondary-display'))
    .map((file) => path.relative(root, file).replaceAll('\\', '/'));
  if (
    taggedSpecs.length !== 2
    || taggedSpecs[0] !== 'tests/e2e/secondary-display.spec.ts'
    || taggedSpecs[1] !== 'tests/e2e/type-library-natural-path.spec.ts'
  ) {
    failures.push(`unexpected @secondary-display specs: ${taggedSpecs.join(', ') || '(none)'}`);
  }

  const expectedMigrations = [
    'V1_RUNTIME_BASELINE_MIGRATION',
    'STRUCTURE_WORKSPACE_MIGRATION',
    'ANALYSIS_MODULE_DEFINITIONS_MIGRATION',
    'ANALYSIS_MODULE_INSTANCES_MIGRATION',
    'ANALYSIS_MODULE_ASSET_PLACEHOLDERS_MIGRATION',
    'TYPE_LIBRARY_REGISTRY_MIGRATION',
    'TYPE_LIBRARY_BOOK_BINDINGS_MIGRATION',
  ];
  for (const migration of expectedMigrations) {
    requireText(migrationRegistry, migration, `migration registry member ${migration}`);
  }
  const registryMatch = migrationRegistry.match(
    /export const APP_MIGRATIONS = \[([\s\S]*?)] as const satisfies readonly Migration\[\];/,
  );
  if (!registryMatch) {
    failures.push('unable to parse APP_MIGRATIONS registry');
  } else {
    const actualMigrations = registryMatch[1]
      .split(',')
      .map((entry) => entry.trim())
      .filter(Boolean);
    if (JSON.stringify(actualMigrations) !== JSON.stringify(expectedMigrations)) {
      failures.push(
        `APP_MIGRATIONS order mismatch: ${actualMigrations.join(', ') || '(empty)'}`,
      );
    }
  }
  requireText(
    sourceTextMetadata,
    'return `source/${id}/${normalizeOriginalFileName(originalFileName)}`',
    'implemented canonical source-copy path',
  );
}

function checkRelativeMarkdownLinks() {
  const markdownFiles = [
    path.join(root, 'README.md'),
    ...walkFiles(path.join(root, 'docs')).filter((file) => file.endsWith('.md')),
  ];

  for (const file of markdownFiles) {
    const withoutFences = readFileSync(file, 'utf8').replace(/```[\s\S]*?```/g, '');
    for (const match of withoutFences.matchAll(/\[[^\]]*]\(([^)]+)\)/g)) {
      let target = match[1].trim();
      if (target.startsWith('<') && target.endsWith('>')) target = target.slice(1, -1);
      target = target.split(/\s+["']/)[0].split('#')[0];
      if (
        target.length === 0
        || target.startsWith('#')
        || /^[a-z][a-z0-9+.-]*:/i.test(target)
        || path.isAbsolute(target)
      ) {
        continue;
      }
      const resolved = path.resolve(path.dirname(file), decodeURIComponent(target));
      if (!existsSync(resolved)) {
        failures.push(
          `broken relative link ${path.relative(root, file)} -> ${target}`,
        );
      }
    }
  }
}

function requireFile(relativePath) {
  if (!existsSync(path.join(root, relativePath))) failures.push(`missing ${relativePath}`);
}

function markdownSection(value, heading) {
  const start = value.indexOf(heading);
  if (start < 0) {
    failures.push(`missing Markdown section: ${heading}`);
    return '';
  }
  const next = value.indexOf('\n## ', start + heading.length);
  return next < 0 ? value.slice(start) : value.slice(start, next);
}

function requireText(value, expected, label) {
  if (!value.includes(expected)) failures.push(`missing ${label}: ${JSON.stringify(expected)}`);
}

function rejectText(value, rejected, label) {
  if (value.includes(rejected)) failures.push(`${label}: ${JSON.stringify(rejected)}`);
}

function rejectPattern(value, rejected, label) {
  if (rejected.test(value)) failures.push(label);
}

function requirePattern(value, expected, label) {
  if (!expected.test(value)) failures.push(`missing ${label}: ${expected}`);
}

function walkFiles(directory) {
  if (!existsSync(directory)) return [];
  return readdirSync(directory).flatMap((entry) => {
    const absolute = path.join(directory, entry);
    return statSync(absolute).isDirectory() ? walkFiles(absolute) : [absolute];
  });
}
