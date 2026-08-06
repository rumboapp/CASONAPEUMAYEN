var SESION_HORAS = 12;

function hashPin_(pin) {
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'casona-peumayen::' + pin);
  return Utilities.base64Encode(digest);
}

/** Login por nombre + PIN (no usa la cuenta de Google del navegador, sirve para cualquier dispositivo/usuario). */
function login(nombre, pin) {
  var usuarios = sheetToObjects_('USUARIOS');
  var hash = hashPin_(String(pin || ''));
  var user = usuarios.filter(function (u) {
    return String(u.nombre).toLowerCase() === String(nombre || '').toLowerCase() && u.activo && u.pinHash === hash;
  })[0];
  if (!user) throw new Error('Nombre o PIN incorrecto.');

  var token = Utilities.getUuid();
  var expira = new Date(Date.now() + SESION_HORAS * 3600000).toISOString();
  appendObject_('SESIONES', { token: token, email: user.email, nombre: user.nombre, rol: user.rol, expira: expira });
  limpiarSesionesVencidas_();
  logCambio_(user.nombre, 'login', '');
  return { token: token, nombre: user.nombre, rol: user.rol };
}

function logout(token) {
  deleteByField_('SESIONES', 'token', token);
  return true;
}

function limpiarSesionesVencidas_() {
  var sesiones = sheetToObjects_('SESIONES');
  var ahora = Date.now();
  sesiones.forEach(function (s) {
    if (new Date(s.expira).getTime() < ahora) deleteByField_('SESIONES', 'token', s.token);
  });
}

/** Valida el token de sesión y devuelve {email,nombre,rol}. Lanza error si no es válido o venció. */
function validarSesion_(token) {
  if (!token) throw new Error('Sesión no válida. Vuelve a iniciar sesión.');
  var sesiones = sheetToObjects_('SESIONES');
  var s = sesiones.filter(function (x) { return x.token === token; })[0];
  if (!s) throw new Error('Sesión no válida. Vuelve a iniciar sesión.');
  if (new Date(s.expira).getTime() < Date.now()) {
    deleteByField_('SESIONES', 'token', token);
    throw new Error('Sesión expirada. Vuelve a iniciar sesión.');
  }
  return { email: s.email, nombre: s.nombre, rol: s.rol };
}

function exigirRol_(user, rolesPermitidos) {
  if (rolesPermitidos.indexOf(user.rol) === -1) {
    throw new Error('No tienes permiso para esta acción.');
  }
}

/** Solo ADMIN: crea o actualiza un usuario del sistema. */
function guardarUsuario(token, datos) {
  var admin = validarSesion_(token);
  exigirRol_(admin, [ROLES.ADMIN]);
  if (!datos.nombre || !datos.rol || !datos.pin) throw new Error('Faltan datos del usuario.');
  var existentes = sheetToObjects_('USUARIOS');
  var yaExiste = existentes.some(function (u) { return String(u.nombre).toLowerCase() === String(datos.nombre).toLowerCase(); });
  var registro = {
    email: datos.email || '',
    nombre: datos.nombre,
    rol: datos.rol,
    pinHash: hashPin_(String(datos.pin)),
    activo: true
  };
  if (yaExiste) {
    updateByField_('USUARIOS', 'nombre', datos.nombre, registro);
  } else {
    appendObject_('USUARIOS', registro);
  }
  logCambio_(admin.nombre, 'usuario_guardado', datos.nombre + ' (' + datos.rol + ')');
  return true;
}

function listarUsuarios(token) {
  var admin = validarSesion_(token);
  exigirRol_(admin, [ROLES.ADMIN]);
  return sheetToObjects_('USUARIOS').map(function (u) {
    return { nombre: u.nombre, rol: u.rol, activo: u.activo, email: u.email };
  });
}
