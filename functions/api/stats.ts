import { getQuery, jsonResponse, errorResponse, getRoomId } from './_lib.js';
import { getStats, initDatabase } from '../lib/db.js';

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
    const stats = await getStats(roomId);
    return jsonResponse(stats);
  } catch (error: any) {
    return errorResponse(error?.message || '获取统计失败');
  }
}
