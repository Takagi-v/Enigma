import React, { useEffect, useRef, useState } from "react";
import "./styles/Map.css";
import config from '../config';

function Map({ onLocationSelect, mode = "view", initialSpot = null }) {
  const mapRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const [selectedLocation, setSelectedLocation] = useState(null);
  const [userLocation, setUserLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [parkingSpots, setParkingSpots] = useState([]);

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
      if (container.offsetHeight === 0) {
        container.style.height = '400px';
      }

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

      // 强制重新计算地图大小
      setTimeout(() => {
        map.setCenter(map.getCenter());
      }, 0);

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

  if (loading) {
    return <div className="map-loading">正在加载地图...</div>;
  }

  if (error) {
    return <div className="map-error">{error}</div>;
  }

  return (
    <div className="map-container">
      <div className="map-wrapper">
        <div ref={mapRef} className="map" />
        {mode === "select" && selectedLocation && (
          <div className="location-info">
            <h3>选中的位置</h3>
            <p>纬度: {selectedLocation.lat}</p>
            <p>经度: {selectedLocation.lng}</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Map;
