import { execFileSync } from 'node:child_process';
import path from 'node:path';
import type { CodexLifecycleTrigger } from './protocol';

export type WindowsProcessSnapshot = {
  readonly pid: number;
  readonly parentPid: number;
  readonly executablePath: string;
  readonly startedAt: number;
};

export type WindowsOwnedProcessTrackerOptions = {
  readonly utilityPid: number;
  readonly utilityExecutablePath: string;
  readonly cliExecutablePath: string;
  readonly observationStartedAt: number;
};

export type WindowsOwnedProcessEvidenceAssertions = {
  readonly utilityIdentityBound: boolean;
  readonly cliIdentityBound: boolean;
  readonly pidCreationTimeExecutablePathBound: boolean;
  readonly observedParentRelationshipBound: boolean;
  readonly ownershipFrozenForSession: boolean;
};

export type WindowsOwnedProcessResidualAssertions = {
  readonly utilityResidualAbsent: boolean;
  readonly cliResidualAbsent: boolean;
};

export type WindowsOwnedProcessGuardOptions = {
  readonly utilityExecutablePath: string;
  readonly cliExecutablePath: string;
  readonly observationStartedAt: number;
  readonly observationAttempts?: number;
  readonly observationIntervalMs?: number;
  readonly residualDelayMs?: number;
  readonly readSnapshots?: () => WindowsProcessSnapshot[];
};

type WindowsObservedProcessRelationship = {
  readonly target: WindowsProcessSnapshot;
  readonly parentChain: readonly WindowsProcessSnapshot[];
};

export class WindowsProcessObserverError extends Error {
  readonly code = 'WINDOWS_PROCESS_OBSERVER_FAILED' as const;

  constructor() {
    super('Windows process observer failed.');
    this.name = 'WindowsProcessObserverError';
  }
}

/**
 * Binds process ownership to one feasibility session. Identities are retained
 * only in memory and are never exposed through the persisted evidence shape.
 */
export class WindowsOwnedProcessTracker {
  private utilityIdentity: WindowsProcessSnapshot | undefined;
  private cliIdentity: WindowsProcessSnapshot | undefined;
  private observedParentChain: readonly WindowsProcessSnapshot[] | undefined;

  constructor(private readonly options: WindowsOwnedProcessTrackerOptions) {}

  observe(snapshots: readonly WindowsProcessSnapshot[]): void {
    if (!this.utilityIdentity) {
      const utilityCandidates = snapshots.filter((snapshot) => (
        snapshot.pid === this.options.utilityPid
        && snapshot.startedAt >= this.options.observationStartedAt
        && pathsEqual(snapshot.executablePath, this.options.utilityExecutablePath)
      ));
      if (utilityCandidates.length !== 1) return;
      this.utilityIdentity = utilityCandidates[0];
    } else if (!isSameProcessIdentityPresent(snapshots, this.utilityIdentity)) {
      // Never replace an identity after PID reuse or a conflicting observation.
      return;
    }

    if (this.cliIdentity) return;
    const relationship = findAttributedProcessRelationship(
      snapshots,
      this.utilityIdentity,
      this.options.cliExecutablePath,
    );
    if (!relationship) return;
    this.cliIdentity = relationship.target;
    this.observedParentChain = relationship.parentChain;
  }

  evidenceAssertions(): WindowsOwnedProcessEvidenceAssertions {
    const relationshipBound = this.observedParentChain !== undefined
      && this.observedParentChain.length >= 2
      && this.utilityIdentity !== undefined
      && this.cliIdentity !== undefined;
    const ownershipFrozen = relationshipBound;
    return {
      utilityIdentityBound: this.utilityIdentity !== undefined,
      cliIdentityBound: this.cliIdentity !== undefined,
      pidCreationTimeExecutablePathBound: ownershipFrozen,
      observedParentRelationshipBound: relationshipBound,
      ownershipFrozenForSession: ownershipFrozen,
    };
  }

  residualAssertions(
    snapshots: readonly WindowsProcessSnapshot[],
  ): WindowsOwnedProcessResidualAssertions {
    return {
      utilityResidualAbsent: this.utilityIdentity !== undefined
        && !isSameProcessIdentityPresent(snapshots, this.utilityIdentity),
      cliResidualAbsent: this.cliIdentity !== undefined
        && !isSameProcessIdentityPresent(snapshots, this.cliIdentity),
    };
  }
}

export class WindowsOwnedProcessGuard {
  private tracker: WindowsOwnedProcessTracker | undefined;
  private observation: Promise<void> = Promise.resolve();
  private residualScan: Promise<{
    readonly ownershipObserved: boolean;
    readonly residualScanCompleted: boolean;
    readonly utilityResidualAbsent: boolean;
    readonly cliResidualAbsent: boolean;
  }> | undefined;
  private disposed = false;
  private readonly readSnapshots: () => WindowsProcessSnapshot[];

  constructor(private readonly options: WindowsOwnedProcessGuardOptions) {
    this.readSnapshots = options.readSnapshots ?? readWindowsProcessSnapshots;
  }

  bindUtility(utilityPid: number): void {
    if (this.tracker || this.disposed) return;
    this.tracker = new WindowsOwnedProcessTracker({
      utilityPid,
      utilityExecutablePath: this.options.utilityExecutablePath,
      cliExecutablePath: this.options.cliExecutablePath,
      observationStartedAt: this.options.observationStartedAt,
    });
    this.observation = this.observeUntilComplete();
  }

  isUtilityOwnedAndRunning(): boolean {
    if (!this.tracker || this.disposed) return false;
    try {
      const snapshots = this.readSnapshots();
      this.tracker.observe(snapshots);
      const evidence = this.tracker.evidenceAssertions();
      const residuals = this.tracker.residualAssertions(snapshots);
      return evidence.utilityIdentityBound && !residuals.utilityResidualAbsent;
    } catch {
      return false;
    }
  }

  async scanResiduals(): Promise<{
    readonly ownershipObserved: boolean;
    readonly residualScanCompleted: boolean;
    readonly utilityResidualAbsent: boolean;
    readonly cliResidualAbsent: boolean;
  }> {
    this.residualScan ??= this.performResidualScan();
    return this.residualScan;
  }

  private async performResidualScan(): Promise<{
    readonly ownershipObserved: boolean;
    readonly residualScanCompleted: boolean;
    readonly utilityResidualAbsent: boolean;
    readonly cliResidualAbsent: boolean;
  }> {
    await this.observation;
    await delay(this.options.residualDelayMs ?? 500);
    if (!this.tracker) return failedResidualScan();
    try {
      const ownership = this.tracker.evidenceAssertions();
      const residuals = this.tracker.residualAssertions(this.readSnapshots());
      return {
        ownershipObserved: ownership.ownershipFrozenForSession,
        residualScanCompleted: true,
        ...residuals,
      };
    } catch {
      return failedResidualScan();
    }
  }

  evidenceAssertions(): WindowsOwnedProcessEvidenceAssertions {
    return this.tracker?.evidenceAssertions() ?? {
      utilityIdentityBound: false,
      cliIdentityBound: false,
      pidCreationTimeExecutablePathBound: false,
      observedParentRelationshipBound: false,
      ownershipFrozenForSession: false,
    };
  }

  dispose(): void {
    this.disposed = true;
  }

  private async observeUntilComplete(): Promise<void> {
    const attempts = this.options.observationAttempts ?? 50;
    const intervalMs = this.options.observationIntervalMs ?? 100;
    for (let attempt = 0; attempt < attempts && !this.disposed; attempt += 1) {
      try {
        this.tracker?.observe(this.readSnapshots());
      } catch {
        return;
      }
      if (this.tracker?.evidenceAssertions().ownershipFrozenForSession) return;
      await delay(intervalMs);
    }
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
  return findAttributedProcessRelationship(snapshots, root, expectedExecutablePath)?.target;
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

function findAttributedProcessRelationship(
  snapshots: readonly WindowsProcessSnapshot[],
  root: WindowsProcessSnapshot,
  expectedExecutablePath: string,
): WindowsObservedProcessRelationship | undefined {
  const byPid = new Map<number, WindowsProcessSnapshot[]>();
  for (const snapshot of snapshots) {
    const matches = byPid.get(snapshot.pid) ?? [];
    matches.push(snapshot);
    byPid.set(snapshot.pid, matches);
  }
  const relationships = snapshots
    .filter((snapshot) => (
      snapshot.startedAt >= root.startedAt
      && pathsEqual(snapshot.executablePath, expectedExecutablePath)
      && !sameProcessIdentity(snapshot, root)
    ))
    .map((target) => ({
      target,
      parentChain: buildExactParentChain(target, root, byPid),
    }))
    .filter((relationship): relationship is WindowsObservedProcessRelationship => (
      relationship.parentChain !== undefined
    ));
  return relationships.length === 1 ? relationships[0] : undefined;
}

function buildExactParentChain(
  candidate: WindowsProcessSnapshot,
  root: WindowsProcessSnapshot,
  byPid: ReadonlyMap<number, readonly WindowsProcessSnapshot[]>,
): readonly WindowsProcessSnapshot[] | undefined {
  const reverseChain: WindowsProcessSnapshot[] = [candidate];
  const seen = new Set<number>([candidate.pid]);
  let child = candidate;
  while (child.parentPid > 0 && !seen.has(child.parentPid)) {
    const parents = byPid.get(child.parentPid);
    if (!parents || parents.length !== 1) return undefined;
    const parent = parents[0]!;
    if (child.startedAt < parent.startedAt) return undefined;
    reverseChain.push(parent);
    if (sameProcessIdentity(parent, root)) return reverseChain.reverse();
    seen.add(parent.pid);
    child = parent;
  }
  return undefined;
}

function sameProcessIdentity(
  left: WindowsProcessSnapshot,
  right: WindowsProcessSnapshot,
): boolean {
  return left.pid === right.pid
    && left.parentPid === right.parentPid
    && left.startedAt === right.startedAt
    && pathsEqual(left.executablePath, right.executablePath);
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

function failedResidualScan(): {
  readonly ownershipObserved: false;
  readonly residualScanCompleted: false;
  readonly utilityResidualAbsent: false;
  readonly cliResidualAbsent: false;
} {
  return {
    ownershipObserved: false,
    residualScanCompleted: false,
    utilityResidualAbsent: false,
    cliResidualAbsent: false,
  };
}

function delay(milliseconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, milliseconds));
}
