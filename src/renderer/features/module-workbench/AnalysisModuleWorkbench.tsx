import { useState, type ReactElement } from 'react';
import type { ModuleInstanceSummary } from '../../../shared/contracts';
import {
  ANALYSIS_MODULE_DEFINITIONS,
  createAnalysisModuleAssetPlaceholders,
  type AnalysisModuleDefinition,
  type ModuleInstanceStatus,
  type ScopeRef,
} from '../../../shared/domain';
import { rendererText } from '../../i18n';

export type AnalysisModuleWorkbenchProps = {
  readonly instances: readonly ModuleInstanceSummary[];
  readonly initialSelectedInstanceId?: string;
};

type WorkbenchItem = {
  readonly definition: AnalysisModuleDefinition;
  readonly instance: ModuleInstanceSummary;
};

export const ANALYSIS_MODULE_DISABLED_ACTIONS = [
  {
    key: 'analysis',
    label: rendererText.moduleWorkbench.actions.runAnalysis,
    reason: rendererText.moduleWorkbench.actions.analysisDisabledReason,
  },
  {
    key: 'rerun',
    label: rendererText.moduleWorkbench.actions.rerunModule,
    reason: rendererText.moduleWorkbench.actions.rerunDisabledReason,
  },
  {
    key: 'diff',
    label: rendererText.moduleWorkbench.actions.viewRerunDiff,
    reason: rendererText.moduleWorkbench.actions.diffDisabledReason,
  },
] as const;

export function AnalysisModuleWorkbench(
  props: AnalysisModuleWorkbenchProps,
): ReactElement {
  const items = createWorkbenchItems(props.instances);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(
    props.initialSelectedInstanceId ?? items[0]?.instance.id ?? null,
  );
  const selected = items.find(({ instance }) => instance.id === selectedInstanceId) ?? items[0];
  const hasUnknownModule = items.length !== props.instances.length;

  return (
    <section className="analysis-module-workbench" aria-labelledby="analysis-workbench-title">
      <header className="analysis-workbench-header">
        <div>
          <p className="eyebrow">{rendererText.moduleWorkbench.eyebrow}</p>
          <h2 id="analysis-workbench-title">{rendererText.moduleWorkbench.title}</h2>
        </div>
        <span>{rendererText.moduleWorkbench.instanceCount(items.length)}</span>
      </header>
      {hasUnknownModule ? (
        <p className="analysis-workbench-error" role="alert">
          {rendererText.moduleWorkbench.contractUnavailable}
        </p>
      ) : null}
      {items.length === 0 ? (
        <p>{rendererText.moduleWorkbench.empty}</p>
      ) : (
        <div className="analysis-workbench-layout">
          <nav aria-label={rendererText.moduleWorkbench.moduleListLabel}>
            <ul className="analysis-module-list">
              {items.map(({ definition, instance }) => {
                const selectedItem = selected?.instance.id === instance.id;
                return (
                  <li key={instance.id}>
                    <button
                      type="button"
                      aria-pressed={selectedItem}
                      onClick={() => setSelectedInstanceId(instance.id)}
                    >
                      <strong>{definition.name}</strong>
                      <span>{scopeLabel(instance.scope)}</span>
                      <span>{statusLabel(instance.status)}</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          </nav>
          {selected ? <ModuleInstanceDetail item={selected} /> : null}
        </div>
      )}
    </section>
  );
}

function ModuleInstanceDetail({ item }: { readonly item: WorkbenchItem }): ReactElement {
  const bodyPlaceholder = createAnalysisModuleAssetPlaceholders(item.definition.key)
    .find(({ slotKind }) => slotKind === 'body');

  return (
    <article className="analysis-module-detail" aria-labelledby="analysis-module-detail-title">
      <header>
        <p className="readout-label">{item.definition.key}</p>
        <h3 id="analysis-module-detail-title">{item.definition.name}</h3>
      </header>
      <dl>
        <div>
          <dt>{rendererText.moduleWorkbench.scope}</dt>
          <dd>{scopeLabel(item.instance.scope)}</dd>
        </div>
        <div>
          <dt>{rendererText.moduleWorkbench.status}</dt>
          <dd>{statusLabel(item.instance.status)}</dd>
        </div>
        <div>
          <dt>{rendererText.moduleWorkbench.structureEdition}</dt>
          <dd>{item.instance.structureEdition}</dd>
        </div>
        <div>
          <dt>{rendererText.moduleWorkbench.analysisRevision}</dt>
          <dd>{item.instance.analysisRevision}</dd>
        </div>
      </dl>
      <section className="analysis-module-body" aria-labelledby="analysis-module-body-title">
        <h4 id="analysis-module-body-title">{rendererText.moduleWorkbench.body}</h4>
        <p>{bodyPlaceholder?.emptyState ?? rendererText.moduleWorkbench.emptyAsset}</p>
      </section>
      <section className="analysis-module-actions" aria-labelledby="analysis-module-actions-title">
        <h4 id="analysis-module-actions-title">{rendererText.moduleWorkbench.actions.title}</h4>
        <ul>
          {ANALYSIS_MODULE_DISABLED_ACTIONS.map((action) => {
            const reasonId = `analysis-action-${action.key}-reason`;
            return (
              <li key={action.key}>
                <button type="button" disabled aria-describedby={reasonId}>
                  {action.label}
                </button>
                <p id={reasonId}>{action.reason}</p>
              </li>
            );
          })}
        </ul>
      </section>
    </article>
  );
}

function createWorkbenchItems(
  instances: readonly ModuleInstanceSummary[],
): WorkbenchItem[] {
  return ANALYSIS_MODULE_DEFINITIONS.flatMap((definition) =>
    instances
      .filter(({ moduleId }) => moduleId === definition.id)
      .map((instance) => ({ definition, instance })),
  );
}

function scopeLabel(scope: ScopeRef): string {
  switch (scope.kind) {
    case 'book':
      return rendererText.moduleWorkbench.scopeLabels.book;
    case 'volume':
      return rendererText.moduleWorkbench.scopeLabels.volume(scope.nodeId);
    case 'chapter':
      return rendererText.moduleWorkbench.scopeLabels.chapter(scope.nodeId);
    case 'story_segment_range':
      return rendererText.moduleWorkbench.scopeLabels.storySegmentRange(scope.rangeId);
  }
}

function statusLabel(status: ModuleInstanceStatus): string {
  return rendererText.moduleWorkbench.statusLabels[status];
}
