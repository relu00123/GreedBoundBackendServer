// DungonManager.ts

import { launchDungeonServer } from "../../utils/launchDungeonServer";
import { DungeonSessionStore,  } from "../stores/DungeonSessionStore";
import { MapType, PlayerToken, DungeonToken, DungeonSession} from "../../types/types"
import { WebSocket as WSWebSocket } from "ws";

export class DungeonManager {
    private static _instance : DungeonManager | null = null;

    // 맵 타입별로 instance 숫자를 따로 관리한다.
    private instanceCounters : Record<MapType, number> = {};

    // DungeonSession cache
    private dungeonSessionStore = DungeonSessionStore.getInstance("DungeonManager");

    private constructor() {}

    public static getInstance(caller : string) : DungeonManager {

        // 이쪽은 DungeonManager를 사용하는 애들만 접근할 수 있도록 추가 작업해야함.
        // 어떻게 작성하는지 모르겠으면 DungeonSessionStoer에서 사용한 방식을 참고할 것. 
        // if (caller != "...") {
        //     throw new Error("Unauthorized access to DungeonManager");
        // }
        return this._instance ??= new DungeonManager();
    }

    // 던전 생성 
    public createDungeon(mapType : MapType, playerTokens : PlayerToken[]) : { generatedDungeonToken : string ; generatedDungeonPort : number; } 
    {
        // 1. mapType에 대한 인스턴스 번호 증가
        const prevInstance = this.instanceCounters[mapType] ?? 0;
        const instanceNumber = prevInstance + 1;
        this.instanceCounters[mapType] = instanceNumber;

        // 2. Dedicated Server 실행
        const { generatedDungeonToken , generatedDungeonPort} = launchDungeonServer(mapType, instanceNumber);

        // 3. 만들어진 DungeonSession 저장
        this.dungeonSessionStore.createDungeonSession(generatedDungeonToken, playerTokens, mapType, instanceNumber);

        return { generatedDungeonToken , generatedDungeonPort};
    }

    // 던전 삭제
    public deleteDungeon(dungeonToken : DungeonToken) 
    {
        // 실행중인 DedicatedServer를 종료해야한다. 

        this.dungeonSessionStore.deleteSession(dungeonToken);
    }

    // 소캣등록 
    public registerDedicatedSocket(token : DungeonToken, ws : WSWebSocket) : boolean {
        return this.dungeonSessionStore.registerSocket(token, ws);
    }


    public hasDungeon(token: string): boolean {
        return this.dungeonSessionStore.getDungeonSession(token) !== undefined;
        //return this.dungeonSessionStore.getDungeonSession(token) !== undefined;
    }
}