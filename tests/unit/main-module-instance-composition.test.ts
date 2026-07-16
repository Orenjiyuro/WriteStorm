import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

describe('main module instance composition', () => {
  it('wires runtime shell creation through the structure edition transaction seam', () => {
    const source = readFileSync('src/main/main.ts', 'utf8');

    expect(source).toContain('new AnalysisModuleInstanceEditionChangePort(');
    expect(source).toContain('structureEditionChangePort: moduleInstanceEditionChangePort');
  });

  it('wires the read service only to modules:list-instances product IPC', () => {
    const source = readFileSync('src/main/main.ts', 'utf8');

    expect(source).toContain('new AnalysisModuleInstanceService({ libraryService })');
    expect(source).toContain('modules: createAnalysisModuleInstanceIpcDependencies(moduleInstanceService)');
    expect(source).not.toContain('modules:update-body');
  });
});
