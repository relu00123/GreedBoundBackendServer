const { spawn } = require("child_process");
let portCounter = 8000;

function launchDungeonServer(dungeonId) {
  const port = portCounter++;

  // const serverProcess = spawn(
  //   // ✅ Dedicated Server 실행 파일 경로
  //   "C:\\Users\\Relu\\Desktop\\GreedboundSVN\\Greedbound\\Build\\WindowsServer\\GreedboundServer.exe",

  //   // ✅ 실행 인자: 맵 이름은 실제 사용 중인 .umap 이름으로 바꿔줘
  //   ["Dungeon1?listen", `-port=${port}`],

  //   {
  //     cwd: "C:\\Users\\Relu\\Desktop\\GreedboundSVN\\Greedbound\\Build\\WindowsServer", // 실행 디렉토리
  //     detached: true,
  //     stdio: "ignore", // 또는 "inherit"으로 바꾸면 로그 확인 가능
  //   }
  // );
const exePath = "C:\\Users\\Relu\\Desktop\\GreedboundSVN\\Greedbound\\Build\\WindowsServer\\GreedboundServer.exe";

 const serverProcess = spawn(
    "cmd.exe",
    [
      "/c",
      "start",
      `"Dungeon_${dungeonId}"`, // 새 창 제목
      exePath,                 // ❗ 경로에 쌍따옴표 붙이지 않기
      `Dungeon1?listen`,
      `-port=${port}`,
      `-log`
    ],
    {
      cwd: "C:\\Users\\Relu\\Desktop\\GreedboundSVN\\Greedbound\\Build\\WindowsServer",
      detached: true
    }
  );


  serverProcess.unref(); // 백그라운드로 실행

  console.log(`🚀 [DedicatedServer] ${dungeonId} 포트 ${port}에서 실행됨`);

  return port;
}

module.exports = {
  launchDungeonServer,
};