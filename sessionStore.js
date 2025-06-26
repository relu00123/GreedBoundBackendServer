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

function removeSession(token) {
  sessionMap.delete(token);
}

module.exports = {
  saveSession,
  getSession,
  updateSession,
  removeSession,
  sessionMap,
};