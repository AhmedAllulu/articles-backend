// config/database.js
require('dotenv').config();

module.exports = {
  getConnectionConfig: (category, country) => {
    // Convert country to lowercase for schema naming
    const schema = country.toLowerCase();
    
    return {
      host: process.env.DB_HOST,
      port: process.env.DB_PORT,
      database: `news_${category}`,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      schema: schema,
      max: 20, // max clients in pool
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 2000,
    };
  }
};
