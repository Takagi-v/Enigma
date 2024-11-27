import React, { useState } from "react";
import { BrowserRouter as Router, Route, Routes } from "react-router-dom";
import "./components/styles/App.css";
import Home from "./components/Home";
import Profile from "./components/Profile";
import Messages from "./components/Messages";
import Sidebar from "./components/Sidebar";
import Auth from "./components/Auth";
import Map from "./components/Map"; // 导入新的 Map 组件
import { GoogleOAuthProvider } from '@react-oauth/google';
import ParkingSpotForm from "./components/ParkingSpotForm";
import Header from './components/Header';
import ParkingDetail from './components/ParkingDetail';
import { searchParking } from "./services/parkingService";
import ParkingSearch from "./components/ParkingSearch";

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="error-boundary">
          <h1>Something went wrong.</h1>
          <p>{this.state.error.message}</p>
          <button onClick={() => window.location.reload()}>Refresh Page</button>
        </div>
      );
    }

    return this.props.children;
  }
}

function App() {
  const [token, setToken] = useState(null);
  
  return (
    <GoogleOAuthProvider clientId="860966856382-u3nj7061n56h23agj3mvi0ntg72f13nn.apps.googleusercontent.com">
        <Router>
          <div className="App">
            <Header />
            <Sidebar />
            <main className="content">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/profile" element={<Profile />} />
                <Route path="/messages" element={<Messages token={token} />} />
                <Route path="/auth" element={<Auth />}/>
                <Route path="/map" element={<Map />} />
                <Route path="/publish" element={<ParkingSpotForm />} />
                <Route path="/parking/:id" element={<ParkingDetail />} />
                <Route path="/search" element={<ParkingSearch />} />
              </Routes>
            </main>
          </div>
        </Router>
    </GoogleOAuthProvider>
  );
}

export default App;
