// routes/player.js
const express = require("express");
const router = express.Router();
const { sessionMap } = require("../services/managers/sessionStore");

router.get("/:username/status", (req, res) => {
  const username = req.params.username;

  for (const session of sessionMap.values()) {
    if (session.username === username) {
      return res.json({
        nickname: session.nickname,
        state: session.state,
        dungeonId: session.dungeonId || null,
      });
    }
  }

  return res.status(404).json({ error: "User not found" });
});

router.get("/", (req, res) => {
  const allPlayers = [];

  for (const session of sessionMap.values()) {
    allPlayers.push({
      username: session.username,
      nickname: session.nickname,
      state: session.state,
      dungeonId: session.dungeonId || null,
    });
  }

  res.json(allPlayers);
});

module.exports = router;