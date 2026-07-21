import path from 'node:path';
import { z } from 'zod';
import type { CodexTurnRuntimeFailureOrigin } from './turn-deadline';

export const CODEX_FEASIBILITY_PROTOCOL_VERSION = 1 as const;

type RequestBase = {
  readonly version: typeof CODEX_FEASIBILITY_PROTOCOL_VERSION;
  readonly origin: 'main';
  readonly requestId: string;
};

export type CodexFeasibilityRequest = RequestBase & (
  | { readonly command: 'inspect-runtime' }
  | { readonly command: 'run-capability-probe'; readonly input: CodexCapabilityProbeInput }
  | { readonly command: 'run-output-schema-probe'; readonly input: CodexOutputSchemaProbeInput }
  | { readonly command: 'start-lifecycle-probe'; readonly input: CodexLifecycleProbeInput }
  | { readonly command: 'cancel-lifecycle-probe'; readonly trigger: CodexLifecycleTrigger }
  | { readonly command: 'cancel-active-probe' }
  | { readonly command: 'shutdown' }
);

export type CodexFeasibilityCommand = CodexFeasibilityRequest['command'];

export type CodexFeasibilityRequestFor<
  Command extends CodexFeasibilityCommand,
> = Extract<CodexFeasibilityRequest, { readonly command: Command }>;

export type CodexFeasibilityRequestPayload<
  Command extends CodexFeasibilityCommand,
> = Omit<
  CodexFeasibilityRequestFor<Command>,
  'version' | 'origin' | 'requestId' | 'command'
>;

export type CodexLifecycleScenario =
  | 'app-timeout'
  | 'explicit-cancel'
  | 'window-close'
  | 'app-quit';

export type CodexLifecycleTrigger = CodexLifecycleScenario;

export type CodexLifecycleProbeInput = {
  readonly scenario: CodexLifecycleScenario;
  readonly workingDirectory: string;
};

export type CodexLifecycleProbeResult = {
  readonly scenario: CodexLifecycleScenario;
  readonly trigger: CodexLifecycleTrigger;
  readonly outcome:
    | 'aborted'
    | 'completed_before_abort'
    | 'login_required'
    | 'auth_failed'
    | 'runtime_failed';
  readonly authClassification: CodexAuthClassification;
  readonly abortRequested: true;
  readonly abortObserved: boolean;
  readonly sdkPromiseSettled: true;
};

export type CodexOutputSchemaProbeInput = {
  readonly scenario: 'valid-minimal' | 'invalid-schema';
  readonly workingDirectory: string;
};

export type CodexOutputSchemaProbeResult = {
  readonly scenario: CodexOutputSchemaProbeInput['scenario'];
  readonly outcome:
    | 'success'
    | 'invalid_schema_rejected'
    | 'invalid_schema_not_rejected'
    | 'output_validation_failed'
    | 'auth_failed'
    | 'login_required'
    | 'runtime_failed';
  readonly authClassification: CodexAuthClassification;
  readonly runtimeFailureOrigin: CodexTurnRuntimeFailureOrigin | null;
  readonly safeFailureCode: CodexSafeFailureCode | null;
  readonly finalJsonParsed: boolean | null;
  readonly strictValidatorAccepted: boolean | null;
  readonly expectedValueMatched: boolean | null;
  readonly invalidSchemaRejectedBySdk: boolean;
};

export type CodexCapabilityProbeScenario =
  | 'default-git-isolated-auth'
  | 'explicit-git-isolated-auth'
  | 'explicit-non-git-isolated-auth'
  | 'skip-non-git-isolated-auth'
  | 'current-auth-explicit-git'
  | 'current-auth-non-git-check'
  | 'current-auth-non-git-skip';

export type CodexSafeFailureCode = 'SDK_RUNTIME_UNAVAILABLE';

export type CodexCapabilityProbeInput = {
  readonly scenario: CodexCapabilityProbeScenario;
  readonly expectedUtilityWorkingDirectory: string;
  readonly workingDirectory?: string;
  readonly skipGitRepoCheck: boolean;
  readonly authMode: 'current' | 'isolated-empty';
  readonly isolatedCodexHome?: string;
};

export type CodexAuthClassification =
  | 'authenticated'
  | 'login_required'
  | 'auth_failed'
  | 'unverified';

export type CodexCapabilityProbeOutcome =
  | 'success'
  | 'git_repo_required'
  | 'login_required'
  | 'auth_failed'
  | 'runtime_failed';

export type CodexCapabilityProbeResult = {
  readonly scenario: CodexCapabilityProbeScenario;
  readonly outcome: CodexCapabilityProbeOutcome;
  readonly authClassification: CodexAuthClassification;
  readonly runtimeFailureOrigin: CodexTurnRuntimeFailureOrigin | null;
  readonly safeFailureCode: CodexSafeFailureCode | null;
  readonly utilityCwdMatchedExpected: boolean;
  readonly explicitWorkingDirectoryRequested: boolean;
  readonly skipGitRepoCheck: boolean;
  readonly envPolicy: 'explicit_allowlist_no_api_credentials';
  readonly finalResponseMatched: boolean | null;
};

export type CodexRuntimeInspection = {
  readonly sdkVersion: string;
  readonly cliVersion: string;
  readonly platformPackageVersion: string;
  readonly nodeRuntime: string;
  readonly platform: NodeJS.Platform;
  readonly architecture: NodeJS.Architecture;
  readonly sdkImported: true;
  readonly sdkClientConstructed: true;
  readonly projectLocalCliResolved: true;
};

export type CodexFeasibilityUtilityErrorCode =
  | 'SDK_IMPORT_FAILED'
  | 'SDK_CONSTRUCT_FAILED'
  | 'PROJECT_LOCAL_CLI_UNRESOLVED'
  | 'PROJECT_LOCAL_CLI_PATH_MISSING'
  | 'PROJECT_LOCAL_CLI_FILE_MISSING'
  | 'PROJECT_LOCAL_CLI_OUTSIDE_PACKAGE'
  | 'SDK_PACKAGE_MANIFEST_UNRESOLVED'
  | 'CLI_PACKAGE_MANIFEST_UNRESOLVED'
  | 'PLATFORM_PACKAGE_MANIFEST_UNRESOLVED'
  | 'PACKAGE_MANIFEST_READ_FAILED'
  | 'UNSUPPORTED_PLATFORM'
  | 'SYNTHETIC_INPUT_MISSING'
  | 'LIFECYCLE_ALREADY_ACTIVE'
  | 'LIFECYCLE_NOT_ACTIVE';

export type CodexFeasibilityResponse =
  | {
      readonly version: typeof CODEX_FEASIBILITY_PROTOCOL_VERSION;
      readonly requestId: string;
      readonly command: 'cancel-active-probe';
      readonly ok: true;
      readonly utilityPid: number;
      readonly abortRequested: boolean;
      readonly abortObserved: boolean;
      readonly sdkPromiseSettled: true;
    }
  | {
      readonly version: typeof CODEX_FEASIBILITY_PROTOCOL_VERSION;
      readonly requestId: string;
      readonly command: 'start-lifecycle-probe';
      readonly ok: true;
      readonly utilityPid: number;
      readonly result: { readonly scenario: CodexLifecycleScenario; readonly turnStarted: true };
    }
  | {
      readonly version: typeof CODEX_FEASIBILITY_PROTOCOL_VERSION;
      readonly requestId: string;
      readonly command: 'start-lifecycle-probe';
      readonly ok: false;
      readonly utilityPid: number;
      readonly error: { readonly code: CodexFeasibilityUtilityErrorCode };
    }
  | {
      readonly version: typeof CODEX_FEASIBILITY_PROTOCOL_VERSION;
      readonly requestId: string;
      readonly command: 'cancel-lifecycle-probe';
      readonly ok: true;
      readonly utilityPid: number;
      readonly result: CodexLifecycleProbeResult;
    }
  | {
      readonly version: typeof CODEX_FEASIBILITY_PROTOCOL_VERSION;
      readonly requestId: string;
      readonly command: 'cancel-lifecycle-probe';
      readonly ok: false;
      readonly utilityPid: number;
      readonly error: { readonly code: CodexFeasibilityUtilityErrorCode };
    }
  | {
      readonly version: typeof CODEX_FEASIBILITY_PROTOCOL_VERSION;
      readonly requestId: string;
      readonly command: 'run-output-schema-probe';
      readonly ok: true;
      readonly utilityPid: number;
      readonly result: CodexOutputSchemaProbeResult;
    }
  | {
      readonly version: typeof CODEX_FEASIBILITY_PROTOCOL_VERSION;
      readonly requestId: string;
      readonly command: 'run-output-schema-probe';
      readonly ok: false;
      readonly utilityPid: number;
      readonly error: { readonly code: CodexFeasibilityUtilityErrorCode };
    }
  | {
      readonly version: typeof CODEX_FEASIBILITY_PROTOCOL_VERSION;
      readonly requestId: string;
      readonly command: 'run-capability-probe';
      readonly ok: true;
      readonly utilityPid: number;
      readonly result: CodexCapabilityProbeResult;
    }
  | {
      readonly version: typeof CODEX_FEASIBILITY_PROTOCOL_VERSION;
      readonly requestId: string;
      readonly command: 'run-capability-probe';
      readonly ok: false;
      readonly utilityPid: number;
      readonly error: { readonly code: CodexFeasibilityUtilityErrorCode };
    }
  | {
      readonly version: typeof CODEX_FEASIBILITY_PROTOCOL_VERSION;
      readonly requestId: string;
      readonly command: 'inspect-runtime';
      readonly ok: true;
      readonly utilityPid: number;
      readonly result: CodexRuntimeInspection;
    }
  | {
      readonly version: typeof CODEX_FEASIBILITY_PROTOCOL_VERSION;
      readonly requestId: string;
      readonly command: 'inspect-runtime';
      readonly ok: false;
      readonly utilityPid: number;
      readonly error: { readonly code: CodexFeasibilityUtilityErrorCode };
    }
  | {
      readonly version: typeof CODEX_FEASIBILITY_PROTOCOL_VERSION;
      readonly requestId: string;
      readonly command: 'shutdown';
      readonly ok: true;
      readonly utilityPid: number;
      readonly cleanupAcknowledged: true;
    };

export type CodexFeasibilityResponseFor<
  Command extends CodexFeasibilityCommand,
> = Extract<CodexFeasibilityResponse, { readonly command: Command }>;

const requestBase = {
  version: z.literal(CODEX_FEASIBILITY_PROTOCOL_VERSION),
  origin: z.literal('main'),
  requestId: z.string().min(1),
} as const;

const requestSchema = z.discriminatedUnion('command', [
  z.object({ ...requestBase, command: z.literal('inspect-runtime') }).strict(),
  z.object({
    ...requestBase,
    command: z.literal('run-capability-probe'),
    input: z.object({
      scenario: z.enum([
        'default-git-isolated-auth',
        'explicit-git-isolated-auth',
        'explicit-non-git-isolated-auth',
        'skip-non-git-isolated-auth',
        'current-auth-explicit-git',
        'current-auth-non-git-check',
        'current-auth-non-git-skip',
      ]),
      expectedUtilityWorkingDirectory: z.string().min(1).refine((value) => path.isAbsolute(value)),
      workingDirectory: z.string().min(1).refine((value) => path.isAbsolute(value)).optional(),
      skipGitRepoCheck: z.boolean(),
      authMode: z.enum(['current', 'isolated-empty']),
      isolatedCodexHome: z.string().min(1).refine((value) => path.isAbsolute(value)).optional(),
    }).strict().superRefine((input, context) => {
      if (input.authMode === 'isolated-empty' && !input.isolatedCodexHome) {
        context.addIssue({ code: 'custom', message: 'isolatedCodexHome is required' });
      }
      if (input.authMode === 'current' && input.isolatedCodexHome !== undefined) {
        context.addIssue({ code: 'custom', message: 'isolatedCodexHome is not admitted' });
      }
    }),
  }).strict(),
  z.object({
    ...requestBase,
    command: z.literal('run-output-schema-probe'),
    input: z.object({
      scenario: z.enum(['valid-minimal', 'invalid-schema']),
      workingDirectory: z.string().min(1).refine((value) => path.isAbsolute(value)),
    }).strict(),
  }).strict(),
  z.object({
    ...requestBase,
    command: z.literal('start-lifecycle-probe'),
    input: z.object({
      scenario: z.enum(['app-timeout', 'explicit-cancel', 'window-close', 'app-quit']),
      workingDirectory: z.string().min(1).refine((value) => path.isAbsolute(value)),
    }).strict(),
  }).strict(),
  z.object({
    ...requestBase,
    command: z.literal('cancel-lifecycle-probe'),
    trigger: z.enum(['app-timeout', 'explicit-cancel', 'window-close', 'app-quit']),
  }).strict(),
  z.object({ ...requestBase, command: z.literal('cancel-active-probe') }).strict(),
  z.object({ ...requestBase, command: z.literal('shutdown') }).strict(),
]) as z.ZodType<CodexFeasibilityRequest>;

const responseBase = {
  version: z.literal(CODEX_FEASIBILITY_PROTOCOL_VERSION),
  requestId: z.string().min(1),
  utilityPid: z.number().int().positive(),
} as const;

const inspectionSchema = z.object({
  sdkVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  cliVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  platformPackageVersion: z.string().min(1),
  nodeRuntime: z.string().min(1),
  platform: z.string().min(1) as z.ZodType<NodeJS.Platform>,
  architecture: z.string().min(1) as z.ZodType<NodeJS.Architecture>,
  sdkImported: z.literal(true),
  sdkClientConstructed: z.literal(true),
  projectLocalCliResolved: z.literal(true),
}).strict() as z.ZodType<CodexRuntimeInspection>;

const capabilityResultSchema = z.object({
  scenario: z.enum([
    'default-git-isolated-auth',
    'explicit-git-isolated-auth',
    'explicit-non-git-isolated-auth',
    'skip-non-git-isolated-auth',
    'current-auth-explicit-git',
    'current-auth-non-git-check',
    'current-auth-non-git-skip',
  ]),
  outcome: z.enum([
    'success',
    'git_repo_required',
    'login_required',
    'auth_failed',
    'runtime_failed',
  ]),
  authClassification: z.enum(['authenticated', 'login_required', 'auth_failed', 'unverified']),
  runtimeFailureOrigin: z.enum(['local_turn_deadline', 'sdk_unstructured']).nullable(),
  safeFailureCode: z.literal('SDK_RUNTIME_UNAVAILABLE').nullable(),
  utilityCwdMatchedExpected: z.boolean(),
  explicitWorkingDirectoryRequested: z.boolean(),
  skipGitRepoCheck: z.boolean(),
  envPolicy: z.literal('explicit_allowlist_no_api_credentials'),
  finalResponseMatched: z.boolean().nullable(),
}).strict() as z.ZodType<CodexCapabilityProbeResult>;

const outputSchemaResultSchema = z.object({
  scenario: z.enum(['valid-minimal', 'invalid-schema']),
  outcome: z.enum([
    'success',
    'invalid_schema_rejected',
    'invalid_schema_not_rejected',
    'output_validation_failed',
    'auth_failed',
    'login_required',
    'runtime_failed',
  ]),
  authClassification: z.enum(['authenticated', 'login_required', 'auth_failed', 'unverified']),
  runtimeFailureOrigin: z.enum(['local_turn_deadline', 'sdk_unstructured']).nullable(),
  safeFailureCode: z.literal('SDK_RUNTIME_UNAVAILABLE').nullable(),
  finalJsonParsed: z.boolean().nullable(),
  strictValidatorAccepted: z.boolean().nullable(),
  expectedValueMatched: z.boolean().nullable(),
  invalidSchemaRejectedBySdk: z.boolean(),
}).strict() as z.ZodType<CodexOutputSchemaProbeResult>;

const lifecycleScenarioSchema = z.enum([
  'app-timeout',
  'explicit-cancel',
  'window-close',
  'app-quit',
]);

const lifecycleResultSchema = z.object({
  scenario: lifecycleScenarioSchema,
  trigger: lifecycleScenarioSchema,
  outcome: z.enum([
    'aborted',
    'completed_before_abort',
    'login_required',
    'auth_failed',
    'runtime_failed',
  ]),
  authClassification: z.enum(['authenticated', 'login_required', 'auth_failed', 'unverified']),
  abortRequested: z.literal(true),
  abortObserved: z.boolean(),
  sdkPromiseSettled: z.literal(true),
}).strict() as z.ZodType<CodexLifecycleProbeResult>;

const utilityErrorCodeSchema = z.enum([
  'SDK_IMPORT_FAILED',
  'SDK_CONSTRUCT_FAILED',
  'PROJECT_LOCAL_CLI_UNRESOLVED',
  'PROJECT_LOCAL_CLI_PATH_MISSING',
  'PROJECT_LOCAL_CLI_FILE_MISSING',
  'PROJECT_LOCAL_CLI_OUTSIDE_PACKAGE',
  'SDK_PACKAGE_MANIFEST_UNRESOLVED',
  'CLI_PACKAGE_MANIFEST_UNRESOLVED',
  'PLATFORM_PACKAGE_MANIFEST_UNRESOLVED',
  'PACKAGE_MANIFEST_READ_FAILED',
  'UNSUPPORTED_PLATFORM',
  'SYNTHETIC_INPUT_MISSING',
  'LIFECYCLE_ALREADY_ACTIVE',
  'LIFECYCLE_NOT_ACTIVE',
]);

const responseSchema = z.union([
  z.object({
    ...responseBase,
    command: z.literal('cancel-active-probe'),
    ok: z.literal(true),
    abortRequested: z.boolean(),
    abortObserved: z.boolean(),
    sdkPromiseSettled: z.literal(true),
  }).strict(),
  z.object({
    ...responseBase,
    command: z.literal('inspect-runtime'),
    ok: z.literal(true),
    result: inspectionSchema,
  }).strict(),
  z.object({
    ...responseBase,
    command: z.literal('start-lifecycle-probe'),
    ok: z.literal(true),
    result: z.object({ scenario: lifecycleScenarioSchema, turnStarted: z.literal(true) }).strict(),
  }).strict(),
  z.object({
    ...responseBase,
    command: z.literal('start-lifecycle-probe'),
    ok: z.literal(false),
    error: z.object({ code: utilityErrorCodeSchema }).strict(),
  }).strict(),
  z.object({
    ...responseBase,
    command: z.literal('cancel-lifecycle-probe'),
    ok: z.literal(true),
    result: lifecycleResultSchema,
  }).strict(),
  z.object({
    ...responseBase,
    command: z.literal('cancel-lifecycle-probe'),
    ok: z.literal(false),
    error: z.object({ code: utilityErrorCodeSchema }).strict(),
  }).strict(),
  z.object({
    ...responseBase,
    command: z.literal('run-output-schema-probe'),
    ok: z.literal(true),
    result: outputSchemaResultSchema,
  }).strict(),
  z.object({
    ...responseBase,
    command: z.literal('run-output-schema-probe'),
    ok: z.literal(false),
    error: z.object({ code: utilityErrorCodeSchema }).strict(),
  }).strict(),
  z.object({
    ...responseBase,
    command: z.literal('inspect-runtime'),
    ok: z.literal(false),
    error: z.object({
      code: utilityErrorCodeSchema,
    }).strict(),
  }).strict(),
  z.object({
    ...responseBase,
    command: z.literal('run-capability-probe'),
    ok: z.literal(true),
    result: capabilityResultSchema,
  }).strict(),
  z.object({
    ...responseBase,
    command: z.literal('run-capability-probe'),
    ok: z.literal(false),
    error: z.object({ code: utilityErrorCodeSchema }).strict(),
  }).strict(),
  z.object({
    ...responseBase,
    command: z.literal('shutdown'),
    ok: z.literal(true),
    cleanupAcknowledged: z.literal(true),
  }).strict(),
]) as z.ZodType<CodexFeasibilityResponse>;

export function isCodexFeasibilityRequest(value: unknown): value is CodexFeasibilityRequest {
  return requestSchema.safeParse(value).success;
}

export function isCodexFeasibilityResponse(value: unknown): value is CodexFeasibilityResponse {
  return responseSchema.safeParse(value).success;
}

export type CodexFeasibilityResponseDiagnostic = {
  readonly valueKind: 'object' | 'non-object';
  readonly hasDataEnvelope: boolean;
  readonly versionRecognized: boolean;
  readonly commandRecognized: boolean;
  readonly requestIdPresent: boolean;
  readonly utilityPidValid: boolean;
  readonly invalidFieldPaths: readonly string[];
};

export function diagnoseCodexFeasibilityResponse(
  value: unknown,
): CodexFeasibilityResponseDiagnostic {
  const record = typeof value === 'object' && value !== null && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined;
  const parsed = responseSchema.safeParse(value);
  return {
    valueKind: record ? 'object' : 'non-object',
    hasDataEnvelope: record !== undefined && 'data' in record,
    versionRecognized: record?.version === CODEX_FEASIBILITY_PROTOCOL_VERSION,
    commandRecognized: typeof record?.command === 'string' && [
      'inspect-runtime',
      'run-capability-probe',
      'run-output-schema-probe',
      'start-lifecycle-probe',
      'cancel-lifecycle-probe',
      'cancel-active-probe',
      'shutdown',
    ].includes(record.command),
    requestIdPresent: typeof record?.requestId === 'string' && record.requestId.length > 0,
    utilityPidValid: typeof record?.utilityPid === 'number'
      && Number.isInteger(record.utilityPid)
      && record.utilityPid > 0,
    invalidFieldPaths: parsed.success
      ? []
      : [...new Set(parsed.error.issues.map((issue) => issue.path.join('.') || '<root>'))].sort(),
  };
}
