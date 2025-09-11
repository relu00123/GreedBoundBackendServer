// routes/dungeon.ts
import { Router, Request, Response } from "express";
import { DungeonManager } from "../services/managers/DungeonManager";

const router = Router();

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