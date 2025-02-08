import React, { useState } from "react";
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
    { path: "/profile", icon: <UserOutlined />, text: "个人" },
    { path: "/contact-us", icon: <PhoneOutlined />, text: "联系我们" }
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
