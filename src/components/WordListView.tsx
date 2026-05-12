import { useState, useEffect, useCallback } from 'react';
import { Word, FilterMode, Room } from '../types';

interface WordListViewProps {
  filter: FilterMode;
  onRefreshStats: () => void;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
  room: Room;
}

export function WordListView({ filter, onRefreshStats, showToast, room }: WordListViewProps) {
  const [words, setWords] = useState<Word[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [search, setSearch] = useState('');
  const [searchResults, setSearchResults] = useState<Word[] | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [selectMode, setSelectMode] = useState(false);
  const pageSize = 50;

  // 加载单词列表
  const loadWords = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        filter,
        limit: String(pageSize),
        offset: String(page * pageSize),
        room: room.id,
      });
      const res = await fetch(`/api/words?${params}`);
      const data = await res.json();
      setWords(data.words || []);
      setTotal(data.total || 0);
    } catch {
      showToast('error', '加载失败');
    }
  }, [filter, page, showToast, room.id]);

  useEffect(() => { loadWords(); }, [loadWords]);

  // 切换筛选条件时重置页码和选择
  useEffect(() => {
    setPage(0);
    setSelectedIds(new Set());
    setSelectMode(false);
  }, [filter]);

  // 搜索
  useEffect(() => {
    if (!search.trim()) {
      setSearchResults(null);
      return;
    }
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/words/search?q=${encodeURIComponent(search.trim())}&room=${encodeURIComponent(room.id)}`);
        const data = await res.json();
        setSearchResults(data.words || []);
      } catch {
        // ignore
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [search]);

  // 掌握/取消掌握
  const toggleMaster = async (word: Word) => {
    const isMastered = word.mastered === 1;
    const endpoint = isMastered ? 'unmaster' : 'master';
    try {
      const res = await fetch(`/api/words/${word.id}/${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ room: room.id }) });
      const data = await res.json();
      if (data.success) {
        showToast('success', isMastered ? `"${word.word}" 已移回待复习` : `"${word.word}" 已掌握`);
        onRefreshStats();
        setWords(prev => prev.filter(w => w.id !== word.id));
        setTotal(prev => prev - 1);
        setSelectedIds(prev => { const next = new Set(prev); next.delete(word.id); return next; });
      }
    } catch {
      showToast('error', '操作失败');
    }
  };

  // 单个删除
  const deleteWord = async (word: Word) => {
    if (!window.confirm(`确定要删除 "${word.word}" 吗？`)) return;
    try {
      const res = await fetch(`/api/words/${word.id}?room=${encodeURIComponent(room.id)}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        showToast('info', `"${word.word}" 已删除`);
        onRefreshStats();
        setWords(prev => prev.filter(w => w.id !== word.id));
        setTotal(prev => prev - 1);
        setSelectedIds(prev => { const next = new Set(prev); next.delete(word.id); return next; });
      } else {
        showToast('error', data.error || '删除失败');
      }
    } catch (e: any) {
      showToast('error', '删除失败：' + (e?.message || '网络错误'));
    }
  };

  // 批量删除
  const batchDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`确定要删除选中的 ${selectedIds.size} 个单词吗？`)) return;
    try {
      const res = await fetch('/api/words/batch-delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds), room: room.id }),
      });
      const data = await res.json();
      if (data.success) {
        showToast('info', `已删除 ${data.deleted} 个单词`);
        setSelectedIds(new Set());
        setSelectMode(false);
        onRefreshStats();
        loadWords();
      } else {
        showToast('error', data.error || '批量删除失败');
      }
    } catch {
      showToast('error', '批量删除失败');
    }
  };

  // 全选/取消全选
  const toggleSelectAll = () => {
    if (selectedIds.size === displayWords.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(displayWords.map(w => w.id)));
    }
  };

  // 切换单个选中
  const toggleSelect = (id: number) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const displayWords = searchResults ?? words;
  const displayTotal = searchResults ? searchResults.length : total;
  const totalPages = Math.ceil(displayTotal / pageSize);

  return (
    <div className="flex flex-col h-full px-6 py-4 gap-4 animate-fade-in">
      {/* 顶部操作栏 */}
      <div className="flex items-center gap-3 flex-wrap">
        <input
          className="input-base flex-1"
          placeholder="搜索单词或释义..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <span className="text-sm whitespace-nowrap" style={{ color: 'rgb(var(--color-muted-foreground))' }}>
          {searchResults !== null ? `搜索到 ${displayTotal} 个` : `共 ${displayTotal} 个`}
        </span>
        {/* 选择模式切换 */}
        <button
          className={`btn ${selectMode ? 'btn-accent' : 'btn-ghost'}`}
          style={{ padding: '4px 12px', fontSize: '12px' }}
          onClick={() => { setSelectMode(!selectMode); setSelectedIds(new Set()); }}
        >
          {selectMode ? '✕ 取消' : '☑ 选择'}
        </button>
        {selectMode && selectedIds.size > 0 && (
          <button
            className="btn btn-danger"
            style={{ padding: '4px 12px', fontSize: '12px' }}
            onClick={batchDelete}
          >
            🗑 删除({selectedIds.size})
          </button>
        )}
      </div>

      {/* 全选栏 */}
      {selectMode && displayWords.length > 0 && (
        <div className="flex items-center gap-2 px-1">
          <label className="flex items-center gap-1 text-sm cursor-pointer" style={{ color: 'rgb(var(--color-muted-foreground))' }}>
            <input
              type="checkbox"
              checked={selectedIds.size === displayWords.length && displayWords.length > 0}
              onChange={toggleSelectAll}
            />
            全选本页
          </label>
          <span className="text-xs" style={{ color: 'rgb(var(--color-muted-foreground))' }}>
            已选 {selectedIds.size} 个
          </span>
        </div>
      )}

      {/* 单词列表 */}
      <div className="flex-1 overflow-auto">
        {displayWords.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <span className="text-4xl">{search ? '🔍' : filter === 'mastered' ? '📝' : '📭'}</span>
            <span style={{ color: 'rgb(var(--color-muted-foreground))' }}>
              {search ? '未找到匹配的单词' : filter === 'mastered' ? '还没有掌握的单词' : '没有待复习的单词'}
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-1">
            {displayWords.map(word => (
              <div
                key={word.id}
                className="flex items-center px-4 py-3 rounded-xl animate-fade-in surface"
                style={{
                  transition: 'border-color 0.2s',
                  borderLeft: selectedIds.has(word.id) ? '3px solid rgb(var(--color-danger))' : '3px solid transparent',
                }}
              >
                {/* 复选框 */}
                {selectMode && (
                  <input
                    type="checkbox"
                    className="mr-3"
                    checked={selectedIds.has(word.id)}
                    onChange={() => toggleSelect(word.id)}
                  />
                )}
                <div className="flex-1 min-w-0 mr-4">
                  <span className="font-semibold text-sm" style={{ color: 'rgb(var(--color-foreground))' }}>
                    {word.word}
                  </span>
                  {word.meaning && (
                    <span className="ml-3 text-sm" style={{ color: 'rgb(var(--color-muted-foreground))' }}>
                      {word.meaning.length > 80 ? word.meaning.slice(0, 80) + '...' : word.meaning}
                    </span>
                  )}
                </div>
                {/* 非选择模式下显示操作按钮 */}
                {!selectMode && (
                  <div className="flex items-center gap-2">
                    <button
                      className={`btn ${word.mastered ? 'btn-secondary' : 'btn-success'}`}
                      style={{ padding: '4px 12px', fontSize: '12px' }}
                      onClick={() => toggleMaster(word)}
                    >
                      {word.mastered ? '↩ 移回' : '✓ 掌握'}
                    </button>
                    <button
                      className="btn btn-danger"
                      style={{ padding: '4px 12px', fontSize: '12px' }}
                      onClick={() => deleteWord(word)}
                      title="删除此词条"
                    >
                      🗑
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* 分页 */}
      {!searchResults && totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 py-2">
          <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: '12px' }} disabled={page === 0} onClick={() => setPage(0)}>«</button>
          <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: '12px' }} disabled={page === 0} onClick={() => setPage(p => p - 1)}>‹ 上一页</button>
          <span className="text-sm px-3" style={{ color: 'rgb(var(--color-muted-foreground))' }}>{page + 1} / {totalPages}</span>
          <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: '12px' }} disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>下一页 ›</button>
          <button className="btn btn-ghost" style={{ padding: '4px 10px', fontSize: '12px' }} disabled={page >= totalPages - 1} onClick={() => setPage(totalPages - 1)}>»</button>
        </div>
      )}
    </div>
  );
}
