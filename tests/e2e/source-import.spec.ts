import { chromium, expect, test, type Page } from '@playwright/test';
import type { ChildProcess } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import Database from 'better-sqlite3';
import net from 'node:net';
import path from 'node:path';
import {
  ANALYSIS_MODULE_DEFINITIONS,
  ANALYSIS_SECONDARY_SYSTEM_PAGES,
} from '../../src/shared/domain';
import {
  createElectronStderrBuffer,
  formatErrorWithElectronStderr,
  isSupportedPackagedPlatform,
  spawnPackagedApp,
} from './electron-app';

test.skip(!isSupportedPackagedPlatform(), 'Packaged Electron source import smoke targets Windows and macOS.');

test('imports a txt/md source through the packaged desktop entry using a main-process dialog stub', async () => {
  test.setTimeout(60_000);
  const testRoot = path.join(process.cwd(), 'test-results', 'electron-source-import');
  const libraryRoot = path.join(testRoot, 'library');
  const fixtureRoot = path.join(testRoot, 'fixtures');
  const sourcePath = path.join(fixtureRoot, 'Packaged Fixture.md');
  const evidenceRoot = path.join(testRoot, 'evidence');
  rmSync(testRoot, { recursive: true, force: true });
  mkdirSync(fixtureRoot, { recursive: true });
  mkdirSync(evidenceRoot, { recursive: true });
  const sourceText = [
    '# Packaged Fixture',
    '## Chapter 1: Arrival',
    'The opening establishes the setting and the first conflict.',
    '## Chapter 2: Turn',
    'The conflict turns and creates a new goal for the protagonist.',
    '## Chapter 3: Aftermath',
    'The consequences settle into a clear ending movement.',
    '',
  ].join('\n');
  writeFileSync(sourcePath, sourceText);

  await withPackagedApp(libraryRoot, sourcePath, async (page) => {
    await expect(page.getByRole('heading', { name: 'No library open' })).toBeVisible();
    await page.getByRole('button', { name: 'Create library' }).click();

    await expect(page.getByRole('heading', { name: 'Breakdown shelf' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Import source' })).toBeVisible();
    await page.getByRole('button', { name: 'Import source' }).click();

    await expect(page.locator('.book-list strong', { hasText: 'Packaged Fixture' })).toBeVisible();
    await expect(page.getByText('Packaged Fixture.md')).toBeVisible();
    await expect(page.getByText('Source imported.')).toBeVisible();
    const jobPanel = page.getByRole('region', { name: 'Jobs & recovery' });
    await expect(jobPanel).toBeVisible();
    const completedImport = jobPanel.locator('.job-recovery-list button')
      .filter({ hasText: 'Import source' }).filter({ hasText: 'COMPLETED' });
    await expect(completedImport).toHaveCount(1);
    await completedImport.click();
    await expect(jobPanel.locator('.job-recovery-detail')).toContainText('Source import');
    await expect(jobPanel.getByText('source_import_completed')).toBeVisible();
    await expect(jobPanel.getByRole('button', { name: 'Resume' })).toBeDisabled();
    await expect(jobPanel.getByRole('button', { name: 'Keep draft' })).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'Detection candidate' })).toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: path.join(evidenceRoot, 'candidate.png'), fullPage: true });

    await page.getByRole('button', { name: 'Create draft' }).click();
    await expect(page.getByText(/Draft revision \d+ is ready for review\./)).toBeVisible();
    const accept = page.getByRole('button', { name: 'Accept low confidence' });
    while (await accept.count() > 0) {
      const previous = await accept.count();
      await accept.first().click();
      await expect(accept).toHaveCount(previous - 1);
    }
    await expect(page.getByRole('button', { name: 'Freeze structure', exact: true })).toBeVisible();
    await page.screenshot({ path: path.join(evidenceRoot, 'draft-ready.png'), fullPage: true });
    await page.getByRole('button', { name: 'Freeze structure', exact: true }).click();
    await expect(page.getByText('Structure edition 1 is frozen and current.')).toBeVisible();
    await expectFrozenAnalysisWorkbench(page);
    const moduleShellJob = jobPanel.locator('.job-recovery-list button')
      .filter({ hasText: 'Create analysis module shells' }).filter({ hasText: 'COMPLETED' });
    await expect(moduleShellJob).toHaveCount(1);
    await moduleShellJob.click();
    await expect(jobPanel.getByText('analysis_module_shell_creation_completed')).toBeVisible();
    await page.screenshot({ path: path.join(evidenceRoot, 'frozen.png'), fullPage: true });
  });

  insertRecoveryUiFixtures(libraryRoot);
  const abandonedImportStaging = path.join(
    libraryRoot,
    'source',
    '.staging',
    'e2e-job-abandoned-import.tmp',
  );
  expect(existsSync(abandonedImportStaging)).toBe(true);

  await withPackagedApp(libraryRoot, sourcePath, async (page) => {
    await expect(page.getByRole('heading', { name: 'No library open' })).toBeVisible();
    await page.getByRole('button', { name: 'Open library' }).click();

    await expect(page.getByRole('heading', { name: 'Breakdown shelf' })).toBeVisible();
    await expect(page.locator('.book-list strong', { hasText: 'Packaged Fixture' })).toBeVisible();
    await expect(page.getByText('Packaged Fixture.md')).not.toBeVisible();
    await expect(page.getByText('Source imported.')).not.toBeVisible();
    const jobPanel = page.getByRole('region', { name: 'Jobs & recovery' });
    const failedImport = jobPanel.locator('.job-recovery-list button')
      .filter({ hasText: 'Import source' }).filter({ hasText: 'FAILED' });
    await expect(failedImport).toHaveCount(2);
    await failedImport.first().click();
    await expect(jobPanel.getByText('SOURCE_IMPORT_ABANDONED')).toBeVisible();
    await failedImport.nth(1).click();
    await expect(jobPanel.getByText('E2E_IMPORT_FAILED')).toBeVisible();
    await expect(jobPanel.getByText('Library-level / unbound').first()).toBeVisible();

    const resumableStructure = jobPanel.locator('.job-recovery-list button')
      .filter({ hasText: 'Detect structure' }).filter({ hasText: 'RESUMABLE' });
    await resumableStructure.click();
    await expect(jobPanel.getByRole('button', { name: 'Resume' })).toBeDisabled();
    await expect(jobPanel.getByRole('button', { name: 'Keep draft' })).toBeDisabled();
    await expect(jobPanel.getByRole('button', { name: 'Cancel job' })).toBeVisible();
    await page.screenshot({ path: path.join(evidenceRoot, 'job-recovery-resumable.png'), fullPage: true });

    const resumableImport = jobPanel.locator('.job-recovery-list button')
      .filter({ hasText: 'Import source' }).filter({ hasText: 'RESUMABLE' });
    await resumableImport.click();
    await jobPanel.getByRole('button', { name: 'Cancel job' }).click();
    await expect(jobPanel.locator('.job-recovery-detail')).toContainText('CANCELLED');
    await expect(jobPanel.getByRole('button', { name: 'Cancel job' })).toHaveCount(0);
    await jobPanel.screenshot({ path: path.join(evidenceRoot, 'job-recovery-cancelled.png') });
    await page.getByRole('button', { name: 'Review structure' }).click();
    await expect(page.getByText('Structure edition 1 is frozen and current.')).toBeVisible();
    await expectFrozenAnalysisWorkbench(page);
    await page.screenshot({ path: path.join(evidenceRoot, 'frozen-after-restart.png'), fullPage: true });
    await page.getByRole('button', { name: 'Create revision draft' }).click();
    await expect(page.getByText('Draft revision 1 is ready for review.')).toBeVisible();
    await page.screenshot({ path: path.join(evidenceRoot, 'unfrozen-draft.png'), fullPage: true });

    bumpCurrentDraftRevision(libraryRoot);
    await page.locator('.structure-node-list form').first().getByRole('button', { name: 'Rename' }).click();
    await expect(page.getByRole('alert')).toContainText('draft_revision_mismatch');
    await expect(page.getByText('Draft revision 2 is ready for review.')).toBeVisible();
    await page.screenshot({ path: path.join(evidenceRoot, 'revision-conflict.png'), fullPage: true });
  });

  expect(existsSync(abandonedImportStaging)).toBe(false);

  markCurrentSourceStale(libraryRoot);
  await withPackagedApp(libraryRoot, sourcePath, async (page) => {
    await page.getByRole('button', { name: 'Open library' }).click();
    await expect(page.getByRole('heading', { name: 'Breakdown shelf' })).toBeVisible();
    await page.getByRole('button', { name: 'Review structure' }).click();
    await expect(page.getByText(/draft is stale:/)).toBeVisible();
    await expect(page.getByText(/Blocked:.*draft_stale/)).toBeVisible();
    await page.screenshot({ path: path.join(evidenceRoot, 'stale-draft.png'), fullPage: true });
  });

  const importRows = readImportRows(libraryRoot);
  expect(importRows.books).toEqual([{
    id: expect.any(String),
    title: 'Packaged Fixture',
    current_source_text_id: expect.any(String),
  }]);
  expect(importRows.sourceTexts).toEqual([{
    id: importRows.books[0].current_source_text_id,
    original_file_name: 'Packaged Fixture.md',
    relative_path: `source/${importRows.books[0].current_source_text_id}/Packaged Fixture.md`,
  }]);
  const copiedPath = path.join(libraryRoot, importRows.sourceTexts[0].relative_path);
  expect(existsSync(copiedPath)).toBe(true);
  expect(readFileSync(copiedPath, 'utf8')).toBe(sourceText);
});

async function expectFrozenAnalysisWorkbench(page: Page): Promise<void> {
  const workbench = page.locator('.analysis-module-workbench');
  await expect(workbench.getByRole('heading', { name: 'Analysis workbench' })).toBeVisible();
  await expect(workbench).toContainText('7 module instances');
  await expect(workbench.locator('.analysis-module-list > li')).toHaveCount(
    ANALYSIS_MODULE_DEFINITIONS.length,
  );

  for (const definition of ANALYSIS_MODULE_DEFINITIONS) {
    await expect(workbench.locator('.analysis-module-list button', {
      hasText: definition.name,
    })).toHaveCount(1);
  }
  for (const pageDefinition of ANALYSIS_SECONDARY_SYSTEM_PAGES) {
    await expect(workbench.getByText(pageDefinition.name, { exact: true })).toHaveCount(0);
  }

  await workbench.locator('.analysis-module-list button', {
    hasText: '世界设定与规则',
  }).click();
  const detail = workbench.locator('.analysis-module-detail');
  await expect(detail.getByRole('heading', { name: '世界设定与规则' })).toBeVisible();
  await expect(detail).toContainText('world_rules');
  await expect(detail).toContainText('Book scope');
  await expect(detail).toContainText('Not generated');
  await expect(detail).toContainText('尚无资产');
  await expect(detail.getByRole('button', { name: 'Run analysis' })).toBeDisabled();
  await expect(detail.getByRole('button', { name: 'Rerun module' })).toBeDisabled();
  await expect(detail.getByRole('button', { name: 'View rerun diff' })).toBeDisabled();
  await expect(detail.getByText(
    'Unavailable: the Codex SDK compatibility spike has not passed, so no AI analysis runtime is admitted.',
    { exact: true },
  )).toBeVisible();
  await expect(detail.getByText(
    'Unavailable: the AI Job runtime is not admitted, so this module cannot be rerun.',
    { exact: true },
  )).toBeVisible();
  await expect(detail.getByText(
    'Unavailable: No rerun candidate exists, and rerun diff is not implemented.',
    { exact: true },
  )).toBeVisible();
}

test('shows packaged detection failure and lets the user retry from the structure workspace', async () => {
  test.setTimeout(60_000);
  const testRoot = path.join(process.cwd(), 'test-results', 'electron-structure-detection-retry');
  const libraryRoot = path.join(testRoot, 'library');
  const fixtureRoot = path.join(testRoot, 'fixtures');
  const evidenceRoot = path.join(testRoot, 'evidence');
  const sourcePath = path.join(fixtureRoot, 'Undetectable Prose.txt');
  rmSync(testRoot, { recursive: true, force: true });
  mkdirSync(fixtureRoot, { recursive: true });
  mkdirSync(evidenceRoot, { recursive: true });
  writeFileSync(sourcePath, 'A continuous prose fragment without headings or structural separators.');

  await withPackagedApp(libraryRoot, sourcePath, async (page) => {
    await expect(page.getByRole('heading', { name: 'No library open' })).toBeVisible();
    await page.getByRole('button', { name: 'Create library' }).click();
    await expect(page.getByRole('heading', { name: 'Breakdown shelf' })).toBeVisible();
    await page.getByRole('button', { name: 'Import source' }).click();
    await expect(page.getByRole('button', { name: 'Retry detection' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('alert')).toContainText('Structure detection failed');
    await page.screenshot({ path: path.join(evidenceRoot, 'detection-failed.png'), fullPage: true });

    await page.getByRole('button', { name: 'Retry detection' }).click();
    await expect.poll(() => detectionRunCount(libraryRoot)).toBe(2);
    await expect(page.getByRole('button', { name: 'Retry detection' })).toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('alert')).toContainText('Structure detection failed');
    await page.waitForTimeout(250);
    await page.locator('.structure-review-panel').screenshot({
      path: path.join(evidenceRoot, 'retry-failed-visible.png'),
    });

    await page.getByRole('button', { name: 'Create manual draft' }).click();
    await expect(page.getByText('Draft revision 1 is ready for review.')).toBeVisible();
    const addNode = page.locator('.add-node-form');
    await addNode.getByLabel('Kind').selectOption('chapter');
    await addNode.getByLabel('Title').fill('Manual Chapter');
    await addNode.getByLabel('Parent').selectOption({ label: 'Undetectable Prose' });
    await addNode.getByLabel('Start offset').fill('0');
    await addNode.getByLabel('End offset').fill('70');
    await addNode.getByRole('button', { name: 'Add node' }).click();
    await expect(page.getByLabel('Draft structure nodes').locator('strong', {
      hasText: 'Manual Chapter',
    })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Freeze structure', exact: true })).toBeVisible();
    await page.screenshot({ path: path.join(evidenceRoot, 'manual-draft-ready.png'), fullPage: true });
    await page.getByRole('button', { name: 'Freeze structure', exact: true }).click();
    await expect(page.getByText('Structure edition 1 is frozen and current.')).toBeVisible();
    await page.screenshot({ path: path.join(evidenceRoot, 'manual-draft-frozen.png'), fullPage: true });
  });

  expect(detectionRunCount(libraryRoot)).toBe(2);
});

test('recovers a persisted orphan detection after packaged app restart and retries', async () => {
  test.setTimeout(60_000);
  const testRoot = path.join(process.cwd(), 'test-results', 'electron-structure-detection-recovery');
  const libraryRoot = path.join(testRoot, 'library');
  const fixtureRoot = path.join(testRoot, 'fixtures');
  const evidenceRoot = path.join(testRoot, 'evidence');
  const sourcePath = path.join(fixtureRoot, 'Recovery Fixture.md');
  rmSync(testRoot, { recursive: true, force: true });
  mkdirSync(fixtureRoot, { recursive: true });
  mkdirSync(evidenceRoot, { recursive: true });
  writeFileSync(sourcePath, [
    '# Recovery Fixture',
    '## Chapter 1: Before',
    'The first movement establishes an orphan recovery checkpoint.',
    '## Chapter 2: After',
    'The second movement proves detection can run again.',
  ].join('\n'));

  await withPackagedApp(libraryRoot, sourcePath, async (page) => {
    await page.getByRole('button', { name: 'Create library' }).click();
    await page.getByRole('button', { name: 'Import source' }).click();
    await expect(page.getByRole('heading', { name: 'Detection candidate' })).toBeVisible({ timeout: 15_000 });
  });

  markLatestDetectionOrphan(libraryRoot);
  expect(latestDetectionStates(libraryRoot)).toEqual({ run: 'running', job: 'running' });

  await withPackagedApp(libraryRoot, sourcePath, async (page) => {
    await page.getByRole('button', { name: 'Open library' }).click();
    await expect(page.getByRole('heading', { name: 'Breakdown shelf' })).toBeVisible();
    const jobPanel = page.getByRole('region', { name: 'Jobs & recovery' });
    const orphanJob = jobPanel.locator('.job-recovery-list button')
      .filter({ hasText: 'Detect structure' }).filter({ hasText: 'RUNNING' });
    await expect(orphanJob).toHaveCount(1);
    await orphanJob.click();
    await expect(jobPanel.getByRole('button', { name: 'Cancel job' })).toBeVisible();
    await page.screenshot({ path: path.join(evidenceRoot, 'orphan-after-restart.png'), fullPage: true });

    await jobPanel.getByRole('button', { name: 'Cancel job' }).click();
    await expect(jobPanel.locator('.job-recovery-detail')).toContainText('CANCELLED');
    await expect.poll(() => latestDetectionStates(libraryRoot)).toEqual({ run: 'failed', job: 'cancelled' });
    await page.getByRole('button', { name: 'Review structure' }).click();
    await expect(page.getByRole('button', { name: 'Recover detection' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Retry detection' })).toBeVisible();
    await page.screenshot({ path: path.join(evidenceRoot, 'orphan-recovered.png'), fullPage: true });

    await page.getByRole('button', { name: 'Retry detection' }).click();
    await expect.poll(() => detectionRunCount(libraryRoot)).toBe(3);
    await expect.poll(() => latestDetectionStates(libraryRoot)).toEqual({ run: 'completed', job: 'completed' });
    await expect(page.getByRole('heading', { name: 'Detection candidate' })).toBeVisible();
    await page.screenshot({ path: path.join(evidenceRoot, 'retry-completed.png'), fullPage: true });
  });
});

test('recovers a stale frozen edition through a fresh candidate replacement draft', async () => {
  test.setTimeout(90_000);
  const testRoot = path.join(process.cwd(), 'test-results', 'electron-structure-source-replacement');
  const libraryRoot = path.join(testRoot, 'library');
  const fixtureRoot = path.join(testRoot, 'fixtures');
  const evidenceRoot = path.join(testRoot, 'evidence');
  const sourcePath = path.join(fixtureRoot, 'Replacement Fixture.md');
  rmSync(testRoot, { recursive: true, force: true });
  mkdirSync(fixtureRoot, { recursive: true });
  mkdirSync(evidenceRoot, { recursive: true });
  writeFileSync(sourcePath, [
    '# Replacement Fixture',
    '## Chapter 1: Old opening',
    'The old source establishes the first movement.',
    '## Chapter 2: Old ending',
    'The old source closes the second movement.',
  ].join('\n'));

  await withPackagedApp(libraryRoot, sourcePath, async (page) => {
    await page.getByRole('button', { name: 'Create library' }).click();
    await page.getByRole('button', { name: 'Import source' }).click();
    await expect(page.getByRole('heading', { name: 'Detection candidate' })).toBeVisible({ timeout: 15_000 });
    await page.getByRole('button', { name: 'Create draft' }).click();
    await acceptAllLowConfidence(page);
    await page.getByRole('button', { name: 'Freeze structure', exact: true }).click();
    await expect(page.getByText('Structure edition 1 is frozen and current.')).toBeVisible();
  });

  replaceCurrentSourceFixture(libraryRoot, 'Replacement Fixture v2.md', [
    '# Replacement Fixture',
    '## Chapter 1: New opening',
    'The new source establishes a revised first movement.',
    '## Chapter 2: New turn',
    'The new source changes the central movement.',
    '## Chapter 3: New ending',
    'The new source closes with a third movement.',
  ].join('\n'));

  await withPackagedApp(libraryRoot, sourcePath, async (page) => {
    await page.getByRole('button', { name: 'Open library' }).click();
    await page.getByRole('button', { name: 'Review structure' }).click();
    await expect(page.getByText(/frozen is stale:/)).toBeVisible();
    await page.getByRole('button', { name: 'Detect structure', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Create replacement draft' }))
      .toBeVisible({ timeout: 15_000 });
    await page.screenshot({ path: path.join(evidenceRoot, 'replacement-available.png'), fullPage: true });
    await page.getByRole('button', { name: 'Create replacement draft' }).click();
    await expect(page.getByText('Draft revision 1 is ready for review.')).toBeVisible();
    await acceptAllLowConfidence(page);
    await page.getByRole('button', { name: 'Freeze structure', exact: true }).click();
    await expect(page.getByText('Structure edition 2 is frozen and current.')).toBeVisible();
    await page.screenshot({ path: path.join(evidenceRoot, 'replacement-frozen.png'), fullPage: true });
  });
});

test('recovers from failed detection with a stale candidate through a manual draft', async () => {
  test.setTimeout(90_000);
  const testRoot = path.join(process.cwd(), 'test-results', 'electron-structure-stale-candidate-manual');
  const libraryRoot = path.join(testRoot, 'library');
  const fixtureRoot = path.join(testRoot, 'fixtures');
  const evidenceRoot = path.join(testRoot, 'evidence');
  const sourcePath = path.join(fixtureRoot, 'Stale Candidate Fixture.md');
  rmSync(testRoot, { recursive: true, force: true });
  mkdirSync(fixtureRoot, { recursive: true });
  mkdirSync(evidenceRoot, { recursive: true });
  writeFileSync(sourcePath, [
    '# Stale Candidate Fixture',
    '## Chapter 1: Detectable',
    'This original source creates a candidate that will become stale.',
  ].join('\n'));

  await withPackagedApp(libraryRoot, sourcePath, async (page) => {
    await page.getByRole('button', { name: 'Create library' }).click();
    await page.getByRole('button', { name: 'Import source' }).click();
    await expect(page.getByRole('heading', { name: 'Detection candidate' })).toBeVisible({ timeout: 15_000 });
  });

  const replacementText = 'A continuous replacement source without headings or structural separators.';
  replaceCurrentSourceFixture(libraryRoot, 'Stale Candidate Fixture v2.txt', replacementText);

  await withPackagedApp(libraryRoot, sourcePath, async (page) => {
    await page.getByRole('button', { name: 'Open library' }).click();
    await page.getByRole('button', { name: 'Review structure' }).click();
    await expect(page.getByText(/candidate is stale:/)).toBeVisible();
    await page.getByRole('button', { name: 'Detect structure', exact: true }).click();
    await expect(page.getByRole('button', { name: 'Create manual draft' }))
      .toBeVisible({ timeout: 15_000 });
    await expect(page.getByRole('heading', { name: 'Detection candidate' })).toBeVisible();
    await page.screenshot({ path: path.join(evidenceRoot, 'stale-candidate-manual-available.png'), fullPage: true });
    await page.getByRole('button', { name: 'Create manual draft' }).click();
    const addNode = page.locator('.add-node-form');
    await addNode.getByLabel('Kind').selectOption('chapter');
    await addNode.getByLabel('Title').fill('Manual replacement chapter');
    await addNode.getByLabel('Parent').selectOption({ label: 'Stale Candidate Fixture' });
    await addNode.getByLabel('Start offset').fill('0');
    await addNode.getByLabel('End offset').fill(String(replacementText.length));
    await addNode.getByRole('button', { name: 'Add node' }).click();
    await expect(page.getByRole('button', { name: 'Freeze structure', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Freeze structure', exact: true }).click();
    await expect(page.getByText('Structure edition 1 is frozen and current.')).toBeVisible();
    await page.screenshot({ path: path.join(evidenceRoot, 'stale-candidate-manual-frozen.png'), fullPage: true });
  });
});

async function withPackagedApp(
  libraryRoot: string,
  sourcePath: string,
  run: (page: Page) => Promise<void>,
): Promise<void> {
  const port = await getFreePort();
  const userDataDir = path.join(process.cwd(), 'test-results', `electron-source-import-user-data-${port}`);
  const electronStderr = createElectronStderrBuffer();
  mkdirSync(userDataDir, { recursive: true });

  const appProcess = spawnPackagedApp({
    args: [`--remote-debugging-port=${port}`, `--user-data-dir=${userDataDir}`],
    env: {
      WRITESTORM_E2E_LIBRARY_DIALOG_STUB: '1',
      WRITESTORM_E2E_LIBRARY_ROOT: libraryRoot,
      WRITESTORM_E2E_LIBRARY_NAME: 'E2E Import Library',
      WRITESTORM_E2E_IMPORT_DIALOG_STUB: '1',
      WRITESTORM_E2E_IMPORT_SOURCE_PATH: sourcePath,
    },
  });
  let appExit: { code: number | null; signal: NodeJS.Signals | null } | undefined;

  appProcess.stderr?.on('data', (chunk: Buffer) => {
    electronStderr.push(chunk);
  });
  appProcess.once('exit', (code, signal) => {
    appExit = { code, signal };
  });

  let browser: Awaited<ReturnType<typeof connectToElectron>> | undefined;
  try {
    browser = await connectToElectron(port, () => appExit);
    const context = browser.contexts()[0];
    const deadline = Date.now() + 10_000;
    let page = context.pages().find((candidate) => candidate.url() !== 'about:blank');
    while (!page && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      page = context.pages().find((candidate) => candidate.url() !== 'about:blank');
    }
    if (!page) throw new Error('Electron app page did not navigate from about:blank.');

    await run(page);
  } catch (error) {
    throw formatErrorWithElectronStderr(error, electronStderr.summary());
  } finally {
    await browser?.close().catch(() => undefined);
    stopProcess(appProcess);
  }
}

async function getFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = net.createServer();
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      server.close(() => {
        if (typeof address === 'object' && address?.port) {
          resolve(address.port);
        } else {
          reject(new Error('Unable to allocate a local debugging port.'));
        }
      });
    });
  });
}

async function connectToElectron(
  port: number,
  getAppExit?: () => { code: number | null; signal: NodeJS.Signals | null } | undefined,
) {
  const endpoint = `http://127.0.0.1:${port}`;
  const deadline = Date.now() + 10_000;
  let lastError: unknown;

  while (Date.now() < deadline) {
    const appExit = getAppExit?.();
    if (appExit) {
      throw new Error(
        `Electron exited before CDP connection (code: ${appExit.code ?? 'null'}, signal: ${appExit.signal ?? 'null'}).`,
      );
    }

    try {
      return await chromium.connectOverCDP(endpoint, { timeout: 1_000 });
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 250));
    }
  }

  throw lastError instanceof Error ? lastError : new Error(`Could not connect to ${endpoint}`);
}

function stopProcess(processToStop: ChildProcess): void {
  if (!processToStop.killed) {
    processToStop.kill();
  }
}

function readImportRows(libraryRoot: string): {
  books: Array<{
    id: string;
    title: string;
    current_source_text_id: string;
  }>;
  sourceTexts: Array<{
    id: string;
    original_file_name: string;
    relative_path: string;
  }>;
} {
  const database = new Database(path.join(libraryRoot, 'writestorm.sqlite'), {
    readonly: true,
    fileMustExist: true,
  });

  try {
    return {
      books: database.prepare(`
        SELECT id, title, current_source_text_id
        FROM books
        ORDER BY id
      `).all() as Array<{
        id: string;
        title: string;
        current_source_text_id: string;
      }>,
      sourceTexts: database.prepare(`
        SELECT id, original_file_name, relative_path
        FROM source_texts
        ORDER BY id
      `).all() as Array<{
        id: string;
        original_file_name: string;
        relative_path: string;
      }>,
    };
  } finally {
    database.close();
  }
}

function insertRecoveryUiFixtures(libraryRoot: string): void {
  const database = new Database(path.join(libraryRoot, 'writestorm.sqlite'));
  try {
    const source = database.prepare(`SELECT b.id AS book_id, s.id AS source_text_id,
      s.source_edition, s.content_hash
      FROM books b JOIN source_texts s ON s.id = b.current_source_text_id LIMIT 1`).get() as {
        book_id: string;
        source_text_id: string;
        source_edition: number;
        content_hash: string;
      } | undefined;
    if (!source) throw new Error('Expected an imported Book before inserting recovery UI fixtures.');
    const fixtureTime = Date.now();
    const timestamp = (offset: number): string => new Date(fixtureTime + offset).toISOString();
    const insert = database.prepare(`INSERT INTO jobs (
      id, book_id, kind, state, completed_units, total_units, payload_schema_version,
      payload_json, error_code, error_details_json, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?, NULL, ?, ?)`);
    database.transaction(() => {
      insert.run(
        'e2e-job-failed-import', null, 'source_import', 'failed', 0, 1,
        JSON.stringify({ sourceTextId: 'e2e-failed-source' }), 'E2E_IMPORT_FAILED',
        timestamp(0), timestamp(1),
      );
      insert.run(
        'e2e-job-resumable-structure', source.book_id, 'structure_detection', 'resumable', 1, 3,
        JSON.stringify({
          title: 'Detect structure',
          sourceTextId: source.source_text_id,
          sourceTextEdition: source.source_edition,
          contentHash: source.content_hash,
        }), 'E2E_STRUCTURE_INTERRUPTED',
        timestamp(2), timestamp(3),
      );
      insert.run(
        'e2e-job-resumable-import', null, 'source_import', 'resumable', 0, 1,
        JSON.stringify({ sourceTextId: 'e2e-resumable-source' }), 'E2E_IMPORT_INTERRUPTED',
        timestamp(4), timestamp(5),
      );
      insert.run(
        'e2e-job-abandoned-import', null, 'source_import', 'running', 0, 1,
        JSON.stringify({ sourceTextId: 'e2e-abandoned-source' }), null,
        timestamp(6), timestamp(7),
      );
    })();
    const stagingPath = path.join(
      libraryRoot,
      'source',
      '.staging',
      'e2e-job-abandoned-import.tmp',
    );
    mkdirSync(path.dirname(stagingPath), { recursive: true });
    writeFileSync(stagingPath, 'abandoned import staging');
  } finally {
    database.close();
  }
}

async function acceptAllLowConfidence(page: Page): Promise<void> {
  const accept = page.getByRole('button', { name: 'Accept low confidence' });
  while (await accept.count() > 0) {
    const previous = await accept.count();
    await accept.first().click();
    await expect(accept).toHaveCount(previous - 1);
  }
}

function bumpCurrentDraftRevision(libraryRoot: string): void {
  const database = new Database(path.join(libraryRoot, 'writestorm.sqlite'));
  try {
    database.prepare(`UPDATE structure_sets SET draft_revision = draft_revision + 1
      WHERE stage = 'draft' AND is_current = 1`).run();
  } finally {
    database.close();
  }
}

function markCurrentSourceStale(libraryRoot: string): void {
  const database = new Database(path.join(libraryRoot, 'writestorm.sqlite'));
  try {
    database.prepare(`UPDATE source_texts SET content_hash = 'sha256:e2e-stale-source'
      WHERE id = (SELECT current_source_text_id FROM books LIMIT 1)`).run();
  } finally {
    database.close();
  }
}

function replaceCurrentSourceFixture(
  libraryRoot: string,
  originalFileName: string,
  sourceText: string,
): void {
  const database = new Database(path.join(libraryRoot, 'writestorm.sqlite'));
  try {
    const book = database.prepare(`SELECT id FROM books ORDER BY created_at, id LIMIT 1`)
      .get() as { id: string } | undefined;
    if (!book) throw new Error('Expected an imported Book before replacing its SourceText fixture.');
    const sourceTextId = `e2e-source-${Date.now()}`;
    const bytes = Buffer.from(sourceText, 'utf8');
    const contentHash = `sha256:${createHash('sha256').update(bytes).digest('hex')}`;
    const extension = path.extname(originalFileName).slice(1);
    const relativePath = `source/${sourceTextId}/${originalFileName}`;
    const copiedPath = path.join(libraryRoot, ...relativePath.split('/'));
    mkdirSync(path.dirname(copiedPath), { recursive: true });
    writeFileSync(copiedPath, bytes);
    database.transaction(() => {
      const nextEdition = database.prepare(`SELECT COALESCE(MAX(source_edition), 0) + 1
        FROM source_texts WHERE book_id = ?`).pluck().get(book.id) as number;
      database.prepare(`INSERT INTO source_texts (
        id, book_id, original_file_name, size_bytes, format, content_hash, encoding,
        source_edition, relative_path, imported_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'utf-8', ?, ?, ?)`)
        .run(sourceTextId, book.id, originalFileName, bytes.byteLength, extension,
          contentHash, nextEdition, relativePath, new Date().toISOString());
      database.prepare(`UPDATE books SET current_source_text_id = ?, updated_at = ? WHERE id = ?`)
        .run(sourceTextId, new Date().toISOString(), book.id);
    })();
  } finally {
    database.close();
  }
}

function detectionRunCount(libraryRoot: string): number {
  const database = new Database(path.join(libraryRoot, 'writestorm.sqlite'), {
    readonly: true,
    fileMustExist: true,
  });
  try {
    return database.prepare('SELECT COUNT(*) FROM structure_detection_runs').pluck().get() as number;
  } finally {
    database.close();
  }
}

function markLatestDetectionOrphan(libraryRoot: string): void {
  const database = new Database(path.join(libraryRoot, 'writestorm.sqlite'));
  try {
    database.transaction(() => {
      const latest = database.prepare(`SELECT
          run.book_id,
          run.source_text_id,
          run.source_text_edition,
          run.source_content_hash,
          run.decoded_text_length,
          run.offset_unit,
          run.run_sequence,
          job.payload_json
        FROM structure_detection_runs run
        JOIN jobs job ON job.id = run.job_id
        ORDER BY run.run_sequence DESC LIMIT 1`).get() as {
          book_id: string;
          source_text_id: string;
          source_text_edition: number;
          source_content_hash: string;
          decoded_text_length: number;
          offset_unit: string;
          run_sequence: number;
          payload_json: string;
        } | undefined;
      if (!latest) throw new Error('Expected a completed detection run before orphan simulation.');
      const now = new Date().toISOString();
      database.prepare(`INSERT INTO jobs (
        id, book_id, kind, state, completed_units, total_units, payload_schema_version,
        payload_json, error_code, error_details_json, created_at, updated_at
      ) VALUES (
        'e2e-orphan-detection-job', ?, 'structure_detection', 'running', 0, 1, 1,
        ?, NULL, NULL, ?, ?
      )`).run(latest.book_id, latest.payload_json, now, now);
      database.prepare(`INSERT INTO structure_detection_runs (
        id, job_id, book_id, source_text_id, source_text_edition, source_content_hash,
        decoded_text_length, offset_unit, state, failure_reason, created_at, updated_at,
        run_sequence
      ) VALUES (
        'e2e-orphan-detection-run', 'e2e-orphan-detection-job', ?, ?, ?, ?, ?, ?,
        'running', NULL, ?, ?, ?
      )`).run(
        latest.book_id,
        latest.source_text_id,
        latest.source_text_edition,
        latest.source_content_hash,
        latest.decoded_text_length,
        latest.offset_unit,
        now,
        now,
        latest.run_sequence + 1,
      );
    })();
  } finally {
    database.close();
  }
}

function latestDetectionStates(libraryRoot: string): { run: string; job: string } {
  const database = new Database(path.join(libraryRoot, 'writestorm.sqlite'), {
    readonly: true,
    fileMustExist: true,
  });
  try {
    const row = database.prepare(`SELECT run.state AS run, job.state AS job
      FROM structure_detection_runs run
      JOIN jobs job ON job.id = run.job_id
      ORDER BY run.run_sequence DESC LIMIT 1`).get() as {
        run: string;
        job: string;
      } | undefined;
    if (!row) throw new Error('Expected a persisted structure detection run.');
    return row;
  } finally {
    database.close();
  }
}
