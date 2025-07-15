
import React, { useState, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../../services/api';
import { AuthContext } from '../../../contexts/AuthContext';
import '../../styles/ParkingSpotForm.css';

const AddParkingSpot = () => {
    const { user } = useContext(AuthContext);
    const [formData, setFormData] = useState({
        owner_username: user ? user.username : '',
        location: '',
        price: '',
        description: '',
        status: 'available',
        opening_hours: '00:00-23:59',
        lock_serial_number: '',
        latitude: '',
        longitude: ''
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
            const response = await api.post('/admin/parking-spots', dataToSend);
            setSuccess('停车位添加成功！');
            setFormData({
                owner_username: user.username,
                location: '',
                price: '',
                description: '',
                status: 'available',
                opening_hours: '00:00-23:59',
                lock_serial_number: '',
                latitude: '',
                longitude: ''
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
        <div className="parking-spot-form-container">
            <h2>添加新停车位</h2>
            {error && <p className="error-message">{error}</p>}
            {success && <p className="success-message">{success}</p>}
            <form onSubmit={handleSubmit} className="parking-spot-form">
                <div className="form-group">
                    <label htmlFor="location">位置</label>
                    <input
                        type="text"
                        id="location"
                        name="location"
                        value={formData.location}
                        onChange={handleChange}
                        required
                    />
                </div>
                <div className="form-group-row">
                    <div className="form-group">
                        <label htmlFor="latitude">纬度</label>
                        <input
                            type="number"
                            step="any"
                            id="latitude"
                            name="latitude"
                            value={formData.latitude}
                            onChange={handleChange}
                        />
                    </div>
                    <div className="form-group">
                        <label htmlFor="longitude">经度</label>
                        <input
                            type="number"
                            step="any"
                            id="longitude"
                            name="longitude"
                            value={formData.longitude}
                            onChange={handleChange}
                        />
                    </div>
                </div>
                <div className="form-group">
                    <label htmlFor="price">价格 (每小时)</label>
                    <input
                        type="number"
                        id="price"
                        name="price"
                        value={formData.price}
                        onChange={handleChange}
                        required
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="description">描述</label>
                    <textarea
                        id="description"
                        name="description"
                        value={formData.description}
                        onChange={handleChange}
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="status">状态</label>
                    <select
                        id="status"
                        name="status"
                        value={formData.status}
                        onChange={handleChange}
                    >
                        <option value="available">可用</option>
                        <option value="occupied">已占用</option>
                        <option value="unavailable">不可用</option>
                    </select>
                </div>
                <div className="form-group">
                    <label htmlFor="opening_hours">开放时间</label>
                    <input
                        type="text"
                        id="opening_hours"
                        name="opening_hours"
                        value={formData.opening_hours}
                        onChange={handleChange}
                    />
                </div>
                <div className="form-group">
                    <label htmlFor="lock_serial_number">地锁序列号 (可选)</label>
                    <input
                        type="text"
                        id="lock_serial_number"
                        name="lock_serial_number"
                        value={formData.lock_serial_number}
                        onChange={handleChange}
                    />
                </div>
                <div className="form-actions">
                    <button type="submit" className="btn-submit">确认添加</button>
                    <button type="button" className="btn-cancel" onClick={() => navigate('/admin/dashboard')}>取消</button>
                </div>
            </form>
        </div>
    );
};

export default AddParkingSpot; 