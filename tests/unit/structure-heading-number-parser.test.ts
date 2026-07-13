import { describe, expect, it } from 'vitest';
import { parseStructureHeadingNumber } from '../../src/main/structure/detection/structure-heading-number-parser';

describe('structure heading number parser', () => {
  it('parses Arabic, Roman and basic Chinese heading numbers without classifying titles', () => {
    expect(parseStructureHeadingNumber('12')).toBe(12);
    expect(parseStructureHeadingNumber('xiv')).toBe(14);
    expect(parseStructureHeadingNumber('二十三')).toBe(23);
    expect(parseStructureHeadingNumber('unknown')).toBeNull();
  });
});
