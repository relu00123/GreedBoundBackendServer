// routes/match.js

const express = require("express");
const router = express.Router();
const authenticateToken = require("../middleware/auth");
const { getSession } = require("../services/sessionStore");
const PlayerState = require("../constants/playerstate");
const { addToMatchQueue } = require("../services/matchManager");

router.post("/start", authenticateToken, (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  const session = getSession(token);

  if (!session) {
    return res.status(401).json({ success: false, message: "세션이 존재하지 않습니다." });
  }

  const username = session.username;

  if ([PlayerState.MATCHING, PlayerState.GAME].includes(session.state)) {
    return res.status(400).send("이미 매칭 중이거나 게임 중입니다.");
  }

  addToMatchQueue(username, token);

  return res.status(200).send({ message: "매칭 시작됨" });
});

module.exports = router;