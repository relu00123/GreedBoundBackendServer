import WebSocket, { WebSocketServer } from "ws";     
import jwt, { JwtPayload } from "jsonwebtoken";
import { getSession, updateSession, sessionMap, Session } from "../services/managers/sessionStore";
import { handleEscapeRequest,  EscapeRequestMessage } from "../services/managers/EscapeManager";
import { DungeonManager } from "../services/managers/DungeonManager";
import { SocketMessage } from "../types/types";
import { PlayerManager } from "../services/managers/PlayerManager";
import { GlobalJobQueue } from "../utils/GlobalJobQueue";
import { FriendshipManager } from "../services/managers/FriendshipManager";
import { ClientSocketMessageSender } from "./ClientSocketMessageSender";
import { SentRequestRow } from "../services/stores/FriendshipStore";


export function setupClientSocketMessageHandler(ws: WebSocket) {
  ws.on("message", (data) => {
    try {
      const msg: SocketMessage = JSON.parse(data.toString());

      GlobalJobQueue.execute(async() => {
     
        switch(msg.type)
        {
          case "friend":
            // handleFriendMessage(ws, msg);
            break;

          case "LobbyUserListRequest":
             
            console.log("LobbyUserListRequest Received");

            const users = PlayerManager.getInstance("ClientSocketMessageHandler").getAllLobbyUserNameAndClass();

            console.log("🧍 Currently Connected Users:");
              users.forEach((user, index) => {
              console.log(`  ${index + 1}. ${user.username} (${user.classType})`);
            });

            ws.send(JSON.stringify({
              type: "LobbyUserListResponse",
              payload : users
            }))
           
            break;

          case "FriendListRequest":
          
            break;

          case "FriendRequestSentListRequest":

            console.log("FriendRequestSentListRequest Received");

            const sentpayload = msg.Payload;
            const userId = sentpayload.MyNickName;

            if (!userId) {
              console.error("MyNickName not provieded in FriendRequestSentListRequest [ClientSocketMessageHandler.ts]");
              break;
            }

            const sentList = await FriendshipManager.getSentRequest(userId);
            ClientSocketMessageSender.sendFriendRequestSentListResponse(ws, sentList);
            break;

          case "FriendRequestReceivedListRequest":

            console.log("FrineRequestReceivedListRequest Received");

            const FriensRequestReceivedListPayload = msg.Payload; 

            if (!FriensRequestReceivedListPayload.MyNickName) {
              console.error("MyNickName not provieded in FriendRequestReceivedListRequest [ClientSocketMessageHandler.ts]");
            }

            const receivedList = await FriendshipManager.getIncomingRequests(FriensRequestReceivedListPayload.MyNickName);
            ClientSocketMessageSender.sendFriendRequestReceivedListResponse(ws, receivedList);
            break;

          case "AddFriendRequest":
            console.log("AddFriendRequest Received!");
            const AddFriendRequestPayload = msg.Payload;
            const MyNickName = AddFriendRequestPayload.MyNickname;  
            const targetNickname = AddFriendRequestPayload.TargetNickname;
            console.log(`Add friend request for : ${MyNickName} -> ${targetNickname}`);
            try {
              await FriendshipManager.HandleAddFriendRequest(MyNickName, targetNickname);
              ClientSocketMessageSender.sendAddFriendRequestSentResponse(ws, true, {friend_id : targetNickname});
            } catch(err : any) {
              ClientSocketMessageSender.sendAddFriendRequestSentResponse(ws, false);
            }

            break;

          case "WithdrawFriendRequest":
            {
            
              console.log("WithdrawFriendRequest Received!");
              const Payload= msg.Payload;

            }
            

            break;
          
          case "RespondToFriendRequest":
            console.log("RespondToFriendRequest Received!");

            break;
            
          default:
            ws.send(JSON.stringify({error : `Unknown message type : ${msg.type}`}));
            break;
        }

        });

    } catch (err) {
      console.error("❌ [Client] Invalid message:", err);
    }
  });
}