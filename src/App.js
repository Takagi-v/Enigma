import React, { useState, useEffect } from "react";
import { BrowserRouter as Router, Route, Routes, useLocation } from "react-router-dom";
import { GoogleOAuthProvider } from '@react-oauth/google';
import "./components/styles/App.css";
import Home from "./components/Home";
import Profile from "./components/Profile";
import EditProfile from "./components/EditProfile";
import Messages from "./components/Messages";
import Sidebar from "./components/Sidebar";
import Auth from "./components/Auth";
import Map from "./components/Map";
import ParkingSpotForm from "./components/ParkingSpotForm";
import Header from './components/Header';
import ParkingDetail from './components/ParkingDetail';
import ParkingUsage from './components/ParkingUsage';
import { searchParking } from "./services/parkingService";
import ParkingSearch from "./components/ParkingSearch";
import AdminLogin from './components/admin/AdminLogin';
import AdminDashboard from './components/admin/AdminDashboard';
import AddParkingSpot from './components/admin/AddParkingSpot';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import ParkingRecord from './components/ParkingRecord';
import ContactUs from './components/ContactUs';
import StripeProvider from './components/StripeProvider';
import PaymentSetup from './components/PaymentSetup';
import TopUp from './components/TopUp';
import config from './config';

const AppContent = () => {
  const location = useLocation();
  const isAdminPage = location.pathname.startsWith('/admin');

  return (
    <div className="App">
      <Header isAdminPage={isAdminPage} />
      {!isAdminPage && <Sidebar />}
      <main className="content">
        <Routes>
          <Route path="/" element={<Map />} />
          <Route path="/parking-lots" element={<Home />} />
          <Route path="/profile" element={
            <ProtectedRoute>
              <Profile />
            </ProtectedRoute>
          } />
          <Route path="/edit-profile" element={
            <ProtectedRoute>
              <EditProfile />
            </ProtectedRoute>
          } />
          <Route path="/messages" element={<Messages token={null} />} />
          <Route path="/auth" element={<Auth />}/>
          <Route path="/publish" element={<ParkingSpotForm />} />
          <Route path="/parking/:id" element={<ParkingDetail />} />
          <Route path="/parking/:id/use" element={<ParkingUsage />} />
          <Route path="/search" element={<ParkingSearch />} />
          <Route path="/parking-record/:id" element={
            <ProtectedRoute>
              <ParkingRecord />
            </ProtectedRoute>
          } />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/add-parking" element={<AddParkingSpot />} />
          <Route path="/contact-us" element={<ContactUs />} />
          <Route path="/payment-setup" element={<PaymentSetup />} />
          <Route path="/top-up" element={
            <ProtectedRoute>
              <TopUp />
            </ProtectedRoute>
          } />
        </Routes>
      </main>
    </div>
  );
};

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
  useEffect(() => {
    // 添加viewport meta标签以支持响应式设计
    const viewport = document.createElement('meta');
    viewport.name = "viewport";
    viewport.content = "width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no";
    document.head.appendChild(viewport);

    return () => {
      document.head.removeChild(viewport);
    };
  }, []);
  
  return (
    <GoogleOAuthProvider clientId={process.env.REACT_APP_GOOGLE_CLIENT_ID}>
      <AuthProvider>
        <StripeProvider>
          <Router>
            <AppContent />
          </Router>
        </StripeProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}

export default App;