// 로그인/로그아웃/회원가입 라우터 

import express, { Request, Response } from "express";
import bcrypt from "bcrypt";
import jwt from "jsonwebtoken";
import { PlayerManager } from "../services/managers/PlayerManager";
import { PlayerSession } from "../types/player";
import db from "../config/db";
import { BroadcastSocketMessageUtils } from "../utils/BroadcastSocketMessageUtils";
import { ClientSocketMessageSender } from "../ws/ClientSocketMessageSender";
import { GlobalJobQueue } from "../utils/GlobalJobQueue";
import { ClientGamePhase } from "../constants/ClientGamePhase";

const router = express.Router();

// 로그인
router.post("/login", async (req: Request, res: Response) => {
  const { username, password } = req.body;

  try {
    const [rows]: any = await db.execute("SELECT * FROM accounts WHERE username = ?", [username]);
    if (rows.length === 0) return res.status(401).json({ success: false, message: "존재하지 않는 아이디" });

    const isMatch = await bcrypt.compare(password, rows[0].password_hash);
    if (!isMatch) return res.status(401).json({ success: false, message: "비밀번호 오류" });

    // 공유접근 데이터를 사용하므로 JobQueue로 감싼다.
    const result = await new Promise<{ code: number, data: any }>((resolve) => {
    GlobalJobQueue.execute(async () => {
      const playerManager = PlayerManager.getInstance("auth");

      if (playerManager.hasPlayerByUserName(username)) {
        return resolve({ code: 409, data: { success: false, message: "이미 접속 중입니다." } });
      }

      const token = jwt.sign({ username }, process.env.JWT_SECRET as string, { expiresIn: "24h" });
      const session: PlayerSession = { username, classType: "Knight", gamePhase : ClientGamePhase.GameInitializing };
      playerManager.registerPlayerSession(token, session);

      console.log(`✅ [Login] ${username} 접속 완료`);

      resolve({
        code: 200,
        data: { success: true, message: "로그인 성공!", token, nickname: username }
      });
    });
  });

  res.status(result.code).json(result.data);

    // if (PlayerManager.getInstance("auth").hasPlayerByUserName(username))
    // {
    //   return res.status(409).json({ success: false, message: "이미 접속 중입니다." });
    // }

    // // 플레이어 토큰 생성
    // const token = jwt.sign({username}, process.env.JWT_SECRET as string, { expiresIn : "24h"});

    // // 플레이어 세션 저장
    // const session : PlayerSession = { username, classType: "Warrior" };
    // PlayerManager.getInstance("auth").registerPlayerSession(token, session);

    // console.log(`✅ [Login] ${username} 접속 완료`);

    // // 클라이언트에게 Response를 보냄 (이부분도 살짝 리팩토링이 필요할 것 같다)
    // res.json({
    //   success: true,
    //   message: "로그인 성공!",
    //   token,
    //   nickname : username
    //   // userState: {
    //   //   nickname: username,
    //   //   //state: PlayerState.IDLE,
    //   // },
    // });

  } catch (err) {
    console.error("❌ 로그인 오류:", err);
    res.status(500).send("서버 오류");
  }
});

// 로그아웃
// GBGameInstance::Shutdown()에서 지금은 Request하고 있다. 
router.post("/logout", async (req: Request, res: Response) => {
  const { token } = req.body;
  if (!token) return res.status(400).json({ success: false, message: "Token이 필요합니다." });

  try {
    jwt.verify(token, process.env.JWT_SECRET as string);
  } catch (err) {
    return res.status(403).json({ success: false, message: "유효하지 않은 토큰입니다." });
  }

  // 공유 자원에 접근해야하기 때문에 JobQueue로 보호
  const result = await new Promise<{ code: number; data: any }>((resolve) => {
    GlobalJobQueue.execute(async () => {
      const playerManager = PlayerManager.getInstance("logout");

       const session = playerManager.getPlayerSessionByToken(token);

      if (!session) {
        return resolve({ code: 404, data: { success: false, message: "세션 없음" } });
      }

     // HandleLogoutByToken에서 Player로 부터 Logout 패킷을 받았을시 해야할 것들을 정의 
      const outcome = playerManager.handleLogoutByToken("logout", token);


      // playerManager.removePlayerSession(token);
      if (outcome.ok) {
        console.log(`🚪 [Logout] ${session.username} 로그아웃 완료`);
      }

      resolve({ code: 200, data: { success: true, message: "로그아웃 성공" } });
    });
  });

  res.status(result.code).json(result.data);

  // const session = PlayerManager.getInstance("...").getPlayerSessionByToken(token);
  // if (!session) return res.status(404).json({ success: false, message: "세션 없음" });

  // PlayerManager.getInstance("...").removePlayerSession(token);
  // console.log(`🚪 [Logout] ${session.username} 로그아웃 완료`);
  // res.status(200).json({ success: true, message: "로그아웃 성공" });
});

// 회원가입 (JobQueue 필요 x )
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