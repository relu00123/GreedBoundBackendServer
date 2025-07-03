// services/matchManager.js

const PlayerState = require("../constants/playerstate");
const { updateSession, sessionMap } = require("./sessionStore");
const { launchDungeonServer } = require("./dungeonManager");

let matchQueue = [];
let dungeons = {};
let dungeonIdCounter = 1;

function addToMatchQueue(username, token) {
  matchQueue.push({ username, token });
  updateSession(token, { state: PlayerState.MATCHING });

  console.log(`🎯 [Matching] ${username} 매칭 큐 등록됨`);

  if (matchQueue.length >= 2) { // 테스트 용도로 2명
    const matched = matchQueue.splice(0, 2);
    const dungeonId = `Dungeon_${String(dungeonIdCounter++).padStart(3, '0')}`;
    const prot = launchDungeonServer(dungeonId);

    matched.forEach(({ username, token }) => {
      updateSession(token, {
        state: PlayerState.GAME,
        dungeonId,
        port,
      });

      const session = getSession(token);
      if (session?.ws && session.ws.readyState === session.ws.OPEN) {
        session.ws.send(JSON.stringify({
          type: "matchSuccess",
          host : "127.0.0.1", // or 공인 IP 
          port,
          dungeonId,
        }));
        console.log(`📨 [Match Notify] ${username}에게 matchSuccess 전송`);
      }
    });

    dungeons[dungeonId] = {
      players: matched.map(m => m.username),
      createdAt: new Date(),
      port,
    };

     console.log(`🎮 [Dungeon Created] ${dungeonId} → 입장 인원: ${matched.map(m => m.username).join(", ")}`);
  }
}

module.exports = {
  addToMatchQueue,
};