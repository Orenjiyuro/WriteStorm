export type StructurePerformanceFixture = {
  readonly name: string;
  readonly format: 'txt' | 'md';
  readonly sizeBytes: number;
};

const KIB = 1024;
const MIB = 1024 * KIB;

export const STRUCTURE_PERFORMANCE_FIXTURES = [
  { name: '50kb-txt', format: 'txt', sizeBytes: 50 * KIB },
  { name: '50kb-md', format: 'md', sizeBytes: 50 * KIB },
  { name: '1mb-txt', format: 'txt', sizeBytes: MIB },
  { name: '1mb-md', format: 'md', sizeBytes: MIB },
  { name: '5mb-txt', format: 'txt', sizeBytes: 5 * MIB },
  { name: '5mb-md', format: 'md', sizeBytes: 5 * MIB },
] as const satisfies readonly StructurePerformanceFixture[];

export function generateStructurePerformanceFixture(
  fixture: StructurePerformanceFixture,
): string {
  const heading = fixture.format === 'md' ? '# ' : '';
  const prefix = [
    `${heading}Chapter 1: Start`,
    'Narrative body for the opening chapter.',
    `${heading}Chapter 2: Continue`,
    'Narrative body for the middle chapter.',
    '',
    '---',
    '',
    `${heading}Chapter 3: Aftermath`,
    'Narrative body for the closing chapter.',
    '',
  ].join('\n');
  if (Buffer.byteLength(prefix, 'utf8') > fixture.sizeBytes) {
    throw new Error(`Structure performance fixture ${fixture.name} is smaller than its heading prefix.`);
  }

  const remainingBytes = fixture.sizeBytes - Buffer.byteLength(prefix, 'utf8');
  const fillerLine = 'Deterministic narrative body line for structure performance recording.\n';
  const filler = fillerLine.repeat(Math.ceil(remainingBytes / fillerLine.length)).slice(0, remainingBytes);
  return prefix + filler;
}
