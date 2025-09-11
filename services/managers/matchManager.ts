// services/matchManager.ts

//import { PlayerState } from "../../constants/playerstate";
// const PlayerState = require("../../constants/playerstate");
// import { updateSession, getSession, sessionMap} from "./sessionStore";
// // const { updateSession,  getSession, sessionMap } = require("./sessionStore");
// import {DungeonManager } from "./DungeonManager";
// //const { DungeonManager } = require("./DungeonManager");

// interface MatchEntry {
//   username : string;
//   token : string;
// }

// let matchQueue : MatchEntry[] = [];
// let dungeons : Record<string, any> = {};
// let dungeonIdCounter : number = 1;
// //let dungeons = {};
// //let dungeonIdCounter = 1;

// export function addToMatchQueue(username: string, token: string) : void 
// { 
//   matchQueue.push({ username, token });
//   updateSession(token, { state: PlayerState.MATCHING });

//   console.log(`🎯 [Matching] ${username} 매칭 큐 등록됨!`);

//   if (matchQueue.length >= 2) { // 테스트 용도로 2명
//     const matched = matchQueue.splice(0, 2);
//     const dungeonId = `Dungeon_${String(dungeonIdCounter++).padStart(3, '0')}`;
    
//      const playerTokens = matched.map(({ token }) => token); 
       

//     // 일단 임시로.. 
//     const { generatedDungeonToken, generatedDungeonPort } =  DungeonManager.getInstance("...").createDungeon("Goblin", playerTokens);
//     //const {dungeontoken, port} = launchDungeonServer(dungeonId);
//     console.log(`🚀 [DungeonManager] 포트 ${generatedDungeonPort} 에서, Goblin 던전 생성됨. 던전 ID는 ${dungeonId}`);

//     matched.forEach(({ username, token }) => {
//       // 클라이언트의 Session을 업데이트함. 
//       updateSession(token, {
//         state: PlayerState.GAME,
//         dungeonId,
//         generatedDungeonPort,
//       });

//       const session = getSession(token);
//       if (session?.ws && session.ws.readyState === session.ws.OPEN) {
//         session.ws.send(JSON.stringify({
//           type: "matchSuccess",
//           host : "127.0.0.1", // or 공인 IP 
//           port : generatedDungeonPort,
//           dungeonId,
//         }));
//         console.log(`📨 [Match Notify] ${username}에게 matchSuccess 전송`);

//       }
//     });

//     dungeons[dungeonId] = {
//       players: matched.map(m => m.username),
//       createdAt: new Date(),
//       generatedDungeonPort,
//     };

//      console.log(`🎮 [Dungeon Created] ${dungeonId} → 입장 인원: ${matched.map(m => m.username).join(", ")}`);
//   }
// }

// module.exports = {
//   addToMatchQueue,
// };