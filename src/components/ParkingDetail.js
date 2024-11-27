import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import './styles/ParkingDetail.css';
import Map from './Map';

function ParkingDetail() {
  const { id } = useParams();
  const [parkingSpot, setParkingSpot] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchParkingDetail = async () => {
      try {
        setIsLoading(true);
        const response = await fetch(`http://localhost:3000/parking-spots/${id}`);
        if (!response.ok) throw new Error('获取停车位详情失败');
        const data = await response.json();
        setParkingSpot(data);
      } catch (err) {
        setError(err.message);
      } finally {
        setIsLoading(false);
        setLoading(false);
      }
    };

    fetchParkingDetail();
  }, [id]);

  if (isLoading) return <div className="loading">加载中...</div>;
  if (error) return <div className="error">{error}</div>;
  if (!parkingSpot) return <div className="error">信息不存在</div>;

  return (
    <div className="parking-detail-container">
      <Link to="/" className="back-button">返回首页</Link>
      
      <div className="parking-detail">
        <h1>{parkingSpot.location}</h1>
        
        <div className="detail-content">
          <div className="info-section">
            <div className="price-section">
              <h2 className="price">¥{parkingSpot.price}/小时</h2>
            </div>
            
            <div className="info-items">
              <div className="info-item">
                <label>联系人：</label>
                <span>{parkingSpot.contact}</span>
              </div>
              <div className="info-item">
                <label>发布者：</label>
                <span>{parkingSpot.owner_username}</span>
              </div>
              <div className="info-item">
                <label>发布时间：</label>
                <span>{new Date(parkingSpot.created_at).toLocaleString()}</span>
              </div>
            </div>

            <div className="description-section">
              <h3>详细描述</h3>
              <p>{parkingSpot.description || '暂无描述'}</p>
            </div>
          </div>

          <div className="map-section">
            <h3>位置信息</h3>
            <div className="map-container">
              <Map 
                mode="detail"
                initialSpot={{
                  location: parkingSpot.location,
                  coordinates: parkingSpot.coordinates,
                  price: parkingSpot.price,
                  contact: parkingSpot.contact
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default ParkingDetail; 