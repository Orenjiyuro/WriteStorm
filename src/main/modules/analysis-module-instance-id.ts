import { randomUUID } from 'node:crypto';
import type {
  AnalysisModuleId,
  AnalysisModuleInstanceId,
  BreakdownBookId,
  ScopeRef,
} from '../../shared/domain';

export type AnalysisModuleInstanceNaturalIdentity = {
  readonly bookId: BreakdownBookId;
  readonly moduleId: AnalysisModuleId;
  readonly scope: ScopeRef;
};

export type AnalysisModuleInstanceIdFactory = (
  identity: AnalysisModuleInstanceNaturalIdentity,
) => AnalysisModuleInstanceId;

export const createAnalysisModuleInstanceId: AnalysisModuleInstanceIdFactory = () =>
  randomUUID() as AnalysisModuleInstanceId;
