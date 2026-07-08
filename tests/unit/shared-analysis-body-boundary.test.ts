import { describe, expect, it } from 'vitest';
import {
  ANALYSIS_BODY_BOUNDARY_POLICY,
  ANALYSIS_MODULE_INSTANCE_CONTRACT,
  ANALYSIS_MARKDOWN_EDIT_POLICY,
  ANALYSIS_REVIEW_ASSET_CONTRACT,
  ANALYSIS_STRUCTURED_FIELD_KINDS,
  MODULE_INSTANCE_STATUSES,
  type AnalysisBodyContentKind,
  type AnalysisMarkdownEditResultKind,
  type AnalysisReviewAssetKind,
  type AnalysisStructuredFieldKind,
  type ModuleInstanceSummary,
} from '../../src/shared/domain';

const bodyContentKind: AnalysisBodyContentKind = 'human_readable_markdown';
const revisionResultKind: AnalysisMarkdownEditResultKind = 'revision';
const evidenceStructuredField: AnalysisStructuredFieldKind = 'evidence_anchor';
const reviewAssetKind: AnalysisReviewAssetKind = 'reusable_technique_candidate';
const moduleInstanceModuleField: keyof ModuleInstanceSummary = 'moduleId';
const moduleInstanceStatusField: keyof ModuleInstanceSummary = 'status';

// @ts-expect-error Body is an asset kind, not a structured field kind.
const invalidBodyStructuredField: AnalysisStructuredFieldKind = 'body';

// @ts-expect-error Markdown/JSON blobs must not become a structural fact source.
const invalidMarkdownFactField: AnalysisStructuredFieldKind = 'markdown_json_blob';

// @ts-expect-error AnalysisModuleInstance DTO identity uses moduleId, not moduleKey.
const invalidModuleInstanceModuleField: keyof ModuleInstanceSummary = 'moduleKey';

describe('analysis body and structured field boundary', () => {
  it('defines module body as human-readable Markdown only', () => {
    expect(bodyContentKind).toBe('human_readable_markdown');
    expect(ANALYSIS_BODY_BOUNDARY_POLICY).toEqual({
      bodyAssetKind: 'body',
      contentKind: 'human_readable_markdown',
      purpose: '人类阅读与编辑的模块正文',
      carriesStructuredFacts: false,
      structuredFactsRequireControls: true,
    });
  });

  it('keeps evidence, tags, object links, relations, status, AI constraints, and candidates structured', () => {
    expect(evidenceStructuredField).toBe('evidence_anchor');
    expect(ANALYSIS_STRUCTURED_FIELD_KINDS).toEqual([
      'structured_object',
      'evidence_anchor',
      'tag',
      'object_link',
      'relation_link',
      'work_technique_observation',
      'review_status',
      'ai_constraint',
      'reusable_technique_candidate',
    ]);
    expect(ANALYSIS_STRUCTURED_FIELD_KINDS.includes('body' as AnalysisStructuredFieldKind)).toBe(false);
  });

  it('limits Markdown body edits to body text and Revision creation', () => {
    expect(revisionResultKind).toBe('revision');
    expect(ANALYSIS_MARKDOWN_EDIT_POLICY).toEqual({
      operation: 'markdown_body_edit',
      resultKind: 'revision',
      mayUpdateBodyText: true,
      mayCreateStructuredFields: false,
      mayParseStructuredFactsFromMarkdown: false,
      mayImportStructuredFactsFromJsonMirror: false,
    });
  });

  it('defines AnalysisModuleInstance ownership of body, review assets, status, and revisions', () => {
    expect(moduleInstanceModuleField).toBe('moduleId');
    expect(moduleInstanceStatusField).toBe('status');
    expect(ANALYSIS_MODULE_INSTANCE_CONTRACT).toEqual({
      ownerKind: 'analysis_module_instance',
      identityFields: ['id', 'bookId', 'moduleId', 'scope', 'analysisRevision'],
      statusFieldKind: 'status',
      statusValues: MODULE_INSTANCE_STATUSES,
      bodyAssetKind: 'body',
      reviewAssetKinds: [
        'body',
        'structured_object',
        'evidence_anchor',
        'relation_link',
        'work_technique_observation',
        'reusable_technique_candidate',
        'ai_constraint',
      ],
      reviewStatusFieldKind: 'review_status',
      bodyEditResultKind: 'revision',
    });
    expect(ANALYSIS_MODULE_INSTANCE_CONTRACT.identityFields).not.toContain('moduleKey');
    expect(ANALYSIS_MODULE_INSTANCE_CONTRACT.statusFieldKind).not.toBe(
      ANALYSIS_MODULE_INSTANCE_CONTRACT.reviewStatusFieldKind,
    );
  });

  it('defines ReviewAsset as the shared reviewable asset envelope without making body structured', () => {
    expect(reviewAssetKind).toBe('reusable_technique_candidate');
    expect(ANALYSIS_REVIEW_ASSET_CONTRACT).toEqual({
      ownerKind: 'analysis_module_instance',
      assetKinds: [
        'body',
        'structured_object',
        'evidence_anchor',
        'relation_link',
        'work_technique_observation',
        'reusable_technique_candidate',
        'ai_constraint',
      ],
      bodyAssetKind: 'body',
      structuredAssetKinds: [
        'structured_object',
        'evidence_anchor',
        'relation_link',
        'work_technique_observation',
        'reusable_technique_candidate',
        'ai_constraint',
      ],
      statusFieldKind: 'review_status',
      bodyCarriesStructuredFacts: false,
      structuredAssetsRequireControls: true,
    });
  });
});
