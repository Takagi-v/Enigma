 
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import '../styles/ModernAdmin.css';

const AddParkingSpot = () => {
    const { user } = useAuth();
    const [formData, setFormData] = useState({
        owner_username: user ? user.username : '',
        location: '',
        price: '',
        description: '',
        status: 'available',
        opening_hours: '00:00-23:59',
        lock_serial_number: '',
        coordinates: ''
    });
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');
    const navigate = useNavigate();

    const handleChange = (e) => {
        const { name, value } = e.target;
        setFormData(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        if (!user) {
            setError('您需要登录才能添加停车位。');
            return;
        }

        try {
            // 在formData中强制设置owner_username
            const dataToSend = { ...formData, owner_username: user.username };
            const response = await fetch(`${window.location.origin.replace(/:\d+$/, '')}${process.env.REACT_APP_API_PATH || ''}/admin/parking-spots`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('adminToken')}`
                },
                body: JSON.stringify(dataToSend)
            });
            if (!response.ok) {
                const data = await response.json();
                throw new Error(data.message || '添加失败');
            }
            setSuccess('停车位添加成功！');
            setFormData({
                owner_username: user.username,
                location: '',
                price: '',
                description: '',
                status: 'available',
                opening_hours: '00:00-23:59',
                lock_serial_number: '',
                coordinates: ''
            });
            // 可选：短暂延迟后重定向
            setTimeout(() => {
                navigate('/admin/dashboard'); 
            }, 1500);
        } catch (err) {
            setError(err.response?.data?.message || '添加停车位失败，请稍后再试。');
        }
    };
    
    return (
        <div style={{
            minHeight: '100vh',
            background: 'var(--bg-secondary)',
            padding: 'var(--spacing-lg)'
        }}>
            {/* 顶部导航 */}
            <div style={{
                maxWidth: '800px',
                margin: '0 auto',
                marginBottom: 'var(--spacing-xl)'
            }}>
                <button 
                    onClick={() => navigate('/admin/dashboard')}
                    className="btn btn-outline"
                    style={{marginBottom: 'var(--spacing-lg)'}}
                >
                    ← 返回管理页面
                </button>
                
                <div className="admin-content-card">
                    <div className="card-header">
                        <h1 className="card-title">➕ 添加新停车位</h1>
                        <p style={{color: 'var(--text-secondary)', margin: 0}}>
                            填写以下信息来创建新的停车位
                        </p>
                    </div>
                    
                    <div className="card-content">
                        {/* 消息提示 */}
                        {error && (
                            <div className="alert alert-error">
                                ⚠️ {error}
                            </div>
                        )}
                        
                        {success && (
                            <div className="alert alert-success">
                                ✅ {success}
                            </div>
                        )}
                        
                        {/* 表单 */}
                        <form onSubmit={handleSubmit} className="modern-form">
                            {/* 基本信息 */}
                            <div style={{
                                marginBottom: 'var(--spacing-xl)',
                                paddingBottom: 'var(--spacing-lg)',
                                borderBottom: '2px solid var(--border-light)'
                            }}>
                                <h3 style={{
                                    color: 'var(--text-primary)',
                                    marginBottom: 'var(--spacing-lg)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 'var(--spacing-sm)'
                                }}>
                                    📍 基本信息
                                </h3>
                                
                                <div style={{display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 'var(--spacing-lg)'}}>
                                    <div className="form-group">
                                        <label className="form-label">📍 停车位位置</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            name="location"
                                            value={formData.location}
                                            onChange={handleChange}
                                            placeholder="例: 北京市朝阳区三里屯路12号"
                                            required
                                        />
                                    </div>
                                    
                                    <div className="form-group">
                                        <label className="form-label">💰 每小时价格 (元)</label>
                                        <input
                                            type="number"
                                            className="form-input"
                                            name="price"
                                            value={formData.price}
                                            onChange={handleChange}
                                            placeholder="10"
                                            min="0"
                                            step="0.1"
                                            required
                                        />
                                    </div>
                                </div>
                                
                                <div className="form-group">
                                    <label className="form-label">🗺️ GPS坐标 (经度,纬度)</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        name="coordinates"
                                        value={formData.coordinates}
                                        onChange={handleChange}
                                        placeholder="例: 116.4074,39.9042"
                                        required
                                    />
                                    <p style={{fontSize: '12px', color: 'var(--text-secondary)', marginTop: '4px'}}>
                                        💡 提示: 可以从谷歌地图中获取精确坐标
                                    </p>
                                </div>
                                
                                <div className="form-group">
                                    <label className="form-label">📝 停车位描述 (可选)</label>
                                    <textarea
                                        className="form-textarea"
                                        name="description"
                                        value={formData.description}
                                        onChange={handleChange}
                                        placeholder="描述停车位的特殊信息，如“靠近地铁站”、“有盖停车位”等"
                                        rows={3}
                                    />
                                </div>
                            </div>
                            
                            {/* 运营设置 */}
                            <div style={{
                                marginBottom: 'var(--spacing-xl)',
                                paddingBottom: 'var(--spacing-lg)',
                                borderBottom: '2px solid var(--border-light)'
                            }}>
                                <h3 style={{
                                    color: 'var(--text-primary)',
                                    marginBottom: 'var(--spacing-lg)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 'var(--spacing-sm)'
                                }}>
                                    ⚙️ 运营设置
                                </h3>
                                
                                <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--spacing-lg)'}}>
                                    <div className="form-group">
                                        <label className="form-label">🔄 初始状态</label>
                                        <select
                                            className="form-select"
                                            name="status"
                                            value={formData.status}
                                            onChange={handleChange}
                                        >
                                            <option value="available">✅ 可用</option>
                                            <option value="occupied">🚗 已占用</option>
                                            <option value="unavailable">⚠️ 不可用</option>
                                        </select>
                                    </div>
                                    
                                    <div className="form-group">
                                        <label className="form-label">🕰️ 开放时间</label>
                                        <input
                                            type="text"
                                            className="form-input"
                                            name="opening_hours"
                                            value={formData.opening_hours}
                                            onChange={handleChange}
                                            placeholder="08:00-22:00"
                                        />
                                    </div>
                                </div>
                            </div>
                            
                            {/* 智能设备 */}
                            <div style={{
                                marginBottom: 'var(--spacing-2xl)'
                            }}>
                                <h3 style={{
                                    color: 'var(--text-primary)',
                                    marginBottom: 'var(--spacing-lg)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: 'var(--spacing-sm)'
                                }}>
                                    🔒 智能设备
                                </h3>
                                
                                <div className="form-group">
                                    <label className="form-label">🔒 地锁设备序列号 (可选)</label>
                                    <input
                                        type="text"
                                        className="form-input"
                                        name="lock_serial_number"
                                        value={formData.lock_serial_number}
                                        onChange={handleChange}
                                        placeholder="输入地锁设备的序列号，绑定后可实现自动开关锁"
                                    />
                                    <div style={{
                                        marginTop: 'var(--spacing-sm)',
                                        padding: 'var(--spacing-sm)',
                                        background: '#e8f5e8',
                                        borderRadius: 'var(--radius-sm)',
                                        fontSize: '14px',
                                        color: '#2e7d32'
                                    }}>
                                        💡 <strong>提示:</strong> 绑定地锁后，系统将自动控制开关锁，提升用户体验和安全性
                                    </div>
                                </div>
                            </div>
                            
                            {/* 提交按钮 */}
                            <div style={{
                                display: 'flex',
                                gap: 'var(--spacing-md)',
                                justifyContent: 'flex-end',
                                paddingTop: 'var(--spacing-lg)',
                                borderTop: '1px solid var(--border-light)'
                            }}>
                                <button 
                                    type="button" 
                                    className="btn btn-outline"
                                    onClick={() => navigate('/admin/dashboard')}
                                    style={{minWidth: '120px'}}
                                >
                                    取消
                                </button>
                                <button 
                                    type="submit" 
                                    className="btn btn-primary"
                                    style={{minWidth: '120px'}}
                                >
                                    🎉 创建停车位
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AddParkingSpot; 