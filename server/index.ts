import express from "express";
import path from "path";
import { fileURLToPath } from "url";
import multer from "multer";
import mammoth from "mammoth";
import { initDatabase, getStats, getRemainingWords, getMasteredWords, getRandomWord, markMastered, unmarkMastered, importWords, clearAllWords, getAllWords, searchWords, createRoom, getRoom, deleteWord, deleteWords } from "../lib/db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json({ limit: '10mb' }));

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }
});

// ============= 初始化 =============

let dbInitialized = false;
async function ensureDb() {
  if (!dbInitialized) {
    await initDatabase();
    dbInitialized = true;
    console.log('[DB] Database initialized');
  }
}

// ============= 房间 API =============

app.post("/api/rooms", async (req, res) => {
  try {
    await ensureDb();
    const { id, name } = req.body;
    if (!id || !name) return res.status(400).json({ error: "缺少房间ID或昵称" });
    const existing = await getRoom(id);
    if (existing) return res.json({ success: true, room: existing });
    const room = await createRoom(id, name);
    res.status(201).json({ success: true, room });
  } catch (error: any) {
    res.status(500).json({ error: error?.message });
  }
});

app.get("/api/rooms/:id", async (req, res) => {
  try {
    await ensureDb();
    const roomId = req.params.id;
    const room = await getRoom(roomId);
    if (!room) return res.status(404).json({ error: "房间不存在" });
    res.json({ room });
  } catch (error: any) {
    res.status(500).json({ error: error?.message });
  }
});

// ============= 通用 API =============

app.get("/api/health", async (req, res) => {
  await ensureDb();
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.get("/api/stats", async (req, res) => {
  try {
    await ensureDb();
    const roomId = req.query.room as string;
    if (!roomId) return res.status(400).json({ error: "缺少 room 参数" });
    res.json(await getStats(roomId));
  } catch (error: any) {
    res.status(500).json({ error: error?.message });
  }
});

// ============= 单词 API =============

app.get("/api/words/remaining", async (req, res) => {
  try {
    await ensureDb();
    const roomId = req.query.room as string;
    if (!roomId) return res.status(400).json({ error: "缺少 room 参数" });
    const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
    const words = await getRemainingWords(roomId, limit);
    res.json({ words });
  } catch (error: any) {
    res.status(500).json({ error: error?.message });
  }
});

app.get("/api/words/random", async (req, res) => {
  try {
    await ensureDb();
    const roomId = req.query.room as string;
    if (!roomId) return res.status(400).json({ error: "缺少 room 参数" });
    const word = await getRandomWord(roomId);
    res.json({ word, message: word ? undefined : "所有单词已掌握！" });
  } catch (error: any) {
    res.status(500).json({ error: error?.message });
  }
});

app.get("/api/words/mastered", async (req, res) => {
  try {
    await ensureDb();
    const roomId = req.query.room as string;
    if (!roomId) return res.status(400).json({ error: "缺少 room 参数" });
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 50;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
    const words = await getMasteredWords(roomId, limit, offset);
    res.json({ words });
  } catch (error: any) {
    res.status(500).json({ error: error?.message });
  }
});

app.get("/api/words", async (req, res) => {
  try {
    await ensureDb();
    const roomId = req.query.room as string;
    if (!roomId) return res.status(400).json({ error: "缺少 room 参数" });
    const limit = req.query.limit ? parseInt(req.query.limit as string) : 100;
    const offset = req.query.offset ? parseInt(req.query.offset as string) : 0;
    const filter = (req.query.filter as 'all' | 'remaining' | 'mastered') || 'all';
    res.json(await getAllWords(roomId, limit, offset, filter));
  } catch (error: any) {
    res.status(500).json({ error: error?.message });
  }
});

app.get("/api/words/search", async (req, res) => {
  try {
    await ensureDb();
    const q = req.query.q as string;
    const roomId = req.query.room as string;
    if (!q?.trim()) return res.status(400).json({ error: "请输入搜索关键词" });
    if (!roomId) return res.status(400).json({ error: "缺少 room 参数" });
    const words = await searchWords(roomId, q.trim());
    res.json({ words });
  } catch (error: any) {
    res.status(500).json({ error: error?.message });
  }
});

app.post("/api/words/:id/master", async (req, res) => {
  try {
    await ensureDb();
    const wordId = parseInt(req.params.id);
    const ok = await markMastered(wordId);
    if (!ok) return res.status(404).json({ error: "单词不存在或已掌握" });
    const roomId = req.body?.room;
    const stats = roomId ? await getStats(roomId) : null;
    res.json({ success: true, stats });
  } catch (error: any) {
    res.status(500).json({ error: error?.message });
  }
});

app.post("/api/words/:id/unmaster", async (req, res) => {
  try {
    await ensureDb();
    const wordId = parseInt(req.params.id);
    const ok = await unmarkMastered(wordId);
    if (!ok) return res.status(404).json({ error: "单词不存在或未掌握" });
    const roomId = req.body?.room;
    const stats = roomId ? await getStats(roomId) : null;
    res.json({ success: true, stats });
  } catch (error: any) {
    res.status(500).json({ error: error?.message });
  }
});

// ============= 导入 API =============

function parseWordContent(content: string): Array<{ word: string; meaning: string }> {
  const lines = content
    .split(/\r?\n/)
    .map(l => l.trim())
    .filter(l => l.length > 0 && !l.startsWith("#") && !l.startsWith("//"));

  const words: Array<{ word: string; meaning: string }> = [];

  for (const line of lines) {
    let wordPart = "";
    let meaning = "";

    if (line.includes("\t")) {
      const idx = line.indexOf("\t");
      wordPart = line.substring(0, idx);
      meaning = line.substring(idx + 1).trim();
    } else if (line.includes("|") && !line.match(/^\s*\|/)) {
      const idx = line.indexOf("|");
      wordPart = line.substring(0, idx);
      meaning = line.substring(idx + 1).trim();
    } else if (line.includes(" - ")) {
      const idx = line.indexOf(" - ");
      wordPart = line.substring(0, idx);
      meaning = line.substring(idx + 3).trim();
    } else if (line.includes("\uff1a")) {
      const idx = line.indexOf("\uff1a");
      wordPart = line.substring(0, idx);
      meaning = line.substring(idx + 1).trim();
    } else if (line.includes(":") && !line.startsWith(":")) {
      const idx = line.indexOf(":");
      wordPart = line.substring(0, idx);
      meaning = line.substring(idx + 1).trim();
    } else {
      const firstCn = line.search(/[\u4e00-\u9fff]/);
      if (firstCn > 0) {
        wordPart = line.substring(0, firstCn).trim();
        meaning = line.substring(firstCn).trim();
      } else {
        wordPart = line;
        meaning = "";
      }
    }

    wordPart = wordPart.trim();
    if (!wordPart) continue;

    const synonyms = wordPart
      .split(/[,，]/)
      .map(s => s.trim())
      .filter(s => s.length > 0);

    if (synonyms.length > 0) {
      words.push({ word: synonyms.join(", "), meaning });
    }
  }

  return words;
}

app.post("/api/words/import", async (req, res) => {
  try {
    await ensureDb();
    const { content, room } = req.body;
    if (!content?.trim()) return res.status(400).json({ error: "导入内容不能为空" });
    if (!room) return res.status(400).json({ error: "缺少 room 参数" });
    const words = parseWordContent(content);
    if (words.length === 0) return res.status(400).json({ error: "未能解析出任何单词" });
    const result = await importWords(room, words);
    const stats = await getStats(room);
    res.json({ success: true, parsed: words.length, ...result, stats });
  } catch (error: any) {
    res.status(500).json({ error: error?.message });
  }
});

app.put("/api/words/import", upload.single("file"), async (req, res) => {
  try {
    await ensureDb();
    const roomId = req.query.room as string;
    if (!roomId) return res.status(400).json({ error: "缺少 room 参数" });
    if (!req.file) return res.status(400).json({ error: "请上传文件" });

    const filename = req.file.originalname.toLowerCase();
    let textContent = "";

    if (filename.endsWith(".docx")) {
      const arrayBuffer = req.file.buffer;
      const result = await mammoth.extractRawText({ buffer: Buffer.from(arrayBuffer) });
      textContent = result.value;
    } else {
      textContent = req.file.buffer.toString("utf-8");
    }

    const words = parseWordContent(textContent);
    if (words.length === 0) return res.status(400).json({ error: "未能从文件中解析出任何单词" });
    const result = await importWords(roomId, words);
    const stats = await getStats(roomId);
    res.json({ success: true, filename: req.file.originalname, parsed: words.length, ...result, stats });
  } catch (error: any) {
    res.status(500).json({ error: error?.message });
  }
});

// ============= 删除 API =============

app.delete("/api/words", async (req, res) => {
  try {
    await ensureDb();
    const roomId = req.query.room as string;
    if (!roomId) return res.status(400).json({ error: "缺少 room 参数" });
    await clearAllWords(roomId);
    res.json({ success: true });
  } catch (error: any) {
    res.status(500).json({ error: error?.message });
  }
});

app.delete("/api/words/:id", async (req, res) => {
  try {
    await ensureDb();
    const wordId = parseInt(req.params.id);
    const ok = await deleteWord(wordId);
    if (!ok) return res.status(404).json({ error: "单词不存在" });
    const roomId = req.query.room as string;
    const stats = roomId ? await getStats(roomId) : null;
    res.json({ success: true, stats });
  } catch (error: any) {
    res.status(500).json({ error: error?.message });
  }
});

app.post("/api/words/batch-delete", async (req, res) => {
  try {
    await ensureDb();
    const { ids, room } = req.body;
    if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: "请提供要删除的单词ID列表" });
    const deleted = await deleteWords(ids.map(Number));
    const stats = room ? await getStats(room) : null;
    res.json({ success: true, deleted, stats });
  } catch (error: any) {
    res.status(500).json({ error: error?.message });
  }
});

// ============= 启动 =============

async function start() {
  await ensureDb();

  app.listen(PORT, () => {
    console.log(`
╔════════════════════════════════════════════╗
║                                            ║
║     Word Flash - 单词卡刷单词              ║
║                                            ║
║     API: http://localhost:${PORT}            ║
║     DB:  Turso / SQLite (lib/db.ts)        ║
║                                            ║
╚════════════════════════════════════════════╝
    `);
  });
}

start();
