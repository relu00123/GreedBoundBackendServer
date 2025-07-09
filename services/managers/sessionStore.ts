// sessionStore.ts

// 1. ws 모듈에서 WebSocket 타입만 명확히 import
import type { WebSocket as WSWebSocket } from "ws";

// 2. Session 인터페이스 정의
export interface Session {
  username: string;
  token: string;
  isDedicated?: boolean;
  dungeonId?: string;
  ws?: WSWebSocket | null; // 핵심 수정: WebSocket은 'ws'에서 온 명확한 타입
  [key: string]: any;
}

// 3. 세션 저장소
const sessionMap = new Map<string, Session>();

function saveSession(token: string, session: Session) {
  sessionMap.set(token, session);
}

function getSession(token: string): Session | undefined {
  return sessionMap.get(token);
}

function updateSession(token: string, patch: Partial<Session>) {
  const existing = sessionMap.get(token);
  if (existing) {
    sessionMap.set(token, { ...existing, ...patch });
  }
}

function updateSessionSafe(token: string, patch: Partial<Session>) {
  const existing = sessionMap.get(token);
  if (!existing) return;

  const protectedKeys = ["username", "isDedicated", "ws"];
  const updated: Session = { ...existing };

  for (const key of Object.keys(patch)) {
    if (!protectedKeys.includes(key)) {
      updated[key] = patch[key];
    }
  }

  sessionMap.set(token, updated);
}

function removeSession(token: string) {
  sessionMap.delete(token);
}

function isUserLoggedIn(username: string): boolean {
  for (const session of sessionMap.values()) {
    if (session.username === username && session.isDedicated !== true) {
      return true;
    }
  }
  return false;
}

function isDedicatedLoggedIn(dungeonId: string): boolean {
  for (const session of sessionMap.values()) {
    if (session.isDedicated === true && session.dungeonId === dungeonId) {
      return true;
    }
  }
  return false;
}

function isSessionOfClient(token: string): boolean {
  const session = sessionMap.get(token);
  return !!(session && session.isDedicated !== true);
}

// 4. export
export {
  saveSession,
  getSession,
  updateSession,
  updateSessionSafe,
  removeSession,
  sessionMap,
  isUserLoggedIn,
  isDedicatedLoggedIn,
  isSessionOfClient,
};