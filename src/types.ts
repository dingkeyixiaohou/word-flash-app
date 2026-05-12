export type Theme = 'light' | 'dark';

export interface Word {
  id: number;
  word: string;
  meaning: string;
  mastered: number;
  created_at: string;
  mastered_at: string | null;
}

export interface Stats {
  total: number;
  mastered: number;
  remaining: number;
}

export interface Room {
  id: string;
  name: string;
  created_at: string;
}

export type ViewMode = 'flash' | 'list' | 'mastered' | 'import';
export type FilterMode = 'all' | 'remaining' | 'mastered';

export interface ImportResult {
  success: boolean;
  parsed: number;
  imported: number;
  stats: Stats;
  filename?: string;
}
