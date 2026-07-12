import { existsSync, readdirSync, rmSync } from 'node:fs';
import path from 'node:path';
import { openReadonlySqliteDatabase } from '../db/sqlite';

const MIGRATION_BACKUP_PATTERN = /^pre-migration-\d+-\d+-(?<timestamp>[0-9A-Za-z]+)\.sqlite$/;

export async function createPreMigrationBackup(
  databasePath: string,
  targetPath: string,
): Promise<void> {
  const database = openReadonlySqliteDatabase(databasePath);
  try {
    await database.backup(targetPath);
  } catch (error) {
    rmSync(targetPath, { force: true });
    throw error;
  } finally {
    database.close();
  }
}

export function pruneMigrationBackups(backupsPath: string, retainCount = 3): void {
  const backups = readdirSync(backupsPath)
    .map((fileName) => ({
      fileName,
      timestamp: MIGRATION_BACKUP_PATTERN.exec(fileName)?.groups?.timestamp,
    }))
    .filter((backup): backup is { fileName: string; timestamp: string } => (
      backup.timestamp !== undefined
    ))
    .sort((left, right) => (
      right.timestamp.localeCompare(left.timestamp) ||
      right.fileName.localeCompare(left.fileName)
    ));

  for (const { fileName } of backups.slice(retainCount)) {
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
