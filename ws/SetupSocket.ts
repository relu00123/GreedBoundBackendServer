import WebSocket, { WebSocketServer } from "ws";      
import jwt, { JwtPayload } from "jsonwebtoken";
import { getSession, updateSession, sessionMap, Session } from "../services/managers/sessionStore";
//import { handleEscapeRequest,  EscapeRequestMessage } from "../services/managers/EscapeManager";
import { SocketMessage, PlayerToken } from "../types/common";
import { DungeonManager } from "../services/managers/DungeonManager";
import { PlayerManager } from "../services/managers/PlayerManager";
import { setupDedicatedSocketMessageHandler } from "./DedicatedSocketMessageHandler";
import { setupClientSocketMessageHandler } from "./ClientSocketMessageHandler";
import { BroadcastSocketMessageUtils } from "../utils/BroadcastSocketMessageUtils";
import { ClientSocketMessageSender } from "../ws/ClientSocketMessageSender";
import { PlayerSession } from "../types/player";
import { GlobalJobQueue } from "../utils/GlobalJobQueue";
import { PartyNotificationService } from "./services/PartyNotificationService";

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
                    GlobalJobQueue.execute(async () => {

                        // ws저장
                        //const success = DungeonManager.getInstance().registerDedicatedSocket(token, ws);

                        // if (!success) {
                        //     ws.send(JSON.stringify({ error : "Invalid or expired session"}));
                        //     ws.close();
                        //     return;
                        // }

                        // Dedicated ws에 MessageHandler등록 
                        setupDedicatedSocketMessageHandler(ws);

                        ws.on("close", () => {
                            GlobalJobQueue.execute(async () => {
                                // DedicatedSession 관리중인 것 삭제 및 DedicatedServer 로직 종료 필요
                                // 로그도 조금더 자세하게 작성해줘야 함. 어떤 DedicatedServer가 종료된 것인지. 
                                console.log(`[SetupSocket] DedicatedServer Disconnected`);
                            });
                        });
                    });
                    break;
                }

                case "client": {
                    GlobalJobQueue.execute(async () => {

                        const success = PlayerManager.getInstance("SetupSocket").registerPlayerSocket(token, ws);
                        const session = PlayerManager.getInstance("SetupSocket").getPlayerSessionByToken(token);

                        if (!success || !session) {
                            ws.send(JSON.stringify({ error : "Invalid or expired session"}));
                            ws.close();
                            return;
                        }

                        // Client ws에 MessageHandler등록
                        setupClientSocketMessageHandler(ws);

                        // 본인을 제외한 모든 접속중인 Client들에게 입장 사실을 알림 
                        BroadcastSocketMessageUtils.broadcastToAllLobbyMemberExceptSender(ws, {
                            type : "playerJoined",
                            payload : { userName : session.username, classType : session.classType }
                        });
                        

                        ws.on("close", () => {
                            GlobalJobQueue.execute(async () => {
                                // DedicatedSession 관리중인 것 삭제 및 DedicatedServer 로직 종료 필요
                                // 로그도 조금더 자세하게 작성해줘야 함. 어떤 DedicatedServer가 종료된 것인지. 
                                console.log(`[SetupSocket] Client Disconnected`);

                              


                                // 본인을 제외한 모든 접속중인 Client에게 퇴장 사실을 알림
                                BroadcastSocketMessageUtils.broadcastToAllLobbyMemberExceptSender(ws, {
                                    type : "playerLeft",
                                    payload : { userName : session.username}
                                });
                            });
                        });
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



