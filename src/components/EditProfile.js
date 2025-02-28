import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './styles/EditProfile.css';
import config from '../config';

function EditProfile() {
  const { user, authFetch } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(false);
  
  // 表单数据
  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
    bio: '',
    address: ''
  });

  // 当用户信息加载完成后，填充表单
  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.fullName || '',
        phone: user.phone || '',
        bio: user.bio || '',
        address: user.address || ''
      });
    } else {
      // 如果没有用户信息，重定向到登录页面
      navigate('/auth');
    }
  }, [user, navigate]);

  // 处理表单输入变化
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  // 提交表单
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!user) {
      setError('用户未登录');
      return;
    }
    
    try {
      setLoading(true);
      setError(null);
      setSuccess(false);
      
      const response = await authFetch(`${config.API_URL}/users/${user.username}`, {
        method: 'PUT',
        body: JSON.stringify({
          full_name: formData.full_name,
          phone: formData.phone,
          bio: formData.bio,
          address: formData.address
        })
      });
      
      const data = await response.json();
      
      if (!response.ok) {
        throw new Error(data.message || '更新资料失败');
      }
      
      setSuccess(true);
      
      // 3秒后返回个人资料页面
      setTimeout(() => {
        navigate('/profile');
      }, 3000);
      
    } catch (err) {
      console.error('更新资料失败:', err);
      setError(err.message || '更新资料失败，请稍后再试');
    } finally {
      setLoading(false);
    }
  };

  // 取消编辑，返回个人资料页面
  const handleCancel = () => {
    navigate('/profile');
  };

  return (
    <div className="edit-profile-container">
      <h1 className="edit-profile-title">编辑个人资料</h1>
      
      {error && (
        <div className="error-message">{error}</div>
      )}
      
      {success && (
        <div className="success-message">资料更新成功！正在返回个人资料页面...</div>
      )}
      
      <form className="edit-profile-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="full_name">姓名</label>
          <input
            type="text"
            id="full_name"
            name="full_name"
            value={formData.full_name}
            onChange={handleChange}
            placeholder="请输入您的姓名"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="phone">电话</label>
          <input
            type="tel"
            id="phone"
            name="phone"
            value={formData.phone}
            onChange={handleChange}
            placeholder="请输入您的电话号码"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="bio">个人简介</label>
          <textarea
            id="bio"
            name="bio"
            value={formData.bio}
            onChange={handleChange}
            placeholder="请输入您的个人简介"
            rows="4"
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="address">地址</label>
          <input
            type="text"
            id="address"
            name="address"
            value={formData.address}
            onChange={handleChange}
            placeholder="请输入您的地址"
          />
        </div>
        
        <div className="form-actions">
          <button 
            type="button" 
            className="cancel-btn"
            onClick={handleCancel}
            disabled={loading}
          >
            取消
          </button>
          <button 
            type="submit" 
            className="submit-btn"
            disabled={loading}
          >
            {loading ? '保存中...' : '保存修改'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default EditProfile; 