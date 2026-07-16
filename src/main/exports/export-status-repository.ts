import type {
  AnalysisModuleId,
  BreakdownBookId,
  ModuleInstanceStatus,
} from '../../shared/domain';
import type { SqliteDatabase } from '../db/sqlite';

export type ExportModuleFact = {
  readonly moduleId: AnalysisModuleId;
  readonly status: ModuleInstanceStatus;
  readonly bodyMarkdown: string;
};

export class ExportStatusRepository {
  listBookScopeModuleFacts(
    database: SqliteDatabase,
    bookId: BreakdownBookId,
  ): ExportModuleFact[] {
    return database.prepare(`
      SELECT instance.module_id AS moduleId,
        instance.status AS status,
        instance.body_markdown AS bodyMarkdown
      FROM analysis_module_instances instance
      INNER JOIN analysis_modules module ON module.id = instance.module_id
      WHERE instance.book_id = ?
        AND instance.scope_kind = 'book'
        AND instance.book_scope_book_id = ?
      ORDER BY module.sort_order ASC
    `).all(bookId, bookId) as ExportModuleFact[];
  }
}
