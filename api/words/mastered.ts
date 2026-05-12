import { getQuery, jsonResponse, errorResponse, getRoomId } from '../_lib.js';
import { getMasteredWords, initDatabase } from '../../lib/db.js';

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
    const limit = query.limit ? parseInt(query.limit) : 50;
    const offset = query.offset ? parseInt(query.offset) : 0;
    const words = await getMasteredWords(roomId, limit, offset);
    return jsonResponse({ words });
  } catch (error: any) {
    return errorResponse(error?.message || '获取单词失败');
  }
}
