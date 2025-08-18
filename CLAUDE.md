# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

停车位共享平台 - A parking spot sharing platform with three main components:
1. **React Web App** (root): Desktop/browser application with Google Maps and Stripe integration
2. **React Native/Expo App** (Goparkme/): Mobile iOS/Android application  
3. **Node.js Backend** (backend/): Express API server with WebSocket support and SQLite database

## Development Commands

### Web Application (React)
```bash
npm start           # Start development server on port 5050
npm run build       # Build for production
npm test           # Run tests
```

### Mobile Application (Expo)
```bash
cd Goparkme
npm start          # Start Expo development server
npm run android    # Start Android emulator
npm run ios        # Start iOS simulator
npm run web        # Start web version
npm run lint       # Run ESLint
```

### Backend Server
```bash
cd backend
node server.js     # Start backend server on port 3002
# Or use PM2:
pm2 start ecosystem.config.js --env development
pm2 start ecosystem.config.js --env production
```

## Architecture

### Multi-Platform Structure
- **Web Frontend**: React with Ant Design components, Google Maps API, Stripe payments
- **Mobile Frontend**: Expo/React Native with file-based routing, native maps, mobile payments
- **Shared Backend**: Single Express.js API serving both platforms

### Backend Services
- **Database**: SQLite3 at `backend/data/parking.db`
- **Authentication**: JWT tokens + Google OAuth integration
- **Real-time**: WebSocket server for live messaging and updates
- **Payments**: Stripe API for transactions and coupon system
- **External APIs**: Twilio SMS, Google Maps/Places

### Configuration
Environment-specific settings in `src/config.js` and `backend/config/server.js`:
- **Development**: localhost:5050 (web), localhost:3002 (API)
- **Production**: www.goparkme.com with HTTPS/WSS

### Key Service Layers
- `src/services/`: Web app API clients and business logic
- `backend/routes/`: API endpoints (auth, parking, payments, users, admin)
- `backend/models/db.js`: SQLite database connection and schema
- `backend/services/`: Payment processing and external integrations

### Mobile App Architecture
- Expo Router for file-based navigation in `app/` directory
- Context providers for auth and location state
- Bottom sheet components for modal interactions
- Native map integration with React Native Maps