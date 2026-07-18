import type { Migration } from '../migration-runner';
import { TYPE_LIBRARY_REGISTRY_SEMANTIC_BOUNDARIES } from './006_type_library_registry_boundaries';

const CREATED_AT_006 = '2026-07-17T00:00:00.000Z';

export const TYPE_LIBRARY_DEFINITION_SEED_006 = [
  ['builtin_main_001', 'main_type', '日轻校园', '以校园、社团为主要舞台，用轻小说式节奏展开青春日常、恋爱喜剧、群像互动或校园中的异常事件，注重人与人之间关系的描写。', 0],
  ['builtin_main_002', 'main_type', '日轻异界', '以DQ为蓝本的日式西幻世界舞台，围绕异世界探索、异能\\金手指规则、伙伴关系、冒险等内容描写。', 1],
  ['builtin_main_003', 'main_type', '现代都市', '以现实社会为舞台，围绕主角拥有的金手指，可能重点描写人际关系互动，也可能重点描写事业经营。', 2],
  ['builtin_main_004', 'main_type', '现代幻想', '在现代社会结构中引入修行、怪异、异能、神秘组织等超常体系，重点表现日常现实与隐秘力量世界的交织。', 3],
  ['builtin_main_005', 'main_type', '古代幻想', '以中国古代或古典东方世界为基础，通过王朝、宗门、修行、神魔和江湖秩序推动人物成长、权力斗争与世界变局。', 4],
  ['builtin_main_006', 'main_type', '西式幻想', '以欧洲中世纪式文明为主要审美基础，围绕帝国、宗教、种族、魔法、战争及文明兴衰展开宏观幻想叙事。', 5],
  ['builtin_main_007', 'main_type', '诸天无限', '主角团在不同的世界冒险探索，重点展示不同世界的独特规则\\生态，描写对其摸索理解。', 6],
  ['builtin_focus_001', 'content_focus', '恋爱炒股', '男主和多个女主之间的情感纠葛，女主的塑造是重中之重。主要阅读和不同女主的互动，读者一般有最支持的一名。', 0],
  ['builtin_focus_002', 'content_focus', '英雄史诗', '主角和众人抗争命运、轰轰烈烈的战争。核心看众人如何在高压环境下成长、挣扎。', 1],
  ['builtin_focus_003', 'content_focus', '能力规则', '主要关注不同角色的技能效果、限制、成长，结合情报博弈，不同能力之间如何碰撞出火花。', 2],
  ['builtin_focus_004', 'content_focus', '种田运营', '如何用更高领先的知识引领社会发展，如何分配剧情中获得的资源建设社会。', 3],
  ['builtin_focus_005', 'content_focus', '群像', '主角只是主要视角，但不等于独占剧情分量。重点看不同角色的成长，互相之间由交织出怎样的故事。', 4],
  ['builtin_focus_006', 'content_focus', '事业', '如何运用眼光、金手指等个人资源去发展事业。', 5],
  ['builtin_focus_007', 'content_focus', '冒险探索', '在一个又一个崭新的环境，一点点探索揭露新的情报资讯，努力冒险。重点关注不同的情景\\压力设置，和如何突破难关又最终获得什么样的回报。', 6],
] as const;

export const TYPE_LIBRARY_REGISTRY_MIGRATION = {
  id: 6,
  name: 'type_library_registry',
  up(database) {
    database.exec(`
      CREATE TABLE type_definitions (
        id TEXT PRIMARY KEY CHECK (typeof(id) = 'text' AND length(trim(id)) > 0),
        kind TEXT NOT NULL CHECK (kind IN ('main_type', 'content_focus')),
        origin TEXT NOT NULL CHECK (origin IN ('built_in', 'user_defined')),
        stable_key TEXT UNIQUE,
        archived_at TEXT CHECK (archived_at IS NULL OR length(trim(archived_at)) > 0),
        UNIQUE (id, kind),
        CHECK (
          (origin = 'built_in' AND stable_key IS NOT NULL AND id = stable_key)
          OR (origin = 'user_defined' AND stable_key IS NULL)
        )
      );

      CREATE TABLE type_definition_versions (
        id TEXT PRIMARY KEY CHECK (typeof(id) = 'text' AND length(trim(id)) > 0),
        type_definition_id TEXT NOT NULL,
        version INTEGER NOT NULL CHECK (typeof(version) = 'integer' AND version > 0),
        display_name TEXT NOT NULL CHECK (typeof(display_name) = 'text' AND length(trim(display_name)) > 0),
        selection_description TEXT NOT NULL
          CHECK (typeof(selection_description) = 'text' AND length(trim(selection_description)) > 0),
        created_at TEXT NOT NULL CHECK (typeof(created_at) = 'text' AND length(trim(created_at)) > 0),
        UNIQUE (type_definition_id, version),
        UNIQUE (type_definition_id, id),
        FOREIGN KEY (type_definition_id) REFERENCES type_definitions(id) ON DELETE RESTRICT
      );

      CREATE TABLE type_library_versions (
        version INTEGER PRIMARY KEY CHECK (typeof(version) = 'integer' AND version > 0),
        entry_count INTEGER NOT NULL CHECK (typeof(entry_count) = 'integer' AND entry_count > 0),
        created_at TEXT NOT NULL CHECK (typeof(created_at) = 'text' AND length(trim(created_at)) > 0)
      );

      CREATE TABLE type_library_version_entries (
        type_library_version INTEGER NOT NULL,
        type_definition_id TEXT NOT NULL,
        type_definition_version_id TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('main_type', 'content_focus')),
        sort_order INTEGER NOT NULL CHECK (typeof(sort_order) = 'integer' AND sort_order >= 0),
        PRIMARY KEY (type_library_version, type_definition_id),
        UNIQUE (type_library_version, type_definition_version_id),
        UNIQUE (type_library_version, kind, sort_order),
        FOREIGN KEY (type_library_version) REFERENCES type_library_versions(version) ON DELETE RESTRICT,
        FOREIGN KEY (type_definition_id, kind) REFERENCES type_definitions(id, kind) ON DELETE RESTRICT,
        FOREIGN KEY (type_definition_id, type_definition_version_id)
          REFERENCES type_definition_versions(type_definition_id, id) ON DELETE RESTRICT
      );

      CREATE TRIGGER type_definitions_identity_immutable
      BEFORE UPDATE OF id, kind, origin, stable_key ON type_definitions
      BEGIN
        SELECT RAISE(ABORT, 'type definition identity is immutable');
      END;

      CREATE TRIGGER type_definitions_archive_once
      BEFORE UPDATE OF archived_at ON type_definitions
      WHEN OLD.archived_at IS NOT NULL OR NEW.archived_at IS NULL
      BEGIN
        SELECT RAISE(ABORT, 'type definition archive is one-way');
      END;

      CREATE TRIGGER type_definitions_no_delete
      BEFORE DELETE ON type_definitions
      BEGIN
        SELECT RAISE(ABORT, 'type definitions are archive-only');
      END;

      CREATE TRIGGER type_definition_versions_no_update
      BEFORE UPDATE ON type_definition_versions
      BEGIN
        SELECT RAISE(ABORT, 'type definition versions are immutable');
      END;

      CREATE TRIGGER type_definition_versions_no_delete
      BEFORE DELETE ON type_definition_versions
      BEGIN
        SELECT RAISE(ABORT, 'type definition versions are immutable');
      END;

      CREATE TRIGGER type_library_versions_no_update
      BEFORE UPDATE ON type_library_versions
      BEGIN
        SELECT RAISE(ABORT, 'type library versions are immutable');
      END;

      CREATE TRIGGER type_library_versions_no_delete
      BEFORE DELETE ON type_library_versions
      BEGIN
        SELECT RAISE(ABORT, 'type library versions are immutable');
      END;

      CREATE TRIGGER type_library_version_entries_no_update
      BEFORE UPDATE ON type_library_version_entries
      BEGIN
        SELECT RAISE(ABORT, 'type library version entries are immutable');
      END;

      CREATE TRIGGER type_library_version_entries_no_delete
      BEFORE DELETE ON type_library_version_entries
      BEGIN
        SELECT RAISE(ABORT, 'type library version entries are immutable');
      END;

      CREATE TRIGGER type_library_version_entries_capacity
      BEFORE INSERT ON type_library_version_entries
      WHEN (
        SELECT COUNT(*) FROM type_library_version_entries
        WHERE type_library_version = NEW.type_library_version
      ) >= (
        SELECT entry_count FROM type_library_versions
        WHERE version = NEW.type_library_version
      )
      BEGIN
        SELECT RAISE(ABORT, 'type library release membership is sealed');
      END;
    `);

    const insertDefinition = database.prepare(`
      INSERT INTO type_definitions (id, kind, origin, stable_key)
      VALUES (?, ?, 'built_in', ?)
    `);
    const insertDefinitionVersion = database.prepare(`
      INSERT INTO type_definition_versions (
        id, type_definition_id, version, display_name, selection_description, created_at
      ) VALUES (?, ?, 1, ?, ?, ?)
    `);
    const insertReleaseEntry = database.prepare(`
      INSERT INTO type_library_version_entries (
        type_library_version, type_definition_id, type_definition_version_id, kind, sort_order
      ) VALUES (1, ?, ?, ?, ?)
    `);

    for (const [id, kind, displayName, selectionDescription] of TYPE_LIBRARY_DEFINITION_SEED_006) {
      insertDefinition.run(id, kind, id);
      insertDefinitionVersion.run(`${id}_v1`, id, displayName, selectionDescription, CREATED_AT_006);
    }
    database.prepare(`
      INSERT INTO type_library_versions (version, entry_count, created_at) VALUES (1, ?, ?)
    `).run(TYPE_LIBRARY_DEFINITION_SEED_006.length, CREATED_AT_006);
    for (const [id, kind, , , sortOrder] of TYPE_LIBRARY_DEFINITION_SEED_006) {
      insertReleaseEntry.run(id, `${id}_v1`, kind, sortOrder);
    }
  },
  semanticWitnesses: [
    {
      id: '006.type_library.release_kind_order_unique',
      migrationId: 6,
      setupSql: `
        INSERT INTO type_definitions VALUES ('main-a', 'main_type', 'built_in', 'main-a', NULL);
        INSERT INTO type_definitions VALUES ('main-b', 'main_type', 'built_in', 'main-b', NULL);
        INSERT INTO type_definition_versions VALUES ('main-a-v1', 'main-a', 1, 'A', 'A', '${CREATED_AT_006}');
        INSERT INTO type_definition_versions VALUES ('main-b-v1', 'main-b', 1, 'B', 'B', '${CREATED_AT_006}');
        INSERT INTO type_library_versions VALUES (1, 2, '${CREATED_AT_006}');
        INSERT INTO type_library_version_entries VALUES (1, 'main-a', 'main-a-v1', 'main_type', 0);
      `,
      sql: `INSERT INTO type_library_version_entries VALUES (1, 'main-b', 'main-b-v1', 'main_type', 0)`,
      expected: { outcome: 'constraint', code: 'SQLITE_CONSTRAINT_UNIQUE' },
    },
  ],
  semanticBoundaries: TYPE_LIBRARY_REGISTRY_SEMANTIC_BOUNDARIES,
} as const satisfies Migration;
