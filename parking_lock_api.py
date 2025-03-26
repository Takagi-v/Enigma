#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import binascii
import logging
from flask import Flask, request, jsonify
from parking_lock_server import ParkingLockServer

# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("parking_lock_api.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("ParkingLockAPI")

# 创建Flask应用
app = Flask(__name__)

# 车位锁服务器实例
lock_server = None

@app.route('/api/status', methods=['GET'])
def get_status():
    """获取服务器状态"""
    global lock_server
    return jsonify({
        "status": "running" if lock_server and lock_server.is_running else "stopped"
    })

@app.route('/api/devices', methods=['GET'])
def get_devices():
    """获取连接的设备列表"""
    global lock_server
    if lock_server and lock_server.is_running:
        devices = lock_server.get_connected_devices()
        return jsonify({"success": True, "devices": devices})
    else:
        return jsonify({"success": False, "message": "Server not running"})

@app.route('/api/device_status/<device_serial_hex>', methods=['GET'])
def get_device_status(device_serial_hex):
    """获取设备的详细状态信息"""
    global lock_server
    if not lock_server or not lock_server.is_running:
        return jsonify({"success": False, "message": "Server not running"})
    
    try:
        # 转换设备序列号从十六进制字符串到bytes
        device_serial = binascii.unhexlify(device_serial_hex)
        device_serial = bytes(device_serial)  # 确保是不可变的bytes类型
        
        # 使用服务器实例获取设备状态
        hb = lock_server.get_device_status(device_serial)
        
        if hb:
            # 构建响应数据
            status_response = {
                "success": True,
                "serialNumber": binascii.hexlify(hb['serial_number']).decode('utf-8'),
                "deviceStatus": {
                    "code": hb['device_status'],
                    "description": hb['device_status_description']
                },
                "carStatus": {
                    "code": hb['car_status'],
                    "description": hb['car_status_description']
                },
                "controlStatus": {
                    "code": hb['control_status'],
                    "description": hb['control_status_description']
                },
                "battery": {
                    "3.7v": hb['battery_3_7v'],
                    "12v": hb['battery_12v']
                },
                "signalStrength": hb['signal_strength'],
                "flowNumber": hb['flow_number'],
                "error": {
                    "code": hb['error_code'],
                    "descriptions": hb.get('error_descriptions', []),
                    "hasError": hb['error_code'] > 0
                },
                "groundSensor": {
                    "currentFrequency": hb['current_frequency'],
                    "noCarBase": hb['no_car_base'],
                    "carBase": hb['car_base'],
                    "carRatio": hb['car_ratio'],
                    "noCarRatio": hb['no_car_ratio']
                },
                "waterDetection": {
                    "code": hb['water_detection'],
                    "description": "有水" if hb['water_detection'] == 1 else "无水"
                }
            }
            
            return jsonify(status_response)
        else:
            return jsonify({
                "success": False, 
                "message": f"No heartbeat data available for device {device_serial_hex}"
            })
    except Exception as e:
        logger.error(f"Error in get_device_status: {e}")
        return jsonify({"success": False, "message": str(e)})

@app.route('/api/device_statuses', methods=['GET'])
def get_all_device_statuses():
    """获取所有设备的详细状态信息"""
    global lock_server
    if not lock_server or not lock_server.is_running:
        return jsonify({"success": False, "message": "Server not running"})
    
    try:
        # 获取所有设备状态
        device_status_list = lock_server.get_all_device_statuses()
        
        device_statuses = []
        for hb in device_status_list:
            # 构建设备状态对象
            status = {
                "serialNumber": binascii.hexlify(hb['serial_number']).decode('utf-8'),
                "deviceStatus": {
                    "code": hb['device_status'],
                    "description": hb['device_status_description']
                },
                "carStatus": {
                    "code": hb['car_status'],
                    "description": hb['car_status_description']
                },
                "controlStatus": {
                    "code": hb['control_status'],
                    "description": hb['control_status_description']
                },
                "battery": {
                    "3.7v": hb['battery_3_7v'],
                    "12v": hb['battery_12v']
                },
                "signalStrength": hb['signal_strength'],
                "flowNumber": hb['flow_number'],
                "error": {
                    "code": hb['error_code'],
                    "descriptions": hb.get('error_descriptions', []),
                    "hasError": hb['error_code'] > 0
                },
                "groundSensor": {
                    "currentFrequency": hb['current_frequency'],
                    "noCarBase": hb['no_car_base'],
                    "carBase": hb['car_base'],
                    "carRatio": hb['car_ratio'],
                    "noCarRatio": hb['no_car_ratio']
                },
                "waterDetection": {
                    "code": hb['water_detection'],
                    "description": "有水" if hb['water_detection'] == 1 else "无水"
                },
                "lastHeartbeat": hb.get("last_heartbeat"),
                "address": f"{hb['address'][0]}:{hb['address'][1]}" if 'address' in hb else "unknown"
            }
            
            device_statuses.append(status)
        
        return jsonify({
            "success": True,
            "deviceCount": len(device_statuses),
            "devices": device_statuses
        })
    except Exception as e:
        logger.error(f"Error in get_all_device_statuses: {e}")
        return jsonify({"success": False, "message": str(e)})

@app.route('/api/open_lock', methods=['POST'])
def open_lock():
    """远程开锁"""
    global lock_server
    if not lock_server or not lock_server.is_running:
        return jsonify({"success": False, "message": "Server not running"})
    
    try:
        data = request.get_json()
        device_serial_hex = data.get('deviceSerial', '')
        device_serial = binascii.unhexlify(device_serial_hex)
        
        result = lock_server.remote_open_lock(device_serial)
        return jsonify({
            "success": result,
            "message": "Open lock command sent" if result else "Failed to send open lock command"
        })
    except Exception as e:
        logger.error(f"Error in open_lock: {e}")
        return jsonify({"success": False, "message": str(e)})

@app.route('/api/close_lock', methods=['POST'])
def close_lock():
    """远程关锁"""
    global lock_server
    if not lock_server or not lock_server.is_running:
        return jsonify({"success": False, "message": "Server not running"})
    
    try:
        data = request.get_json()
        device_serial_hex = data.get('deviceSerial', '')
        device_serial = binascii.unhexlify(device_serial_hex)
        
        result = lock_server.remote_close_lock(device_serial)
        return jsonify({
            "success": result,
            "message": "Close lock command sent" if result else "Failed to send close lock command"
        })
    except Exception as e:
        logger.error(f"Error in close_lock: {e}")
        return jsonify({"success": False, "message": str(e)})

@app.route('/api/set_state', methods=['POST'])
def set_state():
    """设置锁状态（0:正常, 1:保持开, 2:保持关）"""
    global lock_server
    if not lock_server or not lock_server.is_running:
        return jsonify({"success": False, "message": "Server not running"})
    
    try:
        data = request.get_json()
        device_serial_hex = data.get('deviceSerial', '')
        state = data.get('state', 0)
        device_serial = binascii.unhexlify(device_serial_hex)
        
        result = lock_server.set_lock_state(device_serial, state)
        states = {0: "normal", 1: "hold open", 2: "hold close"}
        state_name = states.get(state, "unknown")
        
        return jsonify({
            "success": result,
            "message": f"Set {state_name} state command sent" if result else f"Failed to send {state_name} state command"
        })
    except Exception as e:
        logger.error(f"Error in set_state: {e}")
        return jsonify({"success": False, "message": str(e)})

@app.route('/api/restart_device', methods=['POST'])
def restart_device():
    """远程重启设备"""
    global lock_server
    if not lock_server or not lock_server.is_running:
        return jsonify({"success": False, "message": "Server not running"})
    
    try:
        data = request.get_json()
        device_serial_hex = data.get('deviceSerial', '')
        device_serial = binascii.unhexlify(device_serial_hex)
        
        result = lock_server.remote_restart(device_serial)
        return jsonify({
            "success": result,
            "message": "Restart command sent" if result else "Failed to send restart command"
        })
    except Exception as e:
        logger.error(f"Error in restart_device: {e}")
        return jsonify({"success": False, "message": str(e)})

@app.route('/api/sync_time', methods=['POST'])
def sync_time():
    """同步时间"""
    global lock_server
    if not lock_server or not lock_server.is_running:
        return jsonify({"success": False, "message": "Server not running"})
    
    try:
        data = request.get_json()
        device_serial_hex = data.get('deviceSerial', '')
        device_serial = binascii.unhexlify(device_serial_hex)
        
        result = lock_server.sync_time(device_serial)
        return jsonify({
            "success": result,
            "message": "Sync time command sent" if result else "Failed to send sync time command"
        })
    except Exception as e:
        logger.error(f"Error in sync_time: {e}")
        return jsonify({"success": False, "message": str(e)})

@app.route('/api/start_server', methods=['POST'])
def start_server():
    """启动车位锁服务器"""
    global lock_server
    
    try:
        data = request.get_json()
        host = data.get('host', '0.0.0.0')
        port = data.get('port', 11457)
        
        if lock_server and lock_server.is_running:
            return jsonify({"success": False, "message": "Server already running"})
        
        lock_server = ParkingLockServer(host, port)
        success = lock_server.start()
        
        return jsonify({
            "success": success,
            "message": "Server started successfully" if success else "Failed to start server"
        })
    except Exception as e:
        logger.error(f"Error in start_server: {e}")
        return jsonify({"success": False, "message": str(e)})

@app.route('/api/stop_server', methods=['POST'])
def stop_server():
    """停止车位锁服务器"""
    global lock_server
    
    if not lock_server or not lock_server.is_running:
        return jsonify({"success": False, "message": "Server not running"})
    
    try:
        lock_server.stop()
        return jsonify({
            "success": True,
            "message": "Server stopped successfully"
        })
    except Exception as e:
        logger.error(f"Error in stop_server: {e}")
        return jsonify({"success": False, "message": str(e)})

def main():
    """主函数"""
    # 默认配置
    HOST = '0.0.0.0'
    PORT = 11457
    API_HOST = '0.0.0.0'  # 监听所有网络接口
    API_PORT = 5000  # API服务端口
    
    # 创建并启动车位锁服务器
    global lock_server
    lock_server = ParkingLockServer(HOST, PORT)
    if lock_server.start():
        logger.info(f"Parking lock server started on {HOST}:{PORT}")
    else:
        logger.error("Failed to start parking lock server")
    
    # 启动API服务器
    app.run(host=API_HOST, port=API_PORT, debug=False)

if __name__ == "__main__":
    main()