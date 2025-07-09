// 로그인/로그아웃/회원가입 라우터 

import express, { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";

import db from "../config/db";
import {
  saveSession,
  removeSession,
  getSession,
  isUserLoggedIn,
} from "../services/managers/sessionStore";

const router = express.Router();

enum PlayerState {
  IDLE = "Idle",
  MATCHING = "Matching",
  GAME = "Game",
}

// 로그인
router.post("/login", async (req: Request, res: Response) => {
  const { username, password } = req.body;

  try {
    const [rows]: any = await db.execute("SELECT * FROM accounts WHERE username = ?", [username]);
    if (rows.length === 0) return res.status(401).json({ success: false, message: "존재하지 않는 아이디" });

    const isMatch = await bcrypt.compare(password, rows[0].password_hash);
    if (!isMatch) return res.status(401).json({ success: false, message: "비밀번호 오류" });

    if (isUserLoggedIn(username))
      return res.status(409).json({ success: false, message: "이미 접속 중입니다." });

    const token = jwt.sign({ username }, process.env.JWT_SECRET as string, { expiresIn: "24h" });

    saveSession(token, {
      username,
      nickname: username,
      state: PlayerState.IDLE,
      partyId: null,
      token,
    });

    console.log(`✅ [Login] ${username} 접속 완료`);

    res.json({
      success: true,
      message: "로그인 성공!",
      token,
      userState: {
        nickname: username,
        state: PlayerState.IDLE,
      },
    });
  } catch (err) {
    console.error("❌ 로그인 오류:", err);
    res.status(500).send("서버 오류");
  }
});

// 로그아웃
router.post("/logout", (req: Request, res: Response) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ success: false, message: "Token이 필요합니다." });

  try {
    jwt.verify(token, process.env.JWT_SECRET as string);
  } catch (err) {
    return res.status(403).json({ success: false, message: "유효하지 않은 토큰입니다." });
  }

  const session = getSession(token);
  if (!session) return res.status(404).json({ success: false, message: "세션 없음" });

  removeSession(token);
  console.log(`🚪 [Logout] ${session.username} 로그아웃 완료`);
  res.status(200).json({ success: true, message: "로그아웃 성공" });
});

// 회원가입
router.post("/register", async (req: Request, res: Response) => {
  const { username, password } = req.body;

  try {
    const [existing]: any = await db.execute("SELECT id FROM accounts WHERE username = ?", [username]);
    if (existing.length > 0)
      return res.status(409).json({ success: false, message: "이미 존재하는 사용자" });

    const hashedPassword = await bcrypt.hash(password, 10);
    await db.execute("INSERT INTO accounts (username, password_hash) VALUES (?, ?)", [username, hashedPassword]);

    res.status(200).json({ success: true, message: "회원가입 성공!" });
  } catch (err) {
    console.error("❌ 회원가입 오류:", err);
    res.status(500).send("서버 오류");
  }
});

export default router;