export type CodexFeasibilityAuthMode = 'current' | 'isolated-empty';

const ISOLATED_AUTH_TURN_DEADLINE_MS = 15_000;
const CURRENT_AUTH_TURN_DEADLINE_MS = 90_000;

export const CODEX_FEASIBILITY_SESSION_TIMEOUT_MS = 110_000;

export function resolveCodexFeasibilityTurnDeadlineMs(
  authMode: CodexFeasibilityAuthMode,
): number {
  return authMode === 'isolated-empty'
    ? ISOLATED_AUTH_TURN_DEADLINE_MS
    : CURRENT_AUTH_TURN_DEADLINE_MS;
}

export async function settleCodexTurnWithinDeadline<T>(
  controller: AbortController,
  turn: Promise<T>,
  deadlineMs: number,
): Promise<T> {
  if (!Number.isFinite(deadlineMs) || deadlineMs <= 0) {
    throw new TypeError('Codex feasibility turn deadline must be positive and finite');
  }

  const deadline = setTimeout(() => controller.abort(), deadlineMs);
  try {
    return await turn;
  } finally {
    clearTimeout(deadline);
  }
}
