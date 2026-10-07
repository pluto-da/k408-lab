import type { ItemKind, Subject } from "./catalog";

export interface PublicUser {
  id: string;
  username: string | null;
  email: string | null;
  nickname: string;
  createdAt: string;
}

export interface SubjectProgress {
  subject: Subject;
  name: string;
  done: number;
  total: number;
  percent: number;
  byKind: Record<ItemKind, { done: number; total: number }>;
}

export interface ProgressResponse {
  overall: { done: number; total: number; percent: number };
  subjects: SubjectProgress[];
  recent: { itemId: string; title: string; kind: ItemKind; subject: Subject; lastAt: string }[];
  completedIds: string[];
}

export type MistakeSource = "quiz" | "flow";

export interface MistakeDto {
  id: string;
  source: MistakeSource;
  subject: Subject;
  questionId: string | null;
  flowId: string | null;
  stepIndex: number | null;
  stepType: "single" | "order";
  /** 题干：自测题为受信任的题库 HTML（仅含 code 标签），流程题为纯文本 */
  prompt: string;
  promptIsHtml: boolean;
  options: string[];
  optionsAreHtml: boolean;
  chosen: string;
  correctAnswer: string;
  explanation: string;
  explanationIsHtml: boolean;
  wrongCount: number;
  mastered: boolean;
  masteredAt: string | null;
  lastWrongAt: string;
  createdAt: string;
}

export interface LeaderboardRow {
  rank: number;
  userId: string;
  nickname: string;
  stars: number;
  mistakes: number;
  timeMs: number;
  achievedAt: string;
}

export interface LeaderboardResponse {
  flowId: string;
  period: "week" | "all";
  since: string | null;
  rows: LeaderboardRow[];
  me: LeaderboardRow | null;
  totalPlayers: number;
}
