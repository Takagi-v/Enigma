import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import './styles/Home.css';

function Home() {
  const [parkingSpots, setParkingSpots] = useState([]);
  const navigate = useNavigate();
  const username = localStorage.getItem('username');

  useEffect(() => {
    fetchParkingSpots();
  }, []);

  const fetchParkingSpots = async () => {
    try {
      const response = await fetch('http://localhost:3000/parking-spots');
      const data = await response.json();
      setParkingSpots(data);
    } catch (error) {
      console.error('Error fetching parking spots:', error);
    }
  };

  const handlePublish = () => {
    navigate('/publish');
  };

  return (
    <div className="home-container">
      <h1 className="home-title">停车位信息</h1>

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

      <button className="publish-button" onClick={handlePublish}>
        发布停车位
      </button>
    </div>
  );
}

export default Home;