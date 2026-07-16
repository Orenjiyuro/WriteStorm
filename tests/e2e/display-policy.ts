import { TEST_DISPLAY_TARGET_ENV } from '../../src/main/windows/test-display-placement';

export function configureLocalE2EDisplayPolicy(environment: NodeJS.ProcessEnv): void {
  if (environment[TEST_DISPLAY_TARGET_ENV] !== undefined || isCiEnvironment(environment.CI)) {
    return;
  }

  environment[TEST_DISPLAY_TARGET_ENV] = 'secondary';
}

function isCiEnvironment(value: string | undefined): boolean {
  if (value === undefined || value === '' || value === '0') return false;
  return value.toLowerCase() !== 'false';
}
