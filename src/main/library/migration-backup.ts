import { existsSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import type { SqliteDatabase } from '../db/sqlite';

const MIGRATION_BACKUP_PATTERN = /^pre-migration-\d+-\d+-.+\.sqlite$/;

export async function createPreMigrationBackup(
  database: SqliteDatabase,
  targetPath: string,
): Promise<void> {
  try {
    await database.backup(targetPath);
  } catch (error) {
    rmSync(targetPath, { force: true });
    throw error;
  }
}

export function pruneMigrationBackups(backupsPath: string, retainCount = 3): void {
  const backups = readdirSync(backupsPath)
    .filter((fileName) => MIGRATION_BACKUP_PATTERN.test(fileName))
    .sort()
    .reverse();

  for (const fileName of backups.slice(retainCount)) {
    const backupPath = path.join(backupsPath, fileName);
    if (existsSync(backupPath)) rmSync(backupPath, { force: true });
  }
}

export function buildPreMigrationBackupPath(input: {
  readonly backupsPath: string;
  readonly fromVersion: number;
  readonly toVersion: number;
  readonly timestamp: string;
}): string {
  const timestamp = input.timestamp.replace(/[^0-9A-Za-z]/g, '');
  return path.join(
    input.backupsPath,
    `pre-migration-${input.fromVersion}-${input.toVersion}-${timestamp}.sqlite`,
  );
}
