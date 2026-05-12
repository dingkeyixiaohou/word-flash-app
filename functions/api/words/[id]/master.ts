import { jsonResponse, errorResponse } from '../../_lib.js';
import { markMastered, getStats, initDatabase } from '../../../lib/db.js';

let initialized = false;
async function ensureDb() {
  if (!initialized) { await initDatabase(); initialized = true; }
}

export async function POST(request: Request, context: any) {
  await ensureDb();
  try {
    const wordId = parseInt(context.params.id);
    if (isNaN(wordId)) return errorResponse('无效的单词ID', 400);
    const ok = await markMastered(wordId);
    if (!ok) return errorResponse('单词不存在或已掌握', 404);
    const body: any = await request.json().catch(() => ({}));
    const roomId = body?.room;
    const stats = roomId ? await getStats(roomId) : null;
    return jsonResponse({ success: true, stats });
  } catch (error: any) {
    return errorResponse(error?.message || '操作失败');
  }
}
