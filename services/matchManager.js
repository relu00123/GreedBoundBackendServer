// services/matchManager.js

const PlayerState = require("../constants/playerstate");
const { updateSession, sessionMap } = require("./sessionStore");

let matchQueue = [];
let dungeons = {};
let dungeonIdCounter = 1;

function addToMatchQueue(username, token) {
  matchQueue.push({ username, token });
  updateSession(token, { state: PlayerState.MATCHING });

  console.log(`🎯 [Matching] ${username} 매칭 큐 등록됨`);

  if (matchQueue.length >= 4) {
    const matched = matchQueue.splice(0, 4);
    const dungeonId = `Dungeon_${String(dungeonIdCounter++).padStart(3, '0')}`;

    matched.forEach(({ username, token }) => {
      updateSession(token, {
        state: PlayerState.GAME,
        dungeonId,
      });
    });

    dungeons[dungeonId] = {
      players: matched.map(m => m.username),
      createdAt: new Date(),
    };

    console.log(`🎮 [Dungeon Created] ${dungeonId} → 입장 인원: ${matched.map(m => m.username).join(", ")}`);
  }
}

module.exports = {
  addToMatchQueue,
};