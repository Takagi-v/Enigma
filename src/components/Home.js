import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Select, Spin, Pagination, Input } from 'antd';
import './styles/Home.css';
import config from '../config';

const { Option } = Select;
const { Search } = Input;
const PAGE_SIZE = 12;

function Home() {
  const [parkingSpots, setParkingSpots] = useState([]);
  const [userLocation, setUserLocation] = useState(null);
  const [sortBy, setSortBy] = useState('distance');
  const [loading, setLoading] = useState(false);
  const [searchType, setSearchType] = useState('name');
  const [pagination, setPagination] = useState({
    current_page: 1,
    per_page: PAGE_SIZE,
    total: 0,
    total_pages: 0
  });
  const navigate = useNavigate();

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
          // 默认位置（北京）
          setUserLocation({
            lat: 39.915,
            lng: 116.404
          });
        }
      );
    }
  }, []);

  useEffect(() => {
    if (userLocation) {
      fetchParkingSpots(1);
    }
  }, [userLocation, sortBy]);

  const fetchParkingSpots = async (page) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: page,
        limit: PAGE_SIZE,
        sort: sortBy,
        order: getSortOrder(sortBy)
      });

      if (sortBy === 'distance' && userLocation) {
        params.append('lat', userLocation.lat);
        params.append('lng', userLocation.lng);
        params.append('radius', 5);
      }

      const url = `${config.API_URL}/parking-spots?${params.toString()}`;
      const response = await fetch(url);
      const data = await response.json();

      if (!data.spots || !Array.isArray(data.spots)) {
        console.error('Invalid data format:', data);
        return;
      }

      const uniqueSpots = Array.from(new Set(data.spots.map(spot => spot.id)))
        .map(id => data.spots.find(spot => spot.id === id));

      // 如果是评分排序，在这里也进行一次排序
      if (sortBy === 'rating') {
        uniqueSpots.sort((a, b) => {
          if (!a.average_rating && !b.average_rating) {
            return calculateDistance(a.coordinates) - calculateDistance(b.coordinates);
          }
          if (!a.average_rating) return 1;
          if (!b.average_rating) return -1;
          return b.average_rating - a.average_rating;
        });
      }

      setParkingSpots(uniqueSpots);
      setPagination(data.pagination || {
        current_page: page,
        per_page: PAGE_SIZE,
        total: uniqueSpots.length,
        total_pages: Math.ceil(uniqueSpots.length / PAGE_SIZE)
      });
    } catch (error) {
      console.error('获取停车位失败:', error);
    } finally {
      setLoading(false);
    }
  };

  const getSortOrder = (sort) => {
    switch (sort) {
      case 'price':
      case 'name':
        return 'ASC';
      case 'distance':
      case 'rating':
        return 'DESC';
      default:
        return 'DESC';
    }
  };

  const handleSortChange = (value) => {
    setSortBy(value);
    if (value === 'rating') {
      // 如果选择按评分排序，对当前数据进行排序
      const sorted = [...parkingSpots].sort((a, b) => {
        // 如果没有评分，则按距离排序
        if (!a.average_rating && !b.average_rating) {
          return calculateDistance(a.coordinates) - calculateDistance(b.coordinates);
        }
        // 如果只有一个有评分，有评分的排在前面
        if (!a.average_rating) return 1;
        if (!b.average_rating) return -1;
        // 都有评分则按评分排序（从高到低）
        return b.average_rating - a.average_rating;
      });
      setParkingSpots(sorted);
    } else {
      // 其他排序方式走原有逻辑
      fetchParkingSpots(1);
    }
  };

  const handlePageChange = (page) => {
    fetchParkingSpots(page);
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

  const handleSearch = (value) => {
    if (value) {
      navigate(`/search?keyword=${encodeURIComponent(value)}&type=${searchType}`);
    }
  };

  return (
    <div className="home-container">
      <div className="home-header">
        <h1 className="home-title">所有停车场</h1>
        <div className="search-section">
          <div className="search-type">
            <Select 
              value={searchType}
              style={{ width: 120 }}
              onChange={value => setSearchType(value)}
            >
              <Option value="name">停车场名称</Option>
              <Option value="address">地址</Option>
              <Option value="price">价格范围</Option>
            </Select>
          </div>
          <Search
            placeholder="搜索停车位信息"
            allowClear
            enterButton="搜索"
            size="large"
            onSearch={handleSearch}
            style={{ width: 400 }}
          />
          <Select
            value={sortBy}
            style={{ minWidth: '160px' }}
            onChange={handleSortChange}
            className="sort-select"
          >
            <Option value="rating">按评分排序</Option>
            <Option value="distance">按距离排序</Option>
            <Option value="price">按价格排序</Option>
            <Option value="name">按名称排序</Option>
            <Option value="created_at">按发布时间</Option>
          </Select>
        </div>
      </div>

      {loading ? (
        <div className="loading-container">
          <Spin size="large" />
        </div>
      ) : (
        <>
          <div className="parking-spots-grid">
            {parkingSpots.map((spot) => (
              <Link to={`/parking/${spot.id}`} key={spot.id} className="parking-link">
                <div className="parking-card">
                  <h2>{spot.location}</h2>
                  <div className="price">¥{spot.price}/小时</div>
                  {spot.coordinates && (
                    <div className="distance">
                      距离: {calculateDistance(spot.coordinates)}km
                    </div>
                  )}
                  <div className="rating">
                    评分: {spot.average_rating ? `${spot.average_rating.toFixed(1)}分` : '暂无评分'}
                  </div>
                  <div className="spot-details">
                    <p>{spot.description}</p>
                    <p>联系方式: {spot.contact}</p>
                    <p>状态: {spot.status === 'available' ? '空闲' : '使用中'}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          {pagination.total_pages > 1 && (
            <div className="pagination">
              <Pagination
                current={pagination.current_page}
                total={pagination.total}
                pageSize={PAGE_SIZE}
                onChange={handlePageChange}
                showSizeChanger={false}
                showQuickJumper
                showTotal={(total) => `共 ${total} 条记录`}
              />
            </div>
          )}
        </>
      )}
    </div>
  );
}

export default Home;