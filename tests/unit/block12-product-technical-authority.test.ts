import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const product = readFileSync('docs/product/write-storm-product-design.md', 'utf8');
const technical = readFileSync('docs/engineering/TECHNICAL_DESIGN.md', 'utf8');
const context = readFileSync('docs/engineering/CONTEXT.md', 'utf8');
const decisions = readFileSync('docs/engineering/DECISIONS.md', 'utf8');
const status = readFileSync('docs/engineering/V1-BLOCK-12-STATUS.md', 'utf8');

describe('Block 12 product and technical authority', () => {
  it('publishes the approved seven MainType and seven ContentFocus choices', () => {
    for (const displayName of [
      '日轻校园', '日轻异界', '现代都市', '现代幻想',
      '古代幻想', '西式幻想', '诸天无限',
    ]) {
      expect(product).toContain(`- **${displayName}**`);
    }
    for (const displayName of [
      '恋爱炒股', '英雄史诗', '能力规则', '种田运营',
      '群像', '事业', '冒险探索',
    ]) {
      expect(product).toContain(`- **${displayName}**`);
    }
    expect(product).not.toMatch(/^- 异世界。$/m);
    expect(product).not.toContain('用户选择主类型和子类型');
    expect(product).toContain('一个 MainType');
    expect(product).toContain('零至三个有序 ContentFocus');
    expect(product).toContain('应用不自动分析或归类');
  });

  it('separates the current Technique shell from a future admitted lifecycle', () => {
    expect(product).toContain('Block 12 当前交付边界');
    expect(product).toContain('candidate owner 与原子采纳事务尚未准入');
    expect(product).toContain('TechniqueEntry 持久化仍 blocked/deferred');
    expect(product).not.toContain('融合技法库：V1 半可用');
    expect(product).not.toContain('v1_status: half_usable');
    expect(technical).toContain('Technique production tables remain unadmitted');
    expect(technical).not.toMatch(/\| `technique_entries` \|/);
    expect(technical).not.toMatch(/\| `source_snapshots` \|/);
  });

  it('keeps Prompt lifecycle concepts on independent axes', () => {
    expect(product).toContain('sampleGateStatus');
    expect(product).toContain('publishedAt');
    expect(product).toContain('activationStatus');
    expect(product).toContain('回滚是操作，不是版本状态');
    expect(product).not.toContain(
      '`draft -> sample_passed -> published_version -> enabled -> disabled | rolled_back`',
    );
  });

  it('records the actually admitted schema instead of a speculative minimum', () => {
    for (const table of [
      'library', 'books', 'source_texts', 'jobs', 'job_checkpoints',
      'structure_detection_runs', 'structure_sets', 'structure_nodes',
      'story_segment_ranges', 'story_segment_range_chapters',
      'analysis_modules', 'analysis_module_instances', 'type_definitions',
      'type_definition_versions', 'type_library_versions',
      'type_library_version_entries', 'book_type_bindings',
      'book_content_focus_bindings',
    ]) {
      expect(technical).toContain(`| \`${table}\` |`);
    }
  });

  it('records one active authority override without editing the protected master plan', () => {
    for (const authority of [context, decisions, status]) {
      expect(authority).toContain('D072');
      expect(authority).toContain('protected master plan');
      expect(authority).toContain('seven MainType and seven ContentFocus');
      expect(authority).toContain('independent axes');
      expect(authority).toContain('Technique production tables remain unadmitted');
    }
  });
});
