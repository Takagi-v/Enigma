import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import './styles/ParkingSpotForm.css';
import Map from './Map';
import config from '../config';

function ParkingSpotForm() {
  const { user, authFetch } = useAuth();
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    location: '',
    status: 'available',
    hourly_rate: '',
    description: ''
  });
  const [selectedLocation, setSelectedLocation] = useState(null);

  const handleLocationSelect = (location) => {
    setSelectedLocation(location);
    setFormData(prev => ({
      ...prev,
      coordinates: `${location.lat},${location.lng}`
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!user) {
      navigate('/auth');
      return;
    }

    try {
      const response = await authFetch(`${config.API_URL}/parking-spots`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      if (!response.ok) {
        throw new Error('创建停车位失败');
      }

      alert('停车位创建成功！');
      navigate('/parking-spots');
    } catch (error) {
      console.error('创建停车位失败:', error);
      alert(error.message || '创建停车位失败，请重试');
    }
  };

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value
    });
  };

  return (
    <div className="parking-form-container">
      <div className="map-section">
        <Map onLocationSelect={handleLocationSelect} mode="select" />
      </div>
      
      <div className="form-section">
        <h2>发布停车位信息</h2>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>位置</label>
            <input
              type="text"
              name="location"
              value={formData.location}
              onChange={handleChange}
              required
              placeholder="请输入详细地址"
            />
          </div>

          <div className="form-group">
            <label>价格（元/小时）</label>
            <input
              type="number"
              name="hourly_rate"
              value={formData.hourly_rate}
              onChange={handleChange}
              required
              min="0"
              step="0.1"
            />
          </div>

          <div className="form-group">
            <label>描述</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleChange}
              placeholder="请描述停车位的具体情况"
            />
          </div>

          {selectedLocation && (
            <div className="selected-location">
              <p>已选择位置：</p>
              <p>纬度：{selectedLocation.lat}</p>
              <p>经度：{selectedLocation.lng}</p>
            </div>
          )}

          <button type="submit">发布</button>
        </form>
      </div>
    </div>
  );
}

export default ParkingSpotForm;
