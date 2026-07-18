import { z } from 'zod';
import {
  bookClassificationTargetSchema,
  bookTypeBindingDetailSchema,
  bookTypeBindingReadSchema,
  CONTENT_FOCUS_BINDING_LIMIT,
  typeLibraryReleaseOptionsSchema,
} from '../domain/type-library';
import {
  breakdownBookIdSchema,
  typeDefinitionIdSchema,
  typeDefinitionVersionIdSchema,
} from './common';

const positiveVersionSchema = z.number().int().positive();

export const typeLibraryListOptionsRequestSchema = z.object({
  version: positiveVersionSchema.optional(),
}).strict();

export const typeLibraryBookBindingRequestSchema = z.object({
  bookId: breakdownBookIdSchema,
}).strict();

export const typeLibrarySelectionReferenceSchema = z.object({
  typeDefinitionId: typeDefinitionIdSchema,
  typeDefinitionVersionId: typeDefinitionVersionIdSchema,
}).strict();

const uniqueContentFocusSelectionsSchema = z.array(typeLibrarySelectionReferenceSchema)
  .max(CONTENT_FOCUS_BINDING_LIMIT)
  .superRefine((focuses, context) => {
    const definitionIds = new Set<string>();
    const definitionVersionIds = new Set<string>();
    focuses.forEach((focus, index) => {
      if (definitionIds.has(focus.typeDefinitionId) ||
        definitionVersionIds.has(focus.typeDefinitionVersionId)) {
        context.addIssue({
          code: 'custom',
          path: [index],
          message: 'ContentFocus selections must be unique.',
        });
      }
      definitionIds.add(focus.typeDefinitionId);
      definitionVersionIds.add(focus.typeDefinitionVersionId);
    });
  });

export const typeLibrarySelectionSchema = z.object({
  typeLibraryVersion: positiveVersionSchema,
  mainType: typeLibrarySelectionReferenceSchema.nullable(),
  contentFocuses: uniqueContentFocusSelectionsSchema,
}).strict();

export const typeLibraryUpdateBookBindingRequestSchema = z.object({
  bookId: breakdownBookIdSchema,
  expectedRevision: z.number().int().nonnegative(),
  typeLibraryVersion: positiveVersionSchema,
  mainType: typeLibrarySelectionReferenceSchema.nullable(),
  contentFocuses: uniqueContentFocusSelectionsSchema,
}).strict();

export {
  bookClassificationTargetSchema as typeLibraryBookClassificationTargetSchema,
  bookTypeBindingDetailSchema as typeLibraryBookBindingDetailSchema,
  bookTypeBindingReadSchema as typeLibraryBookBindingReadSchema,
  typeLibraryReleaseOptionsSchema,
};

export type TypeLibraryListOptionsRequest = z.infer<typeof typeLibraryListOptionsRequestSchema>;
export type TypeLibraryBookBindingRequest = z.infer<typeof typeLibraryBookBindingRequestSchema>;
export type TypeLibrarySelection = z.infer<typeof typeLibrarySelectionSchema>;
export type TypeLibraryUpdateBookBindingRequest = z.infer<typeof typeLibraryUpdateBookBindingRequestSchema>;
