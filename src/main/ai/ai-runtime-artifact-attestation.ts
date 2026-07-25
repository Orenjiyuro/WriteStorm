import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readFile } from 'node:fs/promises';
import path from 'node:path';
import { z } from 'zod';
import { resolvePackagedCodexExecutablePath } from './providers/codex/codex-product-runtime-path';

export const AI_RUNTIME_ATTESTATION_FILE =
  'writestorm-ai-runtime-attestation-v1.json';

export type AiArtifactCompatibilityAssessment =
  | Readonly<{
    state: 'verified';
    compatibilityFingerprint: string;
  }>
  | Readonly<{ state: 'unverified' }>;

const sha256Schema = z.string().regex(/^[0-9a-f]{64}$/);
const artifactFileSchema = z.object({
  id: z.enum(['writestorm_executable', 'app_asar', 'codex_executable']),
  size: z.number().int().nonnegative().safe(),
  sha256: sha256Schema,
}).strict();
const attestationSchema = z.object({
  schemaVersion: z.literal(1),
  authority: z.literal('block13-runtime-artifact-attestation-v1'),
  platform: z.literal('win32'),
  architecture: z.literal('x64'),
  compatibilityFingerprint: sha256Schema,
  artifact: z.object({
    boundaryId: z.literal('block13-task13-11-product-artifact-v1'),
    files: z.tuple([
      artifactFileSchema,
      artifactFileSchema,
      artifactFileSchema,
    ]),
    sha256: sha256Schema,
  }).strict(),
}).strict();

export async function verifyAiRuntimeArtifactAttestation(input: {
  readonly executablePath: string;
  readonly resourcesPath: string;
  readonly compatibilityFingerprint: string;
}): Promise<AiArtifactCompatibilityAssessment> {
  if (!/^[0-9a-f]{64}$/.test(input.compatibilityFingerprint)) {
    return unverified();
  }
  try {
    const raw = await readFile(
      path.join(input.resourcesPath, AI_RUNTIME_ATTESTATION_FILE),
      'utf8',
    );
    const parsed = attestationSchema.safeParse(JSON.parse(raw));
    if (!parsed.success
      || parsed.data.compatibilityFingerprint !== input.compatibilityFingerprint) {
      return unverified();
    }
    const expectedIds = [
      'writestorm_executable',
      'app_asar',
      'codex_executable',
    ] as const;
    if (parsed.data.artifact.files.some((entry, index) => entry.id !== expectedIds[index])) {
      return unverified();
    }
    if (hashArtifactReceipt(
      parsed.data.artifact.boundaryId,
      parsed.data.artifact.files,
    ) !== parsed.data.artifact.sha256) {
      return unverified();
    }
    const actualPaths = {
      writestorm_executable: input.executablePath,
      app_asar: path.join(input.resourcesPath, 'app.asar'),
      codex_executable: resolvePackagedCodexExecutablePath(input.resourcesPath),
    } as const;
    for (const expected of parsed.data.artifact.files) {
      if (!await matchesFile(actualPaths[expected.id], expected)) return unverified();
    }
    return Object.freeze({
      state: 'verified',
      compatibilityFingerprint: input.compatibilityFingerprint,
    });
  } catch {
    return unverified();
  }
}

function hashArtifactReceipt(
  boundaryId: string,
  files: readonly {
    readonly id: string;
    readonly size: number;
    readonly sha256: string;
  }[],
): string {
  return createHash('sha256')
    .update(JSON.stringify({ boundaryId, files }))
    .digest('hex');
}

async function matchesFile(
  filePath: string,
  expected: { readonly size: number; readonly sha256: string },
): Promise<boolean> {
  const metadata = await lstat(filePath);
  if (!metadata.isFile()
    || metadata.isSymbolicLink()
    || metadata.size !== expected.size) {
    return false;
  }
  return await hashFile(filePath) === expected.sha256;
}

async function hashFile(filePath: string): Promise<string> {
  const digest = createHash('sha256');
  await new Promise<void>((resolve, reject) => {
    const stream = createReadStream(filePath);
    stream.on('data', (chunk) => digest.update(chunk));
    stream.on('error', reject);
    stream.on('end', resolve);
  });
  return digest.digest('hex');
}

function unverified(): AiArtifactCompatibilityAssessment {
  return Object.freeze({ state: 'unverified' });
}
