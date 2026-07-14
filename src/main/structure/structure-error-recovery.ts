import type { ErrorRecoveryDisposition } from '../../shared/errors';
import type { StructureServiceErrorReason } from './structure-service';
import type { StructureSourceSnapshotErrorReason } from './structure-source-snapshot';

export type StructureDetectionErrorReason =
  | StructureServiceErrorReason
  | StructureSourceSnapshotErrorReason;

export const STRUCTURE_DETECTION_ERROR_RECOVERY = {
  no_current_library: 'user_action',
  library_session_changed: 'retry_later',
  source_snapshot_stale: 'retry_later',
  structure_detection_in_progress: 'retry_later',
  structure_detection_recovery_required: 'user_action',
  structure_validation_failed: 'internal_failure',
  candidate_persistence_failed: 'internal_failure',
  structure_worker_failed: 'internal_failure',
  UTILITY_WORKER_TIMEOUT: 'retry_later',
  UTILITY_WORKER_CRASH: 'retry_later',
  UTILITY_WORKER_CANCELLED: 'retry_later',
  UTILITY_WORKER_PROTOCOL: 'internal_failure',
  UTILITY_WORKER_DISPOSED: 'restart_required',
  book_not_found: 'user_action',
  source_missing: 'user_action',
  source_encoding_invalid: 'user_action',
  source_read_failed: 'user_action',
  source_decode_failed: 'user_action',
  source_hash_mismatch: 'user_action',
} as const satisfies Record<StructureDetectionErrorReason, ErrorRecoveryDisposition>;

export function getStructureDetectionErrorRecoveryDisposition(
  reason: StructureDetectionErrorReason,
): ErrorRecoveryDisposition {
  return STRUCTURE_DETECTION_ERROR_RECOVERY[reason];
}
