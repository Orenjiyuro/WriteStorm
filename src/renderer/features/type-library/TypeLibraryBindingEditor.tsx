import type { ChangeEvent, ReactElement } from 'react';
import {
  BLOCK_12_ANALYSIS_READINESS_DEPENDENCIES,
  CONTENT_FOCUS_BINDING_LIMIT,
  evaluateTypeLibraryAnalysisReadiness,
  type TypeDefinitionVersionReference,
  type TypeLibraryAnalysisReadinessDependencies,
  type TypeLibraryPinnedOption,
  type TypeLibraryReleaseOptions,
} from '../../../shared/domain';
import { rendererText } from '../../i18n';
import { CustomTypeDisabledShell } from './CustomTypeDisabledShell';

export type TypeLibrarySelectionValue = {
  readonly mainType: TypeDefinitionVersionReference | null;
  readonly contentFocuses: readonly TypeDefinitionVersionReference[];
};

export type TypeLibraryBindingEditorProps = {
  readonly idPrefix: string;
  readonly title: string;
  readonly options: TypeLibraryReleaseOptions | null;
  readonly pinnedOptions?: readonly TypeLibraryPinnedOption[];
  readonly value: TypeLibrarySelectionValue;
  readonly pending: boolean;
  readonly error: string | null;
  readonly conflict?: boolean;
  readonly readinessDependencies?: TypeLibraryAnalysisReadinessDependencies;
  readonly onChange: (value: TypeLibrarySelectionValue) => void;
  readonly onSave?: () => void;
  readonly onLoadLatest?: () => void;
};

export function TypeLibraryBindingEditor(
  props: TypeLibraryBindingEditorProps,
): ReactElement {
  const mainTypes = mergePinnedOptions(props, 'main_type');
  const contentFocuses = mergePinnedOptions(props, 'content_focus');
  const selectedMainType = findDisplayOption(mainTypes, props.value.mainType);
  const selectedReferences = [
    ...(props.value.mainType ? [props.value.mainType] : []),
    ...props.value.contentFocuses,
  ];
  const selectableVersionIds = new Set([...mainTypes, ...contentFocuses]
    .filter((option) => option.availability === 'current_selectable')
    .map((option) => option.typeDefinitionVersionId));
  const readiness = evaluateTypeLibraryAnalysisReadiness({
    mainType: props.value.mainType,
    contentFocuses: props.value.contentFocuses.map((focus, index) => ({
      ...focus,
      priority: index + 1,
    })),
    unavailableTypeDefinitionVersionIds: selectedReferences
      .filter((reference) => !selectableVersionIds.has(reference.typeDefinitionVersionId))
      .map((reference) => reference.typeDefinitionVersionId),
    ...(props.readinessDependencies ?? BLOCK_12_ANALYSIS_READINESS_DEPENDENCIES),
  });

  const updateMainType = (event: ChangeEvent<HTMLSelectElement>): void => {
    props.onChange({
      ...props.value,
      mainType: findReference(mainTypes, event.target.value),
    });
  };
  const updateFocus = (index: number, event: ChangeEvent<HTMLSelectElement>): void => {
    const selected = findReference(contentFocuses, event.target.value);
    const next = [...props.value.contentFocuses];
    if (selected) next[index] = selected;
    else next.splice(index, 1);
    props.onChange({ ...props.value, contentFocuses: compactUnique(next) });
  };

  return (
    <section className="type-library-editor" aria-labelledby={`${props.idPrefix}-title`}>
      <div className="type-library-editor-heading">
        <div>
          <p className="readout-label">{rendererText.typeLibraryBinding.userSelectedLabel}</p>
          <h3 id={`${props.idPrefix}-title`}>{props.title}</h3>
        </div>
        <span>{rendererText.typeLibraryBinding.inferenceOff}</span>
      </div>
      <p className="type-library-help">
        {rendererText.typeLibraryBinding.selectionHelp}
      </p>
      <div className="type-library-selectors">
        <label htmlFor={`${props.idPrefix}-main-type`}>
          {rendererText.typeLibraryBinding.mainTypeLabel}
          <select
            id={`${props.idPrefix}-main-type`}
            value={props.value.mainType?.typeDefinitionVersionId ?? ''}
            onChange={updateMainType}
            disabled={props.pending || props.options === null}
            aria-describedby={selectedMainType
              ? `${props.idPrefix}-main-type-description`
              : undefined}
          >
            <option value="">{rendererText.typeLibraryBinding.unassignedOption}</option>
            {mainTypes.map((option) => (
              <option
                key={option.typeDefinitionVersionId}
                value={option.typeDefinitionVersionId}
                disabled={option.availability === 'archived'}
              >
                {option.displayName}
              </option>
            ))}
          </select>
          {selectedMainType ? (
            <span
              className="type-library-selection-description"
              id={`${props.idPrefix}-main-type-description`}
            >
              {formatSelectionDescription(selectedMainType)}
            </span>
          ) : null}
        </label>
        {Array.from({ length: CONTENT_FOCUS_BINDING_LIMIT }, (_, index) => {
          const selected = props.value.contentFocuses[index] ?? null;
          const selectedOption = findDisplayOption(contentFocuses, selected);
          const selectedVersions = new Set(props.value.contentFocuses.map(
            (focus) => focus.typeDefinitionVersionId,
          ));
          return (
            <label key={index} htmlFor={`${props.idPrefix}-focus-${index + 1}`}>
              {rendererText.typeLibraryBinding.contentFocusPriority(index + 1)}
              <select
                id={`${props.idPrefix}-focus-${index + 1}`}
                value={selected?.typeDefinitionVersionId ?? ''}
                onChange={(event) => updateFocus(index, event)}
                disabled={props.pending || props.options === null}
                aria-describedby={selectedOption
                  ? `${props.idPrefix}-focus-${index + 1}-description`
                  : undefined}
              >
                <option value="">{rendererText.typeLibraryBinding.noContentFocus}</option>
                {contentFocuses.map((option) => (
                  <option
                    key={option.typeDefinitionVersionId}
                    value={option.typeDefinitionVersionId}
                    disabled={(
                      selectedVersions.has(option.typeDefinitionVersionId) &&
                      selected?.typeDefinitionVersionId !== option.typeDefinitionVersionId
                    ) || option.availability === 'archived'}
                  >
                    {option.displayName}
                  </option>
                ))}
              </select>
              {selectedOption ? (
                <span
                  className="type-library-selection-description"
                  id={`${props.idPrefix}-focus-${index + 1}-description`}
                >
                  {formatSelectionDescription(selectedOption)}
                </span>
              ) : null}
            </label>
          );
        })}
      </div>
      {props.conflict ? (
        <aside
          className="type-library-conflict"
          role="alert"
          aria-labelledby={`${props.idPrefix}-conflict-title`}
        >
          <strong id={`${props.idPrefix}-conflict-title`}>
            {rendererText.typeLibraryBinding.conflictTitle}
          </strong>
          <p>{rendererText.typeLibraryBinding.conflictBody}</p>
        </aside>
      ) : null}
      {props.onSave ? (
        <div className="type-library-actions">
          <button type="button" onClick={props.onSave} disabled={props.pending || props.options === null}>
            {props.pending
              ? rendererText.typeLibraryBinding.saving
              : props.conflict
                ? rendererText.typeLibraryBinding.retrySelection
                : rendererText.typeLibraryBinding.save}
          </button>
          {props.conflict && props.onLoadLatest ? (
            <button type="button" onClick={props.onLoadLatest} disabled={props.pending}>
              {rendererText.typeLibraryBinding.loadLatest}
            </button>
          ) : null}
        </div>
      ) : null}
      <CustomTypeDisabledShell idPrefix={props.idPrefix} />
      <div className="type-library-readiness" role="status">
        <strong>{readiness.ready
          ? rendererText.typeLibraryBinding.readinessReadyTitle
          : readiness.title}</strong>
        {readiness.ready ? (
          <span>{rendererText.typeLibraryBinding.readinessReadyDescription}</span>
        ) : (
          <ul aria-label={rendererText.typeLibraryBinding.readinessBlockersLabel}>
            {readiness.blockerCodes.map((code) => (
              <li key={code} data-blocker-code={code}>
                {rendererText.typeLibraryBinding.readinessReason(code)}
              </li>
            ))}
          </ul>
        )}
      </div>
      {props.error ? <p className="error-copy" role="alert">{props.error}</p> : null}
    </section>
  );
}

function findReference(
  options: readonly DisplayOption[],
  versionId: string,
): TypeDefinitionVersionReference | null {
  const option = options.find((candidate) => candidate.typeDefinitionVersionId === versionId);
  return option ? {
    typeDefinitionId: option.typeDefinitionId,
    typeDefinitionVersionId: option.typeDefinitionVersionId,
  } : null;
}

type DisplayOption = Omit<TypeLibraryPinnedOption, 'availability'> & {
  readonly availability: TypeLibraryPinnedOption['availability'];
};

function findDisplayOption(
  options: readonly DisplayOption[],
  reference: TypeDefinitionVersionReference | null,
): DisplayOption | null {
  return reference
    ? options.find((option) =>
      option.typeDefinitionVersionId === reference.typeDefinitionVersionId) ?? null
    : null;
}

function formatSelectionDescription(option: DisplayOption): string {
  return option.availability === 'archived'
    ? `${rendererText.typeLibraryBinding.archivedSelection} · ${option.selectionDescription}`
    : option.selectionDescription;
}

function mergePinnedOptions(
  props: TypeLibraryBindingEditorProps,
  kind: TypeLibraryPinnedOption['kind'],
): DisplayOption[] {
  const selectable = (props.options?.options ?? [])
    .filter((option) => option.kind === kind)
    .map(({ sortOrder: _sortOrder, ...option }) => ({
      ...option,
      availability: 'current_selectable' as const,
    }));
  const selectableVersionIds = new Set(selectable.map(
    (option) => option.typeDefinitionVersionId,
  ));
  const archivedPinned = (props.pinnedOptions ?? []).filter((option) =>
    option.kind === kind && option.availability === 'archived' &&
    !selectableVersionIds.has(option.typeDefinitionVersionId));
  return [...selectable, ...archivedPinned];
}

function compactUnique(
  references: readonly TypeDefinitionVersionReference[],
): TypeDefinitionVersionReference[] {
  const versions = new Set<string>();
  return references.filter((reference) => {
    if (versions.has(reference.typeDefinitionVersionId)) return false;
    versions.add(reference.typeDefinitionVersionId);
    return true;
  }).slice(0, CONTENT_FOCUS_BINDING_LIMIT);
}
