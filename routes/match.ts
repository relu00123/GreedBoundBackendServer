import express, { Request, Response } from "express";
import { authenticateToken } from "../middleware/auth";
import { getSession, Session } from "../services/managers/sessionStore";
import { PlayerState } from "../constants/playerstate";
import { addToMatchQueue } from "../services/managers/matchManager";
import { PlayerManager } from "../services/managers/PlayerManager";
import { GameMAPS, isAllowedGameMap, extractGameMapNumericId, MAP_ALIAS_TO_ID } from "../constants/GameMapCatalog";

const router = express.Router();

// 클라이언트가 매칭 시작을 요청할 때 (이 post사용하면 안됨. 매칭에 대한 부분 전면 리팩토링중)
router.post("/start", authenticateToken, (req: Request, res: Response) => {

  const token = req.headers.authorization?.split(" ")[1];
  if (token !== undefined ) {

    // 매칭을 보낸사람 : 파티장 or 파티에 가입하지 않고 솔로큐를 돌리는 사람 
    const session = PlayerManager.getInstance("match").getPlayerSessionByToken(token);

    if (!session) {
      return res.status(401).json({ success : false , message : "세션이 존재하지 않습니다."});
    }

    // Json Body 에서 맵 파싱 .. 작업중 09.05
    const parsed = extractGameMapNumericId(req.body);
    if (!parsed.ok) {
      return res.status(400).json({success:false, message: parsed.error});
    }

    const GameMapNumericId = parsed.id;
    if (!isAllowedGameMap(GameMapNumericId)) {
       return res.status(400).json({ success:false, message:`invalid GameMapNumericId: ${GameMapNumericId}` });
    }

    const def = GameMAPS[GameMapNumericId]; // 타입 안전
    if (def.enabled === false) {
      return res.status(400).json({ success:false, message:`GameMap disabled: ${GameMapNumericId}` });
    }

    const username = session.username;

    // 아직 매칭에 대한 로직이 정립이 안되어 있다. 지금은 로그만 찍어놨는데 나중에 정리해야한다.
     console.log(`🎯 [Matching] ${username} 매칭 큐 등록됨!!`);
     console.log(`🎯 [Matching] ${username} -> 큐 등록 (id=${GameMapNumericId}, name=${GameMAPS[GameMapNumericId].key})`);
     return res.status(200).send({ message: "매칭 시작됨" });
  }

  // 리팩토링이 필요한 옛날코드 (시작)
  // const token = req.headers.authorization?.split(" ")[1];
  // const session = getSession(token!) as Session | undefined;

  // if (!session) {
  //   return res.status(401).json({ success: false, message: "세션이 존재하지 않습니다." });
  // }

  // const username = session.username;

  // if ([PlayerState.MATCHING, PlayerState.GAME].includes(session.state)) {
  //   return res.status(400).send("이미 매칭 중이거나 게임 중입니다.");
  // }

  //addToMatchQueue(username, token!);

  // return res.status(200).send({ message: "매칭 시작됨" });

  // 리팩토링이 필요한 옛날 코드 (끝)
});

// 매칭 상태 조회
// router.get("/status", authenticateToken, (req: Request, res: Response) => {
//   const token = req.headers.authorization?.split(" ")[1];
//   const session = getSession(token!) as Session | undefined;

//   if (!session) return res.status(401).json({ success: false });

//   if (session.state === PlayerState.GAME) {
//     return res.json({
//       matched: true,
//       port: session.port,
//       dungeonId: session.dungeonId,
//     });
//   }

//   return res.json({ matched: false });
// });

export default router;