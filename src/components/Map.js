import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "./styles/Map.css";
import config from '../config';
import { GOOGLE_MAPS_API_KEY, defaultCenter, defaultZoom, mapStyles } from '../config/maps';
import { GoogleMap, useJsApiLoader, Marker, InfoWindow } from '@react-google-maps/api';
import { Input, Drawer, Select, Card, Empty, Spin } from 'antd';
import usePlacesAutocomplete, {
  getGeocode,
  getLatLng,
} from "use-places-autocomplete";

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
  const [initialTouchY, setInitialTouchY] = useState(null);
  const [initialHeight, setInitialHeight] = useState(null);
  const minHeight = 200;
  const maxHeight = window.innerHeight * 0.8;
  const [isLoadingSpots, setIsLoadingSpots] = useState(false);

  // 加载 Google Maps API
  const { isLoaded, loadError } = useJsApiLoader({
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: ["places"],
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
      /* Google Places 选项 */
    },
    debounce: 300,
  });

  // 获取用户位置
  useEffect(() => {
    if (mode === 'detail' && initialSpot) {
      const [lat, lng] = initialSpot.coordinates.split(',');
      setUserLocation({ lat: parseFloat(lat), lng: parseFloat(lng) });
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
          return {
            ...spot,
            distance: calculateDistance(lat, lng, spotLat, spotLng)
          };
        });

      const sorted = [...spotsWithDistance].sort((a, b) => {
        switch(sortType) {
          case 'rating':
            if (!a.average_rating && !b.average_rating) return a.distance - b.distance;
            if (!a.average_rating) return 1;
            if (!b.average_rating) return -1;
            return b.average_rating - a.average_rating;
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

  // Drawer 相关函数
  const handleTouchStart = (e) => {
    setIsDragging(true);
    setInitialTouchY(e.touches[0].clientY);
    setInitialHeight(drawerHeight);
  };

  const handleTouchMove = (e) => {
    if (!isDragging || initialTouchY === null) return;
    e.preventDefault();
    
    const currentTouchY = e.touches[0].clientY;
    const deltaY = initialTouchY - currentTouchY;
    const newHeight = Math.min(Math.max(initialHeight + deltaY, minHeight), maxHeight);
    
    setDrawerHeight(newHeight);
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    setInitialTouchY(null);
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setInitialTouchY(e.clientY);
    setInitialHeight(drawerHeight);
  };

  const handleMouseMove = (e) => {
    if (!isDragging || initialTouchY === null) return;
    e.preventDefault();
    
    const deltaY = initialTouchY - e.clientY;
    const newHeight = Math.min(Math.max(initialHeight + deltaY, minHeight), maxHeight);
    
    setDrawerHeight(newHeight);
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setInitialTouchY(null);
  };

  const showDrawer = () => {
    setIsDrawerMounted(true);
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
          case 'rating':
            if (!a.average_rating && !b.average_rating) return a.distance - b.distance;
            if (!a.average_rating) return 1;
            if (!b.average_rating) return -1;
            return b.average_rating - a.average_rating;
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

  if (loadError) {
    return <div className="map-error">地图加载失败，请检查网络连接后重试</div>;
  }

  if (!isLoaded || loading) {
    return <div className="map-loading">正在加载地图...</div>;
  }

  return (
    <ErrorBoundary>
      <div className="map-container">
        {!hideSearch && (
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
              >
                搜索
              </button>
            </div>
            {status === "OK" && (
              <ul className="suggestions-list">
                {data.map(({ place_id, description }) => (
                  <li
                    key={place_id}
                    onClick={() => handlePlaceSelect(description)}
                  >
                    {description}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="map-wrapper">
          <GoogleMap
            mapContainerStyle={mapStyles}
            center={userLocation || defaultCenter}
            zoom={defaultZoom}
            onClick={handleMapClick}
            onLoad={map => {
              mapRef.current = map;
            }}
          >
            {/* 用户位置标记 */}
            {userLocation && (
              <Marker
                position={userLocation}
                icon={{
                  url: 'https://maps.google.com/mapfiles/ms/icons/blue-dot.png'
                }}
              />
            )}

            {/* 停车位标记 */}
            {parkingSpots.map((spot) => {
              if (!spot.coordinates) return null;
              const [lat, lng] = spot.coordinates.split(',').map(Number);
              return (
                <Marker
                  key={spot.id}
                  position={{ lat, lng }}
                  onClick={() => setSelectedMarker(spot)}
                />
              );
            })}

            {/* 信息窗口 */}
            {selectedMarker && (
              <InfoWindow
                position={{
                  lat: parseFloat(selectedMarker.coordinates.split(',')[0]),
                  lng: parseFloat(selectedMarker.coordinates.split(',')[1])
                }}
                onCloseClick={() => setSelectedMarker(null)}
              >
                <div>
                  <h3>{selectedMarker.location}</h3>
                  <p>价格: ¥{selectedMarker.price}/小时</p>
                  <p>评分: {selectedMarker.average_rating ? 
                    `${selectedMarker.average_rating.toFixed(1)}分` : 
                    '暂无评分'}</p>
                  <p>联系方式: {selectedMarker.contact}</p>
                </div>
              </InfoWindow>
            )}

            {/* 选中位置标记 */}
            {selectedLocation && mode === "select" && (
              <Marker
                position={selectedLocation}
                icon={{
                  url: 'https://maps.google.com/mapfiles/ms/icons/red-dot.png'
                }}
              />
            )}
          </GoogleMap>
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
                      <p>距离: {spot.distance.toFixed(2)}公里</p>
                      <p>评分: {spot.average_rating ? 
                        `${spot.average_rating.toFixed(1)}分` : 
                        '暂无评分'}</p>
                      <p>联系方式: {spot.contact}</p>
                    </div>
                  ))
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
