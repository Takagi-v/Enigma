import React, { useState, useEffect } from 'react';
import { parkingLockService } from '../../services/parkingLockService';
import '../styles/ParkingLockControl.css';

const ParkingLockControl = () => {
  const [devices, setDevices] = useState([]);
  const [deviceStatuses, setDeviceStatuses] = useState([]);
  const [selectedDevice, setSelectedDevice] = useState(null);
  const [deviceDetail, setDeviceDetail] = useState(null);
  const [serverStatus, setServerStatus] = useState({ status: 'unknown' });
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [error, setError] = useState('');
  const [refreshInterval, setRefreshInterval] = useState(5); // 刷新间隔，默认5秒
  const [operationStatus, setOperationStatus] = useState({ show: false, message: '', isError: false });
  const [viewMode, setViewMode] = useState('basic'); // 'basic' 基本模式, 'details' 详细模式

  // 状态名称映射
  const lockStateMap = {
    0: '正常',
    1: '保持开启',
    2: '保持关闭'
  };

  // 获取服务器状态
  const fetchServerStatus = async () => {
    try {
      const response = await parkingLockService.getStatus();
      setServerStatus(response);
      return response.status === 'running';
    } catch (error) {
      console.error('获取服务器状态失败:', error);
      setError('无法连接到地锁服务器。请确保服务已启动。');
      return false;
    }
  };

  // 获取连接的设备
  const fetchDevices = async () => {
    try {
      const isRunning = await fetchServerStatus();
      if (!isRunning) {
        setDevices([]);
        setDeviceStatuses([]);
        setLoading(false);
        return;
      }

      const response = await parkingLockService.getDevices();
      if (response.success) {
        setDevices(response.devices || []);
        setError('');
      } else {
        setError(response.message || '获取设备列表失败');
      }
    } catch (error) {
      console.error('获取设备失败:', error);
      setError('获取设备列表时发生错误。请稍后再试。');
    } finally {
      setLoading(false);
    }
  };

  // 获取所有设备的详细状态
  const fetchAllDeviceStatuses = async () => {
    try {
      const isRunning = await fetchServerStatus();
      if (!isRunning) {
        setDeviceStatuses([]);
        return;
      }

      const response = await parkingLockService.getAllDeviceStatuses();
      if (response.success) {
        setDeviceStatuses(response.设备列表 || []);
        setError('');
      } else {
        setError(response.message || '获取设备状态列表失败');
      }
    } catch (error) {
      console.error('获取设备状态列表失败:', error);
      setError('获取设备状态列表时发生错误。请稍后再试。');
    }
  };

  // 获取单个设备的详细状态
  const fetchDeviceDetail = async (deviceSerial) => {
    try {
      setDetailLoading(true);
      const response = await parkingLockService.getDeviceStatus(deviceSerial);
      if (response.success) {
        setDeviceDetail(response.状态);
        setError('');
      } else {
        setDeviceDetail(null);
        setError(response.message || '获取设备详细状态失败');
      }
    } catch (error) {
      console.error('获取设备详细状态失败:', error);
      setError('获取设备详细状态时发生错误。请稍后再试。');
      setDeviceDetail(null);
    } finally {
      setDetailLoading(false);
    }
  };

  // 刷新数据
  const refreshData = async () => {
    setLoading(true);
    if (viewMode === 'basic') {
      await fetchDevices();
    } else {
      await fetchAllDeviceStatuses();
    }
    setLoading(false);
  };

  // 定期刷新设备信息
  useEffect(() => {
    refreshData();

    const interval = setInterval(() => {
      refreshData();
    }, refreshInterval * 1000);

    return () => clearInterval(interval);
  }, [refreshInterval, viewMode]);

  // 当选中设备变化时，获取设备详情
  useEffect(() => {
    if (selectedDevice) {
      fetchDeviceDetail(selectedDevice);
    } else {
      setDeviceDetail(null);
    }
  }, [selectedDevice]);

  // 显示操作结果
  const showOperationResult = (message, isError = false) => {
    setOperationStatus({
      show: true,
      message,
      isError
    });

    // 3秒后自动关闭提示
    setTimeout(() => {
      setOperationStatus({ show: false, message: '', isError: false });
    }, 3000);
  };

  // 启动服务器
  const handleStartServer = async () => {
    try {
      setLoading(true);
      const response = await parkingLockService.startServer();
      if (response.success) {
        showOperationResult('服务器启动成功');
        await refreshData();
      } else {
        showOperationResult(`服务器启动失败: ${response.message}`, true);
      }
    } catch (error) {
      console.error('启动服务器失败:', error);
      showOperationResult('启动服务器时发生错误', true);
    } finally {
      setLoading(false);
    }
  };

  // 停止服务器
  const handleStopServer = async () => {
    try {
      setLoading(true);
      const response = await parkingLockService.stopServer();
      if (response.success) {
        showOperationResult('服务器已停止');
        await refreshData();
      } else {
        showOperationResult(`停止服务器失败: ${response.message}`, true);
      }
    } catch (error) {
      console.error('停止服务器失败:', error);
      showOperationResult('停止服务器时发生错误', true);
    } finally {
      setLoading(false);
    }
  };

  // 开锁
  const handleOpenLock = async (deviceSerial) => {
    try {
      setLoading(true);
      const response = await parkingLockService.openLock(deviceSerial);
      if (response.success) {
        showOperationResult('开锁指令已发送');
      } else {
        showOperationResult(`开锁失败: ${response.message}`, true);
      }
    } catch (error) {
      console.error('开锁失败:', error);
      showOperationResult('发送开锁指令时发生错误', true);
    } finally {
      setLoading(false);
    }
  };

  // 关锁
  const handleCloseLock = async (deviceSerial) => {
    try {
      setLoading(true);
      const response = await parkingLockService.closeLock(deviceSerial);
      if (response.success) {
        showOperationResult('关锁指令已发送');
      } else {
        showOperationResult(`关锁失败: ${response.message}`, true);
      }
    } catch (error) {
      console.error('关锁失败:', error);
      showOperationResult('发送关锁指令时发生错误', true);
    } finally {
      setLoading(false);
    }
  };

  // 设置锁状态
  const handleSetLockState = async (deviceSerial, state) => {
    try {
      setLoading(true);
      const response = await parkingLockService.setLockState(deviceSerial, state);
      if (response.success) {
        showOperationResult(`设置${lockStateMap[state]}状态成功`);
      } else {
        showOperationResult(`设置状态失败: ${response.message}`, true);
      }
    } catch (error) {
      console.error('设置锁状态失败:', error);
      showOperationResult('设置锁状态时发生错误', true);
    } finally {
      setLoading(false);
    }
  };

  // 重启设备
  const handleRestartDevice = async (deviceSerial) => {
    if (window.confirm('确定要重启该设备吗？')) {
      try {
        setLoading(true);
        const response = await parkingLockService.restartDevice(deviceSerial);
        if (response.success) {
          showOperationResult('重启指令已发送');
        } else {
          showOperationResult(`重启失败: ${response.message}`, true);
        }
      } catch (error) {
        console.error('重启设备失败:', error);
        showOperationResult('发送重启指令时发生错误', true);
      } finally {
        setLoading(false);
      }
    }
  };

  // 同步时间
  const handleSyncTime = async (deviceSerial) => {
    try {
      setLoading(true);
      const response = await parkingLockService.syncTime(deviceSerial);
      if (response.success) {
        showOperationResult('时间同步指令已发送');
      } else {
        showOperationResult(`时间同步失败: ${response.message}`, true);
      }
    } catch (error) {
      console.error('同步时间失败:', error);
      showOperationResult('发送时间同步指令时发生错误', true);
    } finally {
      setLoading(false);
    }
  };

  // 修改刷新间隔
  const handleRefreshIntervalChange = (e) => {
    const value = parseInt(e.target.value);
    if (!isNaN(value) && value >= 1) {
      setRefreshInterval(value);
    }
  };

  // 切换视图模式
  const handleViewModeChange = (mode) => {
    setViewMode(mode);
    setSelectedDevice(null);
  };

  // 查看设备详情
  const handleViewDeviceDetail = (deviceSerial) => {
    setSelectedDevice(deviceSerial);
  };

  // 关闭设备详情面板
  const handleCloseDetail = () => {
    setSelectedDevice(null);
    setDeviceDetail(null);
  };

  // 获取设备状态颜色
  const getStatusColor = (deviceStatus) => {
    if (!deviceStatus) return 'gray';
    
    switch (deviceStatus.设备状态?.代码) {
      case 1: return 'green'; // 上升到位
      case 2: return 'red'; // 下降到位
      case 3: case 4: case 6: return 'orange'; // 错误状态
      case 5: return 'blue'; // 正在动作
      default: return 'gray';
    }
  };
  
  // 获取车辆状态显示
  const getCarStatusDisplay = (carStatus) => {
    if (!carStatus) return '';
    return carStatus === 1 ? '有车' : '无车';
  };

  // 获取电池状态类名
  const getBatteryClass = (level) => {
    if (level === undefined) return '';
    if (level > 80) return 'battery-good';
    if (level > 30) return 'battery-medium';
    return 'battery-low';
  };

  return (
    <div className="parking-lock-control">
      <h2>地锁控制系统</h2>
      
      <div className="server-control">
        <div className="server-status">
          <span>服务器状态: </span>
          <span className={`status-badge ${serverStatus.status === 'running' ? 'status-running' : 'status-stopped'}`}>
            {serverStatus.status === 'running' ? '运行中' : '已停止'}
          </span>
        </div>
        
        <div className="server-buttons">
          <button 
            onClick={handleStartServer} 
            disabled={serverStatus.status === 'running' || loading}
            className="btn btn-start"
          >
            启动服务器
          </button>
          <button 
            onClick={handleStopServer} 
            disabled={serverStatus.status !== 'running' || loading}
            className="btn btn-stop"
          >
            停止服务器
          </button>
        </div>
      </div>

      <div className="view-controls">
        <div className="view-mode-selector">
          <button 
            className={`btn ${viewMode === 'basic' ? 'btn-primary active' : 'btn-secondary'}`}
            onClick={() => handleViewModeChange('basic')}
          >
            基本视图
          </button>
          <button 
            className={`btn ${viewMode === 'details' ? 'btn-primary active' : 'btn-secondary'}`}
            onClick={() => handleViewModeChange('details')}
          >
            详细视图
          </button>
        </div>

        <div className="refresh-control">
          <label>
            刷新间隔(秒): 
            <input 
              type="number" 
              min="1" 
              value={refreshInterval} 
              onChange={handleRefreshIntervalChange} 
            />
          </label>
          <button onClick={refreshData} disabled={loading} className="btn btn-refresh">
            立即刷新
          </button>
        </div>
      </div>

      {operationStatus.show && (
        <div className={`operation-status ${operationStatus.isError ? 'error' : 'success'}`}>
          {operationStatus.message}
        </div>
      )}

      {error && <div className="error-message">{error}</div>}

      {/* 设备详情弹窗 */}
      {selectedDevice && (
        <div className="device-detail-modal">
          <div className="device-detail-content">
            <div className="detail-header">
              <h3>设备详细信息</h3>
              <button className="btn-close-detail" onClick={handleCloseDetail}>×</button>
            </div>
            
            {detailLoading ? (
              <div className="loading">加载设备详情...</div>
            ) : deviceDetail ? (
              <div className="device-detail-info">
                <div className="detail-section">
                  <h4>基本信息</h4>
                  <table className="detail-table">
                    <tbody>
                      <tr>
                        <td>序列号</td>
                        <td>{deviceDetail.序列号}</td>
                      </tr>
                      <tr>
                        <td>最后心跳时间</td>
                        <td>{deviceDetail.最后心跳格式化时间}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                <div className="detail-section">
                  <h4>状态信息</h4>
                  <table className="detail-table">
                    <tbody>
                      <tr>
                        <td>设备状态</td>
                        <td>
                          <span className={`status-indicator status-${getStatusColor(deviceDetail)}`}></span>
                          {deviceDetail.设备状态?.描述 || '未知'}
                        </td>
                      </tr>
                      <tr>
                        <td>车辆状态</td>
                        <td>
                          {deviceDetail.车辆状态?.描述 || '未知'}
                        </td>
                      </tr>
                      <tr>
                        <td>常控状态</td>
                        <td>{deviceDetail.常控状态?.描述 || '未知'}</td>
                      </tr>
                      {deviceDetail.进水检测 && (
                        <tr>
                          <td>进水检测</td>
                          <td className={deviceDetail.进水检测.代码 === 1 ? 'text-danger' : ''}>
                            {deviceDetail.进水检测.描述}
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="detail-section">
                  <h4>电池信息</h4>
                  <table className="detail-table">
                    <tbody>
                      <tr>
                        <td>3.7V电池</td>
                        <td className={getBatteryClass(deviceDetail.电池?.['3.7v'])}>
                          {deviceDetail.电池?.['3.7v']}V
                        </td>
                      </tr>
                      <tr>
                        <td>12V电池</td>
                        <td className={getBatteryClass(deviceDetail.电池?.['12v'])}>
                          {deviceDetail.电池?.['12v']}V
                        </td>
                      </tr>
                      <tr>
                        <td>信号强度</td>
                        <td>{deviceDetail.信号强度}</td>
                      </tr>
                    </tbody>
                  </table>
                </div>

                {deviceDetail.错误 && deviceDetail.错误.代码 > 0 && (
                  <div className="detail-section error-section">
                    <h4>错误信息</h4>
                    <div className="error-list">
                      <p>错误代码: 0x{deviceDetail.错误.代码.toString(16).toUpperCase()}</p>
                      <ul>
                        {deviceDetail.错误.描述列表.map((desc, index) => (
                          <li key={index} className="error-item">{desc}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                )}

                {deviceDetail.地感参数 && (
                  <div className="detail-section">
                    <h4>地感参数</h4>
                    <table className="detail-table">
                      <tbody>
                        <tr>
                          <td>当前频率</td>
                          <td>{deviceDetail.地感参数.当前频率}</td>
                        </tr>
                        <tr>
                          <td>无车基准</td>
                          <td>{deviceDetail.地感参数.无车基准}</td>
                        </tr>
                        <tr>
                          <td>有车基准</td>
                          <td>{deviceDetail.地感参数.有车基准}</td>
                        </tr>
                        <tr>
                          <td>有车万分比</td>
                          <td>{deviceDetail.地感参数.有车万分比}</td>
                        </tr>
                        <tr>
                          <td>无车万分比</td>
                          <td>{deviceDetail.地感参数.无车万分比}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                <div className="detail-actions">
                  <button 
                    onClick={() => handleOpenLock(selectedDevice)}
                    className="btn btn-open"
                  >
                    开锁
                  </button>
                  <button 
                    onClick={() => handleCloseLock(selectedDevice)}
                    className="btn btn-close"
                  >
                    关锁
                  </button>
                  <button 
                    onClick={() => handleSetLockState(selectedDevice, 0)}
                    className="btn btn-normal"
                  >
                    恢复正常
                  </button>
                  <button 
                    onClick={() => handleRestartDevice(selectedDevice)}
                    className="btn btn-restart"
                  >
                    重启设备
                  </button>
                </div>
              </div>
            ) : (
              <div className="error-message">无法获取设备详情</div>
            )}
          </div>
        </div>
      )}

      {loading ? (
        <div className="loading">加载中...</div>
      ) : (
        viewMode === 'basic' ? (
          <div className="devices-list">
            <h3>已连接设备 ({devices.length})</h3>
            
            {devices.length === 0 ? (
              <div className="no-devices">
                {serverStatus.status === 'running' 
                  ? '没有已连接的设备' 
                  : '服务器未运行，请先启动服务器'}
              </div>
            ) : (
              <table className="devices-table">
                <thead>
                  <tr>
                    <th>序列号</th>
                    <th>IP地址</th>
                    <th>最后心跳</th>
                    <th>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {devices.map((device, index) => (
                    <tr key={index}>
                      <td>
                        <a 
                          href="#" 
                          onClick={(e) => {
                            e.preventDefault();
                            handleViewDeviceDetail(device.serial);
                          }}
                          className="device-serial-link"
                        >
                          {device.serial}
                        </a>
                      </td>
                      <td>{device.address[0]}:{device.address[1]}</td>
                      <td>
                        {device.last_heartbeat}
                        <span className="heartbeat-time">
                          ({device.last_heartbeat_seconds_ago}秒前)
                        </span>
                      </td>
                      <td className="device-actions">
                        <button 
                          onClick={() => handleOpenLock(device.serial)} 
                          className="btn btn-open"
                          title="开锁"
                        >
                          开锁
                        </button>
                        <button 
                          onClick={() => handleCloseLock(device.serial)} 
                          className="btn btn-close"
                          title="关锁"
                        >
                          关锁
                        </button>
                        <div className="dropdown">
                          <button className="btn btn-more">更多操作 ▼</button>
                          <div className="dropdown-content">
                            <button onClick={() => handleSetLockState(device.serial, 0)}>
                              恢复正常模式
                            </button>
                            <button onClick={() => handleSetLockState(device.serial, 1)}>
                              设置为保持开启
                            </button>
                            <button onClick={() => handleSetLockState(device.serial, 2)}>
                              设置为保持关闭
                            </button>
                            <button onClick={() => handleSyncTime(device.serial)}>
                              同步时间
                            </button>
                            <button onClick={() => handleRestartDevice(device.serial)}>
                              重启设备
                            </button>
                            <button 
                              onClick={() => handleViewDeviceDetail(device.serial)}
                              className="view-detail-btn"
                            >
                              查看详情
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        ) : (
          <div className="devices-status-list">
            <h3>设备状态列表 ({deviceStatuses.length})</h3>
            
            {deviceStatuses.length === 0 ? (
              <div className="no-devices">
                {serverStatus.status === 'running' 
                  ? '没有已连接的设备' 
                  : '服务器未运行，请先启动服务器'}
              </div>
            ) : (
              <div className="status-cards-container">
                {deviceStatuses.map((device, index) => (
                  <div 
                    key={index}
                    className={`status-card ${device.有错误 ? 'status-card-error' : ''}`}
                    onClick={() => handleViewDeviceDetail(device.序列号)}
                  >
                    <div className="status-card-header">
                      <h4 className="device-serial">{device.序列号}</h4>
                      <span className={`status-indicator status-${getStatusColor(device)}`}></span>
                    </div>
                    <div className="status-card-body">
                      <div className="status-info">
                        <span className="status-label">设备状态:</span>
                        <span className="status-value">{device.设备状态?.描述 || '未知'}</span>
                      </div>
                      <div className="status-info">
                        <span className="status-label">车辆状态:</span>
                        <span className="status-value">{device.车辆状态?.描述 || '未知'}</span>
                      </div>
                      <div className="status-info">
                        <span className="status-label">常控状态:</span>
                        <span className="status-value">{device.常控状态?.描述 || '未知'}</span>
                      </div>
                      <div className="status-info">
                        <span className="status-label">电池:</span>
                        <span className={`status-value ${getBatteryClass(device.电池?.['3.7v'])}`}>
                          3.7V: {device.电池?.['3.7v'] || '未知'}V
                        </span>
                        <span className={`status-value ${getBatteryClass(device.电池?.['12v'])}`}>
                          12V: {device.电池?.['12v'] || '未知'}V
                        </span>
                      </div>
                      <div className="status-info">
                        <span className="status-label">信号:</span>
                        <span className="status-value">{device.信号强度 || '未知'}</span>
                      </div>
                      <div className="status-info">
                        <span className="status-label">最后心跳:</span>
                        <span className="status-value">{device.最后心跳格式化时间}</span>
                      </div>
                      {device.有错误 && (
                        <div className="status-error-badge">
                          <span>⚠️ {device.错误数量}个错误</span>
                        </div>
                      )}
                    </div>
                    <div className="status-card-footer">
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenLock(device.序列号);
                        }} 
                        className="btn btn-sm btn-open"
                      >
                        开锁
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCloseLock(device.序列号);
                        }} 
                        className="btn btn-sm btn-close"
                      >
                        关锁
                      </button>
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          handleViewDeviceDetail(device.序列号);
                        }} 
                        className="btn btn-sm btn-detail"
                      >
                        详情
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )
      )}
    </div>
  );
};

export default ParkingLockControl; 