import { jsonResponse, errorResponse } from '../_lib.js';
import { deleteWord, getStats, initDatabase } from '../../../lib/db.js';

let initialized = false;
async function ensureDb() {
  if (!initialized) { await initDatabase(); initialized = true; }
}

export async function DELETE(request: Request, context: any) {
  await ensureDb();
  try {
    const wordId = parseInt(context.params.id);
    if (isNaN(wordId)) return errorResponse('无效的单词ID', 400);
    const ok = await deleteWord(wordId);
    if (!ok) return errorResponse('单词不存在', 404);
    const url = new URL(request.url);
    const roomId = url.searchParams.get('room');
    const stats = roomId ? await getStats(roomId) : null;
    return jsonResponse({ success: true, stats });
  } catch (error: any) {
    return errorResponse(error?.message || '删除失败');
  }
}
