#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import socket
import threading
import time
import logging
import binascii
import struct
from datetime import datetime
import requests
import os

# 从环境变量加载配置，提供默认值
NODE_WEBHOOK_URL = os.environ.get('NODE_WEBHOOK_URL', 'http://localhost:3002/api/parking-locks/webhook/status-update')
WEBHOOK_SECRET = os.environ.get('LOCK_WEBHOOK_SECRET', 'a_very_secret_string_for_lock_webhook')


# 配置日志
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler("parking_lock_server.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger("ParkingLockServer")

# 全局变量，存储所有连接的设备信息
connected_devices = {}
# 设备锁，防止多线程同时操作
device_lock = threading.Lock()

class ParkingLockProtocol:
    """解析和构建车位锁通信协议"""
    
    @staticmethod
    def calculate_crc16(data):
        """计算CRC16校验码"""
        crc = 0xFFFF
        for byte in data:
            crc ^= byte
            for _ in range(8):
                if crc & 1:
                    crc = (crc >> 1) ^ 0xA001
                else:
                    crc = crc >> 1
        return crc
    
    @staticmethod
    def parse_frame(data):
        """解析接收到的数据帧"""
        if len(data) < 8:  # 至少需要帧头、校验码、长度、映射因子、命令字、CRC16、帧尾
            return None
        
        # 检查帧头和帧尾
        if data[0] != 0xDA or data[-1] != 0xDD:
            logger.error(f"Invalid frame header or footer: {binascii.hexlify(data)}")
            return None
        
        # 解析帧长度
        frame_length = data[2] + (data[3] << 8)
        if len(data) != frame_length:
            logger.error(f"Frame length mismatch: expected {frame_length}, got {len(data)}")
            return None
        
        # 校验CRC16
        received_crc = data[-3] + (data[-2] << 8)
        calculated_crc = ParkingLockProtocol.calculate_crc16(data[:-3])
        if received_crc != calculated_crc:
            logger.error(f"CRC mismatch: expected {calculated_crc:04X}, got {received_crc:04X}")
            return None
        
        # 提取命令字和数据
        command = data[5]
        payload = data[6:-3]
        
        return {"command": command, "payload": payload, "raw_data": data}
    
    @staticmethod
    def build_frame(command, payload=b''):
        """构建发送的数据帧"""
        # 计算帧长度 = 帧头(1) + 校验码(1) + 长度(2) + 映射因子(1) + 命令字(1) + 数据(n) + CRC16(2) + 帧尾(1)
        # 帧长度字段表示从帧头到帧尾的总长度
        frame_length = 9 + len(payload)  # 1+1+2+1+1+len(payload)+2+1
        
        # 构建帧数据
        frame = bytearray()
        frame.append(0xDA)  # 帧头
        frame.append(0x00)  # 校验码
        frame.extend([frame_length & 0xFF, (frame_length >> 8) & 0xFF])  # 长度，低字节在前
        frame.append(0x00)  # 映射因子
        frame.append(command)  # 命令字
        frame.extend(payload)  # 数据
        
        # 计算CRC16
        crc = ParkingLockProtocol.calculate_crc16(frame)
        frame.extend([crc & 0xFF, (crc >> 8) & 0xFF])  # CRC16，低字节在前
        
        frame.append(0xDD)  # 帧尾
        return frame
    
    @staticmethod
    def extract_serial_number(payload):
        """从载荷中提取设备序列号"""
        if len(payload) >= 8:
            # 确保返回不可变类型 bytes 而不是 bytearray
            return bytes(payload[:8])
        return None
    @staticmethod
    def parse_heartbeat_data(payload):
        """解析心跳帧中的详细设备状态信息"""
        if len(payload) < 32:  # 确保有足够的数据
            return None
        
        try:
            # 使用bytes而不是bytearray作为键
            serial_number = bytes(payload[:8])
            action_step = payload[8]
            water_detection = payload[9]  # 0x00: 无水, 0x01: 有水
            battery_3_7v = payload[10]  # 电池电量 (实际值)
            signal_strength = payload[11]  # 4G信号强度 (0-99)
            flow_number = struct.unpack("<I", payload[12:16])[0]  # 流水号
            device_type = payload[16]
            battery_12v = payload[17]  # 12V电量 (实际值/10)
            device_status = payload[18]  # 设备状态
            car_status = payload[19]  # 是否有车
            error_code = struct.unpack("<H", payload[20:22])[0]  # 错误号
            current_frequency = struct.unpack("<I", payload[22:26])[0]  # 当前地感频率
            no_car_base = struct.unpack("<I", payload[26:30])[0]  # 无车基准
            car_base = struct.unpack("<I", payload[30:34])[0]  # 有车基准
            car_ratio = struct.unpack("<H", payload[34:36])[0]  # 有车万分比
            no_car_ratio = struct.unpack("<H", payload[36:38])[0]  # 无车万分比
            control_status = payload[38] if len(payload) > 38 else 0  # 常控状态
            
            # 错误号说明
            error_descriptions = []
            if error_code & 0x0001: error_descriptions.append("上限位开关错误")
            if error_code & 0x0002: error_descriptions.append("下限位开关错误")
            if error_code & 0x0004: error_descriptions.append("电机下降堵转")
            if error_code & 0x0008: error_descriptions.append("电机上升堵转")
            if error_code & 0x0010: error_descriptions.append("上升超时")
            if error_code & 0x0020: error_descriptions.append("下降超时")
            if error_code & 0x0040: error_descriptions.append("地感错误")
            if error_code & 0x0080: error_descriptions.append("齿轮故障")
            if error_code & 0x0100: error_descriptions.append("电机线圈故障")
            if error_code & 0x0200: error_descriptions.append("车检模块错误故障")
            if error_code & 0x0400: error_descriptions.append("临时常控开")
            
            # 设备状态说明
            status_description = {
                0: "上电初始化",
                1: "车位锁上升到位",
                2: "车位锁下降到位",
                3: "车位锁上升错误",
                4: "车位锁下降错误",
                5: "车位锁正在动作，还未到位",
                6: "地感错误",
                9: "设备上有车"
            }.get(device_status, f"未知状态({device_status})")
            
            # 车辆状态说明
            car_status_description = {
                0: "准备",
                1: "有车",
                2: "无车"
            }.get(car_status, f"未知状态({car_status})")
            
            # 常控状态说明
            control_status_description = {
                0: "正常",
                1: "保持开",
                2: "保持关"
            }.get(control_status, f"未知状态({control_status})")
            
            # 将12V电池电量转换为实际电压
            battery_12v_actual = battery_12v / 10.0
            
            return {
                "serial_number": serial_number,
                "action_step": action_step,
                "water_detection": water_detection,
                "battery_3_7v": battery_3_7v,
                "signal_strength": signal_strength,
                "flow_number": flow_number,
                "device_type": device_type,
                "battery_12v": battery_12v_actual,
                "device_status": device_status,
                "device_status_description": status_description,
                "car_status": car_status,
                "car_status_description": car_status_description,
                "error_code": error_code,
                "error_descriptions": error_descriptions,
                "current_frequency": current_frequency,
                "no_car_base": no_car_base,
                "car_base": car_base,
                "car_ratio": car_ratio,
                "no_car_ratio": no_car_ratio,
                "control_status": control_status,
                "control_status_description": control_status_description
            }
        except Exception as e:
            logger.error(f"Error parsing heartbeat data: {e}")
            return None
    @staticmethod
    def log_frame(frame, direction="", command_name=""):
        """详细记录完整帧内容"""
        frame_hex = binascii.hexlify(frame).decode('utf-8')
        
        direction_text = f"{direction} " if direction else ""
        command_text = f" [{command_name}]" if command_name else ""
        
        # 记录完整帧
        logger.info(f"{direction_text}FULL FRAME{command_text}: {frame_hex}")
        
        # 如果帧至少包含基本结构，则分析并记录详细信息
        if len(frame) >= 8:
            try:
                header = frame[0]
                check_code = frame[1]
                frame_length = frame[2] + (frame[3] << 8)
                map_factor = frame[4]
                command = frame[5]
                
                # 根据不同的命令码，提供不同的解析信息
                command_info = ""
                if command == 0x80:
                    command_info = "设备登录"
                elif command == 0x81:
                    command_info = "心跳数据"
                elif command == 0x87:
                    command_info = "确认订单"
                elif command == 0x88:
                    command_info = "结束订单"
                elif command == 0x89:
                    command_info = "设备故障"
                elif command == 0x60:
                    command_info = "车状态改变"
                elif command == 0x84:
                    command_info = "远程开锁"
                elif command == 0x85:
                    command_info = "远程关锁"
                elif command == 0x8E:
                    command_info = "设置锁状态"
                elif command == 0x8F:
                    command_info = "远程重启"
                
                payload = frame[6:-3] if len(frame) > 9 else b''
                crc = frame[-3] + (frame[-2] << 8) if len(frame) > 3 else 0
                footer = frame[-1] if len(frame) > 1 else None
                
                # 记录帧结构
                logger.info(f"{direction_text}FRAME STRUCTURE{command_text}:")
                logger.info(f"  Header (帧头): 0x{header:02X}")
                logger.info(f"  Check Code (校验码): 0x{check_code:02X}")
                logger.info(f"  Length (帧长度): {frame_length} bytes")
                logger.info(f"  Map Factor (映射因子): 0x{map_factor:02X}")
                logger.info(f"  Command (命令字): 0x{command:02X} {command_info}")
                logger.info(f"  Payload (数据): {binascii.hexlify(payload).decode('utf-8')}")
                logger.info(f"  CRC16 (校验CRC16): 0x{crc:04X}")
                logger.info(f"  Footer (帧尾): 0x{footer:02X}" if footer is not None else "  Footer (帧尾): None")
                
                # 根据命令字进一步解析payload
                if command == 0x80 and len(payload) >= 8:  # 设备登录
                    logger.info(f"  设备登录: 序列号={binascii.hexlify(payload[:8]).decode('utf-8')}")
                    if len(payload) > 8:
                        logger.info(f"  设备登录: 其他数据={binascii.hexlify(payload[8:]).decode('utf-8')}")
                
                elif command == 0x81 and len(payload) >= 8:  # 心跳数据
                    logger.info(f"  心跳数据: 序列号={binascii.hexlify(payload[:8]).decode('utf-8')}")
                    if len(payload) > 8:
                        logger.info(f"  心跳数据: 其他数据={binascii.hexlify(payload[8:]).decode('utf-8')}")
                
                elif command == 0x60 and len(payload) >= 10:  # 车状态改变
                    serial_number = payload[:8]
                    car_present = payload[8]
                    lock_status = payload[9]
                    logger.info(f"  车状态: 序列号={binascii.hexlify(serial_number).decode('utf-8')}, 车辆状态={car_present}, 锁状态={lock_status}")
                
                # 时间戳响应的解析 (0x80, 0x81等响应)
                if direction == "SEND" and (command == 0x80 or command == 0x81) and len(payload) == 4:
                    timestamp = struct.unpack("<I", payload)[0]
                    timestamp_iso = datetime.fromtimestamp(timestamp).isoformat()
                    logger.info(f"  响应时间戳: {timestamp} ({timestamp_iso})")
            
            except Exception as e:
                logger.error(f"Error analyzing frame structure: {e}")

def send_heartbeat_to_webhook(hb):
    """将心跳数据格式化为驼峰命名法并发送给 Node.js Webhook"""
    # 转换为与Node.js后端一致的驼峰命名法
    webhook_payload = {
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
        "lastHeartbeat": hb.get("last_heartbeat", time.time())
    }

    headers = {
        'Content-Type': 'application/json',
        'X-Webhook-Secret': WEBHOOK_SECRET
    }
    
    try:
        response = requests.post(NODE_WEBHOOK_URL, json=webhook_payload, headers=headers, timeout=5)
        if response.status_code == 202:
            logger.info(f"成功发送心跳到Webhook: {hb['serial_number'].hex()}")
        else:
            logger.error(f"发送心跳到Webhook失败: {response.status_code} {response.text}")
    except requests.exceptions.RequestException as e:
        logger.error(f"发送心跳到Webhook异常: {e}")

class ParkingLockServer:
    """车位锁控制服务器"""
    
    def __init__(self, host, port):
        """初始化服务器"""
        self.host = host
        self.port = port
        self.server_socket = None
        self.is_running = False
        self.client_buffers = {}  # 存储每个客户端的接收缓冲区
    
    def start(self):
        """启动服务器"""
        try:
            self.server_socket = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            self.server_socket.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            self.server_socket.bind((self.host, self.port))
            self.server_socket.listen(10)
            self.is_running = True
            
            logger.info(f"Server started on {self.host}:{self.port}")
            
            # 启动接收客户端连接的线程
            accept_thread = threading.Thread(target=self.accept_clients)
            accept_thread.daemon = True
            accept_thread.start()
            
            return True
        except Exception as e:
            logger.error(f"Failed to start server: {e}")
            return False
    
    def stop(self):
        """停止服务器"""
        self.is_running = False
        if self.server_socket:
            self.server_socket.close()
        logger.info("Server stopped")
    
    def accept_clients(self):
        """接受客户端连接"""
        while self.is_running:
            try:
                client_socket, client_address = self.server_socket.accept()
                logger.info(f"New connection from {client_address}")
                
                # 为新客户端创建接收缓冲区
                self.client_buffers[client_socket] = bytearray()
                
                # 启动处理客户端消息的线程
                client_thread = threading.Thread(target=self.handle_client, args=(client_socket, client_address))
                client_thread.daemon = True
                client_thread.start()
            except Exception as e:
                if self.is_running:
                    logger.error(f"Error accepting client: {e}")
                    time.sleep(1)
    
    def handle_client(self, client_socket, client_address):
        """处理客户端消息"""
        device_serial = None
        
        try:
            while self.is_running:
                # 接收数据
                data = client_socket.recv(1024)
                if not data:
                    break
                
                # 添加到缓冲区
                if client_socket in self.client_buffers:
                    self.client_buffers[client_socket].extend(data)
                else:
                    self.client_buffers[client_socket] = bytearray(data)
                
                # 检查是否有完整的帧
                frames = self.extract_frames(self.client_buffers[client_socket])
                for frame in frames:
                    # 记录接收到的完整帧
                    ParkingLockProtocol.log_frame(frame, "RECV")
                    
                    parsed_frame = ParkingLockProtocol.parse_frame(frame)
                    if parsed_frame:
                        # 如果是登录帧，提取设备序列号
                        if parsed_frame["command"] == 0x80:
                            serial_number = ParkingLockProtocol.extract_serial_number(parsed_frame["payload"])
                            if serial_number:
                                # 如果这个设备已经登录过，则更新连接信息
                                with device_lock:
                                    if serial_number in connected_devices:
                                        # 如果已有相同设备序列号的连接，检查是否是同一个客户端
                                        existing_socket = connected_devices[serial_number]["socket"]
                                        if existing_socket != client_socket:
                                            # 如果是新的客户端，关闭旧连接
                                            try:
                                                existing_socket.close()
                                                logger.info(f"Closed previous connection for device {binascii.hexlify(serial_number)}")
                                            except:
                                                pass
                                        else:
                                            # 同一客户端重复登录，只更新心跳时间
                                            connected_devices[serial_number]["last_heartbeat"] = time.time()
                                            # 不记录重复登录日志，减少日志干扰
                                            # 直接处理并响应
                                            self.process_frame(parsed_frame, client_socket)
                                            continue
                                    
                                    # 注册新设备连接或更新连接
                                    connected_devices[serial_number] = {
                                        "socket": client_socket,
                                        "address": client_address,
                                        "last_heartbeat": time.time()
                                    }
                                    device_serial = serial_number
                                    logger.info(f"Device {binascii.hexlify(serial_number)} logged in from {client_address}")
                        
                        # 如果是心跳帧，更新最后心跳时间
                        elif parsed_frame["command"] == 0x81 and device_serial:
                            with device_lock:
                                if device_serial in connected_devices:
                                    connected_devices[device_serial]["last_heartbeat"] = time.time()
                            logger.debug(f"Heartbeat received from device {binascii.hexlify(device_serial)}")
                        
                        # 处理帧并发送响应
                        self.process_frame(parsed_frame, client_socket)
        except Exception as e:
            logger.error(f"Error handling client {client_address}: {e}")
        finally:
            # 关闭连接并移除设备记录
            try:
                client_socket.close()
            except:
                pass
            
            # 移除客户端缓冲区
            if client_socket in self.client_buffers:
                del self.client_buffers[client_socket]
            
            # 移除设备连接记录
            if device_serial:
                with device_lock:
                    if device_serial in connected_devices and connected_devices[device_serial]["socket"] == client_socket:
                        del connected_devices[device_serial]
                        logger.info(f"Device {binascii.hexlify(device_serial)} disconnected")
            else:
                logger.info(f"Connection from {client_address} closed")
    
    def extract_frames(self, buffer):
        """从缓冲区中提取完整的帧，并从缓冲区中删除已处理的数据"""
        frames = []
        start_index = 0
        processed_index = 0
        
        while True:
            # 查找帧头
            start_index = buffer.find(0xDA, start_index)
            if start_index == -1:
                break
            
            # 确保有足够的数据来获取帧长度
            if len(buffer) < start_index + 4:
                break
            
            # 获取帧长度
            frame_length = buffer[start_index + 2] + (buffer[start_index + 3] << 8)
            
            # 检查是否有完整的帧
            if len(buffer) < start_index + frame_length:
                break
            
            # 检查帧尾
            if buffer[start_index + frame_length - 1] == 0xDD:
                # 提取完整的帧
                frame = buffer[start_index:start_index + frame_length]
                frames.append(frame)
                processed_index = start_index + frame_length
            
            # 移动到下一个位置
            start_index += 1
        
        # 清理已处理的数据
        if processed_index > 0:
            del buffer[:processed_index]
        
        return frames
    
    def process_frame(self, parsed_frame, client_socket):
        """处理接收到的帧"""
        command = parsed_frame["command"]
        payload = parsed_frame["payload"]
        
        logger.info(f"Processing command: 0x{command:02X}, payload: {binascii.hexlify(payload)}")
        
        try:
            if command == 0x80:  # 设备登录
                # 回应设备登录 - 严格按照协议文档格式
                timestamp = int(time.time())
                logger.info(f"Responding with timestamp: {timestamp} (0x{timestamp:08X})")
                
                # 按照协议要求构建响应payload：4字节时间戳（小端序）
                response_payload = struct.pack("<I", timestamp)
                logger.debug(f"Login response payload (timestamp): {binascii.hexlify(response_payload)}")
                
                # 构建完整的响应帧
                response_frame = ParkingLockProtocol.build_frame(0x80, response_payload)
                
                # 记录发送的完整帧
                ParkingLockProtocol.log_frame(response_frame, "SEND", "设备登录响应")
                
                # 发送响应
                client_socket.send(response_frame)
                logger.info(f"Sent login response with timestamp {timestamp}")
            
            elif command == 0x81:  # 心跳数据
                # 回应心跳
                timestamp = int(time.time())
                response_payload = struct.pack("<I", timestamp)
                response_frame = ParkingLockProtocol.build_frame(0x81, response_payload)
                
                # 记录发送的完整帧
                ParkingLockProtocol.log_frame(response_frame, "SEND", "心跳响应")
                
                client_socket.send(response_frame)
                logger.debug(f"Sent heartbeat response with timestamp {timestamp}")
                
                # 解析心跳数据
                heartbeat_data = ParkingLockProtocol.parse_heartbeat_data(payload)
                if heartbeat_data:
                    serial_number = heartbeat_data["serial_number"]
                    # 存储心跳数据
                    with device_lock:
                        if serial_number in connected_devices:
                            connected_devices[serial_number]["last_heartbeat"] = time.time()
                            connected_devices[serial_number]["heartbeat_data"] = heartbeat_data
                            
                            # 异步发送心跳数据到 Node.js Webhook
                            threading.Thread(target=send_heartbeat_to_webhook, args=(heartbeat_data,)).start()
                            
                            # 记录关键状态变化
                            if "previous_status" in connected_devices[serial_number]:
                                prev_status = connected_devices[serial_number]["previous_status"]
                                current_status = heartbeat_data["device_status"]
                                prev_car = connected_devices[serial_number]["previous_car_status"]
                                current_car = heartbeat_data["car_status"]
                                
                                if prev_status != current_status or prev_car != current_car:
                                    logger.info(f"Device {binascii.hexlify(serial_number)} status changed: "
                                               f"Status {prev_status}({connected_devices[serial_number]['previous_status_desc']}) -> "
                                               f"{current_status}({heartbeat_data['device_status_description']}), "
                                               f"Car {prev_car} -> {current_car}")
                            
                            # 保存当前状态用于下次比较
                            connected_devices[serial_number]["previous_status"] = heartbeat_data["device_status"]
                            connected_devices[serial_number]["previous_status_desc"] = heartbeat_data["device_status_description"]
                            connected_devices[serial_number]["previous_car_status"] = heartbeat_data["car_status"]
                            
                    logger.debug(f"Heartbeat processed from device {binascii.hexlify(serial_number)}")
            elif command == 0x87:  # 确认订单（常降型设备）
                # 回应确认订单
                response_payload = bytes([0x01])  # 成功
                response_frame = ParkingLockProtocol.build_frame(0x87, response_payload)
                
                # 记录发送的完整帧
                ParkingLockProtocol.log_frame(response_frame, "SEND", "确认订单响应")
                
                client_socket.send(response_frame)
                logger.info(f"Sent order confirmation response")
            
            elif command == 0x88:  # 结束订单（常升型设备）
                # 回应结束订单
                response_payload = bytes([0x01])  # 成功
                response_frame = ParkingLockProtocol.build_frame(0x88, response_payload)
                
                # 记录发送的完整帧
                ParkingLockProtocol.log_frame(response_frame, "SEND", "结束订单响应")
                
                client_socket.send(response_frame)
                logger.info(f"Sent order completion response")
            
            elif command == 0x89:  # 设备故障
                # 回应设备故障
                response_payload = bytes([0x01])  # 成功
                response_frame = ParkingLockProtocol.build_frame(0x89, response_payload)
                
                # 记录发送的完整帧
                ParkingLockProtocol.log_frame(response_frame, "SEND", "设备故障响应")
                
                client_socket.send(response_frame)
                logger.info(f"Sent fault acknowledgment")
            
            elif command == 0x60:  # 车状态改变
                # 回应车状态改变
                response_payload = bytes([0x01])  # 成功
                response_frame = ParkingLockProtocol.build_frame(0x60, response_payload)
                
                # 记录发送的完整帧
                ParkingLockProtocol.log_frame(response_frame, "SEND", "车状态改变响应")
                
                client_socket.send(response_frame)
                logger.info(f"Sent car status change response")
                
                # 解析车状态
                if len(payload) >= 10:  # 确保有足够的数据
                    serial_number = payload[:8]
                    car_present = payload[8]
                    lock_status = payload[9]
                    logger.info(f"Car status change: Device {binascii.hexlify(serial_number)}, Car present: {car_present}, Lock status: {lock_status}")
        except Exception as e:
            logger.error(f"Error processing frame: {e}")
    
    def send_command_to_device(self, device_serial, command, payload=b''):
        """向特定设备发送命令"""
        with device_lock:
            if device_serial not in connected_devices:
                logger.error(f"Device {binascii.hexlify(device_serial)} not connected")
                return False
            
            socket = connected_devices[device_serial]["socket"]
        
        try:
            frame = ParkingLockProtocol.build_frame(command, payload)
            
            # 获取命令名称
            command_name = ""
            if command == 0x84:
                command_name = "远程开锁"
            elif command == 0x85:
                command_name = "远程关锁"
            elif command == 0x8E:
                command_name = "设置锁状态"
            elif command == 0x86:
                command_name = "同步时间"
            elif command == 0x8F:
                command_name = "远程重启"
            
            # 记录发送的完整帧
            ParkingLockProtocol.log_frame(frame, "SEND", command_name)
            
            socket.send(frame)
            logger.info(f"Sent command 0x{command:02X} to device {binascii.hexlify(device_serial)}")
            return True
        except Exception as e:
            logger.error(f"Error sending command to device {binascii.hexlify(device_serial)}: {e}")
            return False
    
    def remote_open_lock(self, device_serial):
        """远程开锁"""
        # 构建流水号（4字节）
        flow_number = struct.pack("<I", int(time.time()) % 10000)
        payload = device_serial + flow_number
        return self.send_command_to_device(device_serial, 0x84, payload)
    
    def remote_close_lock(self, device_serial):
        """远程关锁"""
        # 构建流水号（4字节）
        flow_number = struct.pack("<I", int(time.time()) % 10000)
        payload = device_serial + flow_number
        return self.send_command_to_device(device_serial, 0x85, payload)
    
    def set_lock_state(self, device_serial, state):
        """设置锁状态（0:正常, 1:保持开, 2:保持关）"""
        # 构建流水号（4字节）
        flow_number = struct.pack("<I", int(time.time()) % 10000)
        payload = device_serial + flow_number + bytes([state])
        return self.send_command_to_device(device_serial, 0x8E, payload)
    
    def sync_time(self, device_serial):
        """同步时间"""
        payload = device_serial + struct.pack("<I", int(time.time()))
        return self.send_command_to_device(device_serial, 0x86, payload)
    
    def remote_restart(self, device_serial):
        """远程重启设备"""
        return self.send_command_to_device(device_serial, 0x8F)
    
    def get_connected_devices(self):
        """获取当前连接的设备列表"""
        with device_lock:
            devices = []
            current_time = time.time()
            for serial, info in connected_devices.items():
                devices.append({
                    "serial": binascii.hexlify(serial).decode('utf-8'),
                    "address": info["address"],
                    "last_heartbeat": datetime.fromtimestamp(info["last_heartbeat"]).strftime('%Y-%m-%d %H:%M:%S'),
                    "last_heartbeat_seconds_ago": int(current_time - info["last_heartbeat"])
                })
        return devices
        
    def get_device_status(self, device_serial):
        """获取设备详细状态"""
        with device_lock:
            if device_serial in connected_devices and "heartbeat_data" in connected_devices[device_serial]:
                return connected_devices[device_serial]["heartbeat_data"]
        return None
    
    def get_all_device_statuses(self):
        """获取所有设备的详细状态"""
        device_statuses = []
        with device_lock:
            for serial, info in connected_devices.items():
                if "heartbeat_data" in info:
                    status_data = info["heartbeat_data"].copy()  # Make a copy to avoid reference issues
                    status_data["address"] = info["address"]
                    status_data["last_heartbeat"] = info["last_heartbeat"]
                    device_statuses.append(status_data)
        return device_statuses


def main():
    """主函数"""
    # 服务器配置
    HOST = '0.0.0.0'
    PORT = 11457
    
    # 创建并启动服务器
    server = ParkingLockServer(HOST, PORT)
    if server.start():
        logger.info("Server started successfully")
        
        # 创建一个简单的命令行界面
        try:
            while True:
                cmd = input("Enter command (list/status/open/close/hold_open/hold_close/normal/restart/exit): ")
                
                if cmd == "exit":
                    break
                
                elif cmd == "list":
                    devices = server.get_connected_devices()
                    if devices:
                        print("\nConnected devices:")
                        for i, device in enumerate(devices):
                            print(f"{i+1}. Serial: {device['serial']}, Address: {device['address']}, Last heartbeat: {device['last_heartbeat']} ({device['last_heartbeat_seconds_ago']}s ago)")
                    else:
                        print("No devices connected")
                elif cmd == "status":
                    devices = server.get_connected_devices()
                    if not devices:
                        print("No devices connected")
                        continue
                    
                    # 列出设备供选择
                    print("\nSelect a device to view status:")
                    for i, device in enumerate(devices):
                        print(f"{i+1}. Serial: {device['serial']}, Address: {device['address']}")
                    
                    try:
                        choice = int(input("Enter device number (0 to cancel): "))
                        if choice == 0:
                            continue
                        
                        if choice < 1 or choice > len(devices):
                            print("Invalid device number")
                            continue
                        
                        device = devices[choice-1]
                        device_serial = binascii.unhexlify(device['serial'])
                        
                        # 使用bytes类型作为字典键
                        device_serial = bytes(device_serial)
                        
                        with device_lock:
                            if device_serial in connected_devices and "heartbeat_data" in connected_devices[device_serial]:
                                hb = connected_devices[device_serial]["heartbeat_data"]
                                print("\n设备详细状态:")
                                print(f"  序列号: {binascii.hexlify(hb['serial_number']).decode('utf-8')}")
                                print(f"  设备状态: {hb['device_status']} ({hb['device_status_description']})")
                                print(f"  车辆状态: {hb['car_status']} ({hb['car_status_description']})")
                                print(f"  常控状态: {hb['control_status']} ({hb['control_status_description']})")
                                print(f"  3.7V电池: {hb['battery_3_7v']}V")
                                print(f"  12V电池: {hb['battery_12v']:.1f}V")
                                print(f"  4G信号强度: {hb['signal_strength']}")
                                print(f"  流水号: {hb['flow_number']}")
                                
                                if hb['error_code'] > 0:
                                    print(f"  错误码: 0x{hb['error_code']:04X}")
                                    print(f"  错误描述: {', '.join(hb['error_descriptions'])}")
                                else:
                                    print("  设备正常，无错误")
                                
                                print(f"  当前地感频率: {hb['current_frequency']}")
                                print(f"  无车基准: {hb['no_car_base']}")
                                print(f"  有车基准: {hb['car_base']}")
                                print(f"  有车万分比: {hb['car_ratio']}")
                                print(f"  无车万分比: {hb['no_car_ratio']}")
                                
                                # 显示水浸检测状态
                                water_status = "有水" if hb['water_detection'] == 1 else "无水"
                                print(f"  进水检测: {water_status}")
                            else:
                                print(f"No heartbeat data available for device {device['serial']}")
                    except ValueError:
                        print("Invalid input. Please enter a number.")
                elif cmd in ["open", "close", "hold_open", "hold_close", "normal", "restart"]:
                    devices = server.get_connected_devices()
                    if not devices:
                        print("No devices connected")
                        continue
                    
                    # 列出设备供选择
                    print("\nSelect a device:")
                    for i, device in enumerate(devices):
                        print(f"{i+1}. Serial: {device['serial']}, Address: {device['address']}")
                    
                    try:
                        choice = int(input("Enter device number (0 to cancel): "))
                        if choice == 0:
                            continue
                        
                        if choice < 1 or choice > len(devices):
                            print("Invalid device number")
                            continue
                        
                        device = devices[choice-1]
                        device_serial = binascii.unhexlify(device['serial'])
                        
                        if cmd == "open":
                            if server.remote_open_lock(device_serial):
                                print(f"Open lock command sent to device {device['serial']}")
                            else:
                                print(f"Failed to send open lock command to device {device['serial']}")
                        
                        elif cmd == "close":
                            if server.remote_close_lock(device_serial):
                                print(f"Close lock command sent to device {device['serial']}")
                            else:
                                print(f"Failed to send close lock command to device {device['serial']}")
                        
                        elif cmd == "hold_open":
                            if server.set_lock_state(device_serial, 1):
                                print(f"Hold open command sent to device {device['serial']}")
                            else:
                                print(f"Failed to send hold open command to device {device['serial']}")
                        
                        elif cmd == "hold_close":
                            if server.set_lock_state(device_serial, 2):
                                print(f"Hold close command sent to device {device['serial']}")
                            else:
                                print(f"Failed to send hold close command to device {device['serial']}")
                        
                        elif cmd == "normal":
                            if server.set_lock_state(device_serial, 0):
                                print(f"Normal state command sent to device {device['serial']}")
                            else:
                                print(f"Failed to send normal state command to device {device['serial']}")
                        
                        elif cmd == "restart":
                            if server.remote_restart(device_serial):
                                print(f"Restart command sent to device {device['serial']}")
                            else:
                                print(f"Failed to send restart command to device {device['serial']}")
                    
                    except ValueError:
                        print("Invalid input. Please enter a number.")
                
                else:
                    print("Unknown command")
                
                print()  # 空行
        
        except KeyboardInterrupt:
            print("\nExiting...")
        
        finally:
            server.stop()
    else:
        logger.error("Failed to start server")


if __name__ == "__main__":
    main()