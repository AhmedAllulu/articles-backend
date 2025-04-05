// test-db-connection.js
require('dotenv').config();
const { Pool } = require('pg');
const logger = require('./config/logger');

// Connection to postgres for creating databases
const pgPool = new Pool({
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  database: 'postgres', // Connect to default postgres database
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD
});

async function testConnection() {
  console.log('Testing PostgreSQL connection...');
  console.log(`Connection config: ${process.env.DB_HOST}:${process.env.DB_PORT} user: ${process.env.DB_USER}`);
  
  try {
    const client = await pgPool.connect();
    console.log('Connected to PostgreSQL successfully!');
    
    const result = await client.query('SELECT version()');
    console.log('PostgreSQL version:', result.rows[0].version);
    
    client.release();
    await pgPool.end();
    console.log('Test completed successfully.');
  } catch (error) {
    console.error('Error connecting to PostgreSQL:', error.message);
    console.error(error.stack);
  }
}

testConnection();