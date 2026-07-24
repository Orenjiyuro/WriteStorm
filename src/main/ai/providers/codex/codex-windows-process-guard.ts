import { execFileSync } from 'node:child_process';
import path from 'node:path';

type ProcessSnapshot = {
  readonly pid: number;
  readonly parentPid: number;
  readonly executablePath: string;
  readonly startedAt: number;
};

type ProcessIdentity = ProcessSnapshot;

export class CodexWindowsProcessGuard {
  private utilityPid: number | undefined;
  private utility: ProcessIdentity | undefined;
  private cli: ProcessIdentity | undefined;
  private observation: Promise<void> = Promise.resolve();

  constructor(private readonly input: {
    readonly utilityExecutablePath: string;
    readonly cliExecutablePath: string;
    readonly observationStartedAt: number;
    readonly readSnapshots?: () => readonly ProcessSnapshot[];
    readonly observeAttempts?: number;
    readonly observeIntervalMs?: number;
    readonly residualDelayMs?: number;
  }) {}

  bindUtility(pid: number): void {
    if (this.utilityPid !== undefined) return;
    this.utilityPid = pid;
    this.observation = this.observeOwnership();
  }

  isUtilityOwnedAndRunning(): boolean {
    try {
      const snapshots = this.readSnapshots();
      this.tryBindUtility(snapshots);
      return Boolean(this.utility && containsIdentity(snapshots, this.utility));
    } catch {
      return false;
    }
  }

  hasObservedOwnership(): boolean {
    return Boolean(this.utility && this.cli);
  }

  async scanResiduals(): Promise<{
    readonly residualScanCompleted: boolean;
    readonly utilityResidualAbsent: boolean;
    readonly cliResidualAbsent: boolean;
  }> {
    await this.observation;
    await delay(this.input.residualDelayMs ?? 500);
    if (!this.utility || !this.cli) return failedResiduals();
    try {
      const snapshots = this.readSnapshots();
      return {
        residualScanCompleted: true,
        utilityResidualAbsent: !containsIdentity(snapshots, this.utility),
        cliResidualAbsent: !containsIdentity(snapshots, this.cli),
      };
    } catch {
      return failedResiduals();
    }
  }

  private async observeOwnership(): Promise<void> {
    const attempts = this.input.observeAttempts ?? 50;
    for (let attempt = 0; attempt < attempts && !this.cli; attempt += 1) {
      try {
        const snapshots = this.readSnapshots();
        this.tryBindUtility(snapshots);
        if (this.utility && containsIdentity(snapshots, this.utility)) {
          const matches = snapshots.filter((candidate) => (
            candidate.startedAt >= this.utility!.startedAt
            && pathsEqual(candidate.executablePath, this.input.cliExecutablePath)
            && isDescendantOf(candidate, this.utility!, snapshots)
          ));
          if (matches.length === 1) this.cli = matches[0];
        }
      } catch {
        return;
      }
      if (!this.cli) await delay(this.input.observeIntervalMs ?? 100);
    }
  }

  private tryBindUtility(snapshots: readonly ProcessSnapshot[]): void {
    if (this.utility || this.utilityPid === undefined) return;
    const matches = snapshots.filter((snapshot) => (
      snapshot.pid === this.utilityPid
      && snapshot.startedAt >= this.input.observationStartedAt
      && pathsEqual(snapshot.executablePath, this.input.utilityExecutablePath)
    ));
    if (matches.length === 1) this.utility = matches[0];
  }

  private readSnapshots(): readonly ProcessSnapshot[] {
    return (this.input.readSnapshots ?? readWindowsProcessSnapshots)();
  }
}

function isDescendantOf(
  candidate: ProcessSnapshot,
  root: ProcessSnapshot,
  snapshots: readonly ProcessSnapshot[],
): boolean {
  const byPid = new Map<number, ProcessSnapshot[]>();
  for (const snapshot of snapshots) {
    const bucket = byPid.get(snapshot.pid) ?? [];
    bucket.push(snapshot);
    byPid.set(snapshot.pid, bucket);
  }
  let child = candidate;
  const seen = new Set<number>([candidate.pid]);
  while (child.parentPid > 0 && !seen.has(child.parentPid)) {
    const parents = byPid.get(child.parentPid);
    if (!parents || parents.length !== 1) return false;
    const parent = parents[0]!;
    if (child.startedAt < parent.startedAt) return false;
    if (sameIdentity(parent, root)) return true;
    seen.add(parent.pid);
    child = parent;
  }
  return false;
}

function readWindowsProcessSnapshots(): readonly ProcessSnapshot[] {
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
  const candidates = Array.isArray(parsed) ? parsed : [parsed];
  return candidates.filter(isProcessSnapshot);
}

function isProcessSnapshot(value: unknown): value is ProcessSnapshot {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  return Number.isInteger(record.pid)
    && Number.isInteger(record.parentPid)
    && typeof record.executablePath === 'string'
    && record.executablePath.length > 0
    && typeof record.startedAt === 'number'
    && Number.isFinite(record.startedAt)
    && record.startedAt > 0;
}

function containsIdentity(
  snapshots: readonly ProcessSnapshot[],
  identity: ProcessIdentity,
): boolean {
  return snapshots.some((snapshot) => sameIdentity(snapshot, identity));
}

function sameIdentity(left: ProcessIdentity, right: ProcessIdentity): boolean {
  return left.pid === right.pid
    && left.parentPid === right.parentPid
    && left.startedAt === right.startedAt
    && pathsEqual(left.executablePath, right.executablePath);
}

function pathsEqual(left: string, right: string): boolean {
  return path.resolve(left).toLowerCase() === path.resolve(right).toLowerCase();
}

function failedResiduals(): {
  readonly residualScanCompleted: false;
  readonly utilityResidualAbsent: false;
  readonly cliResidualAbsent: false;
} {
  return {
    residualScanCompleted: false,
    utilityResidualAbsent: false,
    cliResidualAbsent: false,
  };
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
