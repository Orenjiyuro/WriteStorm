import { execFileSync } from 'node:child_process';
import path from 'node:path';
import type { CodexLifecycleTrigger } from './protocol';

export type WindowsProcessSnapshot = {
  readonly pid: number;
  readonly parentPid: number;
  readonly executablePath: string;
  readonly startedAt: number;
};

export class WindowsProcessObserverError extends Error {
  readonly code = 'WINDOWS_PROCESS_OBSERVER_FAILED' as const;

  constructor() {
    super('Windows process observer failed.');
    this.name = 'WindowsProcessObserverError';
  }
}

export function createIdempotentLifecycleTrigger<T>(
  execute: (trigger: CodexLifecycleTrigger) => Promise<T>,
): {
  request(trigger: CodexLifecycleTrigger): Promise<T>;
  snapshot(): {
    readonly initialTrigger: CodexLifecycleTrigger | null;
    readonly requestCount: number;
    readonly executionCount: number;
  };
} {
  let initialTrigger: CodexLifecycleTrigger | null = null;
  let requestCount = 0;
  let executionCount = 0;
  let execution: Promise<T> | undefined;
  return {
    request(trigger) {
      requestCount += 1;
      if (!execution) {
        initialTrigger = trigger;
        executionCount += 1;
        execution = execute(trigger);
      }
      return execution;
    },
    snapshot: () => ({ initialTrigger, requestCount, executionCount }),
  };
}

export function findProcessByPidAndPath(
  snapshots: readonly WindowsProcessSnapshot[],
  pid: number,
  expectedExecutablePath: string,
): WindowsProcessSnapshot | undefined {
  return snapshots.find((snapshot) => (
    snapshot.pid === pid && pathsEqual(snapshot.executablePath, expectedExecutablePath)
  ));
}

export function findAttributedProcess(
  snapshots: readonly WindowsProcessSnapshot[],
  root: WindowsProcessSnapshot,
  expectedExecutablePath: string,
): WindowsProcessSnapshot | undefined {
  const byPid = new Map(snapshots.map((snapshot) => [snapshot.pid, snapshot]));
  return snapshots
    .filter((snapshot) => (
      snapshot.startedAt >= root.startedAt
      && pathsEqual(snapshot.executablePath, expectedExecutablePath)
      && isDescendant(snapshot, root.pid, byPid)
    ))
    .sort((left, right) => left.startedAt - right.startedAt)[0];
}

export function isSameProcessIdentityPresent(
  snapshots: readonly WindowsProcessSnapshot[],
  identity: WindowsProcessSnapshot,
): boolean {
  return snapshots.some((snapshot) => (
    snapshot.pid === identity.pid
    && snapshot.parentPid === identity.parentPid
    && snapshot.startedAt === identity.startedAt
    && pathsEqual(snapshot.executablePath, identity.executablePath)
  ));
}

export function readWindowsProcessSnapshots(): WindowsProcessSnapshot[] {
  const script = [
    '$items = Get-CimInstance Win32_Process | ForEach-Object {',
    '  [pscustomobject]@{',
    '    pid = [int]$_.ProcessId',
    '    parentPid = [int]$_.ParentProcessId',
    '    executablePath = [string]$_.ExecutablePath',
    '    startedAt = if ($_.CreationDate) { ([DateTimeOffset]$_.CreationDate).ToUnixTimeMilliseconds() } else { 0 }',
    '  }',
    '}',
    '$items | ConvertTo-Json -Compress',
  ].join('\n');
  try {
    const output = execFileSync('powershell.exe', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      script,
    ], {
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    });
    const parsed = JSON.parse(output) as unknown;
    const items = Array.isArray(parsed) ? parsed : [parsed];
    return items.filter(isWindowsProcessSnapshot);
  } catch {
    throw new WindowsProcessObserverError();
  }
}

function isDescendant(
  candidate: WindowsProcessSnapshot,
  rootPid: number,
  byPid: ReadonlyMap<number, WindowsProcessSnapshot>,
): boolean {
  const seen = new Set<number>();
  let parentPid = candidate.parentPid;
  while (parentPid > 0 && !seen.has(parentPid)) {
    if (parentPid === rootPid) return true;
    seen.add(parentPid);
    parentPid = byPid.get(parentPid)?.parentPid ?? 0;
  }
  return false;
}

function pathsEqual(left: string, right: string): boolean {
  const normalizedLeft = path.resolve(left);
  const normalizedRight = path.resolve(right);
  return process.platform === 'win32'
    ? normalizedLeft.toLowerCase() === normalizedRight.toLowerCase()
    : normalizedLeft === normalizedRight;
}

function isWindowsProcessSnapshot(value: unknown): value is WindowsProcessSnapshot {
  if (typeof value !== 'object' || value === null) return false;
  const record = value as Record<string, unknown>;
  return Number.isInteger(record.pid)
    && Number.isInteger(record.parentPid)
    && typeof record.executablePath === 'string'
    && record.executablePath.length > 0
    && typeof record.startedAt === 'number'
    && Number.isFinite(record.startedAt)
    && record.startedAt > 0;
}
