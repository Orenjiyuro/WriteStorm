import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('renderer breakdown query route gate', () => {
  it('disables every breakdown-only query outside the breakdown route', () => {
    const source = readFileSync('src/renderer/app/AppRouter.tsx', 'utf8');

    expect(source).toMatch(
      /const breakdownQueriesEnabled =\s*route === 'breakdown' && rendererApi !== null && currentLibrary !== null;/,
    );
    expect(sourceBlock(source, 'const booksQuery', 'const importMutation'))
      .toContain('enabled: breakdownQueriesEnabled');
    expect(sourceBlock(source, 'const jobsQuery', 'const [selectedJobId'))
      .toContain('enabled: breakdownQueriesEnabled');
    expect(sourceBlock(source, 'const jobDetailQuery', 'const cancelJobMutation'))
      .toContain('enabled: breakdownQueriesEnabled && selectedJobId !== null');
    expect(sourceBlock(source, 'const structureWorkspaceQuery', 'const structureActionMutation'))
      .toContain('enabled: breakdownQueriesEnabled && openedBook !== null');
    expect(sourceBlock(source, 'const moduleInstancesQuery', 'const exportStatusQuery'))
      .toContain('enabled: breakdownQueriesEnabled && openedBook !== null');
    expect(sourceBlock(source, 'const exportStatusQuery', '  useEffect(() => {'))
      .toContain('enabled: breakdownQueriesEnabled && openedBook !== null');
  });
});

function sourceBlock(source: string, startMarker: string, endMarker: string): string {
  const start = source.indexOf(startMarker);
  const end = source.indexOf(endMarker, start);

  expect(start).toBeGreaterThanOrEqual(0);
  expect(end).toBeGreaterThan(start);

  return source.slice(start, end);
}
