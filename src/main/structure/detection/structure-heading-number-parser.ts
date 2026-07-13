export function parseStructureHeadingNumber(value: string): number | null {
  if (/^\d+$/.test(value)) {
    return Number(value);
  }

  const roman = parseRomanNumber(value);

  if (roman !== null) {
    return roman;
  }

  return parseBasicChineseNumber(value);
}

function parseRomanNumber(value: string): number | null {
  if (!/^[ivxlcdm]+$/i.test(value)) {
    return null;
  }

  const values: Record<string, number> = {
    I: 1,
    V: 5,
    X: 10,
    L: 50,
    C: 100,
    D: 500,
    M: 1000,
  };
  const normalized = value.toUpperCase();
  let total = 0;

  for (let index = 0; index < normalized.length; index += 1) {
    const current = values[normalized[index]];
    const next = values[normalized[index + 1]] ?? 0;
    total += current < next ? -current : current;
  }

  return total;
}

function parseBasicChineseNumber(value: string): number | null {
  const digits: Record<string, number> = {
    〇: 0,
    零: 0,
    一: 1,
    二: 2,
    三: 3,
    四: 4,
    五: 5,
    六: 6,
    七: 7,
    八: 8,
    九: 9,
  };

  if (value.length === 1 && digits[value] !== undefined) {
    return digits[value];
  }

  if (value === '十') {
    return 10;
  }

  const ten = value.match(/^([一二三四五六七八九])?十([一二三四五六七八九])?$/u);

  if (!ten) {
    return null;
  }

  return (digits[ten[1] ?? '一'] * 10) + (ten[2] ? digits[ten[2]] : 0);
}
