import { describe, expect, it } from 'vitest';
import {
  REUSABLE_TECHNIQUE_CANDIDATE_CONTENT_POLICY,
  createProblemSolutionPatternSchema,
  createReusableTechniqueCandidateSchema,
  isReusableTechniqueCandidateContentShapeSafe,
  reusableTechniqueCandidateSchema,
  type ProblemSolutionPattern,
  type ReusableTechniqueCandidate,
  type ReusableTechniqueCandidateId,
  type TechniqueDeproprietizedText,
  type WorkTechniqueObservationId,
} from '../../src/shared/domain';
import type { BreakdownBookId, EvidenceAnchorId } from '../../src/shared/domain';

const bookId = 'book-1' as BreakdownBookId;
const evidenceAnchorId = 'evidence-1' as EvidenceAnchorId;
const candidateId = 'candidate-1' as ReusableTechniqueCandidateId;
const observationId = 'observation-1' as WorkTechniqueObservationId;

const reusablePrinciple = {
  kind: 'reusable_principle',
  text: 'Escalate a private choice into a public consequence through a visible rule change.',
  excludes: [
    'character_names',
    'proprietary_setting_terms',
    'original_sentences',
    'character_specific_actions',
    'plot_reenactment',
  ],
} satisfies TechniqueDeproprietizedText;

const applicableScope = {
  kind: 'applicable_scope',
  text: 'Works for turning a local dilemma into a chapter-level reversal in speculative or suspense scenes.',
  excludes: [
    'character_names',
    'proprietary_setting_terms',
    'original_sentences',
    'character_specific_actions',
    'plot_reenactment',
  ],
} satisfies TechniqueDeproprietizedText;

const limitation = {
  kind: 'limitation',
  text: 'Requires an established rule whose visible consequence can be understood without copying source lore.',
  excludes: [
    'character_names',
    'proprietary_setting_terms',
    'original_sentences',
    'character_specific_actions',
    'plot_reenactment',
  ],
} satisfies TechniqueDeproprietizedText;

const problemSolutionPattern = {
  problemType: {
    kind: 'problem_type',
    text: 'Private choice needs public consequence.',
    excludes: [
      'character_names',
      'proprietary_setting_terms',
      'original_sentences',
      'character_specific_actions',
      'plot_reenactment',
    ],
  },
  setupConditions: {
    kind: 'setup_conditions',
    text: 'A local decision has stakes but lacks visible story pressure.',
    excludes: [
      'character_names',
      'proprietary_setting_terms',
      'original_sentences',
      'character_specific_actions',
      'plot_reenactment',
    ],
  },
  solutionMechanism: {
    kind: 'solution_mechanism',
    text: 'Externalize the decision through a rule change other people can react to.',
    excludes: [
      'character_names',
      'proprietary_setting_terms',
      'original_sentences',
      'character_specific_actions',
      'plot_reenactment',
    ],
  },
  rhythmPosition: {
    kind: 'rhythm_position',
    text: 'Mid-scene reversal.',
    excludes: [
      'character_names',
      'proprietary_setting_terms',
      'original_sentences',
      'character_specific_actions',
      'plot_reenactment',
    ],
  },
  emotionalFunction: {
    kind: 'emotional_function',
    text: 'Converts hesitation into urgency.',
    excludes: [
      'character_names',
      'proprietary_setting_terms',
      'original_sentences',
      'character_specific_actions',
      'plot_reenactment',
    ],
  },
  applicableLimits: [
    {
      kind: 'applicable_limit',
      text: 'Requires a previously established rule.',
      excludes: [
        'character_names',
        'proprietary_setting_terms',
        'original_sentences',
        'character_specific_actions',
        'plot_reenactment',
      ],
    },
    {
      kind: 'applicable_limit',
      text: 'Avoid copying source-specific lore or sequence.',
      excludes: [
        'character_names',
        'proprietary_setting_terms',
        'original_sentences',
        'character_specific_actions',
        'plot_reenactment',
      ],
    },
  ],
} satisfies ProblemSolutionPattern;

const candidate = {
  id: candidateId,
  ownerKind: 'breakdown_book',
  bookId,
  sourceObservationIds: [observationId],
  evidenceAnchorIds: [evidenceAnchorId],
  reusablePrinciple,
  applicableScope,
  limitations: [limitation],
  problemSolutionPattern,
} satisfies ReusableTechniqueCandidate;

const forbiddenFixture = {
  characterName: 'Lin Qiu',
  proprietarySettingTerm: 'Mirror Dominion',
  originalSentence: 'Lin Qiu opened the mirror gate and the city answered in blue fire.',
  directCharacterTechnique: 'Lin Qiu turns the Mirror Dominion oath into a blue-fire city alarm.',
  bridgeLevelReenactment:
    'A named hero opens the mirror gate, the city answers in blue fire, and every oath becomes a key.',
};

const invalidMissingPrinciple = {
  id: candidateId,
  ownerKind: 'breakdown_book',
  bookId,
  sourceObservationIds: [observationId],
  evidenceAnchorIds: [evidenceAnchorId],
  applicableScope,
  limitations: [limitation],
  problemSolutionPattern,
  // @ts-expect-error ReusableTechniqueCandidate must contain reusablePrinciple.
} satisfies ReusableTechniqueCandidate;

const invalidCharacterField = {
  ...candidate,
  // @ts-expect-error ReusableTechniqueCandidate must not preserve character names as fields.
  characterName: forbiddenFixture.characterName,
} satisfies ReusableTechniqueCandidate;

const invalidSettingField = {
  ...candidate,
  // @ts-expect-error ReusableTechniqueCandidate must not preserve proprietary setting fields.
  proprietarySettingName: forbiddenFixture.proprietarySettingTerm,
} satisfies ReusableTechniqueCandidate;

const invalidOriginalSentenceField = {
  ...candidate,
  // @ts-expect-error ReusableTechniqueCandidate must not preserve original source sentences.
  originalSentence: forbiddenFixture.originalSentence,
} satisfies ReusableTechniqueCandidate;

const invalidCharacterSpecificPattern = {
  ...problemSolutionPattern,
  // @ts-expect-error ProblemSolutionPattern stores abstract mechanism fields, not character-specific actions.
  characterSpecificAction: forbiddenFixture.directCharacterTechnique,
} satisfies ProblemSolutionPattern;

describe('reusable technique candidate deproprietization contract', () => {
  it('requires reusable principle, applicable scope, limitations, and ProblemSolutionPattern', () => {
    expect(candidate.reusablePrinciple).toEqual(reusablePrinciple);
    expect(candidate.applicableScope).toEqual(applicableScope);
    expect(candidate.limitations).toEqual([limitation]);
    expect(candidate.problemSolutionPattern).toEqual(problemSolutionPattern);
  });

  it('locks forbidden fields and bridge-level references into an abstract pattern', () => {
    expect(REUSABLE_TECHNIQUE_CANDIDATE_CONTENT_POLICY).toEqual({
      requiredFields: ['reusablePrinciple', 'applicableScope', 'limitations', 'problemSolutionPattern'],
      forbiddenFieldNames: [
        'characterName',
        'roleName',
        'proprietarySettingName',
        'properSettingName',
        'originalSentence',
        'originalText',
        'bridgeExcerpt',
        'characterSpecificTechnique',
      ],
      forbiddenContentKinds: [
        'character_names',
        'proprietary_setting_terms',
        'original_sentences',
        'character_specific_actions',
        'plot_reenactment',
      ],
      bridgeLevelReferenceFormat: 'problem_solution_pattern',
      mayStoreCharacterSpecificTechnique: false,
      mayStoreBridgeLevelOriginalExpression: false,
    });
  });

  it('rejects character-specific technique text, proprietary settings, original sentences, and bridge reenactments', () => {
    const unsafeTexts = [
      forbiddenFixture.characterName,
      forbiddenFixture.proprietarySettingTerm,
      forbiddenFixture.originalSentence,
      forbiddenFixture.directCharacterTechnique,
      forbiddenFixture.bridgeLevelReenactment,
    ];

    for (const unsafeText of unsafeTexts) {
      expect(
        isReusableTechniqueCandidateContentShapeSafe(
          {
            ...reusablePrinciple,
            text: unsafeText,
          },
          forbiddenFixture,
        ),
      ).toBe(false);
    }

    expect(isReusableTechniqueCandidateContentShapeSafe(reusablePrinciple, forbiddenFixture)).toBe(true);
  });

  it('rejects forbidden content inside ProblemSolutionPattern fields at runtime', () => {
    expect(createProblemSolutionPatternSchema(forbiddenFixture).safeParse(problemSolutionPattern).success).toBe(true);

    expect(
      createProblemSolutionPatternSchema(forbiddenFixture).safeParse({
        ...problemSolutionPattern,
        solutionMechanism: {
          ...problemSolutionPattern.solutionMechanism,
          text: forbiddenFixture.directCharacterTechnique,
        },
      }).success,
    ).toBe(false);

    expect(
      createProblemSolutionPatternSchema(forbiddenFixture).safeParse({
        ...problemSolutionPattern,
        applicableLimits: [
          {
            ...problemSolutionPattern.applicableLimits[0],
            text: forbiddenFixture.bridgeLevelReenactment,
          },
        ],
      }).success,
    ).toBe(false);
  });

  it('rejects plain object candidates with incomplete redaction proof or forbidden fields at runtime', () => {
    expect(reusableTechniqueCandidateSchema.safeParse(candidate).success).toBe(true);

    expect(
      reusableTechniqueCandidateSchema.safeParse({
        ...candidate,
        reusablePrinciple: {
          ...reusablePrinciple,
          excludes: [],
        },
      }).success,
    ).toBe(false);

    expect(
      createReusableTechniqueCandidateSchema(forbiddenFixture).safeParse({
        ...candidate,
        problemSolutionPattern: {
          ...problemSolutionPattern,
          solutionMechanism: {
            ...problemSolutionPattern.solutionMechanism,
            text: forbiddenFixture.originalSentence,
          },
        },
        characterName: forbiddenFixture.characterName,
      }).success,
    ).toBe(false);
  });
});
