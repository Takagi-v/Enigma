import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import "./styles/Map.css";
import config from '../config';
import { Input, Drawer, Select, Card, Empty, Spin } from 'antd';

const { Search } = Input;
const { Option } = Select;

// 错误边界组件
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('地图组件错误:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <div className="map-error">地图加载失败，请刷新页面重试</div>;
    }
    return this.props.children;
  }
}

function Map({ onLocationSelect, mode = "view", initialSpot = null, hideSearch = false }) {
  const navigate = useNavigate();
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [parkingSpots, setParkingSpots] = useState([]);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [sortType, setSortType] = useState('distance');
  const [nearbySpots, setNearbySpots] = useState([]);
  const [spotsLoading, setSpotsLoading] = useState(false);

  // 确保百度地图 API 已加载
  useEffect(() => {
    const checkBMapAPI = () => {
      if (window.BMap) {
        return true;
      }
      return false;
    };

    const waitForBMap = () => {
      if (checkBMapAPI()) {
        setLoading(false);
      } else {
        setTimeout(waitForBMap, 100);
      }
    };

    waitForBMap();
  }, []);

  // 获取所有停车位信息
  useEffect(() => {
    const fetchParkingSpots = async () => {
      try {
        const response = await fetch(`${config.API_URL}/parking-spots`);
        const data = await response.json();
        setParkingSpots(data.spots || []);
      } catch (error) {
        console.error('获取停车位失败:', error);
      }
    };

    if (mode !== 'detail') {
      fetchParkingSpots();
    }
  }, [mode]);

  // 获取用户位置
  useEffect(() => {
    // 添加调试信息
    console.log('Environment:', process.env.NODE_ENV);
    console.log('Geolocation available:', 'geolocation' in navigator);
    console.log('Protocol:', window.location.protocol);
    
    if (window.location.protocol !== 'https:') {
      console.warn('Geolocation may not work without HTTPS');
    }
    
    if (mode === 'detail' && initialSpot) {
      const [lat, lng] = initialSpot.coordinates.split(',');
      setUserLocation({ lat: parseFloat(lat), lng: parseFloat(lng) });
      return;
    }

    const getLocation = async () => {
      if ("geolocation" in navigator) {
        try {
          const position = await new Promise((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(
              resolve,
              (error) => {
                console.error('Geolocation error:', error);
                // 根据具体错误类型给出提示
                switch(error.code) {
                  case error.PERMISSION_DENIED:
                    reject(new Error('用户拒绝了位置请求'));
                    break;
                  case error.POSITION_UNAVAILABLE:
                    reject(new Error('位置信息不可用'));
                    break;
                  case error.TIMEOUT:
                    reject(new Error('请求位置超时'));
                    break;
                  default:
                    reject(error);
                }
              },
              {
                enableHighAccuracy: true,
                timeout: 10000,
                maximumAge: 0
              }
            );
          });
          
          setUserLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        } catch (error) {
          console.error('获取位置失败:', error);
          // 使用默认位置（北京）
          setUserLocation({
            lat: 39.915,
            lng: 116.404
          });
          setError(error.message);
        }
      } else {
        console.warn('浏览器不支持地理位置');
        setUserLocation({
          lat: 39.915,
          lng: 116.404
        });
        setError('浏览器不支持地理位置');
      }
    };

    getLocation();
  }, [mode, initialSpot]);

  // 初始化地图
  useEffect(() => {
    if (!userLocation || !mapRef.current || !window.BMap || loading) return;

    try {
      // 确保地图容器有正确的尺寸
      const container = mapRef.current;
      // 如果已经有地图实例，先销毁
      if (mapInstanceRef.current) {
        mapInstanceRef.current.clearOverlays();
        mapInstanceRef.current = null;
      }

      const map = new window.BMap.Map(mapRef.current);
      mapInstanceRef.current = map;

      if (mode === "detail" && initialSpot) {
        const [lat, lng] = initialSpot.coordinates.split(',');
        const point = new window.BMap.Point(lng, lat);
        map.centerAndZoom(point, 16);
        
        const marker = new window.BMap.Marker(point);
        map.addOverlay(marker);

        const infoWindow = new window.BMap.InfoWindow(`
          <div style="padding: 8px;">
            <h4>${initialSpot.location}</h4>
            <p>价格: ¥${initialSpot.price}/小时</p>
            <p>联系方式: ${initialSpot.contact}</p>
          </div>
        `);

        marker.addEventListener('click', () => {
          map.openInfoWindow(infoWindow, point);
        });
        
        map.openInfoWindow(infoWindow, point);
      } else {
        const point = new window.BMap.Point(userLocation.lng, userLocation.lat);
        map.centerAndZoom(point, 15);
        map.enableScrollWheelZoom(true);
        
        const navigationControl = new window.BMap.NavigationControl({
          type: window.BMAP_NAVIGATION_CONTROL_LARGE,
          anchor: window.BMAP_ANCHOR_TOP_LEFT
        });
        map.addControl(navigationControl);

        const scaleControl = new window.BMap.ScaleControl({
          anchor: window.BMAP_ANCHOR_BOTTOM_LEFT
        });
        map.addControl(scaleControl);
        
        const userMarker = new window.BMap.Marker(point);
        map.addOverlay(userMarker);
        
        parkingSpots.forEach(spot => {
          if (!spot.coordinates) return;
          
          const [lat, lng] = spot.coordinates.split(',');
          const spotPoint = new window.BMap.Point(lng, lat);
          const marker = new window.BMap.Marker(spotPoint);
          map.addOverlay(marker);

          const infoWindow = new window.BMap.InfoWindow(`
            <div style="padding: 8px;">
              <h4>${spot.location}</h4>
              <p>价格: ¥${spot.price}/小时</p>
              <p>联系方式: ${spot.contact}</p>
            </div>
          `);

          marker.addEventListener('click', () => {
            map.openInfoWindow(infoWindow, spotPoint);
          });
        });
        
        if (mode === "select") {
          map.addEventListener("click", (e) => {
            const newLocation = {
              lat: e.point.lat,
              lng: e.point.lng,
            };
            setSelectedLocation(newLocation);
            if (onLocationSelect) {
              onLocationSelect(newLocation);
            }
            
            map.clearOverlays();
            map.addOverlay(userMarker);
            const newMarker = new window.BMap.Marker(e.point);
            map.addOverlay(newMarker);
          });
        }
      }

    } catch (err) {
      console.error('地图初始化错误:', err);
      setError('地图加载失败，请刷新重试');
    }

    return () => {
      if (mapInstanceRef.current) {
        const map = mapInstanceRef.current;
        map.clearOverlays();
        map.removeEventListener('click');
        mapInstanceRef.current = null;
      }
    };
  }, [userLocation, parkingSpots, mode, onLocationSelect, initialSpot, loading]);

  // 搜索附近停车位
  const searchNearbyParkingSpots = async (lat, lng) => {
    try {
      setSpotsLoading(true);
      setDrawerVisible(true); // 立即显示抽屉，不等待数据
      
      // 检查 parkingSpots 是否有效
      if (!Array.isArray(parkingSpots)) {
        console.error('停车位数据无效:', parkingSpots);
        setNearbySpots([]);
        return;
      }

      // 使用已有的 parkingSpots 数据
      const spotsWithDistance = parkingSpots
        .filter(spot => spot && typeof spot === 'object') // 确保每个spot是有效的对象
        .map(spot => {
          try {
            if (!spot.coordinates || typeof spot.coordinates !== 'string') {
              console.log('无效的坐标数据:', spot);
              return null;
            }

            const coords = spot.coordinates.split(',');
            if (coords.length !== 2) {
              console.log('坐标格式错误:', spot.coordinates);
              return null;
            }

            const [spotLat, spotLng] = coords.map(coord => parseFloat(coord.trim()));
            
            if (isNaN(spotLat) || isNaN(spotLng)) {
              console.log('无效的坐标值:', spot.coordinates);
              return null;
            }

            // 使用 Haversine 公式计算距离
            const R = 6371; // 地球半径（公里）
            const dLat = (spotLat - parseFloat(lat)) * Math.PI / 180;
            const dLng = (spotLng - parseFloat(lng)) * Math.PI / 180;
            const a = 
              Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(parseFloat(lat) * Math.PI / 180) * Math.cos(spotLat * Math.PI / 180) * 
              Math.sin(dLng/2) * Math.sin(dLng/2);
            const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            const distance = R * c;

            return {
              ...spot,
              distance: parseFloat(distance.toFixed(2))
            };
          } catch (error) {
            console.error('处理停车位数据错误:', error);
            return null;
          }
        })
        .filter(spot => spot !== null)
        .sort((a, b) => {
          try {
            switch(sortType) {
              case 'price':
                return parseFloat(a.price || 0) - parseFloat(b.price || 0);
              case 'name':
                return (a.location || '').localeCompare(b.location || '');
              case 'distance':
              default:
                return (a.distance || 0) - (b.distance || 0);
            }
          } catch (error) {
            console.error('排序错误:', error);
            return 0;
          }
        });

      console.log('处理后的数据:', spotsWithDistance);
      setNearbySpots(spotsWithDistance);
    } catch (error) {
      console.error('处理停车位数据失败:', error);
      setNearbySpots([]); // 确保在错误情况下也设置为空数组
    } finally {
      setSpotsLoading(false);
    }
  };

  // 处理排序方式变更
  const handleSortChange = (value) => {
    setSortType(value);
    // 重新排序现有数据
    setNearbySpots(prevSpots => {
      if (!Array.isArray(prevSpots)) return [];
      
      return [...prevSpots].sort((a, b) => {
        try {
          switch(value) {
            case 'price':
              return parseFloat(a.price || 0) - parseFloat(b.price || 0);
            case 'name':
              return (a.location || '').localeCompare(b.location || '');
            case 'distance':
            default:
              return (a.distance || 0) - (b.distance || 0);
          }
        } catch (error) {
          console.error('排序错误:', error);
          return 0;
        }
      });
    });
  };

  // 处理停车位点击
  const handleSpotClick = (spotId) => {
    navigate(`/parking/${spotId}`);
  };

  useEffect(() => {
    console.log('Drawer 可见性状态:', drawerVisible);
  }, [drawerVisible]);

  // 渲染停车位列表
  const renderParkingSpots = () => {
    console.log('渲染停车位列表:', nearbySpots);
    if (spotsLoading) {
      return (
        <div className="spots-loading">
          <Spin size="large" />
        </div>
      );
    }

    if (!nearbySpots.length) {
      return (
        <Empty 
          description="附近10公里内暂无停车位" 
          image={Empty.PRESENTED_IMAGE_SIMPLE}
        />
      );
    }

    return nearbySpots.map((spot) => (
      <Card 
        key={spot.id}
        className="parking-spot-card"
        onClick={() => handleSpotClick(spot.id)}
      >
        <h3>{spot.location}</h3>
        <p>价格: ¥{spot.price}/小时</p>
        <p>距离: {spot.distance}公里</p>
        <p>联系方式: {spot.contact}</p>
      </Card>
    ));
  };

  // 包装返回的 JSX 使用错误边界
  const content = (
    <div className="fullscreen-map-container">
      {!hideSearch && (
        <div className="map-search">
          <Search
            placeholder="搜索地点（如：万达广场）"
            allowClear
            enterButton="搜索"
            size="large"
            style={{ width: '100%', marginBottom: '10px' }}
            onSearch={value => {
              if (!value) return;
              const localSearch = new window.BMap.LocalSearch(mapInstanceRef.current, {
                onSearchComplete: results => {
                  if (!results?.getCurrentNumPois()) return;
                  
                  const poi = results.getPoi(0);
                  if (!poi?.point) return;

                  // 更新地图
                  mapInstanceRef.current.clearOverlays();
                  mapInstanceRef.current.centerAndZoom(poi.point, 16);
                  mapInstanceRef.current.addOverlay(new window.BMap.Marker(poi.point));

                  // 搜索附近停车位
                  searchNearbyParkingSpots(poi.point.lat, poi.point.lng);
                }
              });
              localSearch.search(value);
            }}
          />
        </div>
      )}
      <div className="map-wrapper">
        <div ref={mapRef} className="map" />
      </div>
      
      <Drawer
        title={
          <div className="drawer-header">
            <span>附近停车位</span>
            <Select
              value={sortType}
              style={{ width: 120 }}
              onChange={handleSortChange}
            >
              <Option value="distance">按距离排序</Option>
              <Option value="price">按价格排序</Option>
              <Option value="name">按名称排序</Option>
            </Select>
          </div>
        }
        placement="bottom"
        height={400}
        onClose={() => setDrawerVisible(false)}
        open={drawerVisible}
        className="parking-spots-drawer"
        destroyOnClose={true}
      >
        <div className="parking-spots-list">
          {renderParkingSpots()}
        </div>
      </Drawer>
    </div>
  );

  if (loading) {
    return <div className="map-loading">正在加载地图...</div>;
  }

  if (error) {
    return <div className="map-error">{error}</div>;
  }

  return <ErrorBoundary>{content}</ErrorBoundary>;
}

export default Map;
