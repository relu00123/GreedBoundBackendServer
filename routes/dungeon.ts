// routes/dungeon.ts
import { Router, Request, Response } from "express";
import { DungeonManager } from "../services/managers/DungeonManager";
import { DungeonSessionStore } from "../services/stores/DungeonSessionStore";

const router = Router();
const store = DungeonSessionStore.getInstance();

const READY_SECRET = process.env.DS_READY_SECRET || ""; // 선택

// UE DS가 준비되었을 때 콜백
// Dungeon Instance의 상태를 running으로 바꾼다. 
router.post("/dungeonReady", (req, res) => {
  try {
    const { dungeonId, matchId, host, port } = req.body || {};
    const gotSecret =
      (req.headers["x-ds-secret"] as string) || req.body?.secret || "";

    if (READY_SECRET && gotSecret !== READY_SECRET) {
      return res.status(403).json({ ok: false, error: "FORBIDDEN" });
    }

    const s =
      (dungeonId && store.getSessionByDungeonId(dungeonId)) ||
      (matchId && store.getSessionByMatchId(matchId));

    if (!s) return res.status(404).json({ ok: false, error: "SESSION_NOT_FOUND" });

    s.serverAddr = `${host}:${port}`;
    s.serverHost = host;
    s.serverPort = Number(port);

    store.setSessionStatus(s.dungeonId, "running");

    console.log(
      `[DS-READY] dng=${s.dungeonId} match=${s.matchId} addr=${(s as any).serverHost}:${(s as any).serverPort}`
    );
    return res.json({ ok: true });
  } catch (e: any) {
    console.error("[/dungeon/dungeonReady] error:", e);
    return res.status(500).json({ ok: false, error: "SERVER_ERROR" });
  }
});


router.post("/verify", (req: Request, res: Response) => {
  try {
    const { dungeonId, userId, token, consume = true } = req.body || {};
    if (!dungeonId || !userId || !token) {
      return res.status(400).json({ ok: false, reason: "BAD_REQUEST" });
    }
    const r = DungeonManager.getInstance().verifyUserToken(dungeonId, userId, token, consume);
    return res.status(r.ok ? 200 : 403).json(r);
  } catch (e) {
    console.error("[/dungeon/verify] error:", e);
    return res.status(500).json({ ok: false, reason: "SERVER_ERROR" });
  }
});

export default router;