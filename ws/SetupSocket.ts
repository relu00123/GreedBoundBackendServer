import WebSocket, { WebSocketServer } from "ws";      
import jwt, { JwtPayload } from "jsonwebtoken";
import { getSession, updateSession, sessionMap, Session } from "../services/managers/sessionStore";
import { handleEscapeRequest,  EscapeRequestMessage } from "../services/managers/EscapeManager";
import { DungeonManager } from "../services/managers/DungeonManager";
import { SocketMessage} from "../types/types"
import { PlayerManager } from "../services/managers/PlayerManager";
import { setupDedicatedSocketMessageHandler } from "./DedicatedSocketMessageHandler";
import { setupClientSocketMessageHandler } from "./ClientSocketMessageHandler";

export function setupSocket(wss : WebSocketServer) {
    wss.on("connection", (ws: WebSocket, req) => {
        const url = new URL(req.url ?? "", `http://${req.headers.host}`);
        const token = url.searchParams.get("token");
        const connecttype = url.searchParams.get("connecttype");
        
        // Client혹은 Dedicated Server가 요청을 보낼때 token= 이라는 부분이 있어야 한다. 
        if (!token || !connecttype) {
            ws.send(JSON.stringify({ error : "Token not provided or can't figues out Client or DedicatedServer"}));
            ws.close();
            return;
        }

        try {
            switch (connecttype.toLowerCase()) {
                case "dedicated": {

                    // ws저장
                    const success = DungeonManager.getInstance("SetupSocket").registerDedicatedSocket(token, ws);

                    if (!success) {
                        ws.send(JSON.stringify({ error : "Invalid or expired session"}));
                        ws.close();
                        return;
                    }

                    // Dedicated ws에 MessageHandler등록 
                    setupClientSocketMessageHandler(ws);

                    ws.on("close", () => {
                        // DedicatedSession 관리중인 것 삭제 및 DedicatedServer 로직 종료 필요
                        // 로그도 조금더 자세하게 작성해줘야 함. 어떤 DedicatedServer가 종료된 것인지. 
                        console.log(`[SetupSocket] DedicatedServer Disconnected`);
                    });

                    break;
                }

                case "client": {

                    const success = PlayerManager.getInstance("SetupSocket").registerPlayerSocket(token, ws);

                    if (!success) {
                        ws.send(JSON.stringify({ error : "Invalid or expired session"}));
                        ws.close();
                        return;
                    }

                    // Client ws에 MessageHandler등록
                    setupDedicatedSocketMessageHandler(ws);

                    ws.on("close", () => {
                        // DedicatedSession 관리중인 것 삭제 및 DedicatedServer 로직 종료 필요
                        // 로그도 조금더 자세하게 작성해줘야 함. 어떤 DedicatedServer가 종료된 것인지. 
                        console.log(`[SetupSocket] Client Disconnected`);
                    });

                    break;
                }

                default : {
                    ws.send(JSON.stringify({error : `Unknown connecttype : ${connecttype}`}));
                    ws.close();
                }
            }
        }

        catch (err) {

        }



    });
}



