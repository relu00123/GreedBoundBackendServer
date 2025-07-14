// import WebSocket, { WebSocketServer } from "ws";     // ✔ 실제 모듈 import
// import jwt, { JwtPayload } from "jsonwebtoken";
// import { getSession, updateSession, sessionMap, Session } from "../services/managers/sessionStore";
// import { handleEscapeRequest,  EscapeRequestMessage } from "../services/managers/EscapeManager";
// import { DungeonManager } from "../services/managers/DungeonManager";


// 아마 이제 안쓰는  파일일듯? [7월 12일 작성]

// interface Session {
//   username: string;
//   token: string;
//    ws: InstanceType<typeof WebSocket> | null;
//   isDedicated?: boolean;
//   [key: string]: any;
// }

// interface Message {
//   type: string;
//   [key: string]: any;
// }

// // Socket수립 요청이 왔을때 호출되는 함수. 
// export function setupSocket(wss: WebSocketServer) {
//   wss.on("connection", (ws: WebSocket, req) => {
//     const url = new URL(req.url ?? "", `http://${req.headers.host}`);
//     const token = url.searchParams.get("token");

//     if (!token) {
//       ws.send(JSON.stringify({ error: "No token provided" }));
//       ws.close();
//       return;
//     }

//     const RealToken = token;

//     try {
//       //const decoded = jwt.verify(token, process.env.JWT_SECRET as string);

//       if (DungeonManager.getInstance("...").hasDungeon(RealToken))
//       {
//         console.log(`🔌 [SocketHandler] Trying To Setup DedicatedWebSocket`); 
//         // DedicatedServer에서 접속시도
//         const success = DungeonManager.getInstance("...").registerDedicatedSocket(RealToken, ws);

//         setupDedicatedServerHandlersTemp(ws);

//         ws.on("close", () => {
//           console.log(`🔌 [DedicatedWebSocket] ... disconnected`); 
//         });

//         return;
//       }

//       else
//       {
//         console.log(`🔌 [SocketHandler] Trying To Setup ClientWebSocket`); 
//         const session = getSession(RealToken) as Session; 
//         if (!session) {
//                 ws.send(JSON.stringify({ error: "Invalid or expired session" }));
//                 ws.close();
//                 return;
//               }

//               session.ws = ws;
//               updateSession(RealToken, session);
//               const isDedicated = session.isDedicated === true;

//               console.log(`✅ [WebSocket] ${session.username} connected (${isDedicated ? "Dedicated" : "Client"})`);

//               setupClientHandlers(ws, session);
              
//               ws.on("close", () => {
//                 console.log(`🔌 [ClientWebSocket] ${session.username} disconnected`);
//                 updateSession(RealToken, { ws: null });
//               });
//       }
//     } catch (err) {
//       console.error("❌ Invalid token:", err);
//       ws.send(JSON.stringify({ error: "Invalid token" }));
//       ws.close();
//     }
//   });
// }

// function setupClientHandlers(ws: WebSocket, session: Session) {
//   ws.on("message", (data) => {
//     try {
//       const msg: Message = JSON.parse(data.toString());

//       if (msg.type === "ping") {
//         ws.send(JSON.stringify({ type: "pong" }));
//       }

//       if (msg.type === "chat") {
//         const chatMessage = {
//           type: "chat",
//           from: session.username,
//           message: msg.message,
//         };

//         for (const s of sessionMap.values()) {
//           if (!s.isDedicated && s.ws && s.ws.readyState === WebSocket.OPEN) {
//             s.ws.send(JSON.stringify(chatMessage));
//           }
//         }

//         console.log(`💬 [Chat] ${session.username}: ${msg.message}`);
//       }
//     } catch (err) {
//       console.error("❌ [Client] Invalid message:", err);
//     }
//   });
// }

// function setupDedicatedServerHandlers(ws: WebSocket, session: Session) {
//   ws.on("message", (data) => {
//     try {
//       const msg: Message = JSON.parse(data.toString());

//       switch (msg.type) {
//         case "escape_request":
//           const escapeMsg = msg as unknown as EscapeRequestMessage;
//           handleEscapeRequest(ws, escapeMsg);
//           break;

//         default:
//           console.warn("⚠️ Unknown server message type:", msg.type);
//       }
//     } catch (err) {
//       console.error("❌ [Dedicated] Invalid message:", err);
//     }
//   });
// }

// function setupDedicatedServerHandlersTemp(ws : WebSocket) {
//   ws.on("message", (data) => {
//     try {
//       const msg: Message = JSON.parse(data.toString());

//       switch (msg.type) {
//         case "escape_request":
//           const escapeMsg = msg as unknown as EscapeRequestMessage;
//           handleEscapeRequest(ws, escapeMsg);
//           break;

//         default:
//           console.warn("⚠️ Unknown server message type:", msg.type);
//       }
//     } catch (err) {
//       console.error("❌ [Dedicated] Invalid message:", err);
//     }
//   });
// }