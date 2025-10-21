import express, { Request, Response } from "express";
import { authenticateToken } from "../middleware/auth";
import { getSession, Session } from "../services/managers/sessionStore";
import { PlayerState } from "../constants/playerstate";
import { PlayerManager } from "../services/managers/PlayerManager";
import { GameMAPS, isAllowedGameMap, extractGameMapNumericId, MAP_ALIAS_TO_ID } from "../constants/GameMapCatalog";
import { TeamJoinPolicy } from "../types/match";
import { MatchQueueManager } from "../services/managers/MatchQueueManager";
import { MatchQueueNotificationService } from "../ws/services/MatchQueueNotificationService";

const router = express.Router();

function parseJoinPolicy(body: any): TeamJoinPolicy {
  const jp = body?.joinPolicy;
  if (jp === TeamJoinPolicy.Open || jp === TeamJoinPolicy.Closed) return jp;
  const allow = body?.allowOthers;
  if (typeof allow === "boolean") return allow ? TeamJoinPolicy.Open : TeamJoinPolicy.Closed;
  return TeamJoinPolicy.Open; // 기본값
}

// 클라이언트가 매칭 시작을 요청할 때 (이 post사용하면 안됨. 매칭에 대한 부분 전면 리팩토링중)
router.post("/start", authenticateToken, (req: Request, res: Response) => {
const logPrefix = "🎯 [MATCH/START]";
  try {
    const token = req.headers.authorization?.split(" ")[1];
    if (!token) {
      console.warn(`${logPrefix} 401: missing token`);
      return res.status(401).json({ success: false, message: "토큰이 필요합니다." });
    }

    const session = PlayerManager.getInstance("match").getPlayerSessionByToken(token);
    if (!session) {
      console.warn(`${logPrefix} 401: session not found for token`);
      return res.status(401).json({ success: false, message: "세션이 존재하지 않습니다." });
    }

    const parsed = extractGameMapNumericId(req.body);
    if (!parsed.ok) {
      console.warn(`${logPrefix} 400: map parse fail -> ${parsed.error}`);
      return res.status(400).json({ success: false, message: parsed.error });
    }
    const mapId = parsed.id;

    if (!isAllowedGameMap(mapId)) {
      console.warn(`${logPrefix} 400: invalid mapId=${mapId}`);
      return res.status(400).json({ success: false, message: `invalid GameMapNumericId: ${mapId}` });
    }
    const def = GameMAPS[mapId];
    if (def.enabled === false) {
      console.warn(`${logPrefix} 400: disabled mapId=${mapId} (${def.key})`);
      return res.status(400).json({ success: false, message: `GameMap disabled: ${mapId}` });
    }

    const username = session.username;
    const partyId = session.party_id ?? null;
    const policy = parseJoinPolicy(req.body);
    const mqm = MatchQueueManager.getInstance();

    console.log(`${logPrefix} REQ username=${username} partyId=${partyId ?? "solo"} mapId=${mapId}(${def.key}) policy=${policy}`);

    if (partyId) {
      // 파티 큐 (파티장만 허용)
      try {
        const { ticketID, members } = mqm.joinQueueParty(partyId, mapId, policy, username);
        console.log(
          `${logPrefix} ENQUEUE PARTY#${partyId} by=${username} members=[${members.join(", ")}] ` +
          `mapId=${mapId}(${def.key}) policy=${policy} ticket=${ticketID}`
        );
        // HTTP는 얇은 ACK만 (실제 UI 갱신은 WS QueueJoined로 처리)
        return res.status(202).json({
          success: true,
          mode: "party",
          ticketID,
          message: "queued",
        });
      } catch (e: any) {
        if (e?.message === "ONLY_HOST_CAN_QUEUE") {
          console.warn(`${logPrefix} 403: only host can queue (partyId=${partyId}, user=${username})`);
          return res.status(403).json({ success: false, message: "파티장만 매칭을 시작할 수 있습니다." });
        }
        console.error(`${logPrefix} party enqueue error:`, e);
        return res.status(400).json({ success: false, message: e?.message || "파티 매칭 시작 실패" });
      }
    } else {
      // 솔로 큐
      const { ticketID } = mqm.joinQueueSolo(username, mapId, policy);

      MatchQueueNotificationService.notifyMatchQueueJoined(false, mapId, username, policy, ticketID);
      console.log(
        `${logPrefix} ENQUEUE SOLO user=${username} mapId=${mapId}(${def.key}) policy=${policy} ticket=${ticketID}`
      );
      // HTTP는 얇은 ACK만 (실제 UI 갱신은 WS QueueJoined로 처리)
      return res.status(202).json({
        success: true,
        mode: "solo",
        ticketID,
        message: "queued",
      });
    }
  } catch (err: any) {
    console.error(`${logPrefix} 500 error:`, err);
    return res.status(500).json({ success: false, message: "서버 오류" });
  }
});
  // 기존 코드 
  // const token = req.headers.authorization?.split(" ")[1];
  // if (token !== undefined ) {

  //   // 매칭을 보낸사람 : 파티장 or 파티에 가입하지 않고 솔로큐를 돌리는 사람 
  //   const session = PlayerManager.getInstance("match").getPlayerSessionByToken(token);

  //   if (!session) {
  //     return res.status(401).json({ success : false , message : "세션이 존재하지 않습니다."});
  //   }

  //   // Json Body 에서 맵 파싱 .. 작업중 09.05
  //   const parsed = extractGameMapNumericId(req.body);
  //   if (!parsed.ok) {
  //     return res.status(400).json({success:false, message: parsed.error});
  //   }

  //   const GameMapNumericId = parsed.id;
  //   if (!isAllowedGameMap(GameMapNumericId)) {
  //      return res.status(400).json({ success:false, message:`invalid GameMapNumericId: ${GameMapNumericId}` });
  //   }

  //   const def = GameMAPS[GameMapNumericId]; // 타입 안전
  //   if (def.enabled === false) {
  //     return res.status(400).json({ success:false, message:`GameMap disabled: ${GameMapNumericId}` });
  //   }

  //   const username = session.username;

  //   // 아직 매칭에 대한 로직이 정립이 안되어 있다. 지금은 로그만 찍어놨는데 나중에 정리해야한다.
  //    console.log(`🎯 [Matching] ${username} 매칭 큐 등록됨!!`);
  //    console.log(`🎯 [Matching] ${username} -> 큐 등록 (id=${GameMapNumericId}, name=${GameMAPS[GameMapNumericId].key})`);
  //    return res.status(200).send({ message: "매칭 시작됨" });
  // }
  // 기존 코드 끝 

  
//});

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