import { useState } from 'react';
import { Room } from '../types';

interface RoomEntryProps {
  onRoomJoined: (room: Room) => void;
  showToast: (type: 'success' | 'error' | 'info', message: string) => void;
}

function generateRoomId(): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let id = 'flash-';
  for (let i = 0; i < 6; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

export function RoomEntry({ onRoomJoined, showToast }: RoomEntryProps) {
  const [name, setName] = useState('');
  const [roomId, setRoomId] = useState('');
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<'create' | 'join'>('create');

  const handleSubmit = async () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      showToast('error', '请输入昵称');
      return;
    }

    setLoading(true);
    try {
      if (mode === 'create') {
        // 创建房间
        const newRoomId = roomId.trim() || generateRoomId();
        const res = await fetch('/api/rooms', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: newRoomId, name: trimmedName }),
        });
        const data = await res.json();
        if (data.success) {
          onRoomJoined(data.room);
        } else {
          showToast('error', data.error || '创建失败');
        }
      } else {
        // 加入房间
        const trimmedRoomId = roomId.trim();
        if (!trimmedRoomId) {
          showToast('error', '请输入房间码');
          return;
        }
        const res = await fetch(`/api/rooms/${encodeURIComponent(trimmedRoomId)}`);
        const data = await res.json();
        if (data.room) {
          onRoomJoined(data.room);
        } else {
          showToast('error', data.error || '房间不存在');
        }
      }
    } catch {
      showToast('error', '网络错误，请重试');
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleSubmit();
  };

  return (
    <div className="flex items-center justify-center h-full animate-fade-in px-4">
      <div
        className="surface rounded-2xl p-8"
        style={{
          width: 'min(420px, 90vw)',
          boxShadow: '0 4px 24px rgba(0,0,0,0.08)',
        }}
      >
        <h2
          className="text-2xl font-bold text-center mb-2"
          style={{ color: 'rgb(var(--color-foreground))' }}
        >
          📚 Word Flash
        </h2>
        <p
          className="text-sm text-center mb-6"
          style={{ color: 'rgb(var(--color-muted-foreground))' }}
        >
          单词卡刷单词 — 创建或加入一个房间开始
        </p>

        {/* 模式切换 */}
        <div className="flex gap-2 mb-5">
          <button
            className={`btn flex-1 ${mode === 'create' ? 'btn-accent' : 'btn-ghost'}`}
            onClick={() => setMode('create')}
            style={{ padding: '8px 0', fontSize: '14px' }}
          >
            ✨ 创建房间
          </button>
          <button
            className={`btn flex-1 ${mode === 'join' ? 'btn-accent' : 'btn-ghost'}`}
            onClick={() => setMode('join')}
            style={{ padding: '8px 0', fontSize: '14px' }}
          >
            🔗 加入房间
          </button>
        </div>

        {/* 昵称输入 */}
        <div className="mb-4">
          <label
            className="block text-sm font-medium mb-1.5"
            style={{ color: 'rgb(var(--color-foreground))' }}
          >
            你的昵称
          </label>
          <input
            className="input-base w-full"
            placeholder="输入昵称..."
            value={name}
            onChange={e => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={20}
          />
        </div>

        {/* 房间码输入（加入模式必填，创建模式可自定义） */}
        <div className="mb-6">
          <label
            className="block text-sm font-medium mb-1.5"
            style={{ color: 'rgb(var(--color-foreground))' }}
          >
            {mode === 'create' ? '房间码（留空自动生成）' : '房间码'}
          </label>
          <input
            className="input-base w-full"
            placeholder={mode === 'create' ? '如 flash-abc123' : '输入房间码...'}
            value={roomId}
            onChange={e => setRoomId(e.target.value)}
            onKeyDown={handleKeyDown}
            maxLength={30}
          />
        </div>

        {/* 提交按钮 */}
        <button
          className="btn btn-accent w-full"
          onClick={handleSubmit}
          disabled={loading}
          style={{ padding: '10px 0', fontSize: '15px' }}
        >
          {loading ? '...' : mode === 'create' ? '✨ 创建并进入' : '🔗 加入房间'}
        </button>

        {/* 提示 */}
        <p
          className="text-xs text-center mt-4"
          style={{ color: 'rgb(var(--color-muted-foreground))' }}
        >
          {mode === 'create'
            ? '创建房间后，分享链接给朋友即可一起刷单词'
            : '输入朋友分享的房间码，加入同一个单词库'}
        </p>
      </div>
    </div>
  );
}
