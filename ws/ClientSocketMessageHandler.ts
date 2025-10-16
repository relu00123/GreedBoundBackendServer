import WebSocket, { WebSocketServer } from "ws";     
import jwt, { JwtPayload } from "jsonwebtoken";
import { getSession, updateSession, sessionMap, Session } from "../services/managers/sessionStore";
import { handleEscapeRequest,  EscapeRequestMessage } from "../services/managers/EscapeManager";
import { DungeonManager } from "../services/managers/DungeonManager";
import { CharacterClassValueMap, CharacterClassType, CharacterClassTypeEnum, CharacterClassNameMap } from "../types/character";
import { PlayerToken, SocketMessage } from "../types/common";
import { PlayerSession } from "../types/player";
import { PlayerManager } from "../services/managers/PlayerManager";
import { GlobalJobQueue } from "../utils/GlobalJobQueue";
import { FriendshipManager } from "../services/managers/FriendshipManager";
import { ClientSocketMessageSender } from "./ClientSocketMessageSender";
import { SentRequestRow } from "../services/stores/FriendshipStore";
import { PlayerSessionPatch } from "../types/player";
import { PartyMessageHandler } from "./handler/PartyMessageHandler";
import { GamePhaseMessageHandler } from "./handler/GamePhaseMessageHandler";
import { MatchQueueManager } from "../services/managers/MatchQueueManager";
import { MatchQueueMessageHandler } from "./handler/MatchQueueMessageHandler";


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

          case "ChangeClassRequest" : 
          {
            try {
              console.log("Change Class Request Received!");

              // 페이로드 파싱
              const payload = msg.Payload;
              const requestedEnum = payload.RequestedClass as CharacterClassTypeEnum;

              // 유효성 체크 (enum 값 범위 확인)
              if (typeof requestedEnum  !== "number" || !(requestedEnum in CharacterClassNameMap)) {
                ws.send(JSON.stringify({
                  type: "ChangeClassResponse",
                  payload : {
                    success : false,
                    oldClass : null,
                    newClass : null,
                    error : "INVALID_PAYLOAD",
                  }
                }));
                break;
            }
            

            // 세션 조회 
            const player = PlayerManager.getInstance("ClientSocketMessageHandler").getPlayerSessionBySocket(ws);

            if (!player) {
              ws.send(JSON.stringify({
                type : "ChangeClassResponse",
                payload: {
                  success : false,
                  oldClass : null,
                  newClass : null,
                  error : "NOT_AUTHENTICATED",
                }
              }));
              break;
            }

            const oldClassStr: CharacterClassType = player.classType; // 예: "Knight"
            const requestedStr = CharacterClassNameMap[requestedEnum]; // e.g. 1 -> "Knight"

            // 같은 클래스일시 no-op
            if (oldClassStr === requestedStr)
            {
              ws.send(JSON.stringify({
                type : "ChangeClassResponse",
                payload : {
                  success : true,
                  oldClass: CharacterClassValueMap[oldClassStr],
                  newClass: CharacterClassValueMap[oldClassStr],
                  note : "NO_CHANGE"
                }
              }));
              break;
            }

            const prevStr = oldClassStr;
            const snapshot = PlayerManager.getInstance("ClientSocketMessageHandler").setClassTypeBySocket(ws, payload.RequestedClass);

            if (!snapshot) {
              ws.send(JSON.stringify({
                type: "ChangeClassResponse",
                payload : 
                {
                  success : false,
                  oldClass: CharacterClassValueMap[oldClassStr],
                  newClass: requestedEnum,
                  error : "CHANGE_FAILED"
                }
              
              }));
              break;
            }

            // 요청자에게 성공 응답
            ws.send(JSON.stringify({
              type: "ChangeClassResponse",
              payload: {
                success:true,
                oldClass: CharacterClassValueMap[prevStr],
                newClass: requestedEnum,
              }
            }));


            // 접속한 모든 유저들에게 Broadcast
            /*
            const update: PlayerSessionUpdated = {
              type: "PlayerSessionUpdated",        
              userId :  player.username,                             
              changed: { classType: requestedStr }  
            };
            */

            const patch: PlayerSessionPatch = { classType: requestedEnum };

            // 접속한 유저들에게 UserInfo바뀜을 Broadcast
            //ClientSocketMessageSender.broadcastuserInfoUpdatedToAll(snapshot);
            ClientSocketMessageSender.broadcastPlayerSessionUpdatedToAll(snapshot, patch);


          } catch (err) {
            console.error("ChangeClassRequest error:", err);
            ws.send(JSON.stringify({
            type: "ChangeClassResponse",
            payload: {
              success: false,
              oldClass: null,
              newClass: null,
              error: "INTERNAL_ERROR",
            }
            }));
          }
            break;
          }

          case "LobbyUserListRequest":

            PlayerManager.getInstance("ClientSocketMessageHandler").handleLobbyUserListRequest(ws);
            break;
             
            // console.log("LobbyUserListRequest Received");

            // const users = PlayerManager.getInstance("ClientSocketMessageHandler").getAllLobbyUserNameAndClass();

            // console.log("🧍 Currently Connected Users:");
            //   users.forEach((user, index) => {
            //   console.log(`  ${index + 1}. ${user.username} (${user.classType})`);
            // });

            // ws.send(JSON.stringify({
            //   type: "LobbyUserListResponse",
            //   payload : users
            // }))
           
            //break;

          case "FriendListRequest":
            {
              console.log("FriendListRequest Received");

              const Payload = msg.Payload;
              const userId = Payload.MyNickName;

              // 전체 msg를 JSON 문자열로 출력
              // console.log("msg =", JSON.stringify(msg, null, 2));

              // // payload만 출력
              // console.log("Payload =", JSON.stringify(Payload, null, 2));

              // // MyNickName 값만 출력
              // console.log("MyNickName =", userId, "| type =", typeof userId);

              if (!userId) 
              {
                console.error("MyNickName not provieded in FriendListRequest [ClientSocketMessageHandler.ts]");
                break;
              }

              const friendList = await FriendshipManager.getFriendList(userId);
              ClientSocketMessageSender.sendFriendListResponse(ws, friendList);
              break;
            }

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
            {
              console.log("AddFriendRequest Received!");
              const AddFriendRequestPayload = msg.Payload;
              const MyNickName = AddFriendRequestPayload.MyNickname;  
              const targetNickname = AddFriendRequestPayload.TargetNickname;
              console.log(`Add friend request for : ${MyNickName} -> ${targetNickname}`);
              try {
                await FriendshipManager.HandleAddFriendRequest(MyNickName, targetNickname);

                // 자기자신에게 보냄 
                ClientSocketMessageSender.sendAddFriendRequestSentResponse(ws, true, {friend_id : targetNickname});
              } catch(err : any) {
                ClientSocketMessageSender.sendAddFriendRequestSentResponse(ws, false);
              }
            }
            break;

          case "RemoveFriendRequest" :
            {
              console.log("RemoveFriendRequest Received!");
              const Payload = msg.Payload;
              const MyNickname = Payload.MyNickname;
              const TargetNickname = Payload.TargetNickname;
              console.log(`Remove friend from : ${MyNickname} -> ${TargetNickname}`);
              try {
                await FriendshipManager.HandleRemoveFriendRequest(MyNickname, TargetNickname);

              } catch(err : any) {

              }
            }
            break;
          case "WithdrawFriendRequest":
            {
            
              console.log("WithdrawFriendRequest Received!");
              const Payload= msg.Payload;

            }
            

            break;
          
          case "RespondToFriendRequest":
            {
              console.log("RespondToFriendRequest Received!");

              const payload = msg.Payload;

              const MyNickName = payload.MyNickname; 
              const targetNickname = payload.TargetNickname;
              const isAccepted = payload.IsAccepted;

              try {
                await FriendshipManager.RespondToFriendRequest(MyNickName, targetNickname, isAccepted);
              } catch(err : any) {
                
              }
            }
            break;
            
          case "InviteToParty" : 
          {
              console.log("Invite To Party Received");
              PartyMessageHandler.handleSendPartyInviteRequest(ws, msg);
              break;
          }

          case "PartyHostTransfer" : 
          {
              PartyMessageHandler.handlePartyHostTransferRequest(ws, msg);
              break;
          }

          case "PartyInviteAccept" : 
          {
              console.log("Party Invite Accept Received");
              PartyMessageHandler.handleAcceptPartyInviteRequest(ws, msg);
              break;
          }

          case "KickFromParty" : 
          {
              PartyMessageHandler.handleKickFromPartyRequest(ws, msg);
              break;
          }

          case "LeaveFromParty" : 
          {
              PartyMessageHandler.handleLeaveFromPartyRequest(ws, msg);
              break;
          }

          case "GamePhaseChangeRequest" : 
          {
            GamePhaseMessageHandler.handleGamePhaseChangeRequest(ws, msg);
            break;
          }

          case "MatchStartRequest" : 
          {
            MatchQueueMessageHandler.handleMatchStartRequest(ws, msg);
            break;
          }
        
           


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