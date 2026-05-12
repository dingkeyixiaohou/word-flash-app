import { getQuery, jsonResponse, errorResponse, getRoomId } from '../_lib.js';
import { getRandomWord, initDatabase } from '../../lib/db.js';

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
    const word = await getRandomWord(roomId);
    return jsonResponse({ word, message: word ? undefined : '所有单词已掌握！' });
  } catch (error: any) {
    return errorResponse(error?.message || '获取单词失败');
  }
}
