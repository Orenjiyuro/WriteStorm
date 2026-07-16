import { describe, expect, it } from 'vitest';
import {
  TEST_DISPLAY_TARGET_ENV,
  assertActualWindowPlacement,
  resolveTestDisplayTarget,
  selectSecondaryDisplayPlacement,
} from '../../src/main/windows/test-display-placement';

const primary = display(1, { x: 0, y: 0, width: 1920, height: 1040 }, 1.25);

describe('test display target contract', () => {
  it('is disabled only when the test variable is absent', () => {
    expect(resolveTestDisplayTarget({})).toBeNull();
    expect(resolveTestDisplayTarget({ [TEST_DISPLAY_TARGET_ENV]: 'secondary' })).toBe('secondary');
  });

  it('rejects misspelled and empty target values instead of silently using product startup', () => {
    for (const value of ['', 'primary', 'Secondary']) {
      expect(() => resolveTestDisplayTarget({ [TEST_DISPLAY_TARGET_ENV]: value })).toThrowError(
        expect.objectContaining({ code: 'INVALID_TEST_DISPLAY_TARGET' }),
      );
    }
  });
});

describe('secondary display placement', () => {
  it('centers the window on a display left of primary without rejecting negative coordinates', () => {
    const secondary = display(2, { x: -1600, y: 0, width: 1600, height: 900 }, 1);

    expect(selectSecondaryDisplayPlacement([primary, secondary], primary)).toEqual({
      primaryDisplay: primary,
      targetDisplay: secondary,
      windowBounds: { x: -1350, y: 70, width: 1100, height: 760 },
    });
  });

  it('supports a secondary display stacked above primary', () => {
    const secondary = display(2, { x: 120, y: -900, width: 1440, height: 900 }, 1);

    expect(selectSecondaryDisplayPlacement([secondary, primary], primary).windowBounds).toEqual({
      x: 290,
      y: -830,
      width: 1100,
      height: 760,
    });
  });

  it('clamps the default window size to a smaller work area', () => {
    const secondary = display(2, { x: 1920, y: 100, width: 900, height: 700 }, 1.5);

    expect(selectSecondaryDisplayPlacement([primary, secondary], primary).windowBounds).toEqual({
      x: 1920,
      y: 100,
      width: 900,
      height: 700,
    });
  });

  it('uses DIP work-area coordinates unchanged across scale factors', () => {
    const workArea = { x: -1280, y: 40, width: 1280, height: 720 };
    const at100 = display(2, workArea, 1);
    const at200 = display(3, workArea, 2);

    expect(selectSecondaryDisplayPlacement([primary, at100], primary).windowBounds).toEqual(
      selectSecondaryDisplayPlacement([primary, at200], primary).windowBounds,
    );
  });

  it('selects deterministically across multiple secondary displays', () => {
    const tooSmall = display(2, { x: -800, y: 0, width: 800, height: 600 }, 1);
    const fittingLowerArea = display(3, { x: 0, y: -900, width: 1440, height: 900 }, 1);
    const fittingHigherArea = display(4, { x: 1920, y: 0, width: 1920, height: 1080 }, 1.5);

    const result = selectSecondaryDisplayPlacement(
      [tooSmall, fittingLowerArea, primary, fittingHigherArea],
      primary,
    );

    expect(result.targetDisplay.id).toBe(4);
  });

  it('uses geometry and display id as stable tie breakers', () => {
    const right = display(8, { x: 1920, y: 0, width: 1280, height: 800 }, 1);
    const above = display(7, { x: 0, y: -800, width: 1280, height: 800 }, 1);

    expect(selectSecondaryDisplayPlacement([right, primary, above], primary).targetDisplay.id).toBe(7);
  });

  it('fails fast with a single display', () => {
    expect(() => selectSecondaryDisplayPlacement([primary], primary)).toThrowError(
      expect.objectContaining({ code: 'NO_SECONDARY_DISPLAY' }),
    );
  });

  it('fails when every secondary work area is unusable', () => {
    const invalid = display(2, { x: 1920, y: 0, width: 0, height: 900 }, 1);

    expect(() => selectSecondaryDisplayPlacement([primary, invalid], primary)).toThrowError(
      expect.objectContaining({ code: 'INVALID_SECONDARY_WORK_AREA' }),
    );
  });

  it('accepts actual bounds only when fully contained and centered on the target display', () => {
    const secondary = display(2, { x: -1600, y: 0, width: 1600, height: 900 }, 1);
    const placement = selectSecondaryDisplayPlacement([primary, secondary], primary);

    expect(() => assertActualWindowPlacement(placement, placement.windowBounds, 2)).not.toThrow();
  });

  it('rejects an OS relocation to primary before the hidden window can be shown', () => {
    const secondary = display(2, { x: -1600, y: 0, width: 1600, height: 900 }, 1);
    const placement = selectSecondaryDisplayPlacement([primary, secondary], primary);

    expect(() =>
      assertActualWindowPlacement(placement, { x: 100, y: 100, width: 1100, height: 760 }, 1),
    ).toThrowError(expect.objectContaining({ code: 'WINDOW_NOT_ON_TARGET_DISPLAY' }));
  });

  it('rejects actual bounds extending outside the target work area', () => {
    const secondary = display(2, { x: 1920, y: 0, width: 1280, height: 800 }, 1);
    const placement = selectSecondaryDisplayPlacement([primary, secondary], primary);

    expect(() =>
      assertActualWindowPlacement(placement, { x: 1900, y: 0, width: 1100, height: 760 }, 2),
    ).toThrowError(expect.objectContaining({ code: 'WINDOW_OUTSIDE_TARGET_WORK_AREA' }));
  });
});

function display(
  id: number,
  workArea: { x: number; y: number; width: number; height: number },
  scaleFactor: number,
) {
  return {
    id,
    bounds: { ...workArea },
    workArea,
    scaleFactor,
  };
}
