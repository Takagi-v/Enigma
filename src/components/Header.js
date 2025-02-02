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
      <div className="logo">
        <Link to="/">智慧停车</Link>
      </div>
      <nav className="nav-links">
        <Link to="/parking-spots">停车位</Link>
        {user ? (
          <>
            <Link to="/profile">个人中心</Link>
            <Link to="/messages">消息</Link>
            <button onClick={handleLogout} className="logout-btn">
              登出
            </button>
          </>
        ) : (
          <Link to="/auth">登录</Link>
        )}
      </nav>
    </header>
  );
}

export default Header; 