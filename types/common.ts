// Token
export type DungeonToken = string;
export type PlayerToken = string;

 

// SocketMessage
export type  SocketMessage = {
  type : string;
  action? : string;
  // string type의 키를 임의로 여러개 가질 수 있고, key는 어떤 타입이든 올 수 있다. 
  [key : string] : any; 
}
