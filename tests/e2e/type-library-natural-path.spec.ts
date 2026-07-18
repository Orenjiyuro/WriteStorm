import { expect, test, type Locator, type Page } from '@playwright/test';
import {
  mkdirSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import Database from 'better-sqlite3';
import path from 'node:path';
import {
  connectToPackagedElectron,
  createElectronStderrBuffer,
  formatErrorWithElectronStderr,
  getFreePort,
  isSupportedPackagedPlatform,
  spawnPackagedApp,
  stopPackagedApp,
  type PackagedAppExit,
} from './electron-app';

test.skip(!isSupportedPackagedPlatform(), 'Packaged Electron TypeLibrary acceptance targets Windows and macOS.');

const MAIN_LIGHT_SCHOOL = 'builtin_main_001_v1';
const MAIN_MODERN_FANTASY = 'builtin_main_004_v1';
const FOCUS_ROMANCE_STOCK = 'builtin_focus_001_v1';
const FOCUS_ABILITY_RULES = 'builtin_focus_003_v1';
const FOCUS_ENSEMBLE = 'builtin_focus_005_v1';
const FOCUS_ADVENTURE = 'builtin_focus_007_v1';

test('@secondary-display accepts TypeLibrary choices through the natural Electron shelf', async () => {
  test.setTimeout(120_000);
  const testRoot = path.join(process.cwd(), 'test-results', 'electron-type-library-natural-path');
  const libraryRoot = path.join(testRoot, 'library');
  const fixtureRoot = path.join(testRoot, 'fixtures');
  const evidenceRoot = path.join(testRoot, 'evidence');
  const unassignedSource = path.join(fixtureRoot, 'No Selection.md');
  const selectedSource = path.join(fixtureRoot, 'Import Selected.md');
  const nextUnassignedSource = path.join(fixtureRoot, 'Next Unassigned.md');
  rmSync(testRoot, { recursive: true, force: true });
  mkdirSync(fixtureRoot, { recursive: true });
  mkdirSync(evidenceRoot, { recursive: true });
  writeFileSync(unassignedSource, '# No Selection\n## Chapter 1\nUser-selected classification only.\n');
  writeFileSync(selectedSource, '# Import Selected\n## Chapter 1\nNo automatic classifier runs.\n');
  writeFileSync(
    nextUnassignedSource,
    '# Next Unassigned\n## Chapter 1\nA successful import must clear the previous selection.\n',
  );

  await withPackagedApp(libraryRoot, unassignedSource, 'create', async (page) => {
    const importEditor = classificationEditor(page, 'import-classification');
    await expect(importEditor).toBeVisible();
    await expectOptionsReady(importEditor);
    await expect(importEditor.locator('[data-blocker-code="missing_main_type"]'))
      .toHaveText('Choose a Main type before formal analysis.');
    const customTypeButton = importEditor.getByRole('button', {
      name: 'Copy a built-in template to customize',
    });
    await expect(customTypeButton).toBeVisible();
    await expect(customTypeButton).toBeDisabled();
    await expect(importEditor.locator('#import-classification-custom-type-disabled-reason'))
      .toContainText(
        'local identity, persistence, versioning, sample validation, and publication flows',
      );

    await page.getByRole('button', { name: 'Import source', exact: true }).click();
    const unassignedBook = bookListItem(page, 'No Selection');
    await expect(unassignedBook).toBeVisible();
    await expect(unassignedBook.locator('.book-classification-summary'))
      .toHaveText('Main type unassigned');

    const bookEditor = classificationEditor(page, 'book-classification');
    await expect(bookEditor).toBeVisible();
    await expectOptionsReady(bookEditor);
    await expect(bookEditor.locator('[data-blocker-code="missing_main_type"]'))
      .toHaveText('Choose a Main type before formal analysis.');

    await setClassification(page, 'book-classification', MAIN_LIGHT_SCHOOL, [
      FOCUS_ROMANCE_STOCK,
      FOCUS_ABILITY_RULES,
      FOCUS_ENSEMBLE,
    ]);
    await expect(page.locator(
      `#book-classification-main-type option[value="${MAIN_LIGHT_SCHOOL}"]`,
    )).toHaveText('日轻校园');
    await expect(page.locator('#book-classification-main-type-description')).toHaveText(
      '以校园、社团为主要舞台，用轻小说式节奏展开青春日常、恋爱喜剧、群像互动或校园中的异常事件，注重人与人之间关系的描写。',
    );
    await expect(page.locator('#book-classification-focus-1-description')).toContainText(
      '男主和多个女主之间的情感纠葛',
    );
    await page.getByRole('button', { name: 'Save classification' }).click();
    await expect(unassignedBook.locator('.book-classification-summary'))
      .toHaveText('日轻校园 · 恋爱炒股 → 能力规则 → 群像');
    await expect(bookEditor.locator('[data-blocker-code="methodology_not_ready"]'))
      .toHaveText('The selected type methodology is not ready.');
    await expect(bookEditor.locator('[data-blocker-code="prompt_not_ready"]'))
      .toHaveText('The selected type Prompt is not ready.');
    await expect(bookEditor.locator('[data-blocker-code="schema_not_ready"]'))
      .toHaveText('The selected type output schema is not ready.');
    await page.screenshot({ path: path.join(evidenceRoot, 'three-ordered-focuses.png'), fullPage: true });

    await setClassification(page, 'book-classification', '', [
      FOCUS_ADVENTURE,
      FOCUS_ENSEMBLE,
    ]);
    await page.getByRole('button', { name: 'Save classification' }).click();
    await expect(unassignedBook.locator('.book-classification-summary'))
      .toHaveText('Main type unassigned · 冒险探索 → 群像');
    await expect(bookEditor.locator('[data-blocker-code="missing_main_type"]')).toBeVisible();
  });

  await withPackagedApp(libraryRoot, [selectedSource, nextUnassignedSource], 'open', async (page) => {
    const focusOnlyBook = bookListItem(page, 'No Selection');
    await expect(focusOnlyBook.locator('.book-classification-summary'))
      .toHaveText('Main type unassigned · 冒险探索 → 群像');
    await focusOnlyBook.getByRole('button', { name: 'Review structure' }).click();

    const bookEditor = classificationEditor(page, 'book-classification');
    await expectOptionsReady(bookEditor);
    await expect(page.locator('#book-classification-main-type')).toHaveValue('');
    await expect(page.locator('#book-classification-focus-1')).toHaveValue(FOCUS_ADVENTURE);
    await expect(page.locator('#book-classification-focus-2')).toHaveValue(FOCUS_ENSEMBLE);
    await expect(bookEditor.locator('[data-blocker-code="missing_main_type"]')).toBeVisible();
    await page.screenshot({ path: path.join(evidenceRoot, 'focus-only-after-restart.png'), fullPage: true });

    await setClassification(page, 'book-classification', '', []);
    await page.getByRole('button', { name: 'Save classification' }).click();
    await expect(focusOnlyBook.locator('.book-classification-summary'))
      .toHaveText('Main type unassigned');

    const importEditor = classificationEditor(page, 'import-classification');
    await expectOptionsReady(importEditor);
    await setClassification(page, 'import-classification', MAIN_MODERN_FANTASY, [
      FOCUS_ABILITY_RULES,
      FOCUS_ADVENTURE,
    ]);
    await expect(importEditor.locator('[data-blocker-code="methodology_not_ready"]')).toBeVisible();
    await page.getByRole('button', { name: 'Import source', exact: true }).click();

    const selectedBook = bookListItem(page, 'Import Selected');
    await expect(selectedBook).toBeVisible();
    await expect(selectedBook.locator('.book-classification-summary'))
      .toHaveText('现代幻想 · 能力规则 → 冒险探索');
    const importedBookEditor = classificationEditor(page, 'book-classification');
    await expect(importedBookEditor.locator('.type-library-readiness'))
      .toContainText('方法论尚未就绪，不能开始正式分析');
    await expect(importedBookEditor.locator('[data-blocker-code="methodology_not_ready"]'))
      .toBeVisible();
    await expect(importedBookEditor.locator('[data-blocker-code="missing_main_type"]'))
      .toHaveCount(0);
    await expect(page.locator('#book-classification-main-type')).toHaveValue(MAIN_MODERN_FANTASY);
    await expect(page.locator('#book-classification-focus-1')).toHaveValue(FOCUS_ABILITY_RULES);
    await expect(page.locator('#book-classification-focus-2')).toHaveValue(FOCUS_ADVENTURE);
    await page.screenshot({ path: path.join(evidenceRoot, 'import-time-selection.png'), fullPage: true });

    await expect(page.locator('#import-classification-main-type')).toHaveValue('');
    await expect(page.locator('#import-classification-focus-1')).toHaveValue('');
    await expect(page.locator('#import-classification-focus-2')).toHaveValue('');
    await page.getByRole('button', { name: 'Import source', exact: true }).click();
    const nextUnassignedBook = bookListItem(page, 'Next Unassigned');
    await expect(nextUnassignedBook).toBeVisible();
    await expect(nextUnassignedBook.locator('.book-classification-summary'))
      .toHaveText('Main type unassigned');
  });

  archiveDefinitions(libraryRoot, ['builtin_main_004', 'builtin_focus_003']);
  await withPackagedApp(libraryRoot, selectedSource, 'open', async (page) => {
    const importEditor = classificationEditor(page, 'import-classification');
    await expect(importEditor.locator(`option[value="${MAIN_MODERN_FANTASY}"]`)).toHaveCount(0);
    await expect(importEditor.locator(`option[value="${FOCUS_ABILITY_RULES}"]`)).toHaveCount(0);

    await bookListItem(page, 'Import Selected')
      .getByRole('button', { name: 'Review structure' }).click();
    const bookEditor = classificationEditor(page, 'book-classification');
    const archivedMain = bookEditor.locator(`option[value="${MAIN_MODERN_FANTASY}"]`);
    const archivedFocus = bookEditor.locator(
      `#book-classification-focus-1 option[value="${FOCUS_ABILITY_RULES}"]`,
    );
    await expect(page.locator('#book-classification-main-type'))
      .toHaveValue(MAIN_MODERN_FANTASY);
    await expect(page.locator('#book-classification-focus-1'))
      .toHaveValue(FOCUS_ABILITY_RULES);
    await expect(archivedMain).toHaveAttribute('disabled', '');
    await expect(archivedFocus).toHaveAttribute('disabled', '');
    await expect(archivedMain).toHaveText('现代幻想');
    await expect(page.locator('#book-classification-main-type-description')).toContainText(
      'Archived selection · 在现代社会结构中引入修行、怪异、异能、神秘组织等超常体系',
    );
    await page.getByRole('button', { name: 'Save classification' }).click();
    await expect(page.getByRole('alert')).toHaveCount(0);
    await expect(bookListItem(page, 'Import Selected').locator('.book-classification-summary'))
      .toHaveText('现代幻想 · 能力规则 → 冒险探索');
  });

  expect(readPersistedBindings(libraryRoot)).toEqual([
    {
      title: 'Import Selected',
      mainTypeDefinitionVersionId: MAIN_MODERN_FANTASY,
      focusCount: 2,
    },
    {
      title: 'Next Unassigned',
      mainTypeDefinitionVersionId: null,
      focusCount: 0,
    },
    {
      title: 'No Selection',
      mainTypeDefinitionVersionId: null,
      focusCount: 0,
    },
  ]);
});

test('@secondary-display retains TypeLibrary choices across import repair retry', async () => {
  test.setTimeout(120_000);
  const testRoot = path.join(process.cwd(), 'test-results', 'electron-type-library-import-retry');
  const libraryRoot = path.join(testRoot, 'library');
  const fixtureRoot = path.join(testRoot, 'fixtures');
  const retrySource = path.join(fixtureRoot, 'Retry Selected.md');
  rmSync(testRoot, { recursive: true, force: true });
  mkdirSync(fixtureRoot, { recursive: true });
  writeFileSync(retrySource, '');

  await withPackagedApp(libraryRoot, retrySource, 'create', async (page) => {
    const importEditor = classificationEditor(page, 'import-classification');
    await expectOptionsReady(importEditor);
    await setClassification(page, 'import-classification', MAIN_MODERN_FANTASY, [
      FOCUS_ABILITY_RULES,
      FOCUS_ADVENTURE,
    ]);

    await page.getByRole('button', { name: 'Import source', exact: true }).click();
    const repairAction = page.getByRole('button', { name: 'Retry import' });
    await expect(repairAction).toBeVisible();

    writeFileSync(
      retrySource,
      '# Retry Selected\n## Chapter 1\nThe retained user selection must survive retry.\n',
    );
    await repairAction.click();

    const importedBook = bookListItem(page, 'Retry Selected');
    await expect(importedBook).toBeVisible();
    await expect(importedBook.locator('.book-classification-summary'))
      .toHaveText('现代幻想 · 能力规则 → 冒险探索');
  });

  expect(readPersistedBindings(libraryRoot)).toEqual([{
    title: 'Retry Selected',
    mainTypeDefinitionVersionId: MAIN_MODERN_FANTASY,
    focusCount: 2,
  }]);
});

async function withPackagedApp(
  libraryRoot: string,
  sourcePath: string | readonly string[],
  libraryAction: 'create' | 'open',
  run: (page: Page) => Promise<void>,
): Promise<void> {
  const port = await getFreePort();
  const userDataDir = path.join(
    process.cwd(),
    'test-results',
    `electron-type-library-user-data-${port}`,
  );
  const electronStderr = createElectronStderrBuffer();
  mkdirSync(userDataDir, { recursive: true });
  const appProcess = spawnPackagedApp({
    args: [`--remote-debugging-port=${port}`, `--user-data-dir=${userDataDir}`],
    env: {
      WRITESTORM_E2E_LIBRARY_DIALOG_STUB: '1',
      WRITESTORM_E2E_LIBRARY_ROOT: libraryRoot,
      WRITESTORM_E2E_LIBRARY_NAME: 'TypeLibrary E2E Library',
      WRITESTORM_E2E_IMPORT_DIALOG_STUB: '1',
      ...(typeof sourcePath === 'string'
        ? { WRITESTORM_E2E_IMPORT_SOURCE_PATH: sourcePath }
        : { WRITESTORM_E2E_IMPORT_SOURCE_PATHS: JSON.stringify(sourcePath) }),
    },
  });
  let appExit: PackagedAppExit | undefined;
  appProcess.stderr?.on('data', (chunk: Buffer) => electronStderr.push(chunk));
  appProcess.once('exit', (code, signal) => { appExit = { code, signal }; });

  let browser: Awaited<ReturnType<typeof connectToPackagedElectron>> | undefined;
  try {
    browser = await connectToPackagedElectron(port, () => appExit);
    const context = browser.contexts()[0];
    const page = context.pages()[0] ?? await context.waitForEvent('page');
    await page.getByRole('button', {
      name: libraryAction === 'create' ? 'Create library' : 'Open library',
    }).click();
    await expect(page.getByRole('heading', { name: 'Breakdown shelf' })).toBeVisible();
    await run(page);
  } catch (error) {
    throw formatErrorWithElectronStderr(error, electronStderr.summary());
  } finally {
    await browser?.close().catch(() => undefined);
    stopPackagedApp(appProcess);
  }
}

function classificationEditor(page: Page, idPrefix: string): Locator {
  return page.locator('.type-library-editor').filter({
    has: page.locator(`#${idPrefix}-title`),
  });
}

async function expectOptionsReady(editor: Locator): Promise<void> {
  await expect(editor.getByLabel('Main type').locator('option')).toHaveCount(8);
  await expect(editor.getByLabel('Content focus priority 1').locator('option')).toHaveCount(8);
}

async function setClassification(
  page: Page,
  idPrefix: string,
  mainTypeVersionId: string,
  focusVersionIds: readonly string[],
): Promise<void> {
  for (let priority = 3; priority >= 1; priority -= 1) {
    const selector = page.locator(`#${idPrefix}-focus-${priority}`);
    await selector.selectOption('');
    await expect(selector).toHaveValue('');
  }
  const mainType = page.locator(`#${idPrefix}-main-type`);
  await mainType.selectOption(mainTypeVersionId);
  await expect(mainType).toHaveValue(mainTypeVersionId);
  for (const [index, versionId] of focusVersionIds.entries()) {
    const selector = page.locator(`#${idPrefix}-focus-${index + 1}`);
    await selector.selectOption(versionId);
    await expect(selector).toHaveValue(versionId);
  }
}

function bookListItem(page: Page, title: string): Locator {
  return page.locator('.book-list li').filter({
    has: page.locator('strong', { hasText: title }),
  });
}

function readPersistedBindings(libraryRoot: string): Array<{
  readonly title: string;
  readonly mainTypeDefinitionVersionId: string | null;
  readonly focusCount: number;
}> {
  const database = new Database(path.join(libraryRoot, 'writestorm.sqlite'), {
    readonly: true,
    fileMustExist: true,
  });
  try {
    return database.prepare(`
      SELECT
        books.title AS title,
        binding.main_type_definition_version_id AS mainTypeDefinitionVersionId,
        COUNT(focus.priority) AS focusCount
      FROM books
      LEFT JOIN book_type_bindings AS binding ON binding.book_id = books.id
      LEFT JOIN book_content_focus_bindings AS focus ON focus.book_id = books.id
      GROUP BY books.id, books.title, binding.main_type_definition_version_id
      ORDER BY books.title ASC
    `).all() as Array<{
      title: string;
      mainTypeDefinitionVersionId: string | null;
      focusCount: number;
    }>;
  } finally {
    database.close();
  }
}

function archiveDefinitions(libraryRoot: string, definitionIds: readonly string[]): void {
  const database = new Database(path.join(libraryRoot, 'writestorm.sqlite'));
  try {
    const archive = database.prepare(`
      UPDATE type_definitions SET archived_at = ? WHERE id = ?
    `);
    const archiveAll = database.transaction(() => {
      definitionIds.forEach((definitionId) => {
        archive.run('2026-07-18T13:00:00.000Z', definitionId);
      });
    });
    archiveAll();
  } finally {
    database.close();
  }
}
