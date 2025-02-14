import React, { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import "./styles/Sidebar.css";
import { 
  HomeOutlined, 
  EnvironmentOutlined, 
  UserOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined,
  PhoneOutlined
} from "@ant-design/icons";

function Sidebar() {
  const [isActive, setIsActive] = useState(false);

  const toggleSidebar = () => {
    setIsActive(!isActive);
  };

  const closeSidebar = (e) => {
    if (
      isActive &&
      !document.querySelector(".sidebar")?.contains(e.target) &&
      !document.querySelector(".toggle-button")?.contains(e.target)
    ) {
      setIsActive(false);
    }
  };

  useEffect(() => {
    document.addEventListener("click", closeSidebar);
    
    // 处理移动端滚动
    if (isActive) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }

    return () => {
      document.removeEventListener("click", closeSidebar);
      document.body.style.overflow = '';
    };
  }, [isActive]);

  const menuItems = [
    { path: "/", icon: <EnvironmentOutlined />, text: "地图" },
    { path: "/profile", icon: <UserOutlined />, text: "个人" },
    { path: "/contact-us", icon: <PhoneOutlined />, text: "联系我们" }
  ];

  return (
    <>
      <button
        className="toggle-button"
        onClick={toggleSidebar}
        aria-label={isActive ? "收起菜单" : "展开菜单"}
      >
        {isActive ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
      </button>

      <div className={`sidebar-overlay ${isActive ? "active" : ""}`} onClick={() => setIsActive(false)} />
      
      <div className={`sidebar ${isActive ? "active" : ""}`}>
        <nav>
          <ul>
            {menuItems.map((item, index) => (
              <li key={index}>
                <Link 
                  to={item.path} 
                  className="sidebar-link"
                  onClick={() => setIsActive(false)}
                >
                  <span className="icon">{item.icon}</span>
                  <span className="text">{item.text}</span>
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>
    </>
  );
}

export default Sidebar;
