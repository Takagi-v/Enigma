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
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 'var(--spacing-lg)'
    }}>
      <div style={{
        background: 'white',
        borderRadius: 'var(--radius-xl)',
        padding: 'var(--spacing-2xl)',
        boxShadow: 'var(--shadow-heavy)',
        width: '100%',
        maxWidth: '400px',
        textAlign: 'center'
      }}>
        {/* 品牌标识 */}
        <div style={{
          marginBottom: 'var(--spacing-2xl)'
        }}>
          <div style={{
            width: '80px',
            height: '80px',
            background: 'linear-gradient(135deg, #007AFF, #5856D6)',
            borderRadius: '50%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto var(--spacing-lg)',
            fontSize: '32px',
            color: 'white'
          }}>
            🔒
          </div>
          <h1 style={{
            fontSize: '28px',
            fontWeight: '700',
            color: 'var(--text-primary)',
            margin: '0 0 var(--spacing-xs) 0'
          }}>
            GoParkMe
          </h1>
          <p style={{
            color: 'var(--text-secondary)',
            fontSize: '16px',
            margin: 0
          }}>
            管理员控制台
          </p>
        </div>

        {/* 错误消息 */}
        {error && (
          <div className="alert alert-error" style={{
            textAlign: 'left',
            marginBottom: 'var(--spacing-lg)'
          }}>
            ⚠️ {error}
          </div>
        )}

        {/* 登录表单 */}
        <form onSubmit={handleSubmit} className="modern-form">
          <div className="form-group">
            <label className="form-label" style={{textAlign: 'left'}}>
              👤 管理员账号
            </label>
            <input
              type="text"
              className="form-input"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              disabled={loading}
              placeholder="请输入管理员用户名"
              required
              style={{
                fontSize: '16px',
                padding: 'var(--spacing-md)'
              }}
            />
          </div>
          
          <div className="form-group">
            <label className="form-label" style={{textAlign: 'left'}}>
              🔑 登录密码
            </label>
            <input
              type="password"
              className="form-input"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={loading}
              placeholder="请输入登录密码"
              required
              style={{
                fontSize: '16px',
                padding: 'var(--spacing-md)'
              }}
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading}
            className="btn btn-primary"
            style={{
              width: '100%',
              fontSize: '18px',
              fontWeight: '700',
              padding: 'var(--spacing-md) var(--spacing-lg)',
              marginTop: 'var(--spacing-lg)',
              background: loading ? 'var(--border-medium)' : 'linear-gradient(135deg, #007AFF, #5856D6)',
              cursor: loading ? 'not-allowed' : 'pointer'
            }}
          >
            {loading ? (
              <>
                <div className="loading-spinner" style={{marginRight: 'var(--spacing-sm)'}} />
                登录中...
              </>
            ) : (
              <>
                🚀 立即登录
              </>
            )}
          </button>
        </form>

        {/* 底部信息 */}
        <div style={{
          marginTop: 'var(--spacing-2xl)',
          paddingTop: 'var(--spacing-lg)',
          borderTop: '1px solid var(--border-light)',
          color: 'var(--text-tertiary)',
          fontSize: '14px'
        }}>
          <p style={{margin: 0}}>
            🛡️ 安全登录 · 数据加密
          </p>
        </div>
      </div>
    </div>
  );
};

export default AdminLogin; 