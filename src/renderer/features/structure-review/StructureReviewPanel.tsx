import { useState, type FormEvent, type ReactElement } from 'react';
import type { BookSummary, ContractRequest } from '../../../shared/contracts';
import type { StructureWorkspace } from '../../../shared/contracts/structure';
import type { StructureNodeId, StructureSetId } from '../../../shared/domain';
import { rendererText } from '../../i18n';

export type StructureReviewPanelProps = {
  readonly book: BookSummary;
  readonly workspace: StructureWorkspace | null;
  readonly loading: boolean;
  readonly actionPending: boolean;
  readonly error: string | null;
  readonly onDetect: () => void;
  readonly onRecoverDetection?: () => void;
  readonly onCreateDraft: (replacementFrozenSetId?: StructureSetId) => void;
  readonly onCreateManualDraft: () => void;
  readonly onUpdateNode: (command: ContractRequest<'structure:update-node'>['command']) => void;
  readonly onUpdateRange: (command: ContractRequest<'structure:update-story-range'>['command']) => void;
  readonly onDiscardDraft: () => void;
  readonly onFreeze: () => void;
  readonly onUnfreeze: () => void;
};

export function requestStoryRangeModeChange(
  currentMode: 'included' | 'skipped_by_user',
  update: StructureReviewPanelProps['onUpdateRange'],
  confirm: (message: string) => boolean = globalThis.confirm,
): void {
  if (currentMode === 'included' && !confirm(rendererText.structureReview.skipRangesConfirm)) return;
  update({
    type: 'set-story-range-mode',
    mode: currentMode === 'included' ? 'skipped_by_user' : 'included',
  });
}

export function StructureReviewPanel(props: StructureReviewPanelProps): ReactElement {
  const [title, setTitle] = useState('');
  const [kind, setKind] = useState<'volume' | 'chapter'>('volume');
  const [parentId, setParentId] = useState('');
  const [startOffset, setStartOffset] = useState('0');
  const [endOffset, setEndOffset] = useState('');
  const run = props.workspace?.latestDetectionRun ?? null;
  const candidate = props.workspace?.candidate ?? null;
  const unresolved = candidate ? [...candidate.nodes, ...candidate.storyRanges]
    .filter(({ confidence }) => confidence.level === 'low' &&
      confidence.lowConfidenceResolution === 'unresolved').length : 0;
  const detecting = run?.state === 'queued' || run?.state === 'running';
  const recoveryRequired = props.workspace?.capabilities.blockers
    ?.includes('structure_detection_recovery_required') ?? false;
  return (
    <section className="structure-review-panel" aria-labelledby="structure-review-title">
      <div className="structure-review-header">
        <div>
          <p className="eyebrow">{rendererText.structureReview.eyebrow}</p>
          <h2 id="structure-review-title">{props.book.title}</h2>
        </div>
        {props.workspace?.capabilities.canDetect ? (
          <button type="button" onClick={props.onDetect} disabled={props.actionPending || detecting}>
            {run?.state === 'failed' ? rendererText.structureReview.retry : rendererText.structureReview.detect}
          </button>
        ) : null}
      </div>
      {props.loading ? <p role="status">{rendererText.structureReview.loading}</p> : null}
      {recoveryRequired ? (
        <div className="structure-review-error" role="alert">
          <p>{rendererText.structureReview.recoveryRequired}</p>
          <button type="button" onClick={props.onRecoverDetection} disabled={props.actionPending || !props.onRecoverDetection}>
            {rendererText.structureReview.recoverDetection}
          </button>
        </div>
      ) : run?.state === 'queued' || run?.state === 'running' ? (
        <p role="status">{rendererText.structureReview.detecting(run.state)}</p>
      ) : null}
      {run?.state === 'failed' ? (
        <p className="structure-review-error" role="alert">
          {rendererText.structureReview.detectionFailed(run.failureReason)}
        </p>
      ) : null}
      {props.error ? <p className="structure-review-error" role="alert">{props.error}</p> : null}
      {props.workspace ? (
        <div className="structure-workspace-state" aria-label={rendererText.structureReview.workspaceState}>
          {(['candidate', 'draft', 'frozen'] as const).map((stage) => {
            const freshness = props.workspace!.freshness?.[stage];
            return freshness && freshness.status !== 'fresh' ? <p key={stage} role="status">
              {rendererText.structureReview.freshness(stage, freshness.status, freshness.reasons)}
            </p> : null;
          })}
          {props.workspace.capabilities.blockers.length > 0 ? <p role="status">
            {rendererText.structureReview.blockers(props.workspace.capabilities.blockers)}
          </p> : null}
        </div>
      ) : null}
      {props.workspace?.draft ? (
        <div className="structure-draft-review">
          <div className="structure-lifecycle-header">
            <p role="status">{props.workspace.freshness?.draft?.status === 'stale'
              ? rendererText.structureReview.draftStale(props.workspace.draft.draftRevision)
              : rendererText.structureReview.draftReady(props.workspace.draft.draftRevision)}</p>
            {props.workspace.capabilities.canDiscardDraft ? <button type="button" disabled={props.actionPending} onClick={() => {
              if (globalThis.confirm(rendererText.structureReview.discardConfirm)) props.onDiscardDraft();
            }}>{rendererText.structureReview.discardDraft}</button> : null}
            {props.workspace.capabilities.canFreeze ? <button type="button" disabled={props.actionPending} onClick={props.onFreeze}>{rendererText.structureReview.freeze}</button> : null}
          </div>
          <ul className="structure-node-list" aria-label={rendererText.structureReview.draftNodes}>
            {props.workspace.draft.nodes.map((node) => <li key={node.id}>
              <div><strong>{node.title}</strong><span>{rendererText.structureReview.nodeSummary(node.kind, node.confidence.level)}</span></div>
              {props.workspace!.capabilities.canEditDraft ? (
                <div className="structure-node-actions">
                  <form onSubmit={(event: FormEvent<HTMLFormElement>) => {
                    event.preventDefault();
                    const input = event.currentTarget.elements.namedItem('title') as HTMLInputElement;
                    props.onUpdateNode({ type: 'rename-node', nodeId: node.id, title: input.value });
                  }}>
                    <label>{rendererText.structureReview.renameNode}<input name="title" required defaultValue={node.title} /></label>
                    <button type="submit" disabled={props.actionPending}>{rendererText.structureReview.rename}</button>
                  </form>
                  <form onSubmit={(event: FormEvent<HTMLFormElement>) => {
                    event.preventDefault();
                    const elements = event.currentTarget.elements;
                    props.onUpdateNode({ type: 'set-node-span', nodeId: node.id,
                      startOffset: Number((elements.namedItem('startOffset') as HTMLInputElement).value),
                      endOffset: Number((elements.namedItem('endOffset') as HTMLInputElement).value) });
                  }}>
                    <label>{rendererText.structureReview.startOffset}<input name="startOffset" required type="number" min="0" defaultValue={node.startOffset} /></label>
                    <label>{rendererText.structureReview.endOffset}<input name="endOffset" required type="number" min="1" defaultValue={node.endOffset} /></label>
                    <button type="submit" disabled={props.actionPending}>{rendererText.structureReview.setSpan}</button>
                  </form>
                  {node.kind !== 'book' ? (
                    <>
                      <form onSubmit={(event: FormEvent<HTMLFormElement>) => {
                        event.preventDefault();
                        const elements = event.currentTarget.elements;
                        props.onUpdateNode({ type: 'move-node', nodeId: node.id,
                          parentId: (elements.namedItem('parentId') as HTMLSelectElement).value as StructureNodeId,
                          order: Number((elements.namedItem('order') as HTMLInputElement).value) });
                      }}>
                        <label>{rendererText.structureReview.nodeParent}<select name="parentId" required defaultValue={node.parentId ?? ''}><option value="">{rendererText.structureReview.chooseParent}</option>{props.workspace!.draft!.nodes.filter((parent) => parent.id !== node.id && (parent.kind === 'book' || (node.kind === 'chapter' && parent.kind === 'volume'))).map((parent) => <option key={parent.id} value={parent.id}>{parent.title}</option>)}</select></label>
                        <label>{rendererText.structureReview.nodeOrder}<input name="order" required type="number" min="0" defaultValue={node.order} /></label>
                        <button type="submit" disabled={props.actionPending}>{rendererText.structureReview.moveNode}</button>
                      </form>
                      <button type="button" disabled={props.actionPending} onClick={() => props.onUpdateNode({ type: 'remove-node', nodeId: node.id })}>{rendererText.structureReview.removeNode}</button>
                    </>
                  ) : null}
                </div>
              ) : null}
              {props.workspace!.capabilities.canEditDraft &&
              node.confidence.level === 'low' && node.confidence.lowConfidenceResolution === 'unresolved' ? (
                <button type="button" disabled={props.actionPending} onClick={() => props.onUpdateNode({
                  type: 'accept-node-low-confidence', nodeId: node.id,
                })}>{rendererText.structureReview.acceptLowConfidence}</button>
              ) : null}
            </li>)}
          </ul>
          <section className="structure-range-review" aria-labelledby="story-ranges-title">
            <div className="structure-range-header">
              <h3 id="story-ranges-title">{rendererText.structureReview.storyRanges}</h3>
              <span>{rendererText.structureReview.rangeMode(props.workspace.draft.storyRangeMode)}</span>
              {props.workspace.capabilities.canEditDraft ? (
                <button type="button" disabled={props.actionPending} onClick={() => requestStoryRangeModeChange(
                  props.workspace!.draft!.storyRangeMode,
                  props.onUpdateRange,
                )}>{props.workspace.draft.storyRangeMode === 'included' ? rendererText.structureReview.skipRanges : rendererText.structureReview.includeRanges}</button>
              ) : null}
            </div>
            <ul className="structure-range-list">
              {props.workspace.draft.storyRanges.map((range) => <li key={range.id}>
                <div><strong>{range.title}</strong><span>{rendererText.structureReview.rangeSummary(range.confidence.level, range.suggestedFunctionTags)}</span></div>
                {props.workspace!.capabilities.canEditDraft ? <>
                  <form onSubmit={(event: FormEvent<HTMLFormElement>) => {
                    event.preventDefault();
                    const input = event.currentTarget.elements.namedItem('title') as HTMLInputElement;
                    props.onUpdateRange({ type: 'rename-range', rangeId: range.id, title: input.value });
                  }}><label>{rendererText.structureReview.rangeTitle}<input name="title" required defaultValue={range.title} /></label><button type="submit" disabled={props.actionPending}>{rendererText.structureReview.rename}</button></form>
                  <form onSubmit={(event: FormEvent<HTMLFormElement>) => {
                    event.preventDefault();
                    const input = event.currentTarget.elements.namedItem('tags') as HTMLInputElement;
                    props.onUpdateRange({ type: 'set-range-function-tags', rangeId: range.id,
                      functionTags: input.value.split(',').map((tag) => tag.trim()).filter(Boolean) });
                  }}><label>{rendererText.structureReview.functionTags}<input name="tags" defaultValue={range.suggestedFunctionTags.join(', ')} /></label><button type="submit" disabled={props.actionPending}>{rendererText.structureReview.saveTags}</button></form>
                  <form className="range-geometry-form" onSubmit={(event: FormEvent<HTMLFormElement>) => {
                    event.preventDefault();
                    const elements = event.currentTarget.elements;
                    const chapters = elements.namedItem('chapters') as HTMLSelectElement;
                    props.onUpdateRange({ type: 'set-range-geometry', rangeId: range.id,
                      startOffset: Number((elements.namedItem('startOffset') as HTMLInputElement).value),
                      endOffset: Number((elements.namedItem('endOffset') as HTMLInputElement).value),
                      coveredChapterIds: [...chapters.selectedOptions].map(({ value }) => value as StructureNodeId),
                      boundaryEvidence: [{
                        kind: (elements.namedItem('evidenceKind') as HTMLSelectElement).value as 'chapter_window',
                        startOffset: Number((elements.namedItem('evidenceStart') as HTMLInputElement).value),
                        endOffset: Number((elements.namedItem('evidenceEnd') as HTMLInputElement).value),
                      }] });
                  }}>
                    <label>{rendererText.structureReview.startOffset}<input name="startOffset" required type="number" min="0" defaultValue={range.startOffset} /></label>
                    <label>{rendererText.structureReview.endOffset}<input name="endOffset" required type="number" min="1" defaultValue={range.endOffset} /></label>
                    <label>{rendererText.structureReview.coveredChapters}<select name="chapters" multiple required defaultValue={[...range.coveredChapterIds]}>{props.workspace!.draft!.nodes.filter(({ kind }) => kind === 'chapter').map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.title}</option>)}</select></label>
                    <label>{rendererText.structureReview.boundaryKind}<select name="evidenceKind" defaultValue={range.boundaryEvidence[0]?.kind ?? 'chapter_window'}>{['chapter_window', 'explicit_separator', 'blank_line_cluster', 'markdown_subheading', 'length_window', 'transition_hint'].map((value) => <option key={value} value={value}>{value}</option>)}</select></label>
                    <label>{rendererText.structureReview.evidenceStart}<input name="evidenceStart" required type="number" min="0" defaultValue={range.boundaryEvidence[0]?.startOffset ?? range.startOffset} /></label>
                    <label>{rendererText.structureReview.evidenceEnd}<input name="evidenceEnd" required type="number" min="1" defaultValue={range.boundaryEvidence[0]?.endOffset ?? range.endOffset} /></label>
                    <button type="submit" disabled={props.actionPending}>{rendererText.structureReview.setGeometry}</button>
                  </form>
                  {props.workspace!.capabilities.canEditDraft && range.confidence.level === 'low' && range.confidence.lowConfidenceResolution === 'unresolved' ? <button type="button" disabled={props.actionPending} onClick={() => props.onUpdateRange({ type: 'accept-range-low-confidence', rangeId: range.id })}>{rendererText.structureReview.acceptLowConfidence}</button> : null}
                  <button type="button" disabled={props.actionPending} onClick={() => props.onUpdateRange({ type: 'remove-range', rangeId: range.id })}>{rendererText.structureReview.removeRange}</button>
                </> : null}
              </li>)}
            </ul>
            {props.workspace.capabilities.canEditDraft && props.workspace.draft.storyRangeMode === 'included' ? (
              <form className="add-range-form" onSubmit={(event: FormEvent<HTMLFormElement>) => {
                event.preventDefault();
                const elements = event.currentTarget.elements;
                const start = Number((elements.namedItem('startOffset') as HTMLInputElement).value);
                const end = Number((elements.namedItem('endOffset') as HTMLInputElement).value);
                const chapters = elements.namedItem('chapters') as HTMLSelectElement;
                props.onUpdateRange({ type: 'add-range',
                  title: (elements.namedItem('title') as HTMLInputElement).value,
                  startOffset: start, endOffset: end,
                  coveredChapterIds: [...chapters.selectedOptions].map(({ value }) => value as StructureNodeId),
                  functionTags: (elements.namedItem('tags') as HTMLInputElement).value.split(',').map((tag) => tag.trim()).filter(Boolean),
                  boundaryEvidence: [{ kind: 'chapter_window', startOffset: start, endOffset: end }],
                  startReason: (elements.namedItem('startReason') as HTMLInputElement).value,
                  endReason: (elements.namedItem('endReason') as HTMLInputElement).value });
              }}>
                <h4>{rendererText.structureReview.addRange}</h4>
                <label>{rendererText.structureReview.rangeTitle}<input name="title" required /></label>
                <label>{rendererText.structureReview.startOffset}<input name="startOffset" required type="number" min="0" /></label>
                <label>{rendererText.structureReview.endOffset}<input name="endOffset" required type="number" min="1" /></label>
                <label>{rendererText.structureReview.coveredChapters}<select name="chapters" multiple required>{props.workspace.draft.nodes.filter(({ kind }) => kind === 'chapter').map((chapter) => <option key={chapter.id} value={chapter.id}>{chapter.title}</option>)}</select></label>
                <label>{rendererText.structureReview.functionTags}<input name="tags" /></label>
                <label>{rendererText.structureReview.startReason}<input name="startReason" required /></label>
                <label>{rendererText.structureReview.endReason}<input name="endReason" required /></label>
                <button type="submit" disabled={props.actionPending}>{rendererText.structureReview.addRange}</button>
              </form>
            ) : null}
          </section>
          {props.workspace.capabilities.canEditDraft ? (
            <form className="add-node-form" onSubmit={(event: FormEvent) => {
              event.preventDefault();
              props.onUpdateNode({ type: 'add-node', kind, title,
                parentId: parentId as StructureNodeId,
                order: props.workspace!.draft!.nodes.filter((node) => node.parentId === parentId).length,
                startOffset: Number(startOffset), endOffset: Number(endOffset) });
            }}>
              <h3>{rendererText.structureReview.addNode}</h3>
              <label>{rendererText.structureReview.nodeKind}<select value={kind} onChange={(event) => setKind(event.target.value as 'volume' | 'chapter')}><option value="volume">{rendererText.structureReview.volume}</option><option value="chapter">{rendererText.structureReview.chapter}</option></select></label>
              <label>{rendererText.structureReview.nodeTitle}<input required value={title} onChange={(event) => setTitle(event.target.value)} /></label>
              <label>{rendererText.structureReview.nodeParent}<select required value={parentId} onChange={(event) => setParentId(event.target.value)}><option value="">{rendererText.structureReview.chooseParent}</option>{props.workspace.draft.nodes.filter((node) => node.kind === 'book' || (kind === 'chapter' && node.kind === 'volume')).map((node) => <option key={node.id} value={node.id}>{node.title}</option>)}</select></label>
              <label>{rendererText.structureReview.startOffset}<input required type="number" min="0" value={startOffset} onChange={(event) => setStartOffset(event.target.value)} /></label>
              <label>{rendererText.structureReview.endOffset}<input required type="number" min="1" value={endOffset} onChange={(event) => setEndOffset(event.target.value)} /></label>
              <button type="submit" disabled={props.actionPending}>{rendererText.structureReview.addNode}</button>
            </form>
          ) : null}
        </div>
      ) : null}
      {props.workspace?.capabilities.canCreateManualDraft ? (
        <button type="button" disabled={props.actionPending} onClick={props.onCreateManualDraft}>
          {rendererText.structureReview.createManualDraft}
        </button>
      ) : null}
      {props.workspace?.frozen ? (
        <div className="structure-frozen-summary">
          <h3>{rendererText.structureReview.frozenTitle}</h3>
          <p role="status">{rendererText.structureReview.frozenEdition(props.workspace.frozen.structureEdition)}</p>
          <span>{rendererText.structureReview.frozenCounts(props.workspace.frozen.nodes.length, props.workspace.frozen.storyRanges.length)}</span>
          {props.workspace.capabilities.canUnfreeze ? <button type="button" disabled={props.actionPending} onClick={props.onUnfreeze}>{rendererText.structureReview.unfreeze}</button> : null}
        </div>
      ) : null}
      {candidate ? (
        <div className="structure-candidate-summary">
          <h3>{rendererText.structureReview.candidateTitle}</h3>
          <dl>
            <div><dt>{rendererText.structureReview.nodes}</dt><dd>{candidate.nodes.length}</dd></div>
            <div><dt>{rendererText.structureReview.ranges}</dt><dd>{candidate.storyRanges.length}</dd></div>
            <div><dt>{rendererText.structureReview.unresolved}</dt><dd>{unresolved}</dd></div>
          </dl>
          {props.workspace?.capabilities.canCreateDraft || props.workspace?.capabilities.canCreateReplacementDraft ? (
            <button type="button" onClick={() => props.onCreateDraft(
              props.workspace?.capabilities.canCreateReplacementDraft
                ? props.workspace.frozen?.id : undefined,
            )} disabled={props.actionPending}>
              {props.workspace?.capabilities.canCreateReplacementDraft
                ? rendererText.structureReview.createReplacementDraft
                : rendererText.structureReview.createDraft}
            </button>
          ) : null}
        </div>
      ) : !props.loading && !detecting ? <p>{rendererText.structureReview.noCandidate}</p> : null}
    </section>
  );
}
