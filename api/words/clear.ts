import { getQuery, jsonResponse, errorResponse, getRoomId } from '../_lib.js';
import { clearAllWords, initDatabase } from '../../lib/db.js';

let initialized = false;
async function ensureDb() {
  if (!initialized) { await initDatabase(); initialized = true; }
}

export async function DELETE(request: Request) {
  await ensureDb();
  try {
    const query = getQuery(request);
    const roomId = getRoomId(query);
    if (!roomId) return errorResponse('缺少 room 参数', 400);
    await clearAllWords(roomId);
    return jsonResponse({ success: true });
  } catch (error: any) {
    return errorResponse(error?.message || '清空失败');
  }
}
