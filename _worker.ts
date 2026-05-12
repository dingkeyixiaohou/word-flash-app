// _worker.ts — Cloudflare Pages catch-all Worker
// esbuild 打包后放到 dist/_worker.js

import { createClient, Config } from '@libsql/client';

interface Env {
  TURSO_DATABASE_URL: string;
  TURSO_AUTH_TOKEN: string;
}

// ===== 数据库 =====
let _db: any = null;

function getDb(env: Env) {
  if (!_db) {
    const url = env.TURSO_DATABASE_URL || '';
    const authToken = env.TURSO_AUTH_TOKEN || '';
    if (!url) {
      _db = createClient({ url: 'file:local.db' } as Config);
    } else {
      _db = createClient({ url, authToken } as Config);
    }
  }
  return _db;
}

async function initDb(env: Env) {
  const client = getDb(env);
  await client.execute(`CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, name TEXT NOT NULL, created_at TEXT NOT NULL)`);
  await client.execute(`CREATE TABLE IF NOT EXISTS words (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    room_id TEXT NOT NULL,
    word TEXT NOT NULL,
    meaning TEXT NOT NULL DEFAULT '',
    mastered INTEGER NOT NULL DEFAULT 0,
    created_at TEXT NOT NULL,
    mastered_at TEXT
  )`);
  await client.execute(`CREATE INDEX IF NOT EXISTS idx_words_room ON words(room_id)`);
}

function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

// ===== 路由分发 =====
async function handleRequest(request: Request, env: Env): Promise<Response> {
  await initDb(env);
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  // POST /api/rooms — 创建房间
  if (path === '/api/rooms' && method === 'POST') {
    const body = await request.json();
    const { id, name } = body as any;
    if (!id || !name) return json({ error: '缺少房间ID或昵称' }, 400);
    const client = getDb(env);
    const existing = await client.execute({ sql: 'SELECT * FROM rooms WHERE id = ?', args: [id] });
    if (existing.rows.length > 0) return json({ success: true, room: existing.rows[0] });
    const now = new Date().toISOString();
    await client.execute({ sql: 'INSERT INTO rooms (id, name, created_at) VALUES (?, ?, ?)', args: [id, name, now] });
    return json({ success: true, room: { id, name, created_at: now } }, 201);
  }

  // GET /api/rooms/:id
  const roomMatch = path.match(/^\/api\/rooms\/([^/]+)$/);
  if (roomMatch && method === 'GET') {
    const roomId = roomMatch[1];
    const client = getDb(env);
    const result = await client.execute({ sql: 'SELECT * FROM rooms WHERE id = ?', args: [roomId] });
    if (result.rows.length === 0) return json({ error: '房间不存在' }, 404);
    return json({ room: result.rows[0] });
  }

  // GET /api/stats?room=xxx
  if (path === '/api/stats' && method === 'GET') {
    const roomId = url.searchParams.get('room');
    if (!roomId) return json({ error: '缺少 room 参数' }, 400);
    const client = getDb(env);
    const totalResult = await client.execute({ sql: 'SELECT COUNT(*) as c FROM words WHERE room_id = ?', args: [roomId] });
    const masteredResult = await client.execute({ sql: 'SELECT COUNT(*) as c FROM words WHERE room_id = ? AND mastered = 1', args: [roomId] });
    const total = Number((totalResult.rows[0] as any).c);
    const mastered = Number((masteredResult.rows[0] as any).c);
    return json({ total, mastered, remaining: total - mastered });
  }

  // GET /api/words?room=xxx&filter=...&limit=...&offset=...
  if (path === '/api/words' && method === 'GET') {
    const roomId = url.searchParams.get('room');
    const filter = url.searchParams.get('filter') || 'all';
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    if (!roomId) return json({ error: '缺少 room 参数' }, 400);
    const client = getDb(env);
    let where = 'WHERE room_id = ?';
    const args: any[] = [roomId];
    if (filter === 'remaining') where += ' AND mastered = 0';
    if (filter === 'mastered') where += ' AND mastered = 1';
    const countResult = await client.execute({ sql: `SELECT COUNT(*) as c FROM words ${where}`, args });
    const total = Number((countResult.rows[0] as any).c);
    const wordsResult = await client.execute({ sql: `SELECT * FROM words ${where} ORDER BY id ASC LIMIT ? OFFSET ?`, args: [...args, limit, offset] });
    return json({ words: wordsResult.rows, total });
  }

  // POST /api/words/import — 导入单词
  if (path === '/api/words/import' && method === 'POST') {
    const body = await request.json();
    const { room, words } = body as any;
    if (!room || !Array.isArray(words)) return json({ error: '参数错误' }, 400);
    const client = getDb(env);
    const now = new Date().toISOString();
    for (const w of words) {
      await client.execute({ sql: 'INSERT INTO words (room_id, word, meaning, mastered, created_at) VALUES (?, ?, ?, 0, ?)', args: [room, w.word, w.meaning, now] });
    }
    const stats = await client.execute({ sql: 'SELECT COUNT(*) as c FROM words WHERE room_id = ?', args: [room] });
    const mastered = await client.execute({ sql: 'SELECT COUNT(*) as c FROM words WHERE room_id = ? AND mastered = 1', args: [room] });
    return json({ success: true, imported: words.length, total: Number((stats.rows[0] as any).c), mastered: Number((mastered.rows[0] as any).c) });
  }

  // POST /api/words/:id/master
  const masterMatch = path.match(/^\/api\/words\/(\d+)\/master$/);
  if (masterMatch && method === 'POST') {
    const wordId = parseInt(masterMatch[1]);
    const client = getDb(env);
    const now = new Date().toISOString();
    const result = await client.execute({ sql: 'UPDATE words SET mastered = 1, mastered_at = ? WHERE id = ? AND mastered = 0', args: [now, wordId] });
    if (result.rowsAffected === 0) return json({ error: '单词不存在或已掌握' }, 404);
    const body = await request.json().catch(() => ({}));
    const roomId = (body as any)?.room;
    if (roomId) {
      const s = await client.execute({ sql: 'SELECT COUNT(*) as c FROM words WHERE room_id = ?', args: [roomId] });
      const m = await client.execute({ sql: 'SELECT COUNT(*) as c FROM words WHERE room_id = ? AND mastered = 1', args: [roomId] });
      return json({ success: true, stats: { total: Number((s.rows[0] as any).c), mastered: Number((m.rows[0] as any).c), remaining: Number((s.rows[0] as any).c) - Number((m.rows[0] as any).c) } });
    }
    return json({ success: true });
  }

  // POST /api/words/:id/unmaster
  const unmasterMatch = path.match(/^\/api\/words\/(\d+)\/unmaster$/);
  if (unmasterMatch && method === 'POST') {
    const wordId = parseInt(unmasterMatch[1]);
    const client = getDb(env);
    const result = await client.execute({ sql: 'UPDATE words SET mastered = 0, mastered_at = NULL WHERE id = ? AND mastered = 1', args: [wordId] });
    if (result.rowsAffected === 0) return json({ error: '单词不存在或未掌握' }, 404);
    const body = await request.json().catch(() => ({}));
    const roomId = (body as any)?.room;
    if (roomId) {
      const s = await client.execute({ sql: 'SELECT COUNT(*) as c FROM words WHERE room_id = ?', args: [roomId] });
      const m = await client.execute({ sql: 'SELECT COUNT(*) as c FROM words WHERE room_id = ? AND mastered = 1', args: [roomId] });
      return json({ success: true, stats: { total: Number((s.rows[0] as any).c), mastered: Number((m.rows[0] as any).c), remaining: Number((s.rows[0] as any).c) - Number((m.rows[0] as any).c) } });
    }
    return json({ success: true });
  }

  // DELETE /api/words/:id?room=xxx
  const deleteMatch = path.match(/^\/api\/words\/(\d+)$/);
  if (deleteMatch && method === 'DELETE') {
    const wordId = parseInt(deleteMatch[1]);
    const client = getDb(env);
    const result = await client.execute({ sql: 'DELETE FROM words WHERE id = ?', args: [wordId] });
    if (result.rowsAffected === 0) return json({ error: '单词不存在' }, 404);
    const urlObj = new URL(request.url);
    const roomId = urlObj.searchParams.get('room');
    if (roomId) {
      const s = await client.execute({ sql: 'SELECT COUNT(*) as c FROM words WHERE room_id = ?', args: [roomId] });
      const m = await client.execute({ sql: 'SELECT COUNT(*) as c FROM words WHERE room_id = ? AND mastered = 1', args: [roomId] });
      return json({ success: true, stats: { total: Number((s.rows[0] as any).c), mastered: Number((m.rows[0] as any).c), remaining: Number((s.rows[0] as any).c) - Number((m.rows[0] as any).c) } });
    }
    return json({ success: true });
  }

  // POST /api/words/clear?room=xxx
  if (path === '/api/words/clear' && method === 'POST') {
    const urlObj = new URL(request.url);
    const roomId = urlObj.searchParams.get('room');
    if (!roomId) return json({ error: '缺少 room 参数' }, 400);
    const client = getDb(env);
    await client.execute({ sql: 'DELETE FROM words WHERE room_id = ?', args: [roomId] });
    return json({ success: true });
  }

  // GET /api/words/random?room=xxx
  if (path === '/api/words/random' && method === 'GET') {
    const roomId = url.searchParams.get('room');
    if (!roomId) return json({ error: '缺少 room 参数' }, 400);
    const client = getDb(env);
    const result = await client.execute({ sql: 'SELECT * FROM words WHERE room_id = ? AND mastered = 0 ORDER BY RANDOM() LIMIT 1', args: [roomId] });
    if (result.rows.length === 0) return json({ error: '没有未掌握的单词了' }, 404);
    return json({ word: result.rows[0] });
  }

  // GET /api/words/remaining?room=xxx&limit=...
  if (path === '/api/words/remaining' && method === 'GET') {
    const roomId = url.searchParams.get('room');
    if (!roomId) return json({ error: '缺少 room 参数' }, 400);
    const limit = parseInt(url.searchParams.get('limit') || '10');
    const client = getDb(env);
    const result = await client.execute({ sql: 'SELECT * FROM words WHERE room_id = ? AND mastered = 0 ORDER BY id ASC LIMIT ?', args: [roomId, limit] });
    return json({ words: result.rows });
  }

  // GET /api/words/mastered?room=xxx&limit=...&offset=...
  if (path === '/api/words/mastered' && method === 'GET') {
    const roomId = url.searchParams.get('room');
    if (!roomId) return json({ error: '缺少 room 参数' }, 400);
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const offset = parseInt(url.searchParams.get('offset') || '0');
    const client = getDb(env);
    const result = await client.execute({ sql: 'SELECT * FROM words WHERE room_id = ? AND mastered = 1 ORDER BY mastered_at DESC LIMIT ? OFFSET ?', args: [roomId, limit, offset] });
    return json({ words: result.rows });
  }

  // GET /api/words/search?room=xxx&q=...
  if (path === '/api/words/search' && method === 'GET') {
    const roomId = url.searchParams.get('room');
    const q = url.searchParams.get('q') || '';
    if (!roomId) return json({ error: '缺少 room 参数' }, 400);
    const client = getDb(env);
    const pattern = `%${q}%`;
    const result = await client.execute({ sql: 'SELECT * FROM words WHERE room_id = ? AND (word LIKE ? OR meaning LIKE ?) ORDER BY id ASC LIMIT 50', args: [roomId, pattern, pattern] });
    return json({ words: result.rows });
  }

  // POST /api/words/batch-delete — 批量删除
  if (path === '/api/words/batch-delete' && method === 'POST') {
    const body = await request.json();
    const { room, ids } = body as any;
    if (!room || !Array.isArray(ids)) return json({ error: '参数错误' }, 400);
    const client = getDb(env);
    let deleted = 0;
    for (const id of ids) {
      const result = await client.execute({ sql: 'DELETE FROM words WHERE id = ?', args: [id] });
      deleted += result.rowsAffected;
    }
    const s = await client.execute({ sql: 'SELECT COUNT(*) as c FROM words WHERE room_id = ?', args: [room] });
    const m = await client.execute({ sql: 'SELECT COUNT(*) as c FROM words WHERE room_id = ? AND mastered = 1', args: [room] });
    return json({ success: true, deleted, total: Number((s.rows[0] as any).c), mastered: Number((m.rows[0] as any).c), remaining: Number((s.rows[0] as any).c) - Number((m.rows[0] as any).c) });
  }

  // GET /api/health
  if (path === '/api/health' && method === 'GET') {
    return json({ status: 'ok', time: new Date().toISOString() });
  }

  return new Response('Not Found', { status: 404 });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    return handleRequest(request, env);
  },
};
