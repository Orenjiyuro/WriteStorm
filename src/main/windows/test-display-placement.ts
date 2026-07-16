export const TEST_DISPLAY_TARGET_ENV = 'WRITESTORM_E2E_DISPLAY_TARGET';
export const TEST_DISPLAY_DIAGNOSTIC_PREFIX = 'WRITESTORM_E2E_DISPLAY ';
export const TEST_DISPLAY_FAILURE_EXIT_CODE = 86;

export type TestDisplayTarget = 'secondary';

export type DisplayRectangle = {
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
};

export type DisplaySnapshot = {
  readonly id: number;
  readonly bounds: DisplayRectangle;
  readonly workArea: DisplayRectangle;
  readonly scaleFactor: number;
};

export type SecondaryDisplayPlacement = {
  readonly primaryDisplay: DisplaySnapshot;
  readonly targetDisplay: DisplaySnapshot;
  readonly windowBounds: DisplayRectangle;
};

export type TestDisplayPlacementErrorCode =
  | 'INVALID_TEST_DISPLAY_TARGET'
  | 'NO_SECONDARY_DISPLAY'
  | 'INVALID_SECONDARY_WORK_AREA'
  | 'WINDOW_NOT_ON_TARGET_DISPLAY'
  | 'WINDOW_OUTSIDE_TARGET_WORK_AREA'
  | 'TARGET_DISPLAY_REMOVED'
  | 'TEST_DISPLAY_STARTUP_FAILED';

export class TestDisplayPlacementError extends Error {
  constructor(
    readonly code: TestDisplayPlacementErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'TestDisplayPlacementError';
  }
}

const defaultWindowSize = { width: 1100, height: 760 } as const;

export function resolveTestDisplayTarget(
  env: Readonly<Record<string, string | undefined>>,
): TestDisplayTarget | null {
  const value = env[TEST_DISPLAY_TARGET_ENV];

  if (value === undefined) {
    return null;
  }

  if (value === 'secondary') {
    return value;
  }

  throw new TestDisplayPlacementError(
    'INVALID_TEST_DISPLAY_TARGET',
    `${TEST_DISPLAY_TARGET_ENV} must be exactly "secondary" when set; received ${JSON.stringify(value)}.`,
  );
}

export function selectSecondaryDisplayPlacement(
  displays: readonly DisplaySnapshot[],
  primaryDisplay: DisplaySnapshot,
): SecondaryDisplayPlacement {
  const secondaryDisplays = displays.filter((display) => display.id !== primaryDisplay.id);

  if (secondaryDisplays.length === 0) {
    throw new TestDisplayPlacementError(
      'NO_SECONDARY_DISPLAY',
      'Secondary-display test mode requires a non-primary display.',
    );
  }

  const usableDisplays = secondaryDisplays.filter((display) => isUsableWorkArea(display.workArea));

  if (usableDisplays.length === 0) {
    throw new TestDisplayPlacementError(
      'INVALID_SECONDARY_WORK_AREA',
      'Secondary-display test mode found no non-primary display with a finite, positive work area.',
    );
  }

  const targetDisplay = [...usableDisplays].sort(compareDisplayPreference)[0];
  const width = Math.min(defaultWindowSize.width, Math.floor(targetDisplay.workArea.width));
  const height = Math.min(defaultWindowSize.height, Math.floor(targetDisplay.workArea.height));
  const x = targetDisplay.workArea.x + Math.floor((targetDisplay.workArea.width - width) / 2);
  const y = targetDisplay.workArea.y + Math.floor((targetDisplay.workArea.height - height) / 2);

  return {
    primaryDisplay,
    targetDisplay,
    windowBounds: { x, y, width, height },
  };
}

export function containsRectangle(container: DisplayRectangle, candidate: DisplayRectangle): boolean {
  return (
    candidate.width > 0 &&
    candidate.height > 0 &&
    candidate.x >= container.x &&
    candidate.y >= container.y &&
    candidate.x + candidate.width <= container.x + container.width &&
    candidate.y + candidate.height <= container.y + container.height
  );
}

export function assertActualWindowPlacement(
  placement: SecondaryDisplayPlacement,
  actualWindowBounds: DisplayRectangle,
  centerDisplayId: number,
): void {
  if (centerDisplayId !== placement.targetDisplay.id) {
    throw new TestDisplayPlacementError(
      'WINDOW_NOT_ON_TARGET_DISPLAY',
      `Window center resolved to display ${centerDisplayId}, expected ${placement.targetDisplay.id}.`,
    );
  }

  if (!containsRectangle(placement.targetDisplay.workArea, actualWindowBounds)) {
    throw new TestDisplayPlacementError(
      'WINDOW_OUTSIDE_TARGET_WORK_AREA',
      `Actual window bounds ${JSON.stringify(actualWindowBounds)} are not contained by target work area ${JSON.stringify(placement.targetDisplay.workArea)}.`,
    );
  }
}

function isUsableWorkArea(workArea: DisplayRectangle): boolean {
  return (
    Number.isFinite(workArea.x) &&
    Number.isFinite(workArea.y) &&
    Number.isFinite(workArea.width) &&
    Number.isFinite(workArea.height) &&
    workArea.width >= 1 &&
    workArea.height >= 1
  );
}

function compareDisplayPreference(left: DisplaySnapshot, right: DisplaySnapshot): number {
  const leftFitsDefault = fitsDefaultWindow(left.workArea);
  const rightFitsDefault = fitsDefaultWindow(right.workArea);

  if (leftFitsDefault !== rightFitsDefault) {
    return leftFitsDefault ? -1 : 1;
  }

  const areaDifference = rectangleArea(right.workArea) - rectangleArea(left.workArea);
  if (areaDifference !== 0) return areaDifference;
  if (left.workArea.y !== right.workArea.y) return left.workArea.y - right.workArea.y;
  if (left.workArea.x !== right.workArea.x) return left.workArea.x - right.workArea.x;
  return left.id - right.id;
}

function fitsDefaultWindow(workArea: DisplayRectangle): boolean {
  return workArea.width >= defaultWindowSize.width && workArea.height >= defaultWindowSize.height;
}

function rectangleArea(rectangle: DisplayRectangle): number {
  return rectangle.width * rectangle.height;
}
