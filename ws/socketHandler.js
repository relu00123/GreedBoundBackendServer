// ws/socketHandler.js

const jwt = require("jsonwebtoken");
const { getSession, updateSession, sessionMap } = require("../services/sessionStore");
const escapeManager = require("../services/escapeManager"); // ← 서버 전용 메시지 처리기

function setupSocket(wss) {
  wss.on("connection", (ws, req) => {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const token = url.searchParams.get("token");

    if (!token) {
      ws.send(JSON.stringify({ error: "No token provided" }));
      ws.close();
      return;
    }

    try {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const session = getSession(token);

      if (!session) {
        ws.send(JSON.stringify({ error: "Invalid or expired session" }));
        ws.close();
        return;
      }

      session.ws = ws;
      updateSession(token, session);

      const isDedicated = session.isDedicated === true;

      console.log(`✅ [WebSocket] ${session.username} connected (${isDedicated ? "Dedicated" : "Client"})`);

      // 연결 분기
      if (isDedicated) {
        setupDedicatedServerHandlers(ws, session);
      } else {
        setupClientHandlers(ws, session);
      }

      ws.on("close", () => {
        console.log(`🔌 [WebSocket] ${session.username} disconnected`);
        updateSession(token, { ws: null });
      });

    } catch (err) {
      console.error("❌ Invalid token:", err);
      ws.send(JSON.stringify({ error: "Invalid token" }));
      ws.close();
    }
  });
}

function setupClientHandlers(ws, session) {
  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data);

      if (msg.type === "ping") {
        ws.send(JSON.stringify({ type: "pong" }));
      }

      if (msg.type === "chat") {
        const chatMessage = {
          type: "chat",
          from: session.username,
          message: msg.message,
        };

        for (const s of sessionMap.values()) {
          if (!s.isDedicated && s.ws && s.ws.readyState === ws.OPEN) {
            s.ws.send(JSON.stringify(chatMessage));
          }
        }

        console.log(`💬 [Chat] ${session.username}: ${msg.message}`);
      }

    } catch (err) {
      console.error("❌ [Client] Invalid message:", err);
    }
  });
}

function setupDedicatedServerHandlers(ws, session) {
  ws.on("message", (data) => {
    try {
      const msg = JSON.parse(data);

      switch (msg.type) {
        case "leave_dungeon":
          escapeManager.handleLeaveDungeon(ws, msg);
          break;

        // TODO: 추후 other server-side messages
        default:
          console.warn("⚠️ Unknown server message type:", msg.type);
      }

    } catch (err) {
      console.error("❌ [Dedicated] Invalid message:", err);
    }
  });
}

module.exports = { setupSocket };