import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import "./styles/Messages.css";
import config from '../config';

function Messages() {
  const { user, authFetch } = useAuth();
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const wsRef = useRef(null);
  const messagesEndRef = useRef(null);
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

  useEffect(() => {
    if (!user) {
      navigate('/auth');
      return;
    }
    fetchMessages();
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [user, navigate]);

  const fetchMessages = async () => {
    try {
      const response = await authFetch(`${config.API_URL}/messages`);
      if (!response.ok) {
        throw new Error('获取消息失败');
      }
      const data = await response.json();
      setMessages(data.messages);
      setLoading(false);
      scrollToBottom();
    } catch (error) {
      console.error('获取消息失败:', error);
    }
  };

  const handleSend = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !user) return;

    try {
      const response = await authFetch(`${config.API_URL}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: newMessage,
          sender: user.username
        })
      });

      if (!response.ok) {
        throw new Error('发送消息失败');
      }

      setNewMessage('');
      await fetchMessages();
    } catch (error) {
      console.error('发送消息失败:', error);
      alert('发送消息失败，请重试');
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleLogout = () => {
    localStorage.removeItem('username');
    navigate('/auth');
  };

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend(e);
    }
  };

  const handleInput = (e) => {
    const textarea = e.target;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 120)}px`;
    setNewMessage(e.target.value);
  };

  if (loading) return <div className="loading">加载中...</div>;
  if (error) return <div className="error">错误: {error}</div>;

  if (!user) {
    return null;
  }

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
          <div ref={messagesEndRef} />
        </div>
        <div className="send-message">
          <form onSubmit={handleSend} className="message-form">
            <textarea
              value={newMessage}
              onChange={handleInput}
              onKeyPress={handleKeyPress}
              placeholder="输入消息..."
              className="message-input"
            />
            <button type="submit" disabled={!newMessage.trim()} className="send-button">
              发送
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

export default Messages;
