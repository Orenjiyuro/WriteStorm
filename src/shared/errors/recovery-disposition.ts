export const ERROR_RECOVERY_DISPOSITIONS = [
  'user_action',
  'retry_later',
  'restart_required',
  'internal_failure',
] as const;

export type ErrorRecoveryDisposition = (typeof ERROR_RECOVERY_DISPOSITIONS)[number];

export function isRecoverableDisposition(disposition: ErrorRecoveryDisposition): boolean {
  return disposition === 'user_action' || disposition === 'retry_later';
}
