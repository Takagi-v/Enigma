import React, { useState, useEffect } from 'react';
import { Input, Select, List, Card, Spin } from 'antd';
import { useNavigate, useLocation } from 'react-router-dom';
import { searchParking } from '../services/parkingService';

const { Search } = Input;
const { Option } = Select;

const ParkingSearch = () => {
  const [searchResults, setSearchResults] = useState([]);
  const [searchType, setSearchType] = useState('name');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    // 从 URL 获取搜索关键词
    const searchParams = new URLSearchParams(location.search);
    const keyword = searchParams.get('keyword');
    if (keyword) {
      handleSearch(keyword);
    }
  }, [location.search]);

  const handleSearch = async (value) => {
    setLoading(true);
    setError(null);
    try {
      const results = await searchParking(searchType, value);
      setSearchResults(results);
    } catch (error) {
      console.error('搜索出错：', error);
      setError('搜索过程中发生错误，请稍后重试');
    } finally {
      setLoading(false);
    }
  };

  const handleParkingClick = (parkingId) => {
    navigate(`/parking/${parkingId}`);
  };

  return (
    <div className="search-container">
      <div className="search-header">
        <Select 
          defaultValue="name" 
          style={{ width: 120 }} 
          onChange={value => setSearchType(value)}
        >
          <Option value="name">停车场名称</Option>
          <Option value="address">地址</Option>
          <Option value="price">价格</Option>
          <Option value="availability">空位状态</Option>
        </Select>
        <Search
          placeholder="请输入搜索关键词"
          allowClear
          enterButton="搜索"
          size="large"
          onSearch={handleSearch}
          style={{ width: 400, marginLeft: 10 }}
          loading={loading}
        />
      </div>

      {error && (
        <div className="error-message" style={{ color: 'red', margin: '10px 0' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div className="loading-spinner">
          <Spin size="large" />
        </div>
      ) : (
        <List
          grid={{ gutter: 16, column: 3 }}
          dataSource={searchResults}
          renderItem={item => (
            <List.Item onClick={() => handleParkingClick(item.id)}>
              <Card 
                hoverable
                title={item.name}
                style={{ marginTop: 16 }}
              >
                <p>地址：{item.address}</p>
                <p>价格：¥{item.price}/小时</p>
                <p>可用车位：{item.availableSpots}</p>
              </Card>
            </List.Item>
          )}
        />
      )}
    </div>
  );
};

export default ParkingSearch; 