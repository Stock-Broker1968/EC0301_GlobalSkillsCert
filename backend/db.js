// db.js - Configuración de la conexión a la base de datos

require('dotenv').config();
const mysql = require('mysql2/promise');

// Crear un pool de conexiones con MySQL
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10
});

module.exports = pool;
