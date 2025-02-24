module.exports = {
  apps: [{
    name: 'parking-app',
    script: './backend/server.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env_production: {
      NODE_ENV: 'production',
      PORT: 3002,
      DOMAIN: 'www.goparkme.com',
      FRONTEND_URL: 'https://www.goparkme.com'
    },
    env_development: {
      NODE_ENV: 'development',
      PORT: 3002,
      DOMAIN: 'localhost',
      FRONTEND_URL: 'http://localhost:5050'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true
  }]
}; 