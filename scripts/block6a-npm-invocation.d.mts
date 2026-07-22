export type Block6aNpmInvocation = {
  readonly executable: string;
  readonly argsPrefix: readonly [string];
};

export function resolveBlock6aNpmInvocation(options: {
  readonly nodeExecutable: string;
  readonly npmExecPath: string | undefined;
  readonly pathExists?: (candidate: string) => boolean;
}): Block6aNpmInvocation;
