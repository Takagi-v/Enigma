import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import "./styles/Messages.css";
import config from '../config';

function Messages() {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);
  const navigate = useNavigate();

  const [username, setUsername] = useState(() => {
    const savedUsername = localStorage.getItem('username');
    return savedUsername || "游客" + Math.floor(Math.random() * 1000);
  });

  // WebSocket连接
  useEffect(() => {
    let mounted = true;

    const connectWebSocket = () => {
      if (wsRef.current) return;

      const socket = new WebSocket(config.WS_URL);

      socket.onopen = () => {
        console.log("WebSocket已连接");
      };

      socket.onmessage = (event) => {
        if (mounted) {
          const message = JSON.parse(event.data);
          setMessages((prevMessages) => [message, ...prevMessages]);
        }
      };

      socket.onerror = (error) => {
        console.error("WebSocket错误:", error);
        if (mounted) {
          setError("连接错误");
        }
      };

      socket.onclose = () => {
        console.log("WebSocket已断开");
        wsRef.current = null;
        if (mounted) {
          setTimeout(connectWebSocket, 5000);
        }
      };

      wsRef.current = socket;
    };

    connectWebSocket();

    return () => {
      mounted = false;
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  // 获取历史消息
  useEffect(() => {
    let mounted = true;

    const fetchMessages = async () => {
      try {
        const response = await fetch(`${config.API_URL}/messages`);
        if (!response.ok) throw new Error("获取消息失败");
        const data = await response.json();
        if (mounted) {
          setMessages(data);
          setIsLoading(false);
        }
      } catch (error) {
        if (mounted) {
          setError(error.message);
          setIsLoading(false);
        }
      }
    };

    fetchMessages();

    return () => {
      mounted = false;
    };
  }, []);

  // 发送消息
  const sendMessage = async () => {
    if (!newMessage.trim()) return;

    try {
      const response = await fetch(`${config.API_URL}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sender_username: username,
          receiver_username: "admin",
          content: newMessage.trim(),
        }),
      });

      if (!response.ok) throw new Error("发送失败");
      setNewMessage("");
    } catch (error) {
      setError(error.message);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('username');
    navigate('/auth');
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const handleInput = (e) => {
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    setNewMessage(e.target.value);
  };

  if (isLoading) return <div className="loading">加载中...</div>;
  if (error) return <div className="error">错误: {error}</div>;

  return (
    <div className="chat-container">
      <div className="chat-sidebar">
        <h2>聊天室</h2>
        <p>当前用户：{username}</p>
        {localStorage.getItem('username') && (
          <button onClick={handleLogout} className="logout-button">
            退出登录
          </button>
        )}
      </div>
      <div className="chat-window">
        <div className="message-list">
          {messages.map((message, index) => (
            <div
              key={message.id || index}
              className={`message ${message.username === username ? "sent" : "received"}`}
            >
              <p className="message-content">{message.text}</p>
              <small className="message-info">
                {message.username} • {new Date(message.created_at).toLocaleString()}
              </small>
            </div>
          ))}
        </div>
        <div className="send-message">
          <textarea
            value={newMessage}
            onChange={handleInput}
            onKeyPress={handleKeyPress}
            placeholder="输入消息..."
            className="message-input"
          />
          <button onClick={sendMessage} className="send-button">
            发送
          </button>
        </div>
      </div>
    </div>
  );
}

export default Messages;
