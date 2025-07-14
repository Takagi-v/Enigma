import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/AdminDashboard.css';
import config from '../../config';
import ParkingLockControl from './ParkingLockControl';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('users');
  const [users, setUsers] = useState([]);
  const [parkingSpots, setParkingSpots] = useState([]);
  const [editingSpot, setEditingSpot] = useState(null);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    const adminToken = localStorage.getItem('adminToken');
    if (!adminToken) {
      navigate('/admin/login');
      return;
    }
    try {
      // 验证token是否有效
      const tokenData = JSON.parse(atob(adminToken.split('.')[1]));
      if (tokenData.exp * 1000 < Date.now()) {
        handleLogout();
        return;
      }
    } catch (error) {
      handleLogout();
      return;
    }
    fetchData();
  }, [navigate]);

  const fetchData = async () => {
    try {
      setError('');
      const headers = {
        'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
        'Content-Type': 'application/json'
      };

      if (activeTab === 'users') {
        const response = await fetch(`${config.API_URL}/admin/users`, {
          headers
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            handleLogout();
            return;
          }
          throw new Error(data.message || '获取用户数据失败');
        }
        
        setUsers(data);
      } else {
        const response = await fetch(`${config.API_URL}/admin/parking-spots`, {
          headers
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            handleLogout();
            return;
          }
          throw new Error(data.message || '获取停车位数据失败');
        }
        
        setParkingSpots(data);
      }
    } catch (error) {
      console.error('获取数据失败:', error);
      setError(error.message);
    }
  };

  useEffect(() => {
    fetchData();
  }, [activeTab]);

  const handleDeleteUser = async (id) => {
    if (window.confirm('确定要删除该用户吗？')) {
      try {
        setError('');
        const response = await fetch(`${config.API_URL}/admin/users/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          }
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            handleLogout();
            return;
          }
          throw new Error(data.message || '删除用户失败');
        }
        
        setUsers(users.filter(user => user.id !== id));
      } catch (error) {
        console.error('删除用户失败:', error);
        setError(error.message);
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
        setError('');
        const response = await fetch(`${config.API_URL}/admin/parking-spots/${id}`, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          }
        });
        
        const data = await response.json();
        
        if (!response.ok) {
          if (response.status === 401 || response.status === 403) {
            handleLogout();
            return;
          }
          throw new Error(data.message || '删除停车位失败');
        }
        
        setParkingSpots(parkingSpots.filter(spot => spot.id !== id));
      } catch (error) {
        console.error('删除停车位失败:', error);
        setError(error.message);
      }
    }
  };

  const handleEditSpot = (spot) => {
    setEditingSpot({
      ...spot,
      price: Number(spot.price),
      lock_serial_number: spot.lock_serial_number || ''
    });
  };

  const handleUpdateSpot = async (e) => {
    e.preventDefault();
    try {
      setError('');
      const response = await fetch(`${config.API_URL}/admin/parking-spots/${editingSpot.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          location: editingSpot.location,
          price: parseFloat(editingSpot.price) || 0,
          status: editingSpot.status,
          description: editingSpot.description,
          hourly_rate: parseFloat(editingSpot.hourly_rate) || 0,
          contact: editingSpot.contact,
          opening_hours: editingSpot.opening_hours,
          lock_serial_number: editingSpot.lock_serial_number
        }),
      });

      const data = await response.json();
      
      if (!response.ok) {
        if (response.status === 401 || response.status === 403) {
          handleLogout();
          return;
        }
        throw new Error(data.message || '更新停车位失败');
      }

      const updatedSpots = parkingSpots.map(spot => 
        spot.id === editingSpot.id ? { ...spot, ...editingSpot } : spot
      );
      setParkingSpots(updatedSpots);
      setEditingSpot(null);
    } catch (error) {
      console.error('更新停车位失败:', error);
      setError(error.message);
    }
  };

  const getStatusText = (status) => {
    const statusMap = {
      'available': '可用',
      'occupied': '已占用',
      'maintenance': '维护中'
    };
    return statusMap[status] || status;
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
        <button 
          className={activeTab === 'parking-lock' ? 'active' : ''} 
          onClick={() => setActiveTab('parking-lock')}
        >
          地锁控制
        </button>
      </div>

      <div className="admin-content">
        {error && <div className="error-message">{error}</div>}
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
        ) : activeTab === 'parking' ? (
          <div className="parking-spots-table">
            {editingSpot && (
              <div className="edit-form-overlay">
                <form onSubmit={handleUpdateSpot} className="edit-spot-form">
                  <label>位置: <input type="text" value={editingSpot.location} onChange={e => setEditingSpot({...editingSpot, location: e.target.value})} /></label>
                  <label>价格: <input type="number" value={editingSpot.price} onChange={e => setEditingSpot({...editingSpot, price: e.target.value})} /></label>
                  <label>每小时费率: <input type="number" value={editingSpot.hourly_rate} onChange={e => setEditingSpot({...editingSpot, hourly_rate: e.target.value})} /></label>
                  <label>联系方式: <input type="text" value={editingSpot.contact} onChange={e => setEditingSpot({...editingSpot, contact: e.target.value})} /></label>
                  <label>开放时间: <input type="text" value={editingSpot.opening_hours} onChange={e => setEditingSpot({...editingSpot, opening_hours: e.target.value})} /></label>
                  <label>地锁序列号: <input type="text" value={editingSpot.lock_serial_number} onChange={e => setEditingSpot({...editingSpot, lock_serial_number: e.target.value})} /></label>
                  <label>状态: 
                    <select value={editingSpot.status} onChange={e => setEditingSpot({...editingSpot, status: e.target.value})}>
                      <option value="available">可用</option>
                      <option value="occupied">已占用</option>
                      <option value="maintenance">维护中</option>
                    </select>
                  </label>
                  <label>描述: <textarea value={editingSpot.description} onChange={e => setEditingSpot({...editingSpot, description: e.target.value})} /></label>
                  <button type="submit">更新</button>
                    <button type="button" onClick={() => setEditingSpot(null)}>取消</button>
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
                      <td>{getStatusText(spot.status)}</td>
                      <td>{spot.owner_full_name || spot.owner_username || '无'}</td>
                      <td>{spot.contact || '无'}</td>
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
        ) : (
          <ParkingLockControl />
        )}
      </div>
    </div>
  );
};

export default AdminDashboard; 