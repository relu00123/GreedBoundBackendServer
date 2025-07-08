// sessionStore.js

const sessionMap = new Map();

function saveSession(token, session) {
  sessionMap.set(token, session);
}

function getSession(token) {
  return sessionMap.get(token);
}

function updateSession(token, patch) {
  const existing = sessionMap.get(token);
  if (existing) {
    sessionMap.set(token, { ...existing, ...patch });
  }
}

function updateSessionSafe(token, patch) {
  const existing = sessionMap.get(token);
  if (!existing) return;

  const protectedKeys = ["username", "isDedicated", "ws"];
  const updated = { ...existing };

  for (const key of Object.keys(patch)) {
    if (!protectedKeys.includes(key)) {
      updated[key] = patch[key];
    }
  }

  sessionMap.set(token, updated);
}

function removeSession(token) {
  sessionMap.delete(token);
}

function isUserLoggedIn(username) {
  for (const session of sessionMap.values()) {
    if (session.username === username && session.isDedicated !== true) {
      return true;
    }
  }
  return false;
}

function isDedicatedLoggedIn(dungeonId) {
  for (const session of sessionMap.values()) {
    if (session.isDedicated === true && session.dungeonId === dungeonId) {
      return true;
    }
  }
  return false;
}

function isSessionOfClient(token) {
  const session = sessionMap.get(token);
  return session && session.isDedicated !== true;
}

module.exports = {
    saveSession,
  getSession,
  updateSession,
  removeSession,
  sessionMap,
  isUserLoggedIn,
  isDedicatedLoggedIn,        
  isSessionOfClient  
};