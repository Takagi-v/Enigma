import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import './styles/Header.css';
import { SearchOutlined } from '@ant-design/icons';
import { Input } from 'antd';

const { Search } = Input;

function Header() {
  const username = localStorage.getItem('username');
  const navigate = useNavigate();
  const [searchValue, setSearchValue] = useState('');

  const handleLogout = () => {
    localStorage.removeItem('username');
    navigate('/auth');
  };

  const handleSearch = (value) => {
    if (value) {
      navigate(`/search?keyword=${encodeURIComponent(value)}`);
    }
  };

  return (
    <div className="floating-search">
      <Search
        placeholder="搜索停车位"
        allowClear
        enterButton={<SearchOutlined />}
        size="large"
        value={searchValue}
        onChange={(e) => setSearchValue(e.target.value)}
        onSearch={handleSearch}
        className="global-search"
      />
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