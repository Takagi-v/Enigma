import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { Select, Spin, Button } from 'antd';
import { ArrowLeftOutlined } from '@ant-design/icons';
import './styles/ParkingSearch.css';
import config from '../config';

const { Option } = Select;

function ParkingSearch() {
  const [searchResults, setSearchResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [sortBy, setSortBy] = useState('distance');
  const [userLocation, setUserLocation] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  // 获取用户位置
  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error('获取位置失败:', error);
          setUserLocation({
            lat: 39.915,
            lng: 116.404
          });
        }
      );
    }
  }, []);

  // 处理搜索
  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const keyword = searchParams.get('keyword');
    const type = searchParams.get('type') || 'name';
    
    if (keyword) {
      handleSearch(keyword, type);
    }
  }, [location.search, userLocation]);

  const handleSearch = async (keyword, type) => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        keyword,
        type,
        sort: sortBy
      });

      if (sortBy === 'distance' && userLocation) {
        params.append('lat', userLocation.lat);
        params.append('lng', userLocation.lng);
      }

      const response = await fetch(`${config.API_URL}/parking-spots/search?${params.toString()}`);
      const data = await response.json();

      if (!Array.isArray(data)) {
        throw new Error('Invalid response format');
      }

      setSearchResults(data);
    } catch (error) {
      console.error('搜索出错：', error);
      setError('搜索过程中发生错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleSortChange = (value) => {
    setSortBy(value);
    const searchParams = new URLSearchParams(location.search);
    handleSearch(searchParams.get('keyword'), searchParams.get('type'));
  };

  const calculateDistance = (spotCoordinates) => {
    if (!spotCoordinates || !userLocation) return null;
    
    const [spotLat, spotLng] = spotCoordinates.split(',').map(Number);
    const R = 6371; // 地球半径（公里）
    const dLat = (spotLat - userLocation.lat) * Math.PI / 180;
    const dLng = (spotLng - userLocation.lng) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(userLocation.lat * Math.PI / 180) * Math.cos(spotLat * Math.PI / 180) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return (R * c).toFixed(2);
  };

  return (
    <div className="search-container">
      <div className="search-header">
        <div className="header-left">
          <Button 
            type="link" 
            icon={<ArrowLeftOutlined />} 
            onClick={() => navigate('/parking-lots')}
            className="back-button"
          />
          <h1>搜索结果</h1>
        </div>
        <Select
          value={sortBy}
          style={{ width: 120 }}
          onChange={handleSortChange}
          className="sort-select"
        >
          <Option value="distance">按距离排序</Option>
          <Option value="price">按价格排序</Option>
          <Option value="name">按名称排序</Option>
        </Select>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {loading ? (
        <div className="loading-container">
          <Spin size="large" />
        </div>
      ) : (
        <div className="search-results">
          {searchResults.length === 0 ? (
            <div className="no-results">
              <p>未找到相关停车位</p>
            </div>
          ) : (
            <div className="parking-spots-grid">
              {searchResults.map((spot) => (
                <Link to={`/parking/${spot.id}`} key={spot.id} className="parking-link">
                  <div className="parking-card">
                    <h2>{spot.location}</h2>
                    <p className="price">¥{spot.price}/小时</p>
                    {spot.coordinates && (
                      <p className="distance">
                        距离: {spot.distance || calculateDistance(spot.coordinates)} 公里
                      </p>
                    )}
                    <div className="spot-details">
                      <p>联系人：{spot.contact}</p>
                      <p>发布者：{spot.owner_username}</p>
                      <p>{spot.description}</p>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default ParkingSearch; 