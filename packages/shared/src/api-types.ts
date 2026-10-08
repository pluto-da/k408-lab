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

/** 错题（仅来自自测题） */
export interface MistakeDto {
  id: string;
  subject: Subject;
  questionId: string | null;
  /** 题干、选项、答案与解析均为受信任的题库 HTML（仅含 code 标签） */
  prompt: string;
  options: string[];
  chosen: string;
  correctAnswer: string;
  explanation: string;
  wrongCount: number;
  mastered: boolean;
  masteredAt: string | null;
  lastWrongAt: string;
  createdAt: string;
}
