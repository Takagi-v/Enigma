import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './styles/Home.css';
import config from '../config';

function Home() {
  const [parkingSpots, setParkingSpots] = useState([]);
  const [pagination, setPagination] = useState({
    current_page: 1,
    per_page: 10,
    total: 0,
    total_pages: 0
  });
  const navigate = useNavigate();

  useEffect(() => {
    fetchParkingSpots(1);
  }, []);

  const fetchParkingSpots = async (page) => {
    try {
      const response = await fetch(
        `${config.API_URL}/parking-spots?page=${page}&limit=10&sort=created_at&order=DESC`
      );
      const data = await response.json();
      setParkingSpots(data.spots);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Error fetching parking spots:', error);
    }
  };

  const handlePageChange = (page) => {
    fetchParkingSpots(page);
  };

  return (
    <div className="home-container">
      <h1 className="home-title">所有停车场</h1>

      <div className="parking-spots-grid">
        {parkingSpots.map((spot) => (
          <Link to={`/parking/${spot.id}`} key={spot.id} className="parking-link">
            <div className="parking-card">
              <h2>{spot.location}</h2>
              <p className="price">¥{spot.price}/小时</p>
              <div className="spot-details">
                <p>联系人：{spot.contact}</p>
                <p>发布者：{spot.owner_username}</p>
                <p>{spot.description}</p>
              </div>
            </div>
          </Link>
        ))}
      </div>

      {pagination.total_pages > 1 && (
        <div className="pagination">
          {pagination.current_page > 1 && (
            <button 
              onClick={() => handlePageChange(pagination.current_page - 1)}
              className="pagination-button"
            >
              上一页
            </button>
          )}
          <span className="page-info">
            第 {pagination.current_page} 页，共 {pagination.total_pages} 页
          </span>
          {pagination.current_page < pagination.total_pages && (
            <button 
              onClick={() => handlePageChange(pagination.current_page + 1)}
              className="pagination-button"
            >
              下一页
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export default Home;