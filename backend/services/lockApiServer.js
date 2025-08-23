/**
 * 简单的地锁API服务器模拟
 * 用于在地锁硬件服务器不可用时提供模拟数据
 */

const express = require('express');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

// 模拟连接的设备数据
const mockDevices = {
  '1234567890ABCDEF': {
    serial_number: '1234567890ABCDEF',
    action_step: 0,
    water_detection: 0,
    battery_3_7v: 3.8,
    signal_strength: 85,
    flow_number: 12345,
    device_type: 1,
    battery_12v: 12.5,
    device_status: 2, // 1=上升到位, 2=下降到位
    device_status_description: '车位锁下降到位',
    car_status: 2, // 1=有车, 2=无车
    car_status_description: '无车',
    error_code: 0,
    error_descriptions: [],
    current_frequency: 50000,
    no_car_base: 45000,
    car_base: 55000,
    car_ratio: 1100,
    no_car_ratio: 900,
    control_status: 0,
    control_status_description: '正常',
    last_heartbeat: new Date().toISOString(),
    address: ['127.0.0.1', 12345]
  }
};

// 获取服务器状态
app.get('/api/status', (req, res) => {
  res.json({
    success: true,
    message: 'Parking lock server is running',
    connected_devices: Object.keys(mockDevices).length,
    server_time: new Date().toISOString()
  });
});

// 获取所有设备
app.get('/api/devices', (req, res) => {
  const devices = Object.values(mockDevices).map(device => ({
    serial: device.serial_number,
    address: device.address,
    last_heartbeat: device.last_heartbeat,
    last_heartbeat_seconds_ago: Math.floor((Date.now() - new Date(device.last_heartbeat).getTime()) / 1000)
  }));
  
  res.json({
    success: true,
    devices: devices
  });
});

// 获取设备详细状态
app.get('/api/device_status/:deviceSerial', (req, res) => {
  const { deviceSerial } = req.params;
  const device = mockDevices[deviceSerial];
  
  if (!device) {
    return res.status(404).json({
      success: false,
      message: 'Device not found or not connected'
    });
  }

  // 更新最后心跳时间
  device.last_heartbeat = new Date().toISOString();
  
  res.json({
    success: true,
    data: device
  });
});

// 获取所有设备状态
app.get('/api/device_statuses', (req, res) => {
  const devices = Object.values(mockDevices);
  
  // 更新所有设备的心跳时间
  devices.forEach(device => {
    device.last_heartbeat = new Date().toISOString();
  });
  
  res.json({
    success: true,
    devices: devices
  });
});

// 开锁
app.post('/api/open_lock', (req, res) => {
  const { deviceSerial } = req.body;
  const device = mockDevices[deviceSerial];
  
  if (!device) {
    return res.status(404).json({
      success: false,
      message: 'Device not found'
    });
  }

  // 模拟开锁操作
  device.device_status = 2; // 下降到位
  device.device_status_description = '车位锁下降到位';
  device.last_heartbeat = new Date().toISOString();
  
  res.json({
    success: true,
    message: `Open lock command sent to device ${deviceSerial}`,
    device_status: device.device_status
  });
});

// 关锁
app.post('/api/close_lock', (req, res) => {
  const { deviceSerial } = req.body;
  const device = mockDevices[deviceSerial];
  
  if (!device) {
    return res.status(404).json({
      success: false,
      message: 'Device not found'
    });
  }

  // 模拟关锁操作 - 只有在无车时才能关锁
  if (device.car_status === 1) {
    return res.status(400).json({
      success: false,
      message: 'Cannot close lock: car detected'
    });
  }

  device.device_status = 1; // 上升到位
  device.device_status_description = '车位锁上升到位';
  device.last_heartbeat = new Date().toISOString();
  
  res.json({
    success: true,
    message: `Close lock command sent to device ${deviceSerial}`,
    device_status: device.device_status
  });
});

// 设置锁状态
app.post('/api/set_state', (req, res) => {
  const { deviceSerial, state } = req.body;
  const device = mockDevices[deviceSerial];
  
  if (!device) {
    return res.status(404).json({
      success: false,
      message: 'Device not found'
    });
  }

  device.control_status = state;
  device.control_status_description = ['正常', '保持开', '保持关'][state] || '未知状态';
  device.last_heartbeat = new Date().toISOString();
  
  res.json({
    success: true,
    message: `Set state command sent to device ${deviceSerial}`,
    state: state
  });
});

// 重启设备
app.post('/api/restart_device', (req, res) => {
  const { deviceSerial } = req.body;
  const device = mockDevices[deviceSerial];
  
  if (!device) {
    return res.status(404).json({
      success: false,
      message: 'Device not found'
    });
  }

  device.last_heartbeat = new Date().toISOString();
  
  res.json({
    success: true,
    message: `Restart command sent to device ${deviceSerial}`
  });
});

// 同步时间
app.post('/api/sync_time', (req, res) => {
  const { deviceSerial } = req.body;
  const device = mockDevices[deviceSerial];
  
  if (!device) {
    return res.status(404).json({
      success: false,
      message: 'Device not found'
    });
  }

  device.last_heartbeat = new Date().toISOString();
  
  res.json({
    success: true,
    message: `Time sync command sent to device ${deviceSerial}`
  });
});

// 模拟车辆检测变化（用于测试）
app.post('/api/simulate_car/:deviceSerial/:hasCarStatus', (req, res) => {
  const { deviceSerial, hasCarStatus } = req.params;
  const device = mockDevices[deviceSerial];
  
  if (!device) {
    return res.status(404).json({
      success: false,
      message: 'Device not found'
    });
  }

  const hasCar = hasCarStatus === '1' || hasCarStatus === 'true';
  device.car_status = hasCar ? 1 : 2;
  device.car_status_description = hasCar ? '有车' : '无车';
  device.last_heartbeat = new Date().toISOString();
  
  res.json({
    success: true,
    message: `Car detection simulated: ${device.car_status_description}`,
    car_status: device.car_status
  });
});

const PORT = process.env.LOCK_API_PORT || 5000;

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Mock Parking Lock API Server running on port ${PORT}`);
  console.log(`Available endpoints:`);
  console.log(`  GET  /api/status - Server status`);
  console.log(`  GET  /api/devices - List connected devices`);
  console.log(`  GET  /api/device_status/:serial - Get device status`);
  console.log(`  POST /api/simulate_car/:serial/:status - Simulate car detection (1=car, 0=no car)`);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('Received SIGTERM, shutting down gracefully');
  server.close(() => {
    console.log('Mock Lock API Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down gracefully');
  server.close(() => {
    console.log('Mock Lock API Server closed');
    process.exit(0);
  });
});

module.exports = app;