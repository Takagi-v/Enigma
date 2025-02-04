import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './styles/Header.css';

function Header() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/auth');
  };

  return (
    <header className="header">
      <div className="user-controls">
        {user ? (
          <div className="user-info">
            <span>{user.username}</span>
            <button onClick={handleLogout}>登出</button>
          </div>
        ) : (
          <Link to="/auth" className="auth-link">登录/注册</Link>
        )}
      </div>
    </header>
  );
}

export default Header; 