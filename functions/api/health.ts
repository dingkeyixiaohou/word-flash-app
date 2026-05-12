import { jsonResponse } from './_lib.js';
import { initDatabase } from '../lib/db.js';

// 数据库自动初始化（每个 cold start 执行一次）
let initialized = false;
async function ensureDb() {
  if (!initialized) {
    await initDatabase();
    initialized = true;
  }
}

export async function GET() {
  await ensureDb();
  return jsonResponse({ status: 'ok', timestamp: new Date().toISOString() });
}
