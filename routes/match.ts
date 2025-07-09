import express, { Request, Response } from "express";
import { authenticateToken } from "../middleware/auth";
import { getSession, Session } from "../services/managers/sessionStore";
import { PlayerState } from "../constants/playerstate";
import { addToMatchQueue } from "../services/managers/matchManager";

const router = express.Router();

// 클라이언트가 매칭 시작을 요청할 때
router.post("/start", authenticateToken, (req: Request, res: Response) => {
  const token = req.headers.authorization?.split(" ")[1];
  const session = getSession(token!) as Session | undefined;

  if (!session) {
    return res.status(401).json({ success: false, message: "세션이 존재하지 않습니다." });
  }

  const username = session.username;

  if ([PlayerState.MATCHING, PlayerState.GAME].includes(session.state)) {
    return res.status(400).send("이미 매칭 중이거나 게임 중입니다.");
  }

  addToMatchQueue(username, token!);

  return res.status(200).send({ message: "매칭 시작됨" });
});

// 매칭 상태 조회
router.get("/status", authenticateToken, (req: Request, res: Response) => {
  const token = req.headers.authorization?.split(" ")[1];
  const session = getSession(token!) as Session | undefined;

  if (!session) return res.status(401).json({ success: false });

  if (session.state === PlayerState.GAME) {
    return res.json({
      matched: true,
      port: session.port,
      dungeonId: session.dungeonId,
    });
  }

  return res.json({ matched: false });
});

export default router;