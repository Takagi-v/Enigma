const express = require('express');
const router = express.Router();
const { db } = require('../models/db');

// 获取消息列表
router.get("/", (req, res) => {
  console.log("Received request to fetch messages");
  db().all(
    `SELECT m.*, 
     u1.full_name as sender_name, u1.avatar as sender_avatar,
     u2.full_name as receiver_name, u2.avatar as receiver_avatar
     FROM messages m
     LEFT JOIN users u1 ON m.sender_username = u1.username
     LEFT JOIN users u2 ON m.receiver_username = u2.username
     ORDER BY m.created_at DESC`,
    [],
    (err, rows) => {
      if (err) {
        console.error("Error fetching messages:", err.message);
        return res.status(500).send("Error fetching messages");
      }
      console.log("Messages fetched successfully");
      res.json(rows);
    }
  );
});

// 发送新消息
router.post("/", (req, res) => {
  console.log("Received request to save message:", req.body);
  const { sender_username, receiver_username, content } = req.body;

  if (!sender_username || !receiver_username || !content) {
    return res.status(400).json({ message: "发送者、接收者和消息内容都不能为空" });
  }

  db().run(
    "INSERT INTO messages (sender_username, receiver_username, content) VALUES (?, ?, ?)",
    [sender_username, receiver_username, content],
    function (err) {
      if (err) {
        console.error("Error saving message:", err.message);
        return res.status(500).send("Error saving message");
      }
      const newMessage = {
        id: this.lastID,
        sender_username,
        receiver_username,
        content,
        created_at: new Date(),
        read: 0
      };
      console.log("Message saved successfully:", newMessage);
      res.status(201).json(newMessage);
    }
  );
});

// 获取用户的消息列表
router.get("/user/:username", (req, res) => {
  const { username } = req.params;
  
  db().all(
    `SELECT m.*, 
     u1.full_name as sender_name, u1.avatar as sender_avatar,
     u2.full_name as receiver_name, u2.avatar as receiver_avatar
     FROM messages m
     LEFT JOIN users u1 ON m.sender_username = u1.username
     LEFT JOIN users u2 ON m.receiver_username = u2.username
     WHERE m.sender_username = ? OR m.receiver_username = ?
     ORDER BY m.created_at DESC`,
    [username, username],
    (err, messages) => {
      if (err) {
        console.error("Error fetching user messages:", err.message);
        return res.status(500).json({ message: "获取消息失败" });
      }
      res.json(messages);
    }
  );
});

// 标记消息为已读
router.put("/:id/read", (req, res) => {
  const { id } = req.params;
  
  db().run(
    "UPDATE messages SET read = 1 WHERE id = ?",
    [id],
    function(err) {
      if (err) {
        console.error("Error marking message as read:", err.message);
        return res.status(500).json({ message: "更新消息状态失败" });
      }
      if (this.changes === 0) {
        return res.status(404).json({ message: "消息不存在" });
      }
      res.json({ message: "消息已标记为已读" });
    }
  );
});

module.exports = router; 