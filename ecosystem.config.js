module.exports = {
  apps: [{
    name: "parking-app",
    script: "./server.js",
    env: {
      NODE_ENV: "development",
      PORT: 3002,
      DB_PATH: "./chat_app.db",
      CORS_ORIGIN: "http://localhost:5050",
      STATIC_PATH: "./build"
    },
    env_production: {
      NODE_ENV: "production",
      PORT: 3002,
      DB_PATH: "/www/wwwroot/parking-app/chat_app.db",
      CORS_ORIGIN: "https://139.196.36.100",
      STATIC_PATH: "/www/wwwroot/parking-app/build"
    },
    watch: false,
    instances: 1,
    exec_mode: "fork",
    max_memory_restart: "1G",
    error_file: "/www/wwwroot/parking-app/logs/pm2/error.log",
    out_file: "/www/wwwroot/parking-app/logs/pm2/out.log",
    log_date_format: "YYYY-MM-DD HH:mm:ss",
    merge_logs: true
  }]
}; 