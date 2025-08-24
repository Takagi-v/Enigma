import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/ModernAdmin.css';
import config from '../../config';

const AdminLogin = () => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const adminToken = localStorage.getItem('adminToken');
    if (adminToken) {
      navigate('/admin/dashboard');
    }
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      if (!username.trim() || !password.trim()) {
        throw new Error('用户名和密码不能为空');
      }

      const response = await fetch(`${config.API_URL}/admin/login`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ username: username.trim(), password: password.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || '登录失败，请检查用户名和密码');
      }

      localStorage.setItem('adminToken', data.token);
      navigate('/admin/dashboard');
    } catch (error) {
      console.error('登录错误:', error);
      setError(error.message || '登录失败，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-panel">
        <div className="login-header">
          <div className="login-brand-icon">
            🔒
          </div>
          <h1 className="login-title">GoParkMe</h1>
          <p className="login-subtitle">管理员控制台</p>
        </div>

        {error && (
          <div className="alert alert-error">
            <span className="alert-icon">⚠️</span> 
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label className="form-label">👤 管理员账号</label>
            <input
              type="text"
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              placeholder="请输入管理员用户名"
              required
            />
          </div>
          
          <div className="form-group">
            <label className="form-label">🔑 登录密码</label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              placeholder="请输入登录密码"
              required
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className="btn btn-primary login-button"
          >
            {loading ? (
              <>
                <div className="loading-spinner" />
                <span>登录中...</span>
              </>
            ) : (
              <span>🚀 立即登录</span>
            )}
          </button>
        </form>

        <div className="login-footer">
          <p>🛡️ 安全登录 · 数据加密</p>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin; 