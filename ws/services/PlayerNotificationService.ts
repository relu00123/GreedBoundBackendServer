import { ClientGamePhase } from "../../constants/ClientGamePhase";
import { PlayerManager } from "../../services/managers/PlayerManager";
import { PlayerSession } from "../../types/player";
import { ClientSocketMessageSender } from "../ClientSocketMessageSender";


export class PlayerNotificationService {

    static notifyGamePhaseChanged(username : string, prev : ClientGamePhase, next : ClientGamePhase, snapshot : PlayerSession) {

        // 자기 자신에게 보내는 전용 패킷
        ClientSocketMessageSender.sendToUser(username, {
            type : "GamePhaseChanged",
            payload : {previousGameState : prev, changedGameState : next}
        });

        // 다른 모든 클라이언트에게 브로드 캐스트
        //const snapshot = PlayerManager.getInstance("PlayerNotificationService").getPlayerSessionByUserName(username);
        if (snapshot) {
            ClientSocketMessageSender.broadcastPlayerSessionUpdatedToAll(snapshot, {
                gamePhase : next
            });
        }
    }

}