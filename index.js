require("dotenv").config();

const express = require("express");
const cors = require("cors");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const http = require("http");
const WebSocket = require("ws");

const db = require("./db");
const authenticateToken = require("./auth");
const {
  saveSession,
  getSession,
  updateSession,
  removeSession,
  sessionMap,
} = require("./sessionStore");

const app = express();
const server = http.createServer(app); // HTTP + WS 겸용
const wss = new WebSocket.Server({server});  // WebSocket 서버 생성 
const clients = new Map(); // socket -> userInfo 

const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// 매칭 상태 및 던전 관련 데이터
let matchQueue = [];
let dungeons = {};
let dungeonIdCounter = 1;

const PlayerState = {
  IDLE: "Idle",
  MATCHING: "Matching",
  GAME: "Game",
};


// 웹 소켓 연결 처리
wss.on("connection", (ws, req) => {
  // ?token=JWTTOKEN 으로부터 토큰 추출
  const url = new URL(req.url, `http://${req.headers.host}`);
  const token = url.searchParams.get("token");

  if(!token) {
    ws.send(JSON.stringify({ error: "No token provided"}));
    ws.close();
    return;
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const session = getSession(token);

    if (!session) {
      ws.send(JSON.stringify({error: "Invalid or expired session"}));
      ws.close();
      return; 
    }

    // WebSocket 객체 저장 (서버 메모리에 직접)
    session.ws = ws;
    updateSession(token, session);

    console.log(`✅ [WebSocket] ${session.username} connected`);

    // 메세지 수신 처리
    ws.on("message", (data) => {
      try {
        const msg = JSON.parse(data);

        if (msg.type === "ping") {
          ws.send(JSON.stringify({type: "pong"}));
        }

        // 채팅 메세지 처리 
        if (msg.type === "chat") {
         const chatMessage = {
          type: "chat",
          from: session.username,
          message: msg.message,
         }; 

         // 모든 연결된 클라이언트에게 전송
         for (const s of sessionMap.values()) {
          if (s.ws && s.ws.readyState == WebSocket.OPEN) {
            s.ws.send(JSON.stringify(chatMessage)); 
          }
         }

         console.log(`💬 [Chat] ${session.username}: ${msg.message}`);

        }

      } catch(err) {
         console.error("❌ 잘못된 메시지:", err);
      }
    });

    // 연결 종료 처리 
    ws.on("close", () => {
       console.log(`🔌 [WebSocket] ${session.username} disconnected`);
      updateSession(token, { ws: null });
    });
  } catch(err) {
    ws.send(JSON.stringify({error: "Invalid token"}));
    ws.close(); 
  }
}); 


// 테스트용
app.get("/", (req, res) => {
  res.send("🟢 Node 서버가 잘 실행되고 있어요!");
});

// ✅ 로그인
app.post("/login", async (req, res) => {
  const { username, password } = req.body;

  try {
    const [rows] = await db.execute(
      "SELECT * FROM accounts WHERE username = ?",
      [username]
    );

    if (rows.length === 0) {
      return res.status(401).json({ success: false, message: "해당 아이디가 존재하지 않습니다." });
    }

    const isMatch = await bcrypt.compare(password, rows[0].password_hash);
    if (!isMatch) {
      return res.status(401).json({ success: false, message: "잘못된 비밀번호입니다." });
    }

    // JWT 발급
    const token = jwt.sign({ username }, process.env.JWT_SECRET, {
      expiresIn: "24h",
    });

    // 세션 저장
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
    console.error("❌ 로그인 중 오류:", err);
    res.status(500).send("서버 오류");
  }
});

// ✅ 회원가입
app.post("/register", async (req, res) => {
  const { username, password } = req.body;

  try {
    const [existing] = await db.execute(
      "SELECT id FROM accounts WHERE username = ?",
      [username]
    );

    if (existing.length > 0) {
      return res.status(409).json({ success: false, message: "이미 존재하는 사용자입니다." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    await db.execute(
      "INSERT INTO accounts (username, password_hash) VALUES (?, ?)",
      [username, hashedPassword]
    );

    res.json({ success: true, message: "회원가입 성공!" });
  } catch (err) {
    console.error("❌ 회원가입 오류:", err);
    res.status(500).send("서버 오류");
  }
});

// ✅ 매칭 시작
app.post("/match/start", authenticateToken, (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  const session = getSession(token);

  if (!session) {
    return res.status(401).json({ success: false, message: "세션이 존재하지 않습니다." });
  }

  const username = session.username;

  if (session.state === PlayerState.MATCHING || session.state === PlayerState.GAME) {
    return res.status(400).send("이미 매칭 중이거나 게임 중입니다.");
  }

  matchQueue.push(username);
  updateSession(token, { state: PlayerState.MATCHING });

  console.log(`🎯 [Matching] ${username} 매칭 큐 등록됨`);

  if (matchQueue.length >= 4) {
    const matchedPlayers = matchQueue.splice(0, 4);
    const dungeonId = `Dungeon_${String(dungeonIdCounter++).padStart(3, '0')}`;

    matchedPlayers.forEach((name) => {
      for (const [token, session] of require("./sessionStore").sessionMap.entries()) {
        if (session.username === name) {
          updateSession(token, {
            state: PlayerState.GAME,
            dungeonId,
          });
          break;
        }
      }
    });

    dungeons[dungeonId] = {
      players: matchedPlayers,
      createdAt: new Date(),
    };

    console.log(`🎮 [Dungeon Created] ${dungeonId} → 입장 인원: ${matchedPlayers.join(", ")}`);
  }

  return res.status(200).send({ message: "매칭 시작됨" });
});

// ✅ 상태 확인
app.get("/player/:username/status", (req, res) => {
  const username = req.params.username;

  for (const session of require("./sessionStore").sessionMap.values()) {
    if (session.username === username) {
      return res.json({
        nickname: session.nickname,
        state: session.state,
        dungeonId: session.dungeonId || null,
      });
    }
  }

  return res.status(404).json({ error: "User not found" });
});

// ✅ 전체 유저 상태 확인
app.get("/players", (req, res) => {
  const allPlayers = [];

  for (const session of require("./sessionStore").sessionMap.values()) {
    allPlayers.push({
      username: session.username,
      nickname: session.nickname,
      state: session.state,
      dungeonId: session.dungeonId || null,
    });
  }

  res.json(allPlayers);
});

// ✅ 서버 실행
server.listen(PORT, () => {
  console.log(`🚀 Game Backend Server is running on http://localhost:${PORT}`);
});