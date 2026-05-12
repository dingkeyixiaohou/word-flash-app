import { useState, useEffect, useCallback } from 'react';
import { Stats, Room, ViewMode } from './types';
import { useTheme } from './hooks/useTheme';
import { Header } from './components/Header';
import { FlashCardView } from './components/FlashCardView';
import { WordListView } from './components/WordListView';
import { ImportView } from './components/ImportView';
import { RoomEntry } from './components/RoomEntry';
import { Toast } from './components/Toast';

const ROOM_STORAGE_KEY = 'word-flash-room';

function App() {
  const { theme, toggleTheme } = useTheme();
  const [room, setRoom] = useState<Room | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>('flash');
  const [stats, setStats] = useState<Stats>({ total: 0, mastered: 0, remaining: 0 });
  const [toasts, setToasts] = useState<Array<{ id: string; type: 'success' | 'error' | 'info'; message: string; hiding?: boolean }>>([]);

  // Toast 通知
  const showToast = useCallback((type: 'success' | 'error' | 'info', message: string) => {
    const id = Date.now().toString();
    setToasts(prev => [...prev, { id, type, message }]);
    setTimeout(() => {
      setToasts(prev => prev.map(t => t.id === id ? { ...t, hiding: true } : t));
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 300);
    }, 2500);
  }, []);

  // 从 localStorage / URL 恢复房间
  useEffect(() => {
    // 先看 URL 有没有 room 参数
    const urlParams = new URLSearchParams(window.location.search);
    const urlRoom = urlParams.get('room');

    if (urlRoom) {
      // 验证房间是否存在
      fetch(`/api/rooms/${encodeURIComponent(urlRoom)}`)
        .then(res => res.json())
        .then(data => {
          if (data.room) {
            setRoom(data.room);
            localStorage.setItem(ROOM_STORAGE_KEY, JSON.stringify(data.room));
            // 清理 URL
            window.history.replaceState({}, '', '/');
          }
        })
        .catch(() => {});
    } else {
      // 从 localStorage 恢复
      const stored = localStorage.getItem(ROOM_STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored) as Room;
          if (parsed.id) setRoom(parsed);
        } catch {}
      }
    }
  }, []);

  // 加入房间后更新 localStorage 和 URL
  const handleRoomJoined = useCallback((newRoom: Room) => {
    setRoom(newRoom);
    localStorage.setItem(ROOM_STORAGE_KEY, JSON.stringify(newRoom));
    // 更新 URL 方便分享
    const url = new URL(window.location.href);
    url.searchParams.set('room', newRoom.id);
    window.history.replaceState({}, '', url.toString());
  }, []);

  // 退出房间
  const handleLeaveRoom = useCallback(() => {
    setRoom(null);
    setStats({ total: 0, mastered: 0, remaining: 0 });
    setViewMode('flash');
    localStorage.removeItem(ROOM_STORAGE_KEY);
    window.history.replaceState({}, '', '/');
  }, []);

  // 刷新统计数据
  const refreshStats = useCallback(async () => {
    if (!room) return;
    try {
      const res = await fetch(`/api/stats?room=${encodeURIComponent(room.id)}`);
      const data = await res.json();
      setStats(data);
    } catch (e) {
      console.error('Failed to fetch stats:', e);
    }
  }, [room]);

  // 初始加载
  useEffect(() => {
    refreshStats();
  }, [refreshStats]);

  // 复制分享链接
  const shareLink = useCallback(() => {
    if (!room) return;
    const url = new URL(window.location.href);
    url.searchParams.set('room', room.id);
    navigator.clipboard.writeText(url.toString()).then(() => {
      showToast('success', '分享链接已复制到剪贴板');
    }).catch(() => {
      // fallback
      const input = document.createElement('input');
      input.value = url.toString();
      document.body.appendChild(input);
      input.select();
      document.execCommand('copy');
      document.body.removeChild(input);
      showToast('success', '分享链接已复制到剪贴板');
    });
  }, [room, showToast]);

  // 辅助函数：生成带 room 参数的 URL
  const apiUrl = (path: string) => {
    const sep = path.includes('?') ? '&' : '?';
    return `${path}${sep}room=${encodeURIComponent(room?.id || '')}`;
  };

  // 未进入房间时显示入口页
  if (!room) {
    return (
      <div className="flex h-screen w-screen" style={{ backgroundColor: 'rgb(var(--color-background))' }}>
        {toasts.map(t => (
          <Toast key={t.id} type={t.type} message={t.message} hiding={t.hiding} />
        ))}
        <RoomEntry onRoomJoined={handleRoomJoined} showToast={showToast} />
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen" style={{ backgroundColor: 'rgb(var(--color-background))' }}>
      {/* Toast 通知 */}
      {toasts.map(t => (
        <Toast key={t.id} type={t.type} message={t.message} hiding={t.hiding} />
      ))}

      {/* 主内容区 */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          stats={stats}
          theme={theme}
          currentView={viewMode}
          onToggleTheme={toggleTheme}
          onViewChange={setViewMode}
          room={room}
          onShareLink={shareLink}
          onLeaveRoom={handleLeaveRoom}
        />

        <div className="flex-1 overflow-auto">
          {viewMode === 'flash' && (
            <FlashCardView
              stats={stats}
              onStatsChange={setStats}
              onRefreshStats={refreshStats}
              showToast={showToast}
              room={room}
            />
          )}
          {viewMode === 'list' && (
            <WordListView
              filter="remaining"
              onRefreshStats={refreshStats}
              showToast={showToast}
              room={room}
            />
          )}
          {viewMode === 'mastered' && (
            <WordListView
              filter="mastered"
              onRefreshStats={refreshStats}
              showToast={showToast}
              room={room}
            />
          )}
          {viewMode === 'import' && (
            <ImportView
              onImportSuccess={refreshStats}
              showToast={showToast}
              room={room}
            />
          )}
        </div>
      </main>
    </div>
  );
}

export default App;
