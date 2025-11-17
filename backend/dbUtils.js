// dbFunctions.js - Funciones para interactuar con la base de datos

const pool = require('./db');

// 1. Guardar Código de Acceso
async function guardarCodigoAccesso(email, code) {
  try {
    await pool.execute(
      "INSERT INTO access_codes (email, code, created_at, expires_at, status) VALUES (?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 1 YEAR), 1)",
      [email, code]
    );
    console.log('Código de acceso guardado con éxito.');
  } catch (error) {
    console.error('Error al guardar el código de acceso:', error.message);
  }
}

// 2. Verificar Código de Acceso
async function verificarCodigoAccesso(email, accessCode) {
  try {
    const [rows] = await pool.execute(
      "SELECT * FROM access_codes WHERE email=? AND code=? AND status=1 AND expires_at>NOW() LIMIT 1",
      [email, accessCode]
    );
    return rows.length > 0; // Si se encontró el código, retorna true
  } catch (error) {
    console.error('Error al verificar el código de acceso:', error.message);
    return false;
  }
}

// 3. Registrar Transacción de Stripe
async function registrarTransaccion(email, amount, referencia) {
  try {
    await pool.execute(
      "INSERT INTO transacciones (email, amount, referencia, fecha) VALUES (?, ?, ?, NOW())",
      [email, amount, referencia]
    );
    console.log('Transacción registrada con éxito.');
  } catch (error) {
    console.error('Error al registrar la transacción:', error.message);
  }
}

// 4. Registrar Módulos Completados
async function registrarModulo(email, modulo, avance) {
  try {
    await pool.execute(
      "INSERT INTO modulos_completados (email, modulo, avance, completado_en) VALUES (?, ?, ?, NOW())",
      [email, modulo, avance]
    );
    console.log('Módulo registrado con éxito.');
  } catch (error) {
    console.error('Error al registrar el módulo:', error.message);
  }
}

// 5. Log de Actividad
async function logActividad(email, accion, info) {
  try {
    await pool.execute(
      "INSERT INTO logs_actividad (usuario, accion, detalles, fecha) VALUES (?, ?, ?, NOW())",
      [email, accion, info]
    );
    console.log('Log de actividad registrado con éxito.');
  } catch (error) {
    console.error('Error al registrar el log de actividad:', error.message);
  }
}

module.exports = {
  guardarCodigoAccesso,
  verificarCodigoAccesso,
  registrarTransaccion,
  registrarModulo,
  logActividad
};
