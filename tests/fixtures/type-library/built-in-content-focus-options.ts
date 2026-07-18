import {
  BUILT_IN_CONTENT_FOCUS_OPTIONS_V1,
  type BuiltInTypeOptionProposal,
} from '../../../src/shared/domain';

export const BUILT_IN_CONTENT_FOCUS_OPTION_PROPOSALS = BUILT_IN_CONTENT_FOCUS_OPTIONS_V1.map((option) => ({
  proposalId: `released-${option.definition.stableKey}`,
  kind: option.definition.kind,
  displayName: option.definitionVersion.displayName,
  ownerKind: 'source_controlled_admission_asset' as const,
  confirmationStatus: 'confirmed' as const,
  selectionDescription: option.definitionVersion.selectionDescription,
  stableKey: option.definition.stableKey,
  selectionAuthority: 'user_only' as const,
  automaticClassification: false as const,
  methodologyOwner: 'block_14' as const,
})) satisfies readonly BuiltInTypeOptionProposal[];
