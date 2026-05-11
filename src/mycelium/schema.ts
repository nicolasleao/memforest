export const SCHEMA_BRANCHES = `
CREATE TABLE IF NOT EXISTS branches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  tree_name TEXT NOT NULL,
  branch_name TEXT NOT NULL,
  relative_path TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT 'seed',
  tags TEXT NOT NULL DEFAULT '[]',
  aliases TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  indexed_at TEXT NOT NULL
);
`;

export const SCHEMA_EDGES = `
CREATE TABLE IF NOT EXISTS edges (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_path TEXT NOT NULL,
  target_path TEXT NOT NULL,
  target_resolved INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_edges_source ON edges(source_path);
CREATE INDEX IF NOT EXISTS idx_edges_target ON edges(target_path);
CREATE UNIQUE INDEX IF NOT EXISTS idx_edges_pair ON edges(source_path, target_path);
`;

export const SCHEMA_FTS = `
CREATE VIRTUAL TABLE IF NOT EXISTS fts_branches USING fts5(
  relative_path,
  title,
  content,
  tags,
  content=branches,
  content_rowid=id,
  tokenize='porter unicode61'
);
`;

export const SCHEMA_FTS_TRIGGERS = `
CREATE TRIGGER IF NOT EXISTS branches_ai AFTER INSERT ON branches BEGIN
  INSERT INTO fts_branches(rowid, relative_path, title, content, tags)
  VALUES (new.id, new.relative_path, new.title, new.content, new.tags);
END;

CREATE TRIGGER IF NOT EXISTS branches_ad AFTER DELETE ON branches BEGIN
  INSERT INTO fts_branches(fts_branches, rowid, relative_path, title, content, tags)
  VALUES ('delete', old.id, old.relative_path, old.title, old.content, old.tags);
END;

CREATE TRIGGER IF NOT EXISTS branches_au AFTER UPDATE ON branches BEGIN
  INSERT INTO fts_branches(fts_branches, rowid, relative_path, title, content, tags)
  VALUES ('delete', old.id, old.relative_path, old.title, old.content, old.tags);
  INSERT INTO fts_branches(rowid, relative_path, title, content, tags)
  VALUES (new.id, new.relative_path, new.title, new.content, new.tags);
END;
`;

export const ALL_SCHEMA = [SCHEMA_BRANCHES, SCHEMA_EDGES, SCHEMA_FTS, SCHEMA_FTS_TRIGGERS];
