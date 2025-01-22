import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/AdminDashboard.css';
import config from '../../config';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [parkingSpots, setParkingSpots] = useState([]);
  const [editingSpot, setEditingSpot] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (!localStorage.getItem('adminToken')) {
      navigate('/admin/login');
      return;
    }
    fetchData();
  }, [navigate]);

  const fetchData = async () => {
    try {
      if (activeTab === 'users') {
        const response = await fetch(`${config.API_URL}/admin/users`);
        const data = await response.json();
        console.log('获取到的用户数据:', data);
        setUsers(data);
      } else {
        const response = await fetch(`${config.API_URL}/admin/parking-spots`);
        const data = await response.json();
        console.log('获取到的停车位数据:', data);
        setParkingSpots(data);
      }
    } catch (error) {
      console.error('获取数据失败:', error);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const handleDeleteUser = async (id) => {
    if (window.confirm('确定要删除该用户吗？')) {
      try {
        const response = await fetch(`${config.API_URL}/admin/users/${id}`, {
          method: 'DELETE',
        });
        if (response.ok) {
          setUsers(users.filter(user => user.id !== id));
        }
      } catch (error) {
        console.error('删除用户失败:', error);
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    navigate('/admin/login');
  };

  const handleDeleteSpot = async (id) => {
    if (window.confirm('确定要删除该停车位吗？')) {
      try {
        const response = await fetch(`${config.API_URL}/admin/parking-spots/${id}`, {
          method: 'DELETE',
        });
        if (response.ok) {
          setParkingSpots(parkingSpots.filter(spot => spot.id !== id));
        }
      } catch (error) {
        console.error('删除停车位失败:', error);
      }
    }
  };

  const handleEditSpot = (spot) => {
    setEditingSpot({
      ...spot,
      price: Number(spot.price)
    });
  };

  const handleUpdateSpot = async (e) => {
    e.preventDefault();
    try {
      const response = await fetch(`${config.API_URL}/admin/parking-spots/${editingSpot.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          location: editingSpot.location,
          price: editingSpot.price,
          status: editingSpot.status,
          description: editingSpot.description
        }),
      });

      if (response.ok) {
        const updatedSpots = parkingSpots.map(spot => 
          spot.id === editingSpot.id ? { ...spot, ...editingSpot } : spot
        );
        setParkingSpots(updatedSpots);
        setEditingSpot(null);
      }
    } catch (error) {
      console.error('更新停车位失败:', error);
    }
  };

  return (
    <div className="admin-dashboard">
      <header className="admin-header">
        <h1>管理员控制台</h1>
        <button onClick={handleLogout}>退出登录</button>
      </header>
      
      <div className="admin-tabs">
        <button 
          className={activeTab === 'users' ? 'active' : ''} 
          onClick={() => setActiveTab('users')}
        >
          用户管理
        </button>
        <button 
          className={activeTab === 'parking' ? 'active' : ''} 
          onClick={() => setActiveTab('parking')}
        >
          停车位管理
        </button>
      </div>

      <div className="admin-content">
        {activeTab === 'users' ? (
          <div className="users-table">
            {users.length === 0 ? (
              <p>暂无用户数据</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>用户名</th>
                    <th>姓名</th>
                    <th>电话</th>
                    <th>注册时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map(user => (
                    <tr key={user.id}>
                      <td>{user.id}</td>
                      <td>{user.username}</td>
                      <td>{user.full_name}</td>
                      <td>{user.phone}</td>
                      <td>{new Date(user.created_at).toLocaleString()}</td>
                      <td>
                        <button onClick={() => handleDeleteUser(user.id)}>删除</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div className="parking-spots-table">
            {editingSpot && (
              <div className="edit-form-overlay">
                <form className="edit-form" onSubmit={handleUpdateSpot}>
                  <h3>编辑停车位</h3>
                  <div className="form-group">
                    <label>位置:</label>
                    <input
                      type="text"
                      value={editingSpot.location}
                      onChange={(e) => setEditingSpot({...editingSpot, location: e.target.value})}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>价格:</label>
                    <input
                      type="number"
                      value={editingSpot.price}
                      onChange={(e) => setEditingSpot({...editingSpot, price: Number(e.target.value)})}
                      required
                    />
                  </div>
                  <div className="form-group">
                    <label>状态:</label>
                    <select
                      value={editingSpot.status || 'available'}
                      onChange={(e) => setEditingSpot({...editingSpot, status: e.target.value})}
                    >
                      <option value="available">可用</option>
                      <option value="occupied">已占用</option>
                      <option value="maintenance">维护中</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>描述:</label>
                    <textarea
                      value={editingSpot.description || ''}
                      onChange={(e) => setEditingSpot({...editingSpot, description: e.target.value})}
                    />
                  </div>
                  <div className="form-buttons">
                    <button type="submit">保存</button>
                    <button type="button" onClick={() => setEditingSpot(null)}>取消</button>
                  </div>
                </form>
              </div>
            )}
            {parkingSpots.length === 0 ? (
              <p>暂无停车位数据</p>
            ) : (
              <table>
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>位置</th>
                    <th>价格</th>
                    <th>状态</th>
                    <th>所有者</th>
                    <th>联系方式</th>
                    <th>创建时间</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {parkingSpots.map(spot => (
                    <tr key={spot.id}>
                      <td>{spot.id}</td>
                      <td>{spot.location}</td>
                      <td>¥{spot.price}</td>
                      <td>{spot.status || '可用'}</td>
                      <td>{spot.owner_full_name || spot.owner_username}</td>
                      <td>{spot.contact}</td>
                      <td>{new Date(spot.created_at).toLocaleString()}</td>
                      <td>
                        <button onClick={() => handleEditSpot(spot)}>编辑</button>
                        <button onClick={() => handleDeleteSpot(spot.id)}>删除</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminDashboard; 