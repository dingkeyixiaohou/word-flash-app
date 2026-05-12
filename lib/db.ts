import { createClient, Config } from '@libsql/client';

// 数据库连接（支持 Turso 云数据库和本地 SQLite）
let db: ReturnType<typeof createClient> | null = null;

export interface DbWord {
  id: number;
  room_id: string;
  word: string;
  meaning: string;
  mastered: number;
  created_at: string;
  mastered_at: string | null;
}

export interface DbRoom {
  id: string;
  name: string;
  created_at: string;
}

function getDb() {
  if (!db) {
    const url = process.env.TURSO_DATABASE_URL;
    const authToken = process.env.TURSO_AUTH_TOKEN;

    if (!url) {
      const config: Config = { url: 'file:local.db' };
      db = createClient(config);
    } else {
      const config: Config = { url, authToken };
      db = createClient(config);
    }
  }
  return db;
}

// 初始化数据库表
export async function initDatabase(): Promise<void> {
  const client = getDb();
  await client.execute(`
    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);
  await client.execute(`
    CREATE TABLE IF NOT EXISTS words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      room_id TEXT NOT NULL,
      word TEXT NOT NULL,
      meaning TEXT NOT NULL DEFAULT '',
      mastered INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      mastered_at TEXT,
      FOREIGN KEY (room_id) REFERENCES rooms(id)
    )
  `);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_words_room ON words(room_id)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_words_room_mastered ON words(room_id, mastered)`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_words_word ON words(word)`);
}

// ============= 房间操作 =============

export async function createRoom(id: string, name: string): Promise<DbRoom> {
  const client = getDb();
  const now = new Date().toISOString();
  await client.execute({
    sql: 'INSERT INTO rooms (id, name, created_at) VALUES (?, ?, ?)',
    args: [id, name, now],
  });
  return { id, name, created_at: now };
}

export async function getRoom(id: string): Promise<DbRoom | null> {
  const client = getDb();
  const result = await client.execute({
    sql: 'SELECT * FROM rooms WHERE id = ?',
    args: [id],
  });
  if (result.rows.length === 0) return null;
  const row = result.rows[0];
  return { id: row.id as string, name: row.name as string, created_at: row.created_at as string };
}

// ============= 统计 =============

export async function getStats(roomId: string): Promise<{ total: number; mastered: number; remaining: number }> {
  const client = getDb();
  const totalResult = await client.execute({
    sql: 'SELECT COUNT(*) as c FROM words WHERE room_id = ?',
    args: [roomId],
  });
  const masteredResult = await client.execute({
    sql: 'SELECT COUNT(*) as c FROM words WHERE room_id = ? AND mastered = 1',
    args: [roomId],
  });
  const total = Number(totalResult.rows[0].c);
  const mastered = Number(masteredResult.rows[0].c);
  return { total, mastered, remaining: total - mastered };
}

// ============= 单词查询 =============

export async function getRemainingWords(roomId: string, limit?: number): Promise<DbWord[]> {
  const client = getDb();
  if (limit) {
    const result = await client.execute({
      sql: 'SELECT * FROM words WHERE room_id = ? AND mastered = 0 ORDER BY id ASC LIMIT ?',
      args: [roomId, limit],
    });
    return result.rows as unknown as DbWord[];
  }
  const result = await client.execute({
    sql: 'SELECT * FROM words WHERE room_id = ? AND mastered = 0 ORDER BY id ASC',
    args: [roomId],
  });
  return result.rows as unknown as DbWord[];
}

export async function getMasteredWords(roomId: string, limit: number, offset: number): Promise<DbWord[]> {
  const client = getDb();
  const result = await client.execute({
    sql: 'SELECT * FROM words WHERE room_id = ? AND mastered = 1 ORDER BY mastered_at DESC LIMIT ? OFFSET ?',
    args: [roomId, limit, offset],
  });
  return result.rows as unknown as DbWord[];
}

export async function getRandomWord(roomId: string): Promise<DbWord | null> {
  const client = getDb();
  const result = await client.execute({
    sql: 'SELECT * FROM words WHERE room_id = ? AND mastered = 0 ORDER BY RANDOM() LIMIT 1',
    args: [roomId],
  });
  if (result.rows.length === 0) return null;
  return result.rows[0] as unknown as DbWord;
}

export async function getAllWords(roomId: string, limit: number, offset: number, filter: 'all' | 'remaining' | 'mastered'): Promise<{ words: DbWord[]; total: number }> {
  const client = getDb();
  let whereClause = 'WHERE room_id = ?';
  const args: (string | number)[] = [roomId];

  if (filter === 'remaining') { whereClause += ' AND mastered = 0'; }
  else if (filter === 'mastered') { whereClause += ' AND mastered = 1'; }

  const countResult = await client.execute({
    sql: `SELECT COUNT(*) as c FROM words ${whereClause}`,
    args,
  });
  const total = Number(countResult.rows[0].c);

  const wordsResult = await client.execute({
    sql: `SELECT * FROM words ${whereClause} ORDER BY id ASC LIMIT ? OFFSET ?`,
    args: [...args, limit, offset],
  });
  return { words: wordsResult.rows as unknown as DbWord[], total };
}

export async function searchWords(roomId: string, q: string): Promise<DbWord[]> {
  const client = getDb();
  const pattern = `%${q}%`;
  const result = await client.execute({
    sql: 'SELECT * FROM words WHERE room_id = ? AND (word LIKE ? OR meaning LIKE ?) ORDER BY id ASC LIMIT 50',
    args: [roomId, pattern, pattern],
  });
  return result.rows as unknown as DbWord[];
}

// ============= 单词修改 =============

export async function markMastered(wordId: number): Promise<boolean> {
  const client = getDb();
  const now = new Date().toISOString();
  const result = await client.execute({
    sql: 'UPDATE words SET mastered = 1, mastered_at = ? WHERE id = ? AND mastered = 0',
    args: [now, wordId],
  });
  return result.rowsAffected > 0;
}

export async function unmarkMastered(wordId: number): Promise<boolean> {
  const client = getDb();
  const result = await client.execute({
    sql: 'UPDATE words SET mastered = 0, mastered_at = NULL WHERE id = ? AND mastered = 1',
    args: [wordId],
  });
  return result.rowsAffected > 0;
}

export async function importWords(roomId: string, words: Array<{ word: string; meaning: string }>): Promise<{ imported: number }> {
  const client = getDb();
  let imported = 0;
  const now = new Date().toISOString();

  // libSQL 批量插入
  for (const item of words) {
    await client.execute({
      sql: 'INSERT INTO words (room_id, word, meaning, mastered, created_at) VALUES (?, ?, ?, 0, ?)',
      args: [roomId, item.word, item.meaning, now],
    });
    imported++;
  }

  return { imported };
}

export async function clearAllWords(roomId: string): Promise<void> {
  const client = getDb();
  await client.execute({
    sql: 'DELETE FROM words WHERE room_id = ?',
    args: [roomId],
  });
}

export async function deleteWord(wordId: number): Promise<boolean> {
  const client = getDb();
  const result = await client.execute({
    sql: 'DELETE FROM words WHERE id = ?',
    args: [wordId],
  });
  return result.rowsAffected > 0;
}

export async function deleteWords(wordIds: number[]): Promise<number> {
  const client = getDb();
  let deleted = 0;
  for (const id of wordIds) {
    const result = await client.execute({
      sql: 'DELETE FROM words WHERE id = ?',
      args: [id],
    });
    deleted += result.rowsAffected;
  }
  return deleted;
}
