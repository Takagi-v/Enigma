import React, { useEffect, useRef, useState, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import "./styles/Map.css";
import config from '../config';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import { Input, Drawer, Select, Card, Empty, Spin, Modal } from 'antd';
import usePlacesAutocomplete, {
  getGeocode,
  getLatLng,
} from "use-places-autocomplete";

const { Search } = Input;
const { Option } = Select;

const defaultCenter = {
  lat: 39.915,  // 默认中心点纬度
  lng: 116.404  // 默认中心点经度
};

const defaultZoom = 15;

const mapStyles = {
  width: '100%',
  height: '100%'
};

const detailMapStyles = {
  width: '100%',
  height: '400px',
  borderRadius: '8px',
  overflow: 'hidden'
};

// 自定义图标配置
const parkingIcon = {
  url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40">
      <circle cx="20" cy="20" r="18" fill="#1967D2" stroke="white" stroke-width="2"/>
      <text x="20" y="27" font-size="22" font-family="Arial, sans-serif" font-weight="bold" 
        fill="white" text-anchor="middle">P</text>
    </svg>
  `),
  scaledSize: window.google?.maps?.Size ? new window.google.maps.Size(40, 40) : null,
  anchor: window.google?.maps?.Point ? new window.google.maps.Point(20, 20) : null
};

const userLocationIcon = {
  path: window.google?.maps?.SymbolPath?.CIRCLE,
  fillColor: '#4285F4',
  fillOpacity: 1,
  strokeWeight: 2,
  strokeColor: '#ffffff',
  scale: 8
};

// 地图库配置 - 确保在所有模式下都加载所需的库
const libraries = ["places"];

// 添加时间验证相关函数
const checkParkingTime = (openingHours) => {
  const [start, end] = openingHours.split('-');
  const [startHour, startMin] = start.split(':').map(Number);
  const [endHour, endMin] = end.split(':').map(Number);
  
  // 获取纽约时间
  const nyTime = new Date().toLocaleString("en-US", {timeZone: "America/New_York"});
  const nyDate = new Date(nyTime);
  const currentHour = nyDate.getHours();
  const currentMin = nyDate.getMinutes();
  
  // 计算当前时间到结束时间的分钟差
  const currentTotalMins = currentHour * 60 + currentMin;
  const endTotalMins = endHour * 60 + endMin;
  const minsUntilClose = endTotalMins - currentTotalMins;
  
  // 如果结束时间是第二天（比如 00:00），加上24小时
  const adjustedMinsUntilClose = minsUntilClose < 0 ? minsUntilClose + 24 * 60 : minsUntilClose;
  
  return {
    isNearClosing: adjustedMinsUntilClose <= 60, // 离关闭时间不到1小时
    minsUntilClose: adjustedMinsUntilClose
  };
};

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
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [parkingSpots, setParkingSpots] = useState([]);
  const [sortType, setSortType] = useState('distance');
  const [sortedSpots, setSortedSpots] = useState([]);
  const [currentPoint, setCurrentPoint] = useState(null);
  const [searchValue, setSearchValue] = useState("");
  const [selectedMarker, setSelectedMarker] = useState(null);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [drawerHeight, setDrawerHeight] = useState(400);
  const drawerRef = useRef(null);
  const [isDrawerMounted, setIsDrawerMounted] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [startY, setStartY] = useState(0);
  const [startHeight, setStartHeight] = useState(0);
  const minHeight = 200;
  const maxHeight = window.innerHeight * 0.8;
  const [isLoadingSpots, setIsLoadingSpots] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [isUserInitiated, setIsUserInitiated] = useState(false);

  // 加载 Google Maps API - 使用相同的 libraries 配置
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY,
    libraries,
    language: 'zh-CN',
    region: 'CN'
  });

  // Places Autocomplete 设置
  const {
    ready,
    value,
    suggestions: { status, data },
    setValue,
    clearSuggestions,
  } = usePlacesAutocomplete({
    requestOptions: {
      language: 'zh-CN',
      region: 'CN',
      location: { lat: () => userLocation?.lat || defaultCenter.lat, lng: () => userLocation?.lng || defaultCenter.lng },
      radius: 20000,
    },
    debounce: 300,
    cache: 24 * 60 * 60,
    enabled: mode !== 'detail', // 在详情模式下禁用
  });

  // 获取用户位置
  useEffect(() => {
    if (mode === 'detail' && initialSpot) {
      setUserLocation({ lat: initialSpot.lat, lng: initialSpot.lng });
      setLoading(false);
      return;
    }

    const getLocation = () => {
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            setUserLocation({
              lat: position.coords.latitude,
              lng: position.coords.longitude
            });
            setLoading(false);
          },
          (error) => {
            console.error('获取位置失败:', error);
            setUserLocation(defaultCenter);
            setLoading(false);
            setError('无法获取您的位置，已使用默认位置');
          }
        );
      } else {
        setUserLocation(defaultCenter);
        setLoading(false);
        setError('您的浏览器不支持地理定位');
      }
    };

    getLocation();
  }, [mode, initialSpot]);

  // 获取停车位数据
  useEffect(() => {
    const fetchParkingSpots = async () => {
      setIsLoadingSpots(true);
      try {
        const response = await fetch(`${config.API_URL}/parking-spots`);
        const data = await response.json();
        setParkingSpots(data.spots || []);
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

  // 计算距离的函数
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371; // 地球半径（公里）
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  };

  // 更新排序后的停车位
  const updateSortedSpots = async (lat, lng) => {
    setIsCalculating(true);
    try {
      const spotsWithDistance = parkingSpots
        .filter(spot => spot?.coordinates)
        .map(spot => {
          const [spotLat, spotLng] = spot.coordinates.split(',').map(Number);
          const distanceFromPoint = calculateDistance(lat, lng, spotLat, spotLng);
          const distanceFromUser = userLocation ? 
            calculateDistance(userLocation.lat, userLocation.lng, spotLat, spotLng) : 
            distanceFromPoint;
          return {
            ...spot,
            distance: isUserInitiated ? distanceFromUser : distanceFromPoint
          };
        });

      const sorted = [...spotsWithDistance].sort((a, b) => {
        switch(sortType) {
          case 'price':
            return parseFloat(a.price || 0) - parseFloat(b.price || 0);
          case 'name':
            return (a.location || '').localeCompare(b.location || '');
          case 'distance':
          default:
            return (a.distance || 0) - (b.distance || 0);
        }
      });

      setSortedSpots(sorted);
      return true;
    } catch (error) {
      console.error('计算距离时出错:', error);
      return false;
    } finally {
      setIsCalculating(false);
    }
  };

  // 处理地图点击
  const handleMapClick = useCallback((e) => {
    if (mode === "select") {
      const newLocation = {
        lat: e.latLng.lat(),
        lng: e.latLng.lng()
      };
      setSelectedLocation(newLocation);
      if (onLocationSelect) {
        onLocationSelect(newLocation);
      }
    }
  }, [mode, onLocationSelect]);

  // 处理地点搜索
  const handlePlaceSelect = async (description) => {
    try {
      const results = await getGeocode({ address: description });
      const { lat, lng } = await getLatLng(results[0]);
      
      setCurrentPoint({ lat, lng });
      mapRef.current?.panTo({ lat, lng });
      mapRef.current?.setZoom(16);
      
      await updateSortedSpots(lat, lng);
      showDrawer();
      clearSuggestions();
    } catch (error) {
      console.error("Error: ", error);
    }
  };

  // 处理搜索按钮点击
  const handleSearch = async () => {
    if (!value) return;
    try {
      const results = await getGeocode({ address: value });
      const { lat, lng } = await getLatLng(results[0]);
      
      setCurrentPoint({ lat, lng });
      mapRef.current?.panTo({ lat, lng });
      mapRef.current?.setZoom(16);
      
      await updateSortedSpots(lat, lng);
      showDrawer();
      clearSuggestions();
    } catch (error) {
      console.error("搜索位置失败:", error);
    }
  };

  // 处理拖动开始
  const handleDragStart = (e) => {
    const clientY = e.type === 'mousedown' ? e.clientY : e.touches[0].clientY;
    setIsDragging(true);
    setStartY(clientY);
    setStartHeight(drawerHeight);
  };

  // 处理拖动过程
  const handleDragMove = (e) => {
    if (!isDragging) return;
    
    const clientY = e.type === 'mousemove' ? e.clientY : e.touches[0].clientY;
    const delta = startY - clientY;
    const newHeight = Math.min(Math.max(startHeight + delta, minHeight), maxHeight);
    
    setDrawerHeight(newHeight);
    e.preventDefault();
    e.stopPropagation();
  };

  // 处理拖动结束
  const handleDragEnd = () => {
    setIsDragging(false);
    document.removeEventListener('mousemove', handleDragMove);
    document.removeEventListener('mouseup', handleDragEnd);
    document.removeEventListener('touchmove', handleDragMove);
    document.removeEventListener('touchend', handleDragEnd);
  };

  // 处理鼠标按下
  const handleMouseDown = (e) => {
    handleDragStart(e);
    document.addEventListener('mousemove', handleDragMove);
    document.addEventListener('mouseup', handleDragEnd);
  };

  // 处理触摸开始
  const handleTouchStart = (e) => {
    handleDragStart(e);
    document.addEventListener('touchmove', handleDragMove, { passive: false });
    document.addEventListener('touchend', handleDragEnd);
  };

  // 组件卸载时清理
  useEffect(() => {
    return () => {
      document.removeEventListener('mousemove', handleDragMove);
      document.removeEventListener('mouseup', handleDragEnd);
      document.removeEventListener('touchmove', handleDragMove);
      document.removeEventListener('touchend', handleDragEnd);
    };
  }, []);

  const showDrawer = async (isUserAction = false) => {
    setIsUserInitiated(isUserAction);
    setIsDrawerMounted(true);

    if (isUserAction && userLocation) {
      setCurrentPoint(userLocation);
      await updateSortedSpots(userLocation.lat, userLocation.lng);
    }

    requestAnimationFrame(() => {
      setDrawerVisible(true);
    });
  };

  const hideDrawer = () => {
    setDrawerVisible(false);
    setTimeout(() => {
      setIsDrawerMounted(false);
    }, 300);
  };

  // 处理排序变化
  const handleSortChange = (value) => {
    setSortType(value);
    if (sortedSpots.length > 0) {
      const sorted = [...sortedSpots].sort((a, b) => {
        switch(value) {
          case 'price':
            return parseFloat(a.price || 0) - parseFloat(b.price || 0);
          case 'name':
            return (a.location || '').localeCompare(b.location || '');
          case 'distance':
          default:
            return (a.distance || 0) - (b.distance || 0);
        }
      });
      setSortedSpots(sorted);
    }
  };

  // 处理滚动
  const handleScroll = (e) => {
    const element = e.target;
    const isAtTop = element.scrollTop === 0;
    const wheelEvent = e.nativeEvent;
    
    if (wheelEvent.deltaY > 0 && isAtTop && !isExpanded) {
      // 在顶部继续向下滚动，展开drawer
      setIsExpanded(true);
      setDrawerHeight(maxHeight);
    } else if (wheelEvent.deltaY < 0 && isAtTop && isExpanded) {
      // 在顶部继续向上滚动，收缩drawer
      setIsExpanded(false);
      setDrawerHeight(400);
    }
  };

  // 添加回到用户位置的函数
  const handleReturnToUserLocation = useCallback(() => {
    if (userLocation && mapRef.current) {
      mapRef.current.panTo(userLocation);
      mapRef.current.setZoom(16);
    }
  }, [userLocation]);

  // 缓存地图配置
  const mapOptions = useMemo(() => ({
    gestureHandling: mode === 'detail' ? 'cooperative' : 'greedy',
    disableDefaultUI: false,
    mapTypeId: 'roadmap',
    scrollwheel: mode !== 'detail',
    zoomControl: true,
    mapTypeControl: mode !== 'detail',
    scaleControl: true,
    streetViewControl: mode !== 'detail',
    rotateControl: mode !== 'detail',
    fullscreenControl: mode !== 'detail',
    mapTypeControlOptions: {
      position: window.google?.maps?.ControlPosition?.TOP_LEFT,
      style: window.google?.maps?.MapTypeControlStyle?.DROPDOWN_MENU
    },
    zoomControlOptions: {
      position: window.google?.maps?.ControlPosition?.RIGHT_CENTER
    },
    streetViewControlOptions: {
      position: window.google?.maps?.ControlPosition?.RIGHT_CENTER
    },
    fullscreenControlOptions: {
      position: window.google?.maps?.ControlPosition?.RIGHT_TOP
    }
  }), [mode]);

  // 缓存地图样式
  const currentMapStyles = useMemo(() => 
    mode === 'detail' ? detailMapStyles : mapStyles
  , [mode]);

  // 缓存地图中心点
  const mapCenter = useMemo(() => 
    userLocation || defaultCenter
  , [userLocation]);

  // 缓存地图组件
  const renderMap = useMemo(() => (
    <GoogleMap
      mapContainerStyle={currentMapStyles}
      center={mapCenter}
      zoom={mode === 'detail' ? 17 : defaultZoom}
      onClick={handleMapClick}
      onLoad={map => {
        mapRef.current = map;
        map.setOptions(mapOptions);
      }}
      options={mapOptions}
    >
      {/* 用户位置标记 */}
      {userLocation && (
        <Marker
          position={userLocation}
          icon={userLocationIcon}
        />
      )}

      {/* 停车位标记 - 仅在非详情模式下显示 */}
      {mode !== 'detail' && parkingSpots.map((spot) => {
        if (!spot.coordinates) return null;
        const [lat, lng] = spot.coordinates.split(',').map(Number);
        return (
          <Marker
            key={spot.id}
            position={{ lat, lng }}
            icon={parkingIcon}
            onClick={() => setSelectedMarker(spot)}
          />
        );
      })}

      {/* 详情模式下的停车位标记 */}
      {mode === 'detail' && userLocation && (
        <Marker
          position={userLocation}
          icon={parkingIcon}
        />
      )}

      {/* 信息窗口 */}
      {selectedMarker && (
        <InfoWindow
          position={{
            lat: parseFloat(selectedMarker.coordinates.split(',')[0]),
            lng: parseFloat(selectedMarker.coordinates.split(',')[1])
          }}
          onCloseClick={() => setSelectedMarker(null)}
          options={{
            pixelOffset: new window.google.maps.Size(0, -30)
          }}
        >
          <div 
            className="info-window-content"
            onClick={() => {
              const timeCheck = checkParkingTime(selectedMarker.opening_hours);
              if (timeCheck.isNearClosing) {
                Modal.confirm({
                  title: '停车场即将关闭',
                  content: `该停车场将在${Math.floor(timeCheck.minsUntilClose)}分钟后关闭，请确保您能在关闭前离开。是否继续？`,
                  okText: '继续',
                  cancelText: '取消',
                  onOk: () => navigate(`/parking/${selectedMarker.id}`)
                });
              } else {
                navigate(`/parking/${selectedMarker.id}`);
              }
            }}
            style={{
              cursor: 'pointer',
              padding: '8px',
              minWidth: '200px'
            }}
          >
            <h3 style={{ 
              margin: '0 0 8px 0',
              fontSize: '16px',
              color: '#1a1a1a'
            }}>{selectedMarker.location}</h3>
            <p style={{
              margin: '4px 0',
              color: '#f5222d',
              fontSize: '15px',
              fontWeight: 'bold'
            }}>¥{selectedMarker.price}/小时</p>
            <p style={{
              margin: '4px 0',
              color: '#52c41a',
              fontSize: '13px'
            }}>
              {selectedMarker.status === 'available' ? '空闲' : '使用中'}
            </p>
            <p style={{
              margin: '4px 0',
              color: '#666',
              fontSize: '13px'
            }}>开放时段: {selectedMarker.opening_hours}</p>
            {checkParkingTime(selectedMarker.opening_hours).isNearClosing && (
              <p style={{
                margin: '4px 0',
                color: '#ff4d4f',
                fontSize: '13px',
                fontWeight: 'bold'
              }}>
                距离关闭还有{Math.floor(checkParkingTime(selectedMarker.opening_hours).minsUntilClose)}分钟
              </p>
            )}
            <p style={{
              margin: '4px 0',
              color: '#666',
              fontSize: '13px'
            }}>联系方式: {selectedMarker.contact}</p>
            <div style={{
              marginTop: '8px',
              textAlign: 'right',
              color: '#1890ff',
              fontSize: '13px'
            }}>
              点击查看详情 →
            </div>
          </div>
        </InfoWindow>
      )}

      {/* 选中位置标记 */}
      {selectedLocation && mode === "select" && (
        <Marker
          position={selectedLocation}
          icon={parkingIcon}
        />
      )}
    </GoogleMap>
  ), [
    currentMapStyles,
    mapCenter,
    mode,
    handleMapClick,
    mapOptions,
    userLocation,
    parkingSpots,
    selectedMarker,
    selectedLocation
  ]);

  if (loadError) {
    return <div className="map-error">地图加载失败: {loadError.message}</div>;
  }

  if (!isLoaded || loading) {
    return <div className="map-loading"><Spin tip="正在加载地图..." /></div>;
  }

  return (
    <ErrorBoundary>
      <div className={mode === 'detail' ? 'detail-map-container' : 'fullscreen-map-container'}>
        {!hideSearch && mode !== 'detail' && (
          <div className="map-search-container">
            <div className="search-box">
              <input
                value={value}
                onChange={(e) => setValue(e.target.value)}
                disabled={!ready}
                placeholder="搜索地点（如：万达广场）"
                className="search-input"
                onKeyPress={(e) => {
                  if (e.key === 'Enter') {
                    handleSearch();
                  }
                }}
              />
              <button 
                className="search-button"
                onClick={handleSearch}
                disabled={!ready}
              >
                搜索
              </button>
            </div>
            {status === "OK" && value && (
              <ul className="suggestions-list">
                {data.map(({ place_id, description }) => (
                  <li
                    key={place_id}
                    onClick={() => handlePlaceSelect(description)}
                    className="suggestion-item"
                  >
                    {description}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className={mode === 'detail' ? 'parking-detail-map-wrapper' : 'fullscreen-map-wrapper'}>
          {renderMap}
        </div>

        {mode !== 'detail' && (
          <div className="map-controls">
            <button 
              className="map-control-button"
              onClick={() => showDrawer(true)}
              aria-label="显示停车位列表"
            >
              <svg viewBox="0 0 24 24">
                <path d="M3 18h18v-2H3v2zm0-5h18v-2H3v2zm0-7v2h18V6H3z"/>
              </svg>
            </button>
            <button 
              className="map-control-button"
              onClick={handleReturnToUserLocation}
              aria-label="回到我的位置"
            >
              <svg viewBox="0 0 24 24">
                <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3c-.46-4.17-3.77-7.48-7.94-7.94V1h-2v2.06C6.83 3.52 3.52 6.83 3.06 11H1v2h2.06c.46 4.17 3.77 7.48 7.94 7.94V23h2v-2.06c4.17-.46 7.48-3.77 7.94-7.94H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
              </svg>
            </button>
          </div>
        )}

        {mode !== 'detail' && isDrawerMounted && (
          <>
            <div 
              className={`drawer-overlay ${drawerVisible ? 'visible' : ''}`}
              onClick={hideDrawer}
            />
            <div 
              ref={drawerRef}
              className={`parking-spots-panel ${drawerVisible ? 'visible' : ''} ${isExpanded ? 'expanded' : ''}`}
              style={{ height: drawerHeight + 'px' }}
            >
              <div className="drawer-handle" />
              <div className="panel-header">
                <h3>附近停车位</h3>
                <select
                  value={sortType}
                  onChange={(e) => handleSortChange(e.target.value)}
                  className="sort-select"
                >
                  <option value="distance">距离最近</option>
                  <option value="price">价格最低</option>
                  <option value="name">名称排序</option>
                </select>
              </div>
              <div 
                className="parking-spots-list" 
                onWheel={handleScroll}
                onTouchMove={(e) => {
                  const touch = e.touches[0];
                  const element = e.target;
                  const isAtTop = element.scrollTop === 0;
                  
                  if (isAtTop && !isExpanded && touch.clientY < e.target.getBoundingClientRect().top) {
                    setIsExpanded(true);
                    setDrawerHeight(maxHeight);
                  } else if (isAtTop && isExpanded && touch.clientY > e.target.getBoundingClientRect().top) {
                    setIsExpanded(false);
                    setDrawerHeight(400);
                  }
                }}
              >
                {!currentPoint ? (
                  <div className="empty-state">
                    <p>请先搜索位置或点击地图选择地点</p>
                  </div>
                ) : isLoadingSpots || isCalculating ? (
                  <div className="spots-loading">
                    <div className="loading-spinner" />
                    <p>正在搜索附近停车位...</p>
                  </div>
                ) : sortedSpots.length === 0 ? (
                  <div className="empty-state">
                    <p>附近暂无停车位信息</p>
                  </div>
                ) : (
                  sortedSpots.map((spot) => {
                    const timeCheck = checkParkingTime(spot.opening_hours);
                    return (
                      <div 
                        key={spot.id}
                        className="parking-spot-card"
                        onClick={() => {
                          if (timeCheck.isNearClosing) {
                            Modal.confirm({
                              title: '停车场即将关闭',
                              content: `该停车场将在${Math.floor(timeCheck.minsUntilClose)}分钟后关闭，请确保您能在关闭前离开。是否继续？`,
                              okText: '继续',
                              cancelText: '取消',
                              onOk: () => navigate(`/parking/${spot.id}`)
                            });
                          } else {
                            navigate(`/parking/${spot.id}`);
                          }
                        }}
                      >
                        <h3 className="spot-title">{spot.location}</h3>
                        <div className="spot-info">
                          <div className="spot-detail">
                            <span className="spot-price">¥{spot.price}/小时</span>
                          </div>
                          <div className="spot-detail">
                            <span className="spot-distance">{spot.distance.toFixed(1)}km</span>
                          </div>
                          <div className="spot-detail">
                            <span className={`status ${spot.status}`}>
                              {spot.status === 'available' ? '空闲' : '使用中'}
                            </span>
                          </div>
                          <div className="spot-detail">
                            <span className="spot-hours">开放时段: {spot.opening_hours}</span>
                            {timeCheck.isNearClosing && (
                              <span className="closing-warning">
                                距离关闭还有{Math.floor(timeCheck.minsUntilClose)}分钟
                              </span>
                            )}
                          </div>
                          {spot.contact && (
                            <div className="spot-detail">
                              <span>联系方式: {spot.contact}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </ErrorBoundary>
  );
}

export default Map;
