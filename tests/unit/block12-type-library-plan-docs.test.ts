import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { BUILT_IN_CONTENT_FOCUS_OPTION_PROPOSALS } from '../fixtures/type-library/built-in-content-focus-options';
import { BUILT_IN_MAIN_TYPE_OPTION_PROPOSALS } from '../fixtures/type-library/built-in-main-type-options';

const admission = readFileSync(
  'docs/engineering/V1-BLOCK-12-TYPE-LIBRARY-ADMISSION.md',
  'utf8',
);
const continuousPlan = readFileSync(
  'docs/engineering/V1-BLOCK-12-TYPE-LIBRARY-CONTINUOUS-PLAN.md',
  'utf8',
);
const context = readFileSync('docs/engineering/CONTEXT.md', 'utf8');
const decisions = readFileSync('docs/engineering/DECISIONS.md', 'utf8');
const status = readFileSync('docs/engineering/V1-BLOCK-12-STATUS.md', 'utf8');
const typeLibraryContract = readFileSync('src/shared/domain/type-library.ts', 'utf8');
const bindingEditorSource = readFileSync(
  'src/renderer/features/type-library/TypeLibraryBindingEditor.tsx',
  'utf8',
);
const migrationRegistry = readFileSync('src/main/db/migrations/index.ts', 'utf8');
const repositorySource = readFileSync(
  'src/main/type-library/type-library-repository.ts',
  'utf8',
);
const serviceSource = readFileSync(
  'src/main/type-library/type-library-service.ts',
  'utf8',
);
const ipcSource = readFileSync('src/main/type-library/type-library-ipc.ts', 'utf8');
const preloadSource = readFileSync('src/preload/writestorm-api.ts', 'utf8');

describe('Block 12 TypeLibrary governance documents', () => {
  it('records Task 12.6D.5 packaged Electron acceptance without claiming Task 12.7', () => {
    expect(admission).toContain('Status: Approved governance override');
    expect(continuousPlan).toContain('Status: Approved governed plan');
    expect(context).toContain('overrides the historical master Task 12.6–12.9 assumptions');
    expect(decisions).toContain('D061: TypeLibrary Electron Acceptance Completes Task 12.6D.5');
    expect(admission).toContain('D061 completes Task 12.6D.5');
    expect(continuousPlan).toContain('Task 12.6D.5 is complete');
    expect(continuousPlan).toContain('stops before separately authorized Task 12.7');
  });

  it('records seven confirmed MainType descriptions and their separately released identities', () => {
    expect(BUILT_IN_MAIN_TYPE_OPTION_PROPOSALS).toHaveLength(7);
    for (const option of BUILT_IN_MAIN_TYPE_OPTION_PROPOSALS) {
      expect(admission).toContain(option.displayName);
      expect(admission).toContain(option.selectionDescription);
      expect(continuousPlan).toContain(option.displayName);
    }
    expect(admission).toContain('D052 now publishes their approved K1 stable keys');
    expect(continuousPlan).toContain('Task 12.6B is complete');
  });

  it('records seven confirmed ContentFocus descriptions without inventing methodology', () => {
    expect(BUILT_IN_CONTENT_FOCUS_OPTION_PROPOSALS).toHaveLength(7);
    for (const option of BUILT_IN_CONTENT_FOCUS_OPTION_PROPOSALS) {
      expect(admission).toContain(option.displayName);
      expect(admission).toContain(option.selectionDescription);
      expect(continuousPlan).toContain(option.displayName);
    }
    expect(continuousPlan).toContain('Task 12.6C is complete');
  });

  it('makes selection user-only and rejects the former classifier review scope', () => {
    for (const document of [admission, continuousPlan]) {
      expect(document).toContain('user_only');
      expect(document).toContain('does not automatically classify');
      expect(document).toContain('Block 14');
      expect(document).not.toContain('definition_review');
      expect(document).not.toContain('taxonomy_validation_review');
      expect(document).not.toContain('validationCorpus');
      expect(document).not.toContain('entryConditions');
    }

    expect(context).toContain('WriteStorm never automatically classifies a Book');
    expect(decisions).toContain('the user alone selects it');
  });

  it('keeps import optional and analysis blockers specific', () => {
    for (const document of [admission, continuousPlan, decisions]) {
      expect(document).toContain('missing_main_type');
      expect(document).toContain('type_definition_version_unavailable');
      expect(document).toContain('methodology_not_ready');
      expect(document).toContain('prompt_not_ready');
      expect(document).toContain('schema_not_ready');
      expect(document).toContain('composition_conflict');
    }
    expect(admission).toContain('Import works without selecting a type');
    expect(continuousPlan).toContain('optional import-time selection');
    expect(continuousPlan).toContain('later editing');
  });

  it('separates definition, analysis, and Prompt version ownership', () => {
    for (const document of [admission, continuousPlan, decisions]) {
      expect(document).toContain('EffectiveMethodologySnapshot');
      expect(document).toContain('EffectivePromptSnapshot');
      expect(document).toContain('PromptTemplateRegistryEntry');
      expect(document).toContain('PromptTemplateVersion');
      expect(document).toContain('sampleGateStatus');
      expect(document).toContain('activationStatus');
      expect(document).toContain('AnalysisConfigurationSnapshot');
    }
    expect(admission).toContain('Task 12.7: Custom Type Disabled Shell');
  });

  it('records shared contracts and only the admitted persistence migrations', () => {
    expect(admission).toContain('Tasks 12.6A–12.6C are complete');
    expect(continuousPlan).toContain('Status: complete for shared domain contracts');
    expect(context).toContain('Task 12.6A implements that governance boundary');

    for (const contractName of [
      'builtInTypeOptionProposalSchema',
      'TYPE_SELECTION_POLICY',
      'typeDefinitionVersionSchema',
      'effectiveMethodologySnapshotSchema',
      'effectivePromptSnapshotSchema',
      'evaluateTypeLibraryAnalysisReadiness',
      'createEditedPromptTemplateDraft',
    ]) {
      expect(typeLibraryContract).toContain(contractName);
    }

    expect(migrationRegistry).toContain('TYPE_LIBRARY_REGISTRY_MIGRATION');
    expect(migrationRegistry).toContain('TYPE_LIBRARY_BOOK_BINDINGS_MIGRATION');
    expect(repositorySource).toContain('listReleaseOptions');
    expect(repositorySource).toContain('getBookBinding');
    expect(repositorySource).toContain('invalid_persisted_book_type_binding');
    expect(repositorySource).toContain('replaceBookBinding');
    expect(serviceSource).toContain('expectedRevision');
    expect(serviceSource).toContain('TypeLibraryBookBindingMutationPort');
    expect(serviceSource).not.toContain('ipcMain');
    expect(ipcSource).toContain("'type-library:update-book-binding'");
    expect(ipcSource).toContain('TYPE_LIBRARY_ERROR');
    expect(preloadSource).toContain('typeLibrary:');
    expect(preloadSource).not.toContain('databasePath');
  });

  it('records the constant-query BookSummary classification read rule', () => {
    expect(decisions).toContain('D060 remediation in Task 12.6R3');
    expect(context).toContain('Task 12.6R3 removes the Book list classification N+1');
    expect(continuousPlan).toContain(
      'Book list classification display reads at exactly three SQL queries',
    );
  });

  it('records the recoverable CAS conflict renderer path', () => {
    expect(decisions).toContain('D060 remediation in Task 12.6R4');
    expect(context).toContain('Task 12.6R4 closes the renderer CAS recovery gap');
    expect(admission).toContain('dirty user draft is never overwritten by the conflict refetch');
    expect(continuousPlan).toContain('Retry my selection');
    expect(continuousPlan).toContain('Load latest saved classification');
  });

  it('records one shared readiness authority for domain and renderer', () => {
    for (const document of [context, decisions, status]) {
      expect(document).toContain('D074');
      expect(document).toContain('evaluateTypeLibraryAnalysisReadiness');
      expect(document).toContain('localized blocker reasons');
    }
    expect(typeLibraryContract).toContain('BLOCK_12_ANALYSIS_READINESS_DEPENDENCIES');
    expect(bindingEditorSource).toContain('evaluateTypeLibraryAnalysisReadiness');
  });

  it('records short selector labels with separate selection descriptions', () => {
    for (const document of [context, decisions, status]) {
      expect(document).toContain('D075');
      expect(document).toContain('short display name');
      expect(document).toContain('selection description below the control');
      expect(document).toContain('archived selection');
    }
    expect(bindingEditorSource).toContain('type-library-selection-description');
    expect(bindingEditorSource).not.toContain(
      '{option.displayName} — {option.selectionDescription}',
    );
  });
});
