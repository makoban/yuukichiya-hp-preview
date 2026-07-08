CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL DEFAULT 'dashboard',
  source_user TEXT,
  source_display_name TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  category TEXT NOT NULL DEFAULT '新着情報',
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  target_stores TEXT NOT NULL DEFAULT '["本店","髙橋店"]',
  published_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  deleted_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_posts_status_published_at
  ON posts (status, published_at DESC, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_posts_source_user
  ON posts (source_user, updated_at DESC);

CREATE TABLE IF NOT EXISTS post_images (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  r2_key TEXT,
  url TEXT NOT NULL,
  content_type TEXT,
  alt TEXT NOT NULL DEFAULT '',
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_post_images_post_order
  ON post_images (post_id, sort_order);

CREATE TABLE IF NOT EXISTS post_links (
  id TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  label TEXT NOT NULL,
  url TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_post_links_post_order
  ON post_links (post_id, sort_order);

CREATE TABLE IF NOT EXISTS draft_sessions (
  source_user TEXT PRIMARY KEY,
  post_id TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE
);
