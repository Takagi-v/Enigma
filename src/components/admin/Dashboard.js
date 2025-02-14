import React, { useState, useEffect } from 'react';
import { Card, Row, Col, Statistic, message } from 'antd';
import {
  UserOutlined,
  CarOutlined,
  DollarOutlined,
  ClockCircleOutlined,
} from '@ant-design/icons';
import config from '../../config';

const Dashboard = () => {
  const [stats, setStats] = useState({
    totalUsers: 0,
    totalParkingSpots: 0,
    totalRevenue: 0,
    activeBookings: 0,
  });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await fetch(`${config.API_URL}/admin/dashboard/stats`, {
        credentials: 'include',
      });

      if (!response.ok) {
        throw new Error('获取统计数据失败');
      }

      const data = await response.json();
      setStats(data);
    } catch (error) {
      message.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2>仪表盘</h2>
      <Row gutter={16}>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic
              title="总用户数"
              value={stats.totalUsers}
              prefix={<UserOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic
              title="停车位总数"
              value={stats.totalParkingSpots}
              prefix={<CarOutlined />}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic
              title="总收入"
              value={stats.totalRevenue}
              prefix={<DollarOutlined />}
              precision={2}
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card loading={loading}>
            <Statistic
              title="当前预订"
              value={stats.activeBookings}
              prefix={<ClockCircleOutlined />}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Dashboard; 