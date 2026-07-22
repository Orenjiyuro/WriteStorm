import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { evaluateBlock6aProbeResults } from './block6a-probe-admission.mjs';
import { verifyBlock6aEvidenceLineageAtRepository } from './block6a-evidence-lineage.mjs';
import { BLOCK6A_FEASIBILITY_MANIFEST } from './block6a-feasibility-manifest.mjs';

const failureMessage = 'Block 6A certification verification failed.';
const conditionalVerdict = BLOCK6A_FEASIBILITY_MANIFEST.verdict.text;

export function evaluateBlock6aCertificationEvidence(records, options) {
  try {
    if (!Array.isArray(records) || records.length !== 7 || !isRecord(options)) fail();
    if (typeof options.verifyLineage !== 'function') fail();

    const development = records.filter((record) => record?.task === '6A.5' || record?.task === '6A.6');
    const lifecycle = records.filter((record) => record?.task === '6A.7');
    const packaged = records.filter((record) => record?.task === '6A.8a');
    if (development.length !== 2 || lifecycle.length !== 4 || packaged.length !== 1) fail();

    const developmentAdmission = evaluateBlock6aProbeResults('dev', development);
    const lifecycleAdmission = evaluateBlock6aProbeResults('lifecycle', lifecycle);
    const packagedAdmission = evaluateBlock6aProbeResults('packaged', packaged);
    for (const admission of [developmentAdmission, lifecycleAdmission, packagedAdmission]) {
      if (admission.evidenceAccepted !== true || admission.recertificationAdmitted !== true) fail();
    }

    for (const [index, record] of records.entries()) {
      const lineage = options.verifyLineage(record, index);
      if (!isRecord(lineage)
        || lineage.verified !== true
        || lineage.classification !== 'evidence_lineage_verified') fail();
    }

    const evidenceInputs = records.map((record, index) => {
      if (!isRecord(record)
        || typeof record.evidenceId !== 'string'
        || typeof record.source !== 'string'
        || typeof record.classification !== 'string') fail();
      const sha256 = typeof options.evidenceSha256 === 'function'
        ? options.evidenceSha256(record, index)
        : hashText(JSON.stringify(record));
      if (!isHash(sha256)) fail();
      return {
        evidenceId: record.evidenceId,
        source: record.source,
        classification: record.classification,
        sha256,
      };
    }).sort((left, right) => left.evidenceId.localeCompare(right.evidenceId));

    return {
      verified: true,
      classification: BLOCK6A_FEASIBILITY_MANIFEST.verdict.classification,
      verdict: conditionalVerdict,
      admissions: {
        development: developmentAdmission.admission,
        lifecycle: lifecycleAdmission.admission,
        packaged: packagedAdmission.admission,
      },
      conditionalLimitations: [
        ...developmentAdmission.conditionalLimitations,
        'macos_packaged_runtime_deferred_by_user',
      ],
      evidenceInputs,
      task13Point1Unblocked: false,
      task13Point2Authorized: false,
      fullGoClaimed: false,
      crossPlatformCompatibilityClaimed: false,
      releaseReadinessClaimed: false,
    };
  } catch {
    throw new Error(failureMessage);
  }
}

export function verifyBlock6aCertificationFilesAtRepository(
  evidencePaths,
  repositoryRoot,
  packagedArtifactRoot,
) {
  try {
    if (!Array.isArray(evidencePaths) || evidencePaths.length !== 7) fail();
    if (typeof packagedArtifactRoot !== 'string' || packagedArtifactRoot.length === 0) fail();
    const inputs = evidencePaths.map((evidencePath) => {
      const absolutePath = path.resolve(repositoryRoot, evidencePath);
      const raw = readFileSync(absolutePath);
      return {
        record: JSON.parse(raw.toString('utf8')),
        sha256: createHash('sha256').update(raw).digest('hex'),
      };
    });

    return evaluateBlock6aCertificationEvidence(
      inputs.map(({ record }) => record),
      {
        evidenceSha256: (_record, index) => inputs[index].sha256,
        verifyLineage: (record) => {
          if (!isRecord(record) || !isRecord(record.lineage)) fail();
          return verifyBlock6aEvidenceLineageAtRepository(
            record.lineage,
            repositoryRoot,
            record.lineage.packagedArtifactSha256 === null
              ? undefined
              : packagedArtifactRoot,
          );
        },
      },
    );
  } catch {
    throw new Error(failureMessage);
  }
}

function hashText(value) {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

function isHash(value) {
  return typeof value === 'string' && /^[0-9a-f]{64}$/.test(value);
}

function isRecord(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function fail() {
  throw new Error(failureMessage);
}
