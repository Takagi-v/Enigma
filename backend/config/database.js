const path = require('path');

const dbConfig = {
  filename: process.env.DB_PATH || path.join(__dirname, '..', '..', 'chat_app.db'),
  verbose: console.log,
};

module.exports = dbConfig; 