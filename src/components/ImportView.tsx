import { useState, useRef } from 'react';
import { ImportResult, Room } from '../types';

interface ImportViewProps {
  onImportSuccess: () => void;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
  room: Room;
}

const EXAMPLE_TEXT = `apple, malus - 苹果；苹果公司
big, large, huge - 大的；巨大的
computer - 计算机；电脑
ephemeral - 短暂的，转瞬即逝的
ubiquitous - 无处不在的
paradigm - 范式；典范
serendipity - 意外发现；机缘巧合
resilience - 韧性；恢复力
meticulous - 一丝不苟的；细致的
eloquent - 雄辩的；有说服力的`;

export function ImportView({ onImportSuccess, showToast, room }: ImportViewProps) {
  const [content, setContent] = useState('');
  const [importing, setImporting] = useState(false);
  const [lastResult, setLastResult] = useState<ImportResult | null>(null);
  const [dragging, setDragging] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 文本导入
  const handleImport = async () => {
    if (!content.trim()) {
      showToast('error', '请输入或粘贴单词内容');
      return;
    }
    setImporting(true);
    try {
      const res = await fetch('/api/words/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, room: room.id }),
      });
      const data = await res.json();
      if (data.success) {
        setLastResult(data);
        onImportSuccess();
        showToast('success', `成功导入 ${data.imported} 个词条（解析 ${data.parsed} 行）`);
        if (data.imported > 0) setContent('');
      } else {
        showToast('error', data.error || '导入失败');
      }
    } catch {
      showToast('error', '网络请求失败');
    }
    setImporting(false);
  };

  // 文件上传
  const handleFileUpload = async (file: File) => {
    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch(`/api/words/import?room=${encodeURIComponent(room.id)}`, {
        method: 'PUT',
        body: formData,
      });
      const data = await res.json();
      if (data.success) {
        setLastResult(data);
        onImportSuccess();
        showToast('success', `从 "${data.filename}" 导入 ${data.imported} 个单词`);
      } else {
        showToast('error', data.error || '导入失败');
      }
    } catch {
      showToast('error', '文件上传失败');
    }
    setImporting(false);
  };

  // 拖拽处理
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFileUpload(file);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(true);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileUpload(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // 加载示例
  const loadExample = () => {
    setContent(EXAMPLE_TEXT);
  };

  // 清空所有单词
  const handleClearAll = async () => {
    if (!window.confirm('确定要清空所有单词吗？此操作不可撤销！')) return;
    try {
      const res = await fetch(`/api/words?room=${encodeURIComponent(room.id)}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('info', '已清空所有单词');
        onImportSuccess();
        setLastResult(null);
      }
    } catch {
      showToast('error', '清空失败');
    }
  };

  return (
    <div className="flex flex-col h-full px-6 py-4 gap-4 overflow-auto animate-fade-in">
      {/* 说明 */}
      <div className="surface px-5 py-4">
        <h3 className="font-semibold text-sm mb-2" style={{ color: 'rgb(var(--color-foreground))' }}>
          支持的导入格式
        </h3>
        <p className="text-sm leading-relaxed" style={{ color: 'rgb(var(--color-muted-foreground))' }}>
          每行一个词条，支持以下分隔符（单词与释义之间）：<br />
          <code className="px-1.5 py-0.5 rounded text-xs" style={{ background: 'rgb(var(--color-muted))' }}>Tab</code>
          <code className="px-1.5 py-0.5 rounded text-xs ml-1" style={{ background: 'rgb(var(--color-muted))' }}>|</code>
          <code className="px-1.5 py-0.5 rounded text-xs ml-1" style={{ background: 'rgb(var(--color-muted))' }}> - </code>
          <code className="px-1.5 py-0.5 rounded text-xs ml-1" style={{ background: 'rgb(var(--color-muted))' }}>:</code>
          <br />
          同义词用逗号（中英文均可）分隔，如：<code className="px-1.5 py-0.5 rounded text-xs" style={{ background: 'rgb(var(--color-muted))' }}>big, large, huge - 大的</code>
          <br />
          也可以自动识别中英文分界，如：<code className="px-1.5 py-0.5 rounded text-xs" style={{ background: 'rgb(var(--color-muted))' }}>abate, mitigate 减弱</code>
        </p>
      </div>

      {/* 文件上传区 */}
      <div
        className={`drop-zone ${dragging ? 'dragging' : ''}`}
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragging(false)}
        onClick={() => fileInputRef.current?.click()}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".txt,.csv,.tsv,.docx"
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <div className="text-3xl mb-2">📄</div>
        <div className="text-sm font-medium" style={{ color: 'rgb(var(--color-foreground))' }}>
          拖拽文件到此处，或点击上传
        </div>
        <div className="text-xs mt-1" style={{ color: 'rgb(var(--color-muted-foreground))' }}>
          支持 .txt / .csv / .tsv / .docx 格式
        </div>
      </div>

      {/* 文本输入区 */}
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium" style={{ color: 'rgb(var(--color-foreground))' }}>
          或直接粘贴：
        </span>
        <button className="btn btn-ghost" style={{ padding: '2px 8px', fontSize: '12px' }} onClick={loadExample}>
          加载示例
        </button>
      </div>
      <textarea
        className="input-base flex-1"
        style={{ minHeight: '200px', resize: 'vertical', fontFamily: 'monospace', fontSize: '13px', lineHeight: 1.6 }}
        placeholder={"apple\t苹果；苹果公司\nbanana\t香蕉\ncomputer\t计算机\n\n或：\nabate, mitigate 减弱（程度）"}
        value={content}
        onChange={e => setContent(e.target.value)}
      />

      {/* 操作按钮 */}
      <div className="flex items-center gap-3">
        <button
          className="btn btn-primary"
          onClick={handleImport}
          disabled={importing || !content.trim()}
          style={{ opacity: importing || !content.trim() ? 0.5 : 1 }}
        >
          {importing ? '⏳ 导入中...' : '📥 导入单词'}
        </button>
        <button className="btn btn-danger" onClick={handleClearAll} style={{ fontSize: '12px' }}>
          🗑 清空全部
        </button>
      </div>

      {/* 上次导入结果 */}
      {lastResult && (
        <div className="surface px-5 py-3 animate-fade-in">
          <span className="text-sm" style={{ color: 'rgb(var(--color-success))' }}>
            上次导入：解析 {lastResult.parsed} 行，成功导入 {lastResult.imported} 个词条
          </span>
        </div>
      )}
    </div>
  );
}
