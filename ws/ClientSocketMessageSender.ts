import { WebSocket } from "ws";
import { GlobalJobQueue } from "../utils/GlobalJobQueue";

// 아직까지는 JobQueue에 연동해야할 부분이 없지만, 필요하다면 JobQueue에 연동을 해야한다. 
export class ClientSocketMessageSender {
    static sendPlayerJoined(ws : WebSocket, userName : string, classType  : string) {
        ws.send(JSON.stringify({
            type: "playerJoined",
            payload: { userName, classType }
        }));
    }

    static sendPlayerLeft(ws : WebSocket, userName : string) {
        ws.send(JSON.stringify({
            type: "playerLeft",
            payload : {userName}
        }));
    }
}