#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import json
import binascii
import logging
from flask import Flask, request, jsonify
from parking_lock_server import ParkingLockServer
from datetime import datetime
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
        host = data.get('host', '18.220.204.146')
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
    

@app.route('/api/device_status/<device_serial_hex>', methods=['GET'])
def get_device_status(device_serial_hex):
    """获取指定设备的详细状态信息"""
    global lock_server
    if not lock_server or not lock_server.is_running:
        return jsonify({"success": False, "message": "服务器未运行"})
    
    try:
        device_serial = binascii.unhexlify(device_serial_hex)
        
        with lock_server.device_lock:
            if device_serial not in lock_server.connected_devices:
                return jsonify({"success": False, "message": "设备未连接"})
            
            device_info = lock_server.connected_devices[device_serial]
            
            if "heartbeat_data" not in device_info:
                return jsonify({"success": False, "message": "该设备没有可用的心跳数据"})
            
            # 获取心跳数据
            hb = device_info["heartbeat_data"]
            
            # 构建更易读的返回数据
            status_data = {
                "序列号": binascii.hexlify(hb["serial_number"]).decode('utf-8'),
                "设备状态": {
                    "代码": hb["device_status"],
                    "描述": hb["device_status_description"]
                },
                "车辆状态": {
                    "代码": hb["car_status"],
                    "描述": hb["car_status_description"]
                },
                "常控状态": {
                    "代码": hb["control_status"],
                    "描述": hb["control_status_description"]
                },
                "电池": {
                    "3.7v": hb["battery_3_7v"],
                    "12v": hb["battery_12v"]
                },
                "信号强度": hb["signal_strength"],
                "流水号": hb["flow_number"],
                "进水检测": {
                    "代码": hb["water_detection"],
                    "描述": "有水" if hb["water_detection"] == 1 else "无水"
                },
                "错误": {
                    "代码": hb["error_code"],
                    "描述列表": hb["error_descriptions"]
                },
                "地感参数": {
                    "当前频率": hb["current_frequency"],
                    "无车基准": hb["no_car_base"],
                    "有车基准": hb["car_base"],
                    "有车万分比": hb["car_ratio"],
                    "无车万分比": hb["no_car_ratio"]
                },
                "最后心跳时间": device_info["last_heartbeat"],
                "最后心跳格式化时间": datetime.fromtimestamp(device_info["last_heartbeat"]).strftime('%Y-%m-%d %H:%M:%S')
            }
            
            return jsonify({"success": True, "状态": status_data})
    
    except Exception as e:
        logger.error(f"获取设备状态时出错: {e}")
        return jsonify({"success": False, "message": str(e)})

@app.route('/api/device_statuses', methods=['GET'])
def get_all_device_statuses():
    """获取所有设备的详细状态信息"""
    global lock_server
    if not lock_server or not lock_server.is_running:
        return jsonify({"success": False, "message": "服务器未运行"})
    
    try:
        devices_status = []
        
        with lock_server.device_lock:
            for device_serial, device_info in lock_server.connected_devices.items():
                device_data = {
                    "序列号": binascii.hexlify(device_serial).decode('utf-8'),
                    "地址": device_info["address"],
                    "最后心跳时间": device_info["last_heartbeat"],
                    "最后心跳格式化时间": datetime.fromtimestamp(device_info["last_heartbeat"]).strftime('%Y-%m-%d %H:%M:%S')
                }
                
                # 添加心跳数据如果可用
                if "heartbeat_data" in device_info:
                    hb = device_info["heartbeat_data"]
                    device_data.update({
                        "设备状态": {
                            "代码": hb["device_status"],
                            "描述": hb["device_status_description"]
                        },
                        "车辆状态": {
                            "代码": hb["car_status"],
                            "描述": hb["car_status_description"]
                        },
                        "常控状态": {
                            "代码": hb["control_status"],
                            "描述": hb["control_status_description"]
                        },
                        "电池": {
                            "3.7v": hb["battery_3_7v"],
                            "12v": hb["battery_12v"]
                        },
                        "信号强度": hb["signal_strength"],
                        "有错误": hb["error_code"] > 0,
                        "错误数量": len(hb["error_descriptions"])
                    })
                
                devices_status.append(device_data)
        
        return jsonify({"success": True, "设备列表": devices_status})
    
    except Exception as e:
        logger.error(f"获取所有设备状态时出错: {e}")
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
    app.run(host=API_HOST, port=API_PORT)

if __name__ == "__main__":
    main()
