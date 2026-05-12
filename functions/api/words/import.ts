import { getBody, getQuery, jsonResponse, errorResponse, getRoomId } from '../_lib.js';
import { importWords, getStats, initDatabase } from '../../lib/db.js';

let initialized = false;
async function ensureDb() {
  if (!initialized) { await initDatabase(); initialized = true; }
}

// 单词解析函数（支持中英文逗号）
function parseWordContent(content: string): Array<{ word: string; meaning: string }> {
  const lines = content
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith('#') && !l.startsWith('//'));

  const words: Array<{ word: string; meaning: string }> = [];

  for (const line of lines) {
    let wordPart = '';
    let meaning = '';

    if (line.includes('\t')) {
      const idx = line.indexOf('\t');
      wordPart = line.substring(0, idx);
      meaning = line.substring(idx + 1).trim();
    } else if (line.includes('|') && !line.match(/^\s*\|/)) {
      const idx = line.indexOf('|');
      wordPart = line.substring(0, idx);
      meaning = line.substring(idx + 1).trim();
    } else if (line.includes(' - ')) {
      const idx = line.indexOf(' - ');
      wordPart = line.substring(0, idx);
      meaning = line.substring(idx + 3).trim();
    } else if (line.includes('\uff1a')) {
      const idx = line.indexOf('\uff1a');
      wordPart = line.substring(0, idx);
      meaning = line.substring(idx + 1).trim();
    } else if (line.includes(':') && !line.startsWith(':')) {
      const idx = line.indexOf(':');
      wordPart = line.substring(0, idx);
      meaning = line.substring(idx + 1).trim();
    } else {
      // 自动识别：找第一个中文字符作为英文/中文分界
      const firstCn = line.search(/[\u4e00-\u9fff]/);
      if (firstCn > 0) {
        wordPart = line.substring(0, firstCn).trim();
        meaning = line.substring(firstCn).trim();
      } else {
        wordPart = line;
        meaning = '';
      }
    }

    wordPart = wordPart.trim();
    if (!wordPart) continue;

    // 同义词分隔：支持中英文逗号
    const synonyms = wordPart
      .split(/[,，]/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (synonyms.length > 0) {
      words.push({ word: synonyms.join(', '), meaning });
    }
  }

  return words;
}

// POST /api/words/import — JSON 文本导入
export async function POST(request: Request) {
  await ensureDb();
  try {
    const body = await getBody(request);
    const { content, room } = body;
    if (!content?.trim()) return errorResponse('导入内容不能为空', 400);
    if (!room) return errorResponse('缺少 room 参数', 400);

    const words = parseWordContent(content);
    if (words.length === 0) return errorResponse('未能解析出任何单词', 400);

    const result = await importWords(room, words);
    const stats = await getStats(room);
    return jsonResponse({ success: true, parsed: words.length, ...result, stats });
  } catch (error: any) {
    return errorResponse(error?.message || '导入失败');
  }
}

// POST /api/words/import/file — 文件上传导入
export async function PUT(request: Request) {
  await ensureDb();
  try {
    const query = getQuery(request);
    const roomId = getRoomId(query);
    if (!roomId) return errorResponse('缺少 room 参数', 400);

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    if (!file) return errorResponse('请上传文件', 400);

    let textContent = '';
    const filename = file.name.toLowerCase();

    if (filename.endsWith('.docx')) {
      // 动态导入 mammoth 解析 docx
      const mammoth = await import('mammoth');
      const arrayBuffer = await file.arrayBuffer();
      const result = await mammoth.extractRawText({ buffer: Buffer.from(arrayBuffer) });
      textContent = result.value;
    } else {
      textContent = await file.text();
    }

    const words = parseWordContent(textContent);
    if (words.length === 0) return errorResponse('未能从文件中解析出任何单词', 400);

    const result = await importWords(roomId, words);
    const stats = await getStats(roomId);
    return jsonResponse({ success: true, filename: file.name, parsed: words.length, ...result, stats });
  } catch (error: any) {
    return errorResponse(error?.message || '导入失败');
  }
}

// 导出 parseWordContent 供 import-file 使用
export { parseWordContent };
