module.exports = {
  apps: [{
    name: "parking-app",
    script: "server.js",
    env: {
      NODE_ENV: "production",
      PORT: 3000
    }
  }]
}; 