import { getQuery, jsonResponse, errorResponse, getRoomId } from '../_lib.js';
import { getAllWords, initDatabase } from '../../lib/db.js';

let initialized = false;
async function ensureDb() {
  if (!initialized) { await initDatabase(); initialized = true; }
}

export async function GET(request: Request) {
  await ensureDb();
  try {
    const query = getQuery(request);
    const roomId = getRoomId(query);
    if (!roomId) return errorResponse('缺少 room 参数', 400);
    const limit = query.limit ? parseInt(query.limit) : 100;
    const offset = query.offset ? parseInt(query.offset) : 0;
    const filter = (query.filter as 'all' | 'remaining' | 'mastered') || 'all';
    const result = await getAllWords(roomId, limit, offset, filter);
    return jsonResponse(result);
  } catch (error: any) {
    return errorResponse(error?.message || '获取单词失败');
  }
}
