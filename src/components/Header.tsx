import { ViewMode, Room } from '../types';

interface HeaderProps {
  theme: 'light' | 'dark';
  stats: { total: number; mastered: number; remaining: number };
  currentView: ViewMode;
  onViewChange: (view: ViewMode) => void;
  onToggleTheme: () => void;
  room: Room;
  onShareLink: () => void;
  onLeaveRoom: () => void;
}

export function Header({ theme, stats, currentView, onViewChange, onToggleTheme, room, onShareLink, onLeaveRoom }: HeaderProps) {
  const mastered = stats.mastered || 0;
  const total = stats.total || 0;
  const progress = total > 0 ? Math.round((mastered / total) * 100) : 0;

  const tabs: { key: ViewMode; label: string; icon: string }[] = [
    { key: 'flash', label: '闪卡', icon: '🃏' },
    { key: 'list', label: '列表', icon: '📋' },
    { key: 'mastered', label: '已掌握', icon: '✅' },
    { key: 'import', label: '导入', icon: '📥' },
  ];

  return (
    <header className="mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold">📚 Word Flash</h1>
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{
              background: 'rgb(var(--color-accent))',
              color: 'white',
              opacity: 0.85,
            }}
          >
            {room.id}
          </span>
          <span
            className="text-xs"
            style={{ color: 'rgb(var(--color-muted-foreground))' }}
          >
            {room.name}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button className="btn btn-ghost" onClick={onShareLink} title="分享房间链接" style={{ padding: '4px 8px', fontSize: '12px' }}>
            🔗
          </button>
          <button className="btn btn-ghost" onClick={onToggleTheme} title={theme === 'light' ? '切换到暗色模式' : '切换到亮色模式'} style={{ padding: '4px 8px', fontSize: '12px' }}>
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          <button className="btn btn-ghost" onClick={onLeaveRoom} title="退出房间" style={{ padding: '4px 8px', fontSize: '12px' }}>
            ✕
          </button>
        </div>
      </div>

      {/* 进度条 */}
      <div className="mb-4">
        <div className="progress-bar">
          <div
            className="progress-fill"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="text-xs text-center mt-1" style={{ color: 'rgb(var(--color-muted-foreground))' }}>
          掌握进度: {mastered}/{total} ({progress}%)
        </p>
      </div>

      {/* 标签导航 */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {tabs.map(tab => (
          <button
            key={tab.key}
            className={`tab ${currentView === tab.key ? 'active' : ''}`}
            onClick={() => onViewChange(tab.key)}
          >
            <span className="mr-1">{tab.icon}</span>
            {tab.label}
          </button>
        ))}
      </div>
    </header>
  );
}
