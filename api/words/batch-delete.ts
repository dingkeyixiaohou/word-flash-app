import { getBody, jsonResponse, errorResponse } from '../_lib.js';
import { deleteWords, getStats, initDatabase } from '../../lib/db.js';

let initialized = false;
async function ensureDb() {
  if (!initialized) { await initDatabase(); initialized = true; }
}

export async function POST(request: Request) {
  await ensureDb();
  try {
    const body = await getBody(request);
    const { ids, room } = body;
    if (!Array.isArray(ids) || ids.length === 0) return errorResponse('请提供要删除的单词ID列表', 400);
    const deleted = await deleteWords(ids.map(Number));
    const stats = room ? await getStats(room) : null;
    return jsonResponse({ success: true, deleted, stats });
  } catch (error: any) {
    return errorResponse(error?.message || '批量删除失败');
  }
}
