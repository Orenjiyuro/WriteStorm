import { existsSync } from 'node:fs';
import path from 'node:path';

const failureMessage = 'Block 6A npm invocation is unavailable.';

export function resolveBlock6aNpmInvocation({
  nodeExecutable,
  npmExecPath,
  pathExists = existsSync,
}) {
  if (typeof nodeExecutable !== 'string'
    || !path.isAbsolute(nodeExecutable)
    || typeof npmExecPath !== 'string'
    || !path.isAbsolute(npmExecPath)
    || path.basename(npmExecPath).toLowerCase() !== 'npm-cli.js'
    || typeof pathExists !== 'function'
    || !pathExists(npmExecPath)) {
    throw new Error(failureMessage);
  }

  return Object.freeze({
    executable: nodeExecutable,
    argsPrefix: Object.freeze([npmExecPath]),
  });
}
