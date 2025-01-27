import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './styles/Header.css';

function Header() {
  const username = localStorage.getItem('username');
  const navigate = useNavigate();

  const handleLogout = () => {
    localStorage.removeItem('username');
    navigate('/auth');
  };

  return (
    <div className="header">
      <div className="user-controls">
        {username ? (
          <div className="user-info">
            <span>{username}</span>
            <button onClick={handleLogout}>退出</button>
          </div>
        ) : (
          <Link to="/auth" className="auth-link">登录/注册</Link>
        )}
      </div>
    </div>
  );
}

export default Header; 