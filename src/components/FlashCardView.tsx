import { useState, useEffect, useCallback } from 'react';
import { Stats, Word, Room } from '../types';

interface FlashCardViewProps {
  stats: Stats;
  onStatsChange: (stats: Stats) => void;
  onRefreshStats: () => void;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
  room: Room;
}

export function FlashCardView({ stats, onStatsChange, showToast, room }: FlashCardViewProps) {
  const [words, setWords] = useState<Word[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isFlipped, setIsFlipped] = useState(false);
  const [loading, setLoading] = useState(true);
  const [justMastered, setJustMastered] = useState(false);

  const currentWord = words[currentIndex] || null;

  // 解析同义词（word 字段可能包含 "synonym1, synonym2, synonym3"）
  const synonyms = currentWord ? currentWord.word.split(',').map(s => s.trim()).filter(Boolean) : [];
  const displayWord = synonyms.length > 0 ? synonyms.join(', ') : currentWord?.word || '';

  // 加载待复习单词
  const loadWords = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/words/remaining?room=${encodeURIComponent(room.id)}`);
      const data = await res.json();
      if (data.words?.length > 0) {
        setWords(data.words);
        setCurrentIndex(0);
        setIsFlipped(false);
      } else {
        setWords([]);
      }
    } catch {
      showToast('error', '加载单词失败');
    }
    setLoading(false);
  }, [showToast]);

  useEffect(() => { loadWords(); }, [loadWords]);

  // 标记掌握
  const handleMaster = useCallback(async () => {
    if (!currentWord) return;
    try {
      const res = await fetch(`/api/words/${currentWord.id}/master`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ room: room.id }) });
      const data = await res.json();
      if (data.success) {
        onStatsChange(data.stats);
        setJustMastered(true);
        showToast('success', `"${currentWord.word}" 已标记为掌握`);
        setTimeout(() => goToNext(), 400);
      }
    } catch {
      showToast('error', '操作失败');
    }
  }, [currentWord, onStatsChange, showToast]);

  const goToNext = useCallback(() => {
    setJustMastered(false);
    if (currentIndex + 1 < words.length) {
      setCurrentIndex(prev => prev + 1);
      setIsFlipped(false);
    } else {
      loadWords();
    }
  }, [currentIndex, words.length, loadWords]);

  const goToPrev = useCallback(() => {
    setJustMastered(false);
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
      setIsFlipped(false);
    }
  }, [currentIndex]);

  const handleShuffle = useCallback(() => {
    if (words.length < 2) return;
    setWords(prev => [...prev].sort(() => Math.random() - 0.5));
    setCurrentIndex(0);
    setIsFlipped(false);
    setJustMastered(false);
  }, [words.length]);

  // 键盘快捷键
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLInputElement) return;
      switch (e.key) {
        case ' ':
          e.preventDefault();
          setIsFlipped(prev => !prev);
          break;
        case 'ArrowRight':
          goToNext();
          break;
        case 'ArrowLeft':
          goToPrev();
          break;
        case 'Enter':
          handleMaster();
          break;
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [goToNext, goToPrev, handleMaster]);

  // 空状态
  if (!currentWord && !loading) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-6 animate-fade-in">
        <div className="text-6xl">{stats.total === 0 ? '📭' : '🎉'}</div>
        <h2 className="text-xl font-bold" style={{ color: 'rgb(var(--color-foreground))' }}>
          {stats.total === 0 ? '还没有单词' : '全部掌握！'}
        </h2>
        <p style={{ color: 'rgb(var(--color-muted-foreground))' }}>
          {stats.total === 0
            ? '点击上方「导入」标签页，导入你的单词列表'
            : `恭喜！你已经掌握了全部 ${stats.total} 个单词`}
        </p>
        {stats.total > 0 && (
          <button className="btn btn-secondary" onClick={loadWords}>🔄 重新检查</button>
        )}
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-lg" style={{ color: 'rgb(var(--color-muted-foreground))' }}>加载中...</div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center h-full gap-5 px-4 animate-fade-in">
      {/* 计数 */}
      {words.length > 0 && (
        <div className="text-sm font-medium" style={{ color: 'rgb(var(--color-muted-foreground))' }}>
          第 {currentIndex + 1} / {words.length} 个
        </div>
      )}

      {/* 翻转卡片 */}
      <div
        className="card-flip-container"
        style={{ width: 'min(520px, 88vw)', height: 'min(300px, 46vh)', cursor: 'pointer' }}
        onClick={() => setIsFlipped(prev => !prev)}
      >
        <div className={`card-flip-inner ${isFlipped ? 'flipped' : ''}`}>
          {/* 正面 */}
          <div
            className={`card-front surface ${justMastered ? 'pulse-success' : ''}`}
            style={{
              background: justMastered
                ? 'rgb(var(--color-success))'
                : 'rgb(var(--color-card))',
              boxShadow: justMastered
                ? '0 8px 32px rgba(var(--color-success), 0.3)'
                : '0 2px 12px rgba(0,0,0,0.06)',
            }}
          >
            <span
              className="text-xs mb-3"
              style={{ color: justMastered ? 'rgba(255,255,255,0.7)' : 'rgb(var(--color-muted-foreground))' }}
            >
              {isFlipped ? '点击翻转回正面' : '点击翻转查看释义'}
            </span>
            {synonyms.length > 1 ? (
              // 多同义词：每个词单独一行显示
              <div className="flex flex-col items-center gap-2">
                {synonyms.map((syn, i) => (
                  <span
                    key={i}
                    className="font-bold tracking-tight"
                    style={{
                      color: justMastered ? 'white' : 'rgb(var(--color-foreground))',
                      fontSize: i === 0 ? '2rem' : '1.5rem',
                      opacity: i > 0 ? 0.7 : 1,
                    }}
                  >
                    {syn}
                  </span>
                ))}
              </div>
            ) : (
              <span
                className="text-4xl font-bold tracking-tight"
                style={{ color: justMastered ? 'white' : 'rgb(var(--color-foreground))' }}
              >
                {displayWord}
              </span>
            )}
            {justMastered && (
              <span className="mt-4 text-base" style={{ color: 'rgba(255,255,255,0.85)' }}>
                ✓ 已掌握，即将跳转...
              </span>
            )}
          </div>

          {/* 背面 */}
          <div
            className="card-back"
            style={{
              background: 'rgb(var(--color-accent))',
              borderRadius: '16px',
              boxShadow: '0 8px 32px rgba(var(--color-accent), 0.25)',
            }}
          >
            <span className="text-sm mb-3 font-semibold" style={{ color: 'rgba(255,255,255,0.7)' }}>
              {currentWord.word}
            </span>
            <span
              className="text-xl text-center leading-relaxed px-4"
              style={{ color: 'white', maxWidth: '440px' }}
            >
              {currentWord.meaning || '(无释义)'}
            </span>
          </div>
        </div>
      </div>

      {/* 操作按钮 */}
      <div className="flex items-center gap-2 flex-wrap justify-center">
        <button className="btn btn-secondary" onClick={goToPrev} disabled={currentIndex === 0} style={{ opacity: currentIndex === 0 ? 0.35 : 1 }}>
          ← 上一个
        </button>
        <button className="btn btn-success" onClick={handleMaster}>
          ✓ 掌握
        </button>
        <button className="btn btn-secondary" onClick={goToNext}>
          下一个 →
        </button>
        <button className="btn btn-ghost" onClick={handleShuffle} title="打乱顺序">🔀</button>
        <button className="btn btn-ghost" onClick={loadWords} title="重新加载">🔄</button>
      </div>

      {/* 快捷键提示 */}
      <span className="text-xs" style={{ color: 'rgb(var(--color-muted-foreground))', marginTop: '-4px' }}>
        空格=翻转 &nbsp; ←→=切换 &nbsp; Enter=掌握
      </span>
    </div>
  );
}
