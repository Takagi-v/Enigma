import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/ModernAdmin.css';
import config from '../../config';
import ParkingLockControl from './ParkingLockControl';

const AdminDashboard = () => {
  const [activeTab, setActiveTab] = useState('overview');
  const [users, setUsers] = useState([]);
  const [parkingSpots, setParkingSpots] = useState([]);
  const [editingSpot, setEditingSpot] = useState(null);
  const [error, setError] = useState('');
  const [editFormData, setEditFormData] = useState({});
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
      } else if (activeTab === 'parking') {
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
        
        fetchData();
      } catch (error) {
        console.error('删除用户失败:', error);
        setError(error.message);
      }
    }
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
        
        fetchData();
      } catch (error) {
        console.error('删除停车位失败:', error);
        setError(error.message);
      }
    }
  };


  const handleLogout = () => {
    localStorage.removeItem('adminToken');
    navigate('/admin/login');
  };

  const handleEditSpot = (spot) => {
    setEditingSpot(spot);
    setEditFormData({
      location: spot.location,
      price: spot.price,
      status: spot.status,
      description: spot.description || '',
      coordinates: spot.coordinates || '',
      lock_serial_number: spot.lock_serial_number || ''
    });
  };

  const handleSaveSpot = async () => {
    try {
      const response = await fetch(`${config.API_URL}/admin/parking-spots/${editingSpot.id}`, {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('adminToken')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(editFormData)
      });

      if (response.ok) {
        setEditingSpot(null);
        setEditFormData({});
        fetchData();
        setError('');
      } else {
        const data = await response.json();
        setError(data.message || '更新停车位失败');
      }
    } catch (error) {
      console.error('更新停车位失败:', error);
      setError('更新停车位失败，请稍后重试');
    }
  };

  // 统计数据
  const totalUsers = users.length;
  const totalSpots = parkingSpots.length;
  const availableSpots = parkingSpots.filter(spot => spot.status === 'available').length;
  const occupiedSpots = parkingSpots.filter(spot => spot.status === 'occupied').length;

  return (
    <div className="admin-dashboard-layout">
      {/* 侧边栏导航 */}
      <aside className="admin-sidebar">
        <div className="sidebar-brand">
          <div className="brand-icon">🅿️</div>
          <div className="brand-text">
            <h2>GoParkMe</h2>
            <span>管理控制台</span>
          </div>
        </div>
        
        <nav className="sidebar-nav">
          <div className="nav-section">
            <h3>管理功能</h3>
            <ul>
              <li>
                <button 
                  onClick={() => setActiveTab('overview')} 
                  className={`nav-link ${activeTab === 'overview' ? 'active' : ''}`}
                >
                  <span className="nav-icon">📊</span>
                  <span className="nav-text">数据概览</span>
                </button>
              </li>
              <li>
                <button 
                  onClick={() => setActiveTab('users')} 
                  className={`nav-link ${activeTab === 'users' ? 'active' : ''}`}
                >
                  <span className="nav-icon">👥</span>
                  <span className="nav-text">用户管理</span>
                  <span className="nav-badge">{totalUsers}</span>
                </button>
              </li>
              <li>
                <button 
                  onClick={() => setActiveTab('parking')} 
                  className={`nav-link ${activeTab === 'parking' ? 'active' : ''}`}
                >
                  <span className="nav-icon">🅿️</span>
                  <span className="nav-text">停车位管理</span>
                  <span className="nav-badge">{totalSpots}</span>
                </button>
              </li>
              <li>
                <button 
                  onClick={() => setActiveTab('locks')} 
                  className={`nav-link ${activeTab === 'locks' ? 'active' : ''}`}
                >
                  <span className="nav-icon">🔒</span>
                  <span className="nav-text">地锁控制</span>
                </button>
              </li>
            </ul>
          </div>
          
          <div className="nav-section">
            <h3>系统功能</h3>
            <ul>
              <li>
                <button 
                  onClick={() => navigate('/admin/add-parking')} 
                  className="nav-link"
                >
                  <span className="nav-icon">➕</span>
                  <span className="nav-text">添加停车位</span>
                </button>
              </li>
            </ul>
          </div>
        </nav>
        
        <div className="sidebar-footer">
          <div className="admin-profile">
            <div className="profile-avatar">A</div>
            <div className="profile-info">
              <span className="profile-name">管理员</span>
              <span className="profile-role">系统管理员</span>
            </div>
          </div>
          <button onClick={handleLogout} className="logout-button" title="退出登录">
            <span className="logout-icon">🚪</span>
            <span>退出</span>
          </button>
        </div>
      </aside>

      {/* 主内容区域 */}
      <main className="admin-main">
        {/* 页面标题栏 */}
        <header className="page-header">
          <div className="header-left">
            <h1 className="page-title">
              {activeTab === 'overview' ? '📊 数据概览' : 
               activeTab === 'users' ? '👥 用户管理' : 
               activeTab === 'parking' ? '🅿️ 停车位管理' : 
               activeTab === 'locks' ? '🔒 地锁控制' : '管理仪表板'}
            </h1>
            <p className="page-subtitle">
              {activeTab === 'overview' ? '查看系统整体运营数据' : 
               activeTab === 'users' ? `管理系统用户 · 共 ${totalUsers} 个用户` : 
               activeTab === 'parking' ? `管理停车位信息 · 共 ${totalSpots} 个停车位` : 
               activeTab === 'locks' ? '控制停车位地锁设备' : ''}
            </p>
          </div>
          <div className="header-right">
            <div className="quick-stats">
              <div className="quick-stat">
                <span className="stat-value">{availableSpots}</span>
                <span className="stat-label">可用</span>
              </div>
              <div className="quick-stat">
                <span className="stat-value">{occupiedSpots}</span>
                <span className="stat-label">占用</span>
              </div>
            </div>
          </div>
        </header>

        {/* 错误提示 */}
        {error && (
          <div className="alert alert-error">
            <span className="alert-icon">⚠️</span>
            <span className="alert-message">{error}</span>
          </div>
        )}

        {/* 数据概览页面 */}
        {activeTab === 'overview' && (
          <div className="dashboard-content">
            {/* KPI 卡片网格 */}
            <div className="kpi-grid">
              <div className="kpi-card primary">
                <div className="kpi-header">
                  <div className="kpi-icon">👥</div>
                  <div className="kpi-trend up">↗</div>
                </div>
                <div className="kpi-body">
                  <div className="kpi-value">{totalUsers}</div>
                  <div className="kpi-label">注册用户</div>
                  <div className="kpi-desc">系统总用户数</div>
                </div>
              </div>
              
              <div className="kpi-card success">
                <div className="kpi-header">
                  <div className="kpi-icon">🅿️</div>
                  <div className="kpi-trend up">↗</div>
                </div>
                <div className="kpi-body">
                  <div className="kpi-value">{totalSpots}</div>
                  <div className="kpi-label">停车位</div>
                  <div className="kpi-desc">已添加的停车位</div>
                </div>
              </div>
              
              <div className="kpi-card warning">
                <div className="kpi-header">
                  <div className="kpi-icon">🟢</div>
                  <div className="kpi-trend stable">→</div>
                </div>
                <div className="kpi-body">
                  <div className="kpi-value">{availableSpots}</div>
                  <div className="kpi-label">可用车位</div>
                  <div className="kpi-desc">当前可预订车位</div>
                </div>
              </div>
              
              <div className="kpi-card danger">
                <div className="kpi-header">
                  <div className="kpi-icon">🚗</div>
                  <div className="kpi-trend down">↘</div>
                </div>
                <div className="kpi-body">
                  <div className="kpi-value">{occupiedSpots}</div>
                  <div className="kpi-label">占用车位</div>
                  <div className="kpi-desc">正在使用的车位</div>
                </div>
              </div>
            </div>

            {/* 使用率展示 */}
            <div className="content-grid">
              <div className="content-card">
                <div className="card-header">
                  <h3 className="card-title">车位使用率</h3>
                  <div className="card-actions">
                    <button className="btn btn-outline btn-sm">详细</button>
                  </div>
                </div>
                <div className="card-body">
                  <div className="usage-chart">
                    <div className="usage-bar">
                      <div 
                        className="usage-fill available" 
                        style={{width: `${totalSpots > 0 ? (availableSpots / totalSpots) * 100 : 0}%`}}
                      ></div>
                      <div 
                        className="usage-fill occupied" 
                        style={{width: `${totalSpots > 0 ? (occupiedSpots / totalSpots) * 100 : 0}%`}}
                      ></div>
                    </div>
                    <div className="usage-legend">
                      <div className="legend-item">
                        <span className="legend-dot available"></span>
                        <span>可用 ({availableSpots})</span>
                      </div>
                      <div className="legend-item">
                        <span className="legend-dot occupied"></span>
                        <span>占用 ({occupiedSpots})</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="content-card">
                <div className="card-header">
                  <h3 className="card-title">快速操作</h3>
                </div>
                <div className="card-body">
                  <div className="quick-actions">
                    <button 
                      onClick={() => setActiveTab('users')} 
                      className="quick-action-btn"
                    >
                      <span className="action-icon">👥</span>
                      <span className="action-text">管理用户</span>
                      <span className="action-arrow">→</span>
                    </button>
                    <button 
                      onClick={() => setActiveTab('parking')} 
                      className="quick-action-btn"
                    >
                      <span className="action-icon">🅿️</span>
                      <span className="action-text">管理停车位</span>
                      <span className="action-arrow">→</span>
                    </button>
                    <button 
                      onClick={() => navigate('/admin/add-parking')} 
                      className="quick-action-btn primary"
                    >
                      <span className="action-icon">➕</span>
                      <span className="action-text">添加停车位</span>
                      <span className="action-arrow">→</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 用户管理页面 */}
        {activeTab === 'users' && (
          <div className="dashboard-content">
            <div className="content-card full-width">
              <div className="card-header">
                <h3 className="card-title">用户列表</h3>
                <div className="card-actions">
                  <div className="search-box">
                    <span className="search-icon">🔍</span>
                    <input 
                      type="text" 
                      placeholder="搜索用户..." 
                      className="search-input"
                    />
                  </div>
                </div>
              </div>
              <div className="card-body no-padding">
                <div className="data-table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>用户</th>
                        <th>联系信息</th>
                        <th>车辆信息</th>
                        <th>余额</th>
                        <th>注册时间</th>
                        <th className="actions-col">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {users.map(user => (
                        <tr key={user.id}>
                          <td>
                            <div className="user-cell">
                              <div className="user-avatar-sm">
                                {user.username.charAt(0).toUpperCase()}
                              </div>
                              <div className="user-info">
                                <div className="user-name">{user.username}</div>
                                <div className="user-id">#{user.id}</div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <div className="contact-info">
                              <div>{user.email || '—'}</div>
                              <div className="phone">{user.phone || '—'}</div>
                            </div>
                          </td>
                          <td>
                            <div className="vehicle-info">
                              {user.vehicle_plate ? (
                                <span className="vehicle-plate">{user.vehicle_plate}</span>
                              ) : (
                                <span className="no-data">未设置</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <span className={`balance ${user.balance > 0 ? 'positive' : 'zero'}`}>
                              ¥{user.balance || 0}
                            </span>
                          </td>
                          <td>
                            <span className="date-text">
                              {user.created_at ? new Date(user.created_at).toLocaleDateString() : '—'}
                            </span>
                          </td>
                          <td>
                            <div className="action-buttons">
                              <button 
                                className="btn btn-sm btn-outline"
                                title="编辑用户"
                              >
                                ✏️
                              </button>
                              <button 
                                className="btn btn-sm btn-danger"
                                onClick={() => handleDeleteUser(user.id)}
                                title="删除用户"
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 停车位管理页面 */}
        {activeTab === 'parking' && (
          <div className="dashboard-content">
            <div className="content-card full-width">
              <div className="card-header">
                <h3 className="card-title">停车位列表</h3>
                <div className="card-actions">
                  <div className="filter-group">
                    <select className="filter-select">
                      <option value="">全部状态</option>
                      <option value="available">可用</option>
                      <option value="occupied">占用</option>
                      <option value="unavailable">不可用</option>
                    </select>
                  </div>
                  <button 
                    className="btn btn-primary"
                    onClick={() => navigate('/admin/add-parking')}
                  >
                    ➕ 添加停车位
                  </button>
                </div>
              </div>
              <div className="card-body no-padding">
                <div className="data-table-container">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>停车位</th>
                        <th>位置</th>
                        <th>价格</th>
                        <th>状态</th>
                        <th>地锁</th>
                        <th className="actions-col">操作</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parkingSpots.map(spot => (
                        <tr key={spot.id}>
                          <td>
                            <div className="spot-cell">
                              <div className="spot-id">#{spot.id}</div>
                              <div className="spot-owner">车主: {spot.owner_username}</div>
                            </div>
                          </td>
                          <td>
                            <div className="location-info">
                              <div className="address">{spot.location}</div>
                              {spot.coordinates && (
                                <div className="coordinates">📍 {spot.coordinates}</div>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="price-info">
                              <div className="hourly-rate">¥{spot.price}/时</div>
                              {spot.hourly_rate && spot.hourly_rate !== spot.price && (
                                <div className="alt-rate">备用: ¥{spot.hourly_rate}/时</div>
                              )}
                            </div>
                          </td>
                          <td>
                            <span className={`status-badge status-${spot.status}`}>
                              {spot.status === 'available' ? '✅ 可用' : 
                               spot.status === 'occupied' ? '🚗 占用' : 
                               '❌ 不可用'}
                            </span>
                          </td>
                          <td>
                            <div className="lock-info">
                              {spot.lock_serial_number ? (
                                <span className="lock-serial">🔒 {spot.lock_serial_number}</span>
                              ) : (
                                <span className="no-lock">无地锁</span>
                              )}
                            </div>
                          </td>
                          <td>
                            <div className="action-buttons">
                              <button 
                                className="btn btn-sm btn-outline"
                                onClick={() => handleEditSpot(spot)}
                                title="编辑停车位"
                              >
                                ✏️
                              </button>
                              {spot.lock_serial_number && (
                                <button 
                                  className="btn btn-sm btn-warning"
                                  title="控制地锁"
                                >
                                  🔒
                                </button>
                              )}
                              <button 
                                className="btn btn-sm btn-danger"
                                onClick={() => handleDeleteSpot(spot.id)}
                                title="删除停车位"
                              >
                                🗑️
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 地锁控制页面 */}
        {activeTab === 'locks' && (
          <div className="dashboard-content">
            <ParkingLockControl />
          </div>
        )}
      </main>

      {/* 编辑停车位弹窗 */}
      {editingSpot && (
        <div className="modal-overlay" onClick={() => setEditingSpot(null)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>编辑停车位</h3>
              <button 
                className="modal-close"
                onClick={() => setEditingSpot(null)}
              >
                ✕
              </button>
            </div>
            <div className="modal-body">
              <form className="edit-form">
                <div className="form-group">
                  <label className="form-label">停车位位置</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editFormData.location || ''}
                    onChange={(e) => setEditFormData({...editFormData, location: e.target.value})}
                    placeholder="请输入停车位位置"
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">价格 (¥/时)</label>
                    <input
                      type="number"
                      className="form-input"
                      value={editFormData.price || ''}
                      onChange={(e) => setEditFormData({...editFormData, price: parseFloat(e.target.value)})}
                      placeholder="10.0"
                      step="0.1"
                    />
                  </div>

                  <div className="form-group">
                    <label className="form-label">状态</label>
                    <select
                      className="form-select"
                      value={editFormData.status || 'available'}
                      onChange={(e) => setEditFormData({...editFormData, status: e.target.value})}
                    >
                      <option value="available">可用</option>
                      <option value="occupied">占用</option>
                      <option value="unavailable">不可用</option>
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">描述信息</label>
                  <textarea
                    className="form-textarea"
                    value={editFormData.description || ''}
                    onChange={(e) => setEditFormData({...editFormData, description: e.target.value})}
                    placeholder="停车位详细描述..."
                    rows="3"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">坐标位置</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editFormData.coordinates || ''}
                    onChange={(e) => setEditFormData({...editFormData, coordinates: e.target.value})}
                    placeholder="纬度,经度 (例: 31.2304,121.4737)"
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">地锁序列号</label>
                  <input
                    type="text"
                    className="form-input"
                    value={editFormData.lock_serial_number || ''}
                    onChange={(e) => setEditFormData({...editFormData, lock_serial_number: e.target.value})}
                    placeholder="输入地锁序列号绑定地锁设备"
                  />
                  <small className="form-help">
                    输入地锁序列号可将停车位与地锁设备绑定，留空则解除绑定
                  </small>
                </div>
              </form>
            </div>
            <div className="modal-footer">
              <button 
                className="btn btn-outline"
                onClick={() => {
                  setEditingSpot(null);
                  setEditFormData({});
                }}
              >
                取消
              </button>
              <button 
                className="btn btn-primary"
                onClick={handleSaveSpot}
              >
                保存更新
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminDashboard;
