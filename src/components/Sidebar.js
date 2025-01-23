import React, { useState } from "react";
import { Link } from "react-router-dom";
import "./styles/Sidebar.css";
import { 
  HomeOutlined, 
  MessageOutlined, 
  EnvironmentOutlined, 
  UserOutlined,
  SearchOutlined,
  MenuFoldOutlined,
  MenuUnfoldOutlined
} from "@ant-design/icons";

function Sidebar() {
  const [isActive, setIsActive] = useState(false);

  const toggleSidebar = () => {
    setIsActive(!isActive);
    document.body.classList.toggle("overlay", !isActive);
  };

  const closeSidebar = (e) => {
    if (
      isActive &&
      !document.querySelector(".sidebar").contains(e.target) &&
      !document.querySelector(".toggle-button").contains(e.target)
    ) {
      setIsActive(false);
      document.body.classList.remove("overlay");
    }
  };

  React.useEffect(() => {
    document.addEventListener("click", closeSidebar);
    return () => {
      document.removeEventListener("click", closeSidebar);
    };
  }, [isActive]);

  const menuItems = [
    { path: "/", icon: <EnvironmentOutlined />, text: "地图" },
    { path: "/parking-lots", icon: <HomeOutlined />, text: "停车场" },
    { path: "/messages", icon: <MessageOutlined />, text: "消息" },
    { path: "/profile", icon: <UserOutlined />, text: "个人" },
    { path: "/search", icon: <SearchOutlined />, text: "搜索停车位" },
  ];

  return (
    <>
      <div className={`sidebar ${isActive ? "active" : ""}`}>
        <button
          className="toggle-button"
          onClick={toggleSidebar}
          aria-label={isActive ? "收起菜单" : "展开菜单"}
        >
          {isActive ? <MenuFoldOutlined /> : <MenuUnfoldOutlined />}
        </button>
        <nav>
          <ul>
            {menuItems.map((item, index) => (
              <li key={index}>
                <Link to={item.path} className="sidebar-link">
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
