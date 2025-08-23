/**
 * 地锁状态同步验证服务
 * 负责检查和同步地锁状态与数据库停车位状态
 */
const parkingLockService = require('./parkingLockService');
const { db } = require('../models/db');

class LockStatusSyncService {
  constructor() {
    this.syncInterval = null;
    this.syncIntervalMs = 30000; // 30秒同步一次
  }

  /**
   * 启动定时同步服务
   */
  startSync() {
    if (this.syncInterval) {
      console.warn('地锁同步服务已在运行');
      return;
    }

    console.log('启动地锁状态同步服务，同步间隔:', this.syncIntervalMs / 1000, '秒');
    this.syncInterval = setInterval(() => {
      this.syncAllLockStatus().catch(error => {
        console.error('定时同步地锁状态失败:', error);
      });
    }, this.syncIntervalMs);
  }

  /**
   * 停止定时同步服务
   */
  stopSync() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
      console.log('地锁状态同步服务已停止');
    }
  }

  /**
   * 同步所有地锁状态
   */
  async syncAllLockStatus() {
    try {
      console.log('开始执行地锁状态同步...');
      
      // 获取所有有地锁的停车位
      const spotsWithLock = await new Promise((resolve, reject) => {
        db().all(
          `SELECT id, lock_serial_number, status, current_user_id 
           FROM parking_spots 
           WHERE lock_serial_number IS NOT NULL AND lock_serial_number != ''`,
          [],
          (err, rows) => {
            if (err) reject(err);
            else resolve(rows || []);
          }
        );
      });

      if (spotsWithLock.length === 0) {
        console.log('没有找到配置地锁的停车位');
        return;
      }

      console.log(`找到 ${spotsWithLock.length} 个配置了地锁的停车位`);

      // 获取所有地锁设备状态
      let deviceStatuses;
      try {
        const result = await parkingLockService.getAllDeviceStatuses();
        deviceStatuses = result.devices || [];
      } catch (error) {
        console.error('获取地锁设备状态失败:', error);
        return;
      }

      // 为每个停车位检查状态
      for (const spot of spotsWithLock) {
        await this.syncSingleSpotStatus(spot, deviceStatuses);
      }

      console.log('地锁状态同步完成');
    } catch (error) {
      console.error('同步地锁状态时发生错误:', error);
    }
  }

  /**
   * 同步单个停车位的地锁状态
   */
  async syncSingleSpotStatus(spot, deviceStatuses) {
    try {
      // 查找对应的设备状态
      const deviceStatus = deviceStatuses.find(device => 
        device.serial_number === spot.lock_serial_number
      );

      if (!deviceStatus) {
        console.warn(`地锁设备 ${spot.lock_serial_number} 未连接或不在线`);
        return;
      }

      const isCarPresent = deviceStatus.car_status === 1; // 1=有车, 2=无车
      const lockIsUp = deviceStatus.device_status === 1; // 1=升起, 2=降下
      const spotIsOccupied = spot.status === 'occupied';

      // 检查是否需要同步状态
      let needsUpdate = false;
      let newStatus = spot.status;
      let inconsistencyFound = false;

      // 逻辑检查：
      // 1. 如果地锁检测到有车，但停车位状态是可用，更新为占用
      if (isCarPresent && !spotIsOccupied) {
        newStatus = 'occupied';
        needsUpdate = true;
        inconsistencyFound = true;
        console.log(`停车位 ${spot.id} 状态不一致：地锁检测到有车但停车位状态为可用`);
      }

      // 2. 如果地锁检测到无车，但停车位状态是占用且没有当前用户，更新为可用
      if (!isCarPresent && spotIsOccupied && !spot.current_user_id) {
        newStatus = 'available';
        needsUpdate = true;
        inconsistencyFound = true;
        console.log(`停车位 ${spot.id} 状态不一致：地锁检测到无车但停车位状态为占用（无用户）`);
      }

      // 3. 如果有当前用户但地锁检测无车，可能是用户已离开但未正式结束
      if (!isCarPresent && spotIsOccupied && spot.current_user_id) {
        console.log(`停车位 ${spot.id} 可能存在未结束的使用记录：地锁无车但有当前用户 ${spot.current_user_id}`);
        // 这种情况可能需要人工干预，暂时不自动更改状态
      }

      // 更新数据库状态
      if (needsUpdate) {
        await new Promise((resolve, reject) => {
          db().run(
            'UPDATE parking_spots SET status = ?, updated_at = DATETIME("now", "utc") WHERE id = ?',
            [newStatus, spot.id],
            (err) => {
              if (err) reject(err);
              else resolve();
            }
          );
        });
        console.log(`已更新停车位 ${spot.id} 状态: ${spot.status} -> ${newStatus}`);
      }

      // 记录同步结果
      if (inconsistencyFound) {
        await this.logStatusInconsistency(spot.id, spot.lock_serial_number, {
          database_status: spot.status,
          new_status: newStatus,
          lock_car_detected: isCarPresent,
          lock_position: lockIsUp ? 'up' : 'down',
          current_user_id: spot.current_user_id
        });
      }

    } catch (error) {
      console.error(`同步停车位 ${spot.id} 状态失败:`, error);
    }
  }

  /**
   * 记录状态不一致日志
   */
  async logStatusInconsistency(spotId, lockSerial, details) {
    try {
      // 可以在这里记录到日志表或文件
      console.log(`[状态不一致] 停车位 ${spotId}, 地锁 ${lockSerial}:`, details);
      
      // 如果有专门的日志表，可以在这里插入记录
      // await new Promise((resolve, reject) => {
      //   db().run(
      //     'INSERT INTO lock_sync_logs (spot_id, lock_serial, details, created_at) VALUES (?, ?, ?, DATETIME("now", "utc"))',
      //     [spotId, lockSerial, JSON.stringify(details)],
      //     (err) => {
      //       if (err) reject(err);
      //       else resolve();
      //     }
      //   );
      // });
    } catch (error) {
      console.error('记录状态不一致日志失败:', error);
    }
  }

  /**
   * 检查特定停车位的地锁状态
   */
  async checkSpotLockStatus(spotId) {
    try {
      const spot = await new Promise((resolve, reject) => {
        db().get(
          'SELECT id, lock_serial_number, status, current_user_id FROM parking_spots WHERE id = ?',
          [spotId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!spot || !spot.lock_serial_number) {
        return { success: false, message: '停车位不存在或未配置地锁' };
      }

      const deviceStatus = await parkingLockService.getDeviceStatus(spot.lock_serial_number);
      if (!deviceStatus || !deviceStatus.success) {
        return { success: false, message: '无法获取地锁设备状态' };
      }

      // 解析地锁服务返回的数据结构
      const lockData = deviceStatus.data || deviceStatus;
      const isCarPresent = lockData.car_status === 1 || lockData.carStatus?.code === 1;
      const deviceStatusDesc = lockData.device_status_description || lockData.deviceStatus?.description || 'unknown';
      
      return {
        success: true,
        spot_status: spot.status,
        current_user_id: spot.current_user_id,
        lock_status: {
          car_detected: isCarPresent,
          lock_position: deviceStatusDesc,
          device_online: true,
          last_heartbeat: lockData.last_heartbeat || lockData.lastHeartbeat || new Date().toISOString(),
          battery_level: lockData.battery_3_7v || null,
          signal_strength: lockData.signal_strength || null,
          error_code: lockData.error_code || 0,
          error_descriptions: lockData.error_descriptions || []
        }
      };
    } catch (error) {
      console.error('检查停车位地锁状态失败:', error);
      return { success: false, message: error.message };
    }
  }

  /**
   * 强制同步特定停车位状态
   */
  async forceSyncSpotStatus(spotId) {
    try {
      const spot = await new Promise((resolve, reject) => {
        db().get(
          'SELECT * FROM parking_spots WHERE id = ?',
          [spotId],
          (err, row) => {
            if (err) reject(err);
            else resolve(row);
          }
        );
      });

      if (!spot) {
        return { success: false, message: '停车位不存在' };
      }

      if (!spot.lock_serial_number) {
        return { success: false, message: '该停车位未配置地锁' };
      }

      const deviceStatuses = await parkingLockService.getAllDeviceStatuses();
      await this.syncSingleSpotStatus(spot, deviceStatuses.devices || []);

      return { success: true, message: '同步完成' };
    } catch (error) {
      console.error('强制同步停车位状态失败:', error);
      return { success: false, message: error.message };
    }
  }
}

// 创建单例实例
const lockStatusSyncService = new LockStatusSyncService();

module.exports = lockStatusSyncService;