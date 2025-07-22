// import express, { Request, Response } from "express";
// import { sessionMap, Session } from "../services/managers/sessionStore";

// const router = express.Router();

// // 특정 유저 상태 조회
// router.get("/:username/status", (req: Request, res: Response) => {
//   const username = req.params.username;

//   for (const session of sessionMap.values()) {
//     if (session.username === username) {
//       return res.json({
//         nickname: session.nickname,
//         state: session.state,
//         dungeonId: session.dungeonId || null,
//       });
//     }
//   }

//   return res.status(404).json({ error: "User not found" });
// });

// // 전체 유저 리스트 조회
// router.get("/", (_req: Request, res: Response) => {
//   const allPlayers = [];

//   for (const session of sessionMap.values()) {
//     allPlayers.push({
//       username: session.username,
//       nickname: session.nickname,
//       state: session.state,
//       dungeonId: session.dungeonId || null,
//     });
//   }

//   res.json(allPlayers);
// });

// export default router;