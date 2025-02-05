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
  const [sortType, setSortType] = useState('distance');
  const [sortedSpots, setSortedSpots] = useState([]);
  const [currentPoint, setCurrentPoint] = useState(null);
  const [searchValue, setSearchValue] = useState("");
  const searchInputRef = useRef(null);
  const autocompleteRef = useRef(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerHeight, setDrawerHeight] = useState(400);
  const drawerRef = useRef(null);
  const [isDrawerMounted, setIsDrawerMounted] = useState(false);
  let startY = 0;
  let startHeight = 0;
  const [isCalculating, setIsCalculating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [initialTouchY, setInitialTouchY] = useState(null);
  const [initialHeight, setInitialHeight] = useState(null);
  const minHeight = 200;
  const maxHeight = window.innerHeight * 0.8;
  const [isLoadingSpots, setIsLoadingSpots] = useState(false);

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
      setIsLoadingSpots(true);
      try {
        const response = await fetch(`${config.API_URL}/parking-spots`);
        const data = await response.json();
        setParkingSpots(data.spots || []);
        // 如果当前有搜索点，重新计算距离
        if (currentPoint) {
          await updateSortedSpots(currentPoint.lat, currentPoint.lng);
        }
      } catch (error) {
        console.error('获取停车位失败:', error);
      } finally {
        setIsLoadingSpots(false);
      }
    };

    if (mode !== 'detail') {
      fetchParkingSpots();
    }
  }, [mode, currentPoint]);

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

  // 初始化地图时添加所有停车位标记
  useEffect(() => {
    if (!userLocation || !mapRef.current || !window.BMap || loading) return;

    try {
      const map = new window.BMap.Map(mapRef.current);
      mapInstanceRef.current = map;

      if (mode === "detail" && initialSpot) {
        const [lat, lng] = initialSpot.coordinates.split(',');
        const point = new window.BMap.Point(lng, lat);
        map.centerAndZoom(point, 16);
        
        // 使用默认标记
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
        
        // 使用自定义用户位置图标
        const userIcon = new window.BMap.Icon(
          "https://api.map.baidu.com/images/geolocation-control/point/position-icon-14x14.png",
          new window.BMap.Size(14, 14),
          {
            anchor: new window.BMap.Size(7, 7)
          }
        );
        const userMarker = new window.BMap.Marker(point, { icon: userIcon });
        map.addOverlay(userMarker);
        
        // 添加所有停车位标记
        parkingSpots.forEach(spot => {
          if (!spot.coordinates) return;
          
          const [lat, lng] = spot.coordinates.split(',');
          const spotPoint = new window.BMap.Point(lng, lat);
          
          // 使用默认标记
          const marker = new window.BMap.Marker(spotPoint);
          map.addOverlay(marker);

          const infoWindow = new window.BMap.InfoWindow(`
            <div style="padding: 8px;">
              <h4>${spot.location}</h4>
              <p>价格: ¥${spot.price}/小时</p>
              <p>联系方式: ${spot.contact}</p>
              ${spot.average_rating ? `<p>评分: ${spot.average_rating.toFixed(1)}分</p>` : ''}
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
            
            const newMarker = new window.BMap.Marker(e.point);
            map.addOverlay(newMarker);
          });
        }
      }

    } catch (err) {
      console.error('地图初始化错误:', err);
      setError('地图加载失败，请刷新重试');
    }
  }, [userLocation, parkingSpots, mode, onLocationSelect, initialSpot, loading]);

  // 修改 handleSortChange 函数
  const handleSortChange = (value) => {
    setSortType(value);
    // 如果当前有数据，立即进行重新排序
    if (sortedSpots.length > 0) {
      const sorted = [...sortedSpots].sort((a, b) => {
        try {
          switch(value) { // 使用新的排序类型
            case 'rating':
              // 如果没有评分，则按距离排序
              if (!a.average_rating && !b.average_rating) {
                return (a.distance || 0) - (b.distance || 0);
              }
              // 如果只有一个有评分，有评分的排在前面
              if (!a.average_rating) return 1;
              if (!b.average_rating) return -1;
              // 都有评分则按评分排序
              return b.average_rating - a.average_rating;
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
      setSortedSpots(sorted);
    }
  };

  // 修改 updateSortedSpots 函数，在设置数据后立即应用当前的排序方式
  const updateSortedSpots = async (lat, lng) => {
    setIsCalculating(true);
    if (!Array.isArray(parkingSpots)) {
      console.error('停车位数据无效:', parkingSpots);
      setSortedSpots([]);
      setIsCalculating(false);
      return;
    }

    try {
      const spotsWithDistance = parkingSpots
        .filter(spot => spot && typeof spot === 'object')
        .map(spot => {
          try {
            if (!spot.coordinates || typeof spot.coordinates !== 'string') {
              return null;
            }

            const coords = spot.coordinates.split(',');
            if (coords.length !== 2) {
              return null;
            }

            const [spotLat, spotLng] = coords.map(coord => parseFloat(coord.trim()));
            
            if (isNaN(spotLat) || isNaN(spotLng)) {
              return null;
            }

            const R = 6371;
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
        .filter(spot => spot !== null);

      // 直接使用 handleSortChange 的排序逻辑
      handleSortChange(sortType);
      return true;
    } catch (error) {
      console.error('计算距离时出错:', error);
      setSortedSpots([]);
      return false;
    } finally {
      setIsCalculating(false);
    }
  };

  // 处理抽屉拖动开始
  const handleTouchStart = (e) => {
    setIsDragging(true);
    setInitialTouchY(e.touches[0].clientY);
    setInitialHeight(drawerHeight);
  };

  // 处理抽屉拖动
  const handleTouchMove = (e) => {
    if (!isDragging || initialTouchY === null) return;
    e.preventDefault();
    
    const currentTouchY = e.touches[0].clientY;
    const deltaY = initialTouchY - currentTouchY;
    const newHeight = Math.min(Math.max(initialHeight + deltaY, minHeight), maxHeight);
    
    setDrawerHeight(newHeight);
  };

  // 处理抽屉拖动结束
  const handleTouchEnd = () => {
    setIsDragging(false);
    setInitialTouchY(null);
  };

  // 处理鼠标拖动开始
  const handleMouseDown = (e) => {
    setIsDragging(true);
    setInitialTouchY(e.clientY);
    setInitialHeight(drawerHeight);
  };

  // 处理鼠标拖动
  const handleMouseMove = (e) => {
    if (!isDragging || initialTouchY === null) return;
    e.preventDefault();
    
    const deltaY = initialTouchY - e.clientY;
    const newHeight = Math.min(Math.max(initialHeight + deltaY, minHeight), maxHeight);
    
    setDrawerHeight(newHeight);
  };

  // 处理鼠标拖动结束
  const handleMouseUp = () => {
    setIsDragging(false);
    setInitialTouchY(null);
  };

  // 添加和移除鼠标事件监听器
  useEffect(() => {
    if (drawerVisible) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }
    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [drawerVisible, isDragging, initialTouchY, initialHeight]);

  // 处理抽屉显示
  const showDrawer = () => {
    setIsDrawerMounted(true);
    // 使用 requestAnimationFrame 确保挂载后再添加可见性，这样才能触发动画
    requestAnimationFrame(() => {
      setDrawerVisible(true);
    });
  };

  // 处理抽屉隐藏
  const hideDrawer = () => {
    setDrawerVisible(false);
    // 等待动画完成后再卸载组件
    setTimeout(() => {
      setIsDrawerMounted(false);
    }, 300); // 与 CSS 动画时长相匹配
  };

  // 修改搜索处理函数
  const handleSearch = () => {
    if (!searchValue) return;
    const localSearch = new window.BMap.LocalSearch(mapInstanceRef.current, {
      onSearchComplete: async results => {
        if (!results?.getCurrentNumPois()) return;
        
        const poi = results.getPoi(0);
        if (!poi?.point) return;

        mapInstanceRef.current.centerAndZoom(poi.point, 16);
        
        const searchIcon = new window.BMap.Icon(
          "https://api.map.baidu.com/images/marker_red_sprite.png",
          new window.BMap.Size(39, 25),
          { imageOffset: new window.BMap.Size(0, 0) }
        );
        const searchMarker = new window.BMap.Marker(poi.point, { icon: searchIcon });
        mapInstanceRef.current.addOverlay(searchMarker);
        
        setCurrentPoint(poi.point);
        showDrawer(); // 立即显示抽屉，但显示加载状态
      }
    });
    localSearch.search(searchValue);
  };

  // 修改 onconfirm 事件处理
  useEffect(() => {
    if (window.BMap && searchInputRef.current && !autocompleteRef.current) {
      const ac = new window.BMap.Autocomplete({
        input: searchInputRef.current,
        location: mapInstanceRef.current
      });

      ac.addEventListener('onconfirm', function(e) {
        const myValue = e.item.value;
        setSearchValue(myValue.province + myValue.city + myValue.district + myValue.street + myValue.business);
        
        const localSearch = new window.BMap.LocalSearch(mapInstanceRef.current, {
          onSearchComplete: async function(results) {
            if (results && results.getPoi(0)) {
              const poi = results.getPoi(0);
              mapInstanceRef.current.centerAndZoom(poi.point, 16);
              
              const searchIcon = new window.BMap.Icon(
                "https://api.map.baidu.com/images/marker_red_sprite.png",
                new window.BMap.Size(39, 25),
                { imageOffset: new window.BMap.Size(0, 0) }
              );
              const searchMarker = new window.BMap.Marker(poi.point, { icon: searchIcon });
              mapInstanceRef.current.addOverlay(searchMarker);
              
              setCurrentPoint(poi.point);
              // 等待数据计算完成后再显示抽屉
              const success = await updateSortedSpots(poi.point.lat, poi.point.lng);
              if (success) {
                showDrawer();
              }
            }
          }
        });
        localSearch.search(myValue.province + myValue.city + myValue.district + myValue.street + myValue.business);
      });

      autocompleteRef.current = ac;
    }
  }, [loading]);

  // 处理点击外部关闭
  const handleOutsideClick = (e) => {
    if (drawerRef.current && !drawerRef.current.contains(e.target)) {
      hideDrawer(); // 使用新的隐藏函数
    }
  };

  // 添加点击外部关闭事件监听
  useEffect(() => {
    if (drawerVisible) {
      document.addEventListener('mousedown', handleOutsideClick);
    }
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
    };
  }, [drawerVisible]);

  const content = (
    <>
      {!hideSearch && (
        <div className="map-search-container">
          <div className="search-box">
            <input
              ref={searchInputRef}
              type="text"
              className="search-input"
              placeholder="搜索地点（如：万达广场）"
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              onKeyPress={(e) => {
                if (e.key === 'Enter') {
                  handleSearch();
                }
              }}
            />
            <button 
              className="search-button"
              onClick={handleSearch}
            >
              搜索
            </button>
          </div>
        </div>
      )}
      <div className="fullscreen-map-container">
        <div className="map-wrapper">
          <div ref={mapRef} className="map" />
        </div>
        
        {isDrawerMounted && (
          <>
            <div 
              className={`drawer-overlay ${drawerVisible ? 'visible' : ''}`}
              onClick={hideDrawer}
            />
            <div 
              ref={drawerRef}
              className={`parking-spots-panel ${drawerVisible ? 'visible' : ''}`}
              style={{ 
                height: drawerHeight + 'px',
                cursor: isDragging ? 'grabbing' : 'default'
              }}
            >
              <div 
                className="panel-header"
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onMouseDown={handleMouseDown}
                style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
              >
                <div className="drawer-handle"></div>
                <h3>所有停车位</h3>
                <select
                  value={sortType}
                  onChange={(e) => handleSortChange(e.target.value)}
                  className="sort-select"
                >
                  <option value="rating">按评分排序</option>
                  <option value="distance">按距离排序</option>
                  <option value="price">按价格排序</option>
                  <option value="name">按名称排序</option>
                </select>
              </div>
              <div className="parking-spots-list">
                {!currentPoint ? (
                  <div className="empty-state">
                    <p>请先搜索位置</p>
                  </div>
                ) : isLoadingSpots || isCalculating ? (
                  <div className="spots-loading">
                    <div className="loading-spinner"></div>
                    <p>正在加载附近停车位...</p>
                  </div>
                ) : sortedSpots.length === 0 ? (
                  <div className="empty-state">
                    <p>附近暂无停车位信息</p>
                  </div>
                ) : (
                  sortedSpots.map((spot) => (
                    <div 
                      key={spot.id}
                      className="parking-spot-card"
                      onClick={() => navigate(`/parking/${spot.id}`)}
                    >
                      <h3>{spot.location}</h3>
                      <p>价格: ¥{spot.price}/小时</p>
                      <p>距离: {spot.distance}公里</p>
                      <p>评分: {spot.average_rating ? `${spot.average_rating.toFixed(1)}分` : '暂无评分'}</p>
                      <p>联系方式: {spot.contact}</p>
                    </div>
                  ))
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
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
