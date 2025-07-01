// ws/socketHandler.js

const jwt = require("jsonwebtoken");
const { getSession, updateSession, sessionMap } = require("../services/sessionStore");

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

      console.log(`✅ [WebSocket] ${session.username} connected`);

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
              if (s.ws && s.ws.readyState === ws.OPEN) {
                s.ws.send(JSON.stringify(chatMessage));
              }
            }

            console.log(`💬 [Chat] ${session.username}: ${msg.message}`);
          }

        } catch (err) {
          console.error("❌ 잘못된 메시지:", err);
        }
      });

      ws.on("close", () => {
        console.log(`🔌 [WebSocket] ${session.username} disconnected`);
        updateSession(token, { ws: null });
      });

    } catch (err) {
      ws.send(JSON.stringify({ error: "Invalid token" }));
      ws.close();
    }
  });
}

module.exports = { setupSocket };