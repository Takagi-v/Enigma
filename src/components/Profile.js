import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import './styles/Profile.css';
import defaultAvatar from '../images/default-avatar.jpg'; // 请确保有默认头像图片
import config from '../config';

function Profile() {
  const [userInfo, setUserInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const username = localStorage.getItem('username');

  useEffect(() => {
    if (!username) {
      alert('请先登录');
      navigate('/auth');
      return;
    }

    fetchUserInfo();
  }, [username, navigate]);

  const fetchUserInfo = async () => {
    try {
      const response = await fetch(`${config.API_URL}/user-info/${username}`);
      if (!response.ok) {
        throw new Error('获取用户信息失败');
      }
      const data = await response.json();
      setUserInfo(data);
    } catch (error) {
      console.error('Error:', error);
      alert('获取用户信息失败');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="loading">加载中...</div>;
  }

  if (!userInfo) {
    return null;
  }

  return (
    <div className="profile-container">
      <div className="profile-left">
        <img
          src={userInfo.avatar || defaultAvatar}
          alt={userInfo.username}
          className="profile-avatar"
        />
      </div>
      <div className="profile-right">
        <h1 className="profile-name">{userInfo.full_name}</h1>
        <p className="profile-username">@{userInfo.username}</p>
        {userInfo.address && (
          <p className="profile-location">{userInfo.address}</p>
        )}
        
        <div className="profile-info">
          <div className="info-section">
            <h3>个人简介</h3>
            <p>{userInfo.bio}</p>
          </div>

          <div className="info-section">
            <h3>联系方式</h3>
            <p>电话：{userInfo.phone}</p>
          </div>

          <button 
            className="edit-profile-btn"
            onClick={() => navigate('/edit-profile')} // 需要创建编辑页面
          >
            编辑资料
          </button>
        </div>
      </div>
    </div>
  );
}

export default Profile;