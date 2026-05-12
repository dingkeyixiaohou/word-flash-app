import { jsonResponse, errorResponse } from '../_lib.js';
import { createRoom, getRoom, initDatabase } from '../../lib/db.js';

let initialized = false;
async function ensureDb() {
  if (!initialized) { await initDatabase(); initialized = true; }
}

// POST /api/rooms — 创建房间
export async function POST(request: Request) {
  await ensureDb();
  try {
    const body: any = await request.json();
    const { id, name } = body;
    if (!id || !name) return errorResponse('缺少房间ID或昵称', 400);

    const existing = await getRoom(id);
    if (existing) return jsonResponse({ success: true, room: existing });

    const room = await createRoom(id, name);
    return jsonResponse({ success: true, room }, 201);
  } catch (error: any) {
    return errorResponse(error?.message || '创建房间失败');
  }
}

// GET /api/rooms/[id] — 获取房间信息
export async function GET(request: Request, context: any) {
  await ensureDb();
  try {
    const roomId = context.params.id;
    if (!roomId) return errorResponse('缺少房间ID', 400);

    const room = await getRoom(roomId);
    if (!room) return errorResponse('房间不存在', 404);

    return jsonResponse({ room });
  } catch (error: any) {
    return errorResponse(error?.message || '获取房间失败');
  }
}
