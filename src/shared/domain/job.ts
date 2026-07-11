export const JOB_STATES = [
  'queued',
  'estimating',
  'waiting_confirmation',
  'running',
  'paused',
  'failed',
  'resumable',
  'cancelled',
  'completed',
] as const;

export type JobState = (typeof JOB_STATES)[number];

export const JOB_TRANSITIONS = {
  queued: ['estimating', 'running', 'failed', 'cancelled'],
  estimating: ['waiting_confirmation', 'running', 'failed', 'cancelled'],
  waiting_confirmation: ['running', 'cancelled'],
  running: ['paused', 'failed', 'cancelled', 'completed'],
  paused: ['running', 'cancelled'],
  failed: ['resumable'],
  resumable: ['running', 'cancelled'],
  cancelled: [],
  completed: [],
} as const satisfies Readonly<Record<JobState, readonly JobState[]>>;

export function canTransitionJob(from: JobState, to: JobState): boolean {
  return (JOB_TRANSITIONS[from] as readonly JobState[]).includes(to);
}
