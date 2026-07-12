import Database from 'better-sqlite3';
import type BetterSqlite3 from 'better-sqlite3';

export type SqliteDatabase = BetterSqlite3.Database;

export function openSqliteDatabase(databasePath: string): SqliteDatabase {
  const database = new Database(databasePath);

  database.pragma('foreign_keys = ON');

  return database;
}

export function openReadonlySqliteDatabase(databasePath: string): SqliteDatabase {
  return new Database(databasePath, {
    readonly: true,
    fileMustExist: true,
  });
}
