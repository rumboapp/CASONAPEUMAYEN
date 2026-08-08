/* ============================================================
   CASONA PEUMAYÉN — PMS
   Único archivo de servidor. La base de datos es una planilla
   de Google Sheets que se crea sola al ejecutar setup().

   Regla clave del modelo: UNA reserva ocupa UN recurso
   (una habitación completa, o una cama en las compartidas).
   Si un grupo toma 2 habitaciones, se cargan 2 reservas.
   Esto mantiene el calendario y los choques de fecha simples.
   ============================================================ */

var TZ = 'America/Santiago';

var HOJAS = {
  Unidades: ['id', 'nombre', 'grupo', 'capacidad', 'bano', 'porCama', 'precioBase', 'precioAlta', 'orden', 'activa'],
  Camas: ['id', 'idUnidad', 'nombre', 'precioBase', 'precioAlta', 'orden', 'activa'],
  // Las columnas nuevas SIEMPRE se agregan al final: si se insertan en medio,
  // las filas ya guardadas quedan corridas y sus fechas se vuelven ilegibles.
  Reservas: ['id', 'recurso', 'idUnidad', 'huesped', 'telefono', 'canal', 'checkIn', 'checkOut', 'estado', 'total', 'anticipo', 'addon', 'addonFecha', 'notas', 'creado', 'creadoPor', 'email', 'tokenFicha', 'checkInReal', 'checkOutReal', 'grupo', 'pax'],
  Aseo: ['idUnidad', 'estado', 'responsable', 'notas', 'actualizado'],
  Fichas: ['id', 'idReserva', 'nombre', 'documento', 'nacionalidad', 'nacimiento', 'procedencia', 'destino', 'motivo', 'emergencia', 'firmaUrl', 'fecha'],
  Usuarios: ['nombre', 'rol', 'pinHash', 'activo'],
  Sesiones: ['token', 'nombre', 'rol', 'expira'],
  Log: ['fecha', 'usuario', 'accion', 'detalle'],
  Config: ['clave', 'valor']
};

/* Columnas que deben guardarse como TEXTO plano y no como fecha de Sheets.
   Esto era el origen del bug de reservas duplicadas: Sheets convertía
   "2026-08-07" en un objeto Date con hora local y las comparaciones fallaban. */
var COLS_TEXTO = {
  Reservas: ['checkIn', 'checkOut', 'addonFecha', 'creado', 'telefono', 'checkInReal', 'checkOutReal'],
  Fichas: ['nacimiento', 'fecha'],
  Aseo: ['actualizado'],
  Sesiones: ['expira'],
  Log: ['fecha'],
  Config: ['valor']
};

/* El logo va incrustado en el propio código: así las tres pantallas lo
   muestran sin depender de ningún archivo externo ni de permisos de Drive. */
var LOGO = 'data:image/png;base64,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';

/* Tres páginas: la interna del equipo (Index), la que firma el huésped
   (Ficha, con ?f=<token>) y la del equipo de aseo (Aseo, con ?aseo=<clave>).
   Las dos últimas no piden clave. */
function doGet(e) {
  var p = (e && e.parameter) || {};
  var pagina, titulo;

  if (p.f) {
    pagina = HtmlService.createTemplateFromFile('Ficha');
    pagina.token = String(p.f);
    titulo = 'Casona Peumayén — Registro';
  } else if (p.aseo) {
    pagina = HtmlService.createTemplateFromFile('Aseo');
    pagina.clave = String(p.aseo);
    titulo = 'Casona Peumayén — Aseo';
  } else {
    pagina = HtmlService.createTemplateFromFile('Index');
    titulo = 'Casona Peumayén';
  }

  pagina.logo = LOGO;
  return pagina.evaluate()
    .setTitle(titulo)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/* ===================== INFRAESTRUCTURA ===================== */

function ss_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SSID');
  if (id) return SpreadsheetApp.openById(id);
  var ss = SpreadsheetApp.create('Casona Peumayén — Datos PMS');
  props.setProperty('SSID', ss.getId());
  return ss;
}

function hoja_(nombre) {
  var sh = ss_().getSheetByName(nombre);
  if (!sh) throw new Error('Falta ejecutar setup(). No existe la hoja: ' + nombre);
  return sh;
}

/* ===================== MEMORIA DE LA EJECUCIÓN =====================
   Cada getValues() de Sheets es una llamada remota y es lo que hace lento
   todo. Dentro de una misma ejecución la planilla no cambia sola, así que
   cada hoja se lee UNA vez y se reutiliza; al escribir se descarta lo
   guardado de esa hoja para no trabajar con datos viejos. */
var MEMO = {};

/* La hoja en bruto, tal cual viene de Sheets. Se guarda aparte de la versión
   ya armada en objetos porque escribir necesita saber en qué fila está cada
   cosa: así leer y escribir comparten la MISMA lectura, en vez de pedirle la
   hoja a Google dos veces en la misma operación. */
function crudo_(nombre) {
  var k = '__raw_' + nombre;
  if (MEMO[k]) return MEMO[k];
  MEMO[k] = hoja_(nombre).getDataRange().getValues();
  return MEMO[k];
}

function leer_(nombre) {
  if (MEMO[nombre]) return MEMO[nombre];
  var v = crudo_(nombre);
  var out = [];
  if (v.length >= 2) {
    var cab = v[0];
    for (var i = 1; i < v.length; i++) {
      if (String(v[i].join('')).trim() === '') continue;
      var o = {};
      for (var j = 0; j < cab.length; j++) o[cab[j]] = v[i][j];
      out.push(o);
    }
  }
  MEMO[nombre] = out;
  return out;
}

function olvidar_(nombre) {
  delete MEMO[nombre];
  delete MEMO['__raw_' + nombre];
  delete MEMO['__cab_' + nombre];
  if (nombre === 'Unidades' || nombre === 'Camas') olvidarRecursos_();
  if (nombre === 'Config') olvidarConfig_();
  if (nombre === 'Fichas') olvidarFirmadas_();
  if (nombre === 'Aseo') olvidarAseo_();
}

/* El registro de cambios es una bitácora: se escribe sola, nadie edita sus
   columnas a mano y una fila mal puesta ahí no afecta a ninguna reserva. Por
   eso su encabezado se puede recordar entre ejecuciones y ahorrar una
   lectura en cada cambio de estado. Las hojas con datos de verdad se leen
   siempre de la planilla. */
var CAB_RECORDABLE = { Log: 1 };

function cabGuardada_(nombre) {
  try {
    var g = CacheService.getScriptCache().get('cab_' + nombre);
    return g ? JSON.parse(g) : null;
  } catch (e) { return null; }
}

function recordarCab_(nombre, cab) {
  if (!CAB_RECORDABLE[nombre]) return;
  try { CacheService.getScriptCache().put('cab_' + nombre, JSON.stringify(cab), 21600); } catch (e) {}
}

/* Encabezado REAL de la hoja. Nunca se escribe por posición fija: siempre
   según los nombres que la hoja tiene hoy, para que agregar columnas más
   adelante no descoloque las filas ya guardadas. */
function cabecera_(nombre) {
  if (MEMO['__cab_' + nombre]) return MEMO['__cab_' + nombre];
  var sh = hoja_(nombre);
  var cab;
  // Si la hoja ya se leyó en esta ejecución, su primera fila ES el
  // encabezado y no hace falta volver a pedírselo a Google.
  var ya = MEMO['__raw_' + nombre];
  var recordada = CAB_RECORDABLE[nombre] ? cabGuardada_(nombre) : null;
  if (ya && ya.length && String(ya[0].join('')).trim() !== '') {
    cab = ya[0].map(function (c) { return String(c).trim(); });
  } else if (recordada) {
    MEMO['__cab_' + nombre] = recordada;
    return recordada;
  } else {
    var ancho = Math.max(sh.getLastColumn(), 1);
    cab = sh.getRange(1, 1, 1, ancho).getValues()[0]
      .map(function (c) { return String(c).trim(); });
  }

  var faltan = HOJAS[nombre].filter(function (c) { return cab.indexOf(c) === -1; });
  if (!faltan.length) { MEMO['__cab_' + nombre] = cab; recordarCab_(nombre, cab); return cab; }

  if (cab.join('') === '') {                       // hoja recién creada
    sh.getRange(1, 1, 1, HOJAS[nombre].length).setValues([HOJAS[nombre]]);
    MEMO['__cab_' + nombre] = HOJAS[nombre].slice();
    recordarCab_(nombre, MEMO['__cab_' + nombre]);
    return MEMO['__cab_' + nombre];
  }
  sh.getRange(1, cab.length + 1, 1, faltan.length).setValues([faltan]);
  MEMO['__cab_' + nombre] = cab.concat(faltan);
  recordarCab_(nombre, MEMO['__cab_' + nombre]);
  return MEMO['__cab_' + nombre];
}

function insertar_(nombre, obj) {
  var cab = cabecera_(nombre);
  hoja_(nombre).appendRow(cab.map(function (c) {
    return obj[c] === undefined || obj[c] === null ? '' : obj[c];
  }));
  olvidar_(nombre);
}

/* Varias filas de una sola vez. Una reserva de grupo son dos o tres filas:
   así se escriben en una sola llamada a Sheets, y no una por habitación. */
function insertarVarias_(nombre, objs) {
  if (!objs || !objs.length) return;
  if (objs.length === 1) return insertar_(nombre, objs[0]);
  var cab = cabecera_(nombre), sh = hoja_(nombre);
  var filas = objs.map(function (obj) {
    return cab.map(function (c) {
      return obj[c] === undefined || obj[c] === null ? '' : obj[c];
    });
  });
  var inicio = sh.getLastRow() + 1;
  if (inicio + filas.length - 1 <= sh.getMaxRows()) {
    sh.getRange(inicio, 1, filas.length, cab.length).setValues(filas);
  } else {
    filas.forEach(function (f) { sh.appendRow(f); });   // la hoja se quedó sin filas libres
  }
  olvidar_(nombre);
}

function actualizar_(nombre, campoId, valorId, cambios) {
  var sh = hoja_(nombre), v = crudo_(nombre), cab = v[0] || [];
  var ci = cab.indexOf(campoId);
  if (ci === -1) return false;
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][ci]) === String(valorId)) {
      // Se escribe el bloque completo de la fila de una vez: una llamada a
      // Sheets en lugar de una por cada campo que cambia.
      var fila = v[i].slice();
      var cambio = false;
      Object.keys(cambios).forEach(function (k) {
        var c = cab.indexOf(k);
        if (c > -1) { fila[c] = cambios[k]; cambio = true; }
      });
      if (cambio) sh.getRange(i + 1, 1, 1, fila.length).setValues([fila]);
      olvidar_(nombre);
      return true;
    }
  }
  return false;
}

function guardarOCrear_(nombre, campoId, valorId, obj) {
  if (!actualizar_(nombre, campoId, valorId, obj)) insertar_(nombre, obj);
}

function borrar_(nombre, campoId, valorId) {
  var sh = hoja_(nombre), v = crudo_(nombre), ci = (v[0] || []).indexOf(campoId);
  if (ci === -1) return;
  for (var i = v.length - 1; i >= 1; i--) if (String(v[i][ci]) === String(valorId)) sh.deleteRow(i + 1);
  olvidar_(nombre);
}

function uid_(p) { return p + Utilities.getUuid().slice(0, 8); }

/* Normaliza cualquier fecha a texto "YYYY-MM-DD".
   Con fechas como texto, comparar rangos es comparar strings: exacto y sin zonas horarias. */
function ymd_(v) {
  if (!v && v !== 0) return '';
  if (Object.prototype.toString.call(v) === '[object Date]') return Utilities.formatDate(v, TZ, 'yyyy-MM-dd');
  var s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  var d = new Date(s);
  return isNaN(d.getTime()) ? '' : Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
}

/* Sheets guarda "15:00" como una hora, que al leerla vuelve como un objeto
   Date del 30 de diciembre de 1899. Esto la devuelve siempre como "HH:mm". */
function hora_(v, porDefecto) {
  if (Object.prototype.toString.call(v) === '[object Date]') {
    return Utilities.formatDate(v, TZ, 'HH:mm');
  }
  var s = String(v == null ? '' : v).trim();
  var m = /^(\d{1,2}):(\d{2})/.exec(s);
  if (m) return ('0' + m[1]).slice(-2) + ':' + m[2];
  return porDefecto || '';
}

function ahora_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'); }
function hoy_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }

/* Dos estadías chocan si se pisan. El día de check-out queda libre para el siguiente. */
function chocan_(inA, outA, inB, outB) { return inA < outB && inB < outA; }

/* La configuración casi nunca cambia, así que también se guarda armada. */
function configTodo_() {
  if (MEMO.__cfg) return MEMO.__cfg;
  try {
    var g = CacheService.getScriptCache().get('config');
    if (g) { MEMO.__cfg = JSON.parse(g); return MEMO.__cfg; }
  } catch (e) {}
  var mapa = {};
  leer_('Config').forEach(function (r) {
    mapa[r.clave] = (Object.prototype.toString.call(r.valor) === '[object Date]')
      ? hora_(r.valor) : r.valor;
  });
  MEMO.__cfg = mapa;
  try { CacheService.getScriptCache().put('config', JSON.stringify(mapa), 21600); } catch (e) {}
  return mapa;
}

function olvidarConfig_() {
  try { CacheService.getScriptCache().remove('config'); } catch (e) {}
  MEMO.__cfg = null;
}

/* ===================== RESÚMENES GUARDADOS =====================
   El calendario solo necesita dos datos chicos de dos hojas grandes: qué
   reservas tienen la ficha firmada y cómo está el aseo de cada pieza. Ambos
   se guardan ya resumidos entre ejecuciones y se descartan solos en cuanto
   alguien firma una ficha o marca una habitación, así abrir el calendario
   pasa de leer tres hojas a leer una sola. */
function guardarResumen_(clave, valor) {
  try {
    var s = JSON.stringify(valor);
    // La caché de Apps Script no acepta más de 100 KB por entrada: si algún
    // día el resumen crece demasiado, simplemente se deja de guardar y se
    // sigue leyendo de la planilla como siempre.
    if (s.length < 90000) CacheService.getScriptCache().put(clave, s, 21600);
  } catch (e) {}
}

function firmadas_() {
  if (MEMO.__firmadas) return MEMO.__firmadas;
  try {
    var g = CacheService.getScriptCache().get('firmadas');
    if (g) { MEMO.__firmadas = JSON.parse(g); return MEMO.__firmadas; }
  } catch (e) {}
  var mapa = {};
  leer_('Fichas').forEach(function (f) { if (f.idReserva) mapa[f.idReserva] = 1; });
  MEMO.__firmadas = mapa;
  guardarResumen_('firmadas', mapa);
  return mapa;
}

function olvidarFirmadas_() {
  try { CacheService.getScriptCache().remove('firmadas'); } catch (e) {}
  MEMO.__firmadas = null;
}

function aseoMapa_() {
  if (MEMO.__aseo) return MEMO.__aseo;
  try {
    var g = CacheService.getScriptCache().get('aseoMapa');
    if (g) { MEMO.__aseo = JSON.parse(g); return MEMO.__aseo; }
  } catch (e) {}
  var mapa = {};
  leer_('Aseo').forEach(function (a) { mapa[a.idUnidad] = a.estado; });
  MEMO.__aseo = mapa;
  guardarResumen_('aseoMapa', mapa);
  return mapa;
}

function olvidarAseo_() {
  try { CacheService.getScriptCache().remove('aseoMapa'); } catch (e) {}
  MEMO.__aseo = null;
}

/* Borra todo lo guardado entre ejecuciones. Se llama desde setup(), que es
   lo que uno ejecuta cuando algo quedó raro: así nada viejo sobrevive. */
function limpiarCaches_() {
  olvidarRecursos_(); olvidarConfig_(); olvidarFirmadas_(); olvidarAseo_();
  Object.keys(HOJAS).forEach(function (n) {
    try { CacheService.getScriptCache().remove('cab_' + n); } catch (e) {}
  });
  Object.keys(MEMO).forEach(function (k) { delete MEMO[k]; });
}

function config_(clave, porDefecto) {
  var v = configTodo_()[clave];
  return (v === undefined || v === '') ? porDefecto : v;
}

function esAlta_(fechaYmd) {
  var mmdd = String(fechaYmd).slice(5, 10);
  var ini = String(config_('temporadaAltaInicio', '12-15'));
  var fin = String(config_('temporadaAltaFin', '03-15'));
  return ini <= fin ? (mmdd >= ini && mmdd <= fin) : (mmdd >= ini || mmdd <= fin);
}

/* ===================== SETUP ===================== */

function setup() {
  var ss = ss_();
  limpiarCaches_();

  // Migración sin pérdidas: agrega las columnas que falten al final y deja
  // intactas las que ya existen, para no descolocar los datos guardados.
  Object.keys(HOJAS).forEach(function (nombre) {
    var sh = ss.getSheetByName(nombre) || ss.insertSheet(nombre);
    sh.setFrozenRows(1);
    var cab = cabecera_(nombre);
    (COLS_TEXTO[nombre] || []).forEach(function (col) {
      var c = cab.indexOf(col) + 1;
      if (c > 0) sh.getRange(1, c, sh.getMaxRows(), 1).setNumberFormat('@');
    });
  });

  ['Hoja 1', 'Sheet1', 'Hoja1'].forEach(function (n) {
    var sh = ss.getSheetByName(n);
    if (sh && ss.getSheets().length > 1) ss.deleteSheet(sh);
  });

  olvidarRecursos_();
  olvidarConfig_();

  if (!leer_('Config').length) {
    var cfg = {
      checkIn: '15:00', checkOut: '11:00',
      temporadaAltaInicio: '12-15', temporadaAltaFin: '03-15',
      addonBase: 30000, addonAlta: 35000
    };
    Object.keys(cfg).forEach(function (k) { insertar_('Config', { clave: k, valor: cfg[k] }); });
  }

  if (!leer_('Unidades').length) {
    [
      ['U1', 'Habitación 1 · Matrimonial', 'Lodge', 2, 'privado', false, 55000, 70000],
      ['U2', 'Habitación 2 · Matrimonial', 'Lodge', 2, 'privado', false, 55000, 70000],
      ['U3', 'Habitación 3 · Twin', 'Lodge', 2, 'privado', false, 55000, 70000],
      ['U4', 'Habitación 4 · Matrimonial + individual', 'Lodge', 3, 'privado', false, 70000, 90000],
      ['U5', 'Habitación 5 · Matrimonial + litera', 'Lodge', 3, 'compartido', true, '', ''],
      ['U6', 'Habitación 6 · Individual + litera', 'Lodge', 3, 'compartido', true, '', ''],
      ['U7', 'Habitación 7 · Individual', 'Lodge', 1, 'compartido', true, '', ''],
      ['U8', 'Habitación 8 · Individual', 'Lodge', 1, 'compartido', true, '', ''],
      ['G1', 'Carpa A', 'Glamping', 2, 'compartido', false, 65000, 83000],
      ['G2', 'Carpa B', 'Glamping', 2, 'compartido', false, 65000, 83000],
      ['G3', 'Carpa C', 'Glamping', 2, 'compartido', false, 65000, 83000]
    ].forEach(function (u, i) {
      insertar_('Unidades', {
        id: u[0], nombre: u[1], grupo: u[2], capacidad: u[3], bano: u[4],
        porCama: u[5], precioBase: u[6], precioAlta: u[7], orden: i + 1, activa: true
      });
    });

    [
      ['B51', 'U5', 'Cama matrimonial', 28000, 36000],
      ['B52', 'U5', 'Litera superior', 25000, 32000],
      ['B53', 'U5', 'Litera inferior', 25000, 32000],
      ['B61', 'U6', 'Cama individual', 25000, 32000],
      ['B62', 'U6', 'Litera superior', 25000, 32000],
      ['B63', 'U6', 'Litera inferior', 25000, 32000],
      ['B71', 'U7', 'Cama individual', 33000, 42000],
      ['B81', 'U8', 'Cama individual', 33000, 42000]
    ].forEach(function (b, i) {
      insertar_('Camas', {
        id: b[0], idUnidad: b[1], nombre: b[2], precioBase: b[3], precioAlta: b[4],
        orden: i + 1, activa: true
      });
    });
  }

  if (!leer_('Usuarios').length) {
    insertar_('Usuarios', { nombre: 'admin', rol: 'admin', pinHash: pin_('1234'), activo: true });
  }

  return ss.getUrl();
}

/* Repara las reservas que quedaron con las columnas corridas.
   Ejecutar desde el editor. Sin argumentos solo INFORMA lo que encontró;
   con repararReservas(true) borra las filas que no se pueden recuperar.

   El caso conocido: una versión anterior agregó columnas en medio del
   encabezado, así que las filas guardadas antes quedaron desplazadas y sus
   fechas dejaron de leerse. Esas reservas existen en la planilla pero el
   calendario no puede dibujarlas. */
function repararReservas(borrar) {
  var malas = leer_('Reservas').filter(function (r) {
    return !ymd_(r.checkIn) || !ymd_(r.checkOut);
  });
  if (!malas.length) {
    Logger.log('Todo en orden: no hay reservas con fechas ilegibles.');
    return { revisadas: 0, borradas: 0 };
  }

  Logger.log(malas.length + ' reserva(s) con fechas ilegibles:');
  malas.forEach(function (r) {
    Logger.log('  · ' + r.id + '  huésped="' + r.huesped + '"  checkIn="' + r.checkIn + '"');
  });

  if (!borrar) {
    Logger.log('\nNo se borró nada. Puedes corregir esas filas a mano en la planilla, ' +
      'o volver a ejecutar como repararReservas(true) para eliminarlas y cargarlas de nuevo.');
    return { revisadas: malas.length, borradas: 0 };
  }
  malas.forEach(function (r) { borrar_('Reservas', 'id', r.id); });
  Logger.log('\nSe eliminaron ' + malas.length + ' fila(s). Vuelve a cargar esas reservas en el calendario.');
  return { revisadas: malas.length, borradas: malas.length };
}

/* Crear o cambiar el PIN de un usuario desde el editor si te quedas fuera del sistema. */
function crearUsuario(nombre, pin, rol) {
  guardarOCrear_('Usuarios', 'nombre', nombre, {
    nombre: nombre, rol: rol || 'recepcion', pinHash: pin_(String(pin)), activo: true
  });
  return 'Listo: ' + nombre;
}

/* ===================== SESIÓN ===================== */

function pin_(p) {
  return Utilities.base64Encode(
    Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, 'cp::' + p));
}

function entrar(nombre, pin) {
  var u = leer_('Usuarios').filter(function (x) {
    return String(x.nombre).toLowerCase() === String(nombre || '').trim().toLowerCase()
      && x.activo && x.pinHash === pin_(String(pin || ''));
  })[0];
  if (!u) throw new Error('Usuario o PIN incorrecto.');
  var token = Utilities.getUuid();
  insertar_('Sesiones', {
    token: token, nombre: u.nombre, rol: u.rol,
    expira: Utilities.formatDate(new Date(Date.now() + 12 * 3600000), TZ, 'yyyy-MM-dd HH:mm')
  });
  return { token: token, nombre: u.nombre, rol: u.rol };
}

function salir(token) {
  borrar_('Sesiones', 'token', token);
  try { CacheService.getScriptCache().remove('ses_' + token); } catch (e) {}
  return true;
}

/* La sesión se recuerda unos minutos para no leer la hoja en cada llamada.
   El plazo es corto a propósito, y al salir se borra igual. */
function sesion_(token) {
  if (!token) throw new Error('Sesión no válida. Vuelve a entrar.');
  var clave = 'ses_' + token;
  if (MEMO[clave]) return MEMO[clave];
  try {
    var guardada = CacheService.getScriptCache().get(clave);
    if (guardada) { MEMO[clave] = JSON.parse(guardada); return MEMO[clave]; }
  } catch (e) {}

  var s = leer_('Sesiones').filter(function (x) { return x.token === token; })[0];
  if (!s) throw new Error('Sesión no válida. Vuelve a entrar.');
  if (String(s.expira) < ahora_()) { borrar_('Sesiones', 'token', token); throw new Error('Sesión expirada.'); }

  var datos = { nombre: s.nombre, rol: s.rol };
  MEMO[clave] = datos;
  try { CacheService.getScriptCache().put(clave, JSON.stringify(datos), 180); } catch (e) {}
  return datos;
}

/* ===================== DATOS DEL CALENDARIO ===================== */

/* ===================== CACHÉ ENTRE EJECUCIONES =====================
   El inventario cambia muy de vez en cuando, así que se guarda ya armado y
   se descarta solo cuando alguien lo edita. Ahorra dos lecturas de planilla
   en cada carga del calendario. */
function olvidarRecursos_() {
  try { CacheService.getScriptCache().remove('recursos'); } catch (e) {}
  MEMO.__recursos = null;
}

function recursos_() {
  if (MEMO.__recursos) return MEMO.__recursos;
  try {
    var guardado = CacheService.getScriptCache().get('recursos');
    if (guardado) { MEMO.__recursos = JSON.parse(guardado); return MEMO.__recursos; }
  } catch (e) { /* sin caché se lee de la planilla igual */ }

  var lista = recursosDesdePlanilla_();
  MEMO.__recursos = lista;
  try { CacheService.getScriptCache().put('recursos', JSON.stringify(lista), 21600); } catch (e) {}
  return lista;
}

/* Recursos = filas del calendario. Cada habitación entera, o cada cama en las compartidas. */
function recursosDesdePlanilla_() {
  var unidades = leer_('Unidades').filter(function (u) { return u.activa; })
    .sort(function (a, b) { return Number(a.orden) - Number(b.orden); });
  var camas = leer_('Camas').filter(function (c) { return c.activa; })
    .sort(function (a, b) { return Number(a.orden) - Number(b.orden); });
  var out = [];
  unidades.forEach(function (u) {
    if (u.porCama) {
      camas.filter(function (c) { return c.idUnidad === u.id; }).forEach(function (c) {
        out.push({
          id: c.id, idUnidad: u.id, grupo: u.grupo, unidad: u.nombre, nombre: c.nombre,
          precioBase: Number(c.precioBase) || 0, precioAlta: Number(c.precioAlta) || 0,
          capacidad: 1, bano: u.bano || 'compartido'
        });
      });
    } else {
      out.push({
        id: u.id, idUnidad: u.id, grupo: u.grupo, unidad: u.nombre, nombre: '',
        precioBase: Number(u.precioBase) || 0, precioAlta: Number(u.precioAlta) || 0,
        capacidad: Number(u.capacidad) || 2, bano: u.bano || 'privado'
      });
    }
  });
  return out;
}

/* Huella del inventario. Sirve para no mandar de vuelta la lista completa de
   habitaciones y camas en cada refresco de fondo: si la huella es la misma
   que la que ya tiene la pantalla, no cambió nada y no hace falta enviarla. */
function versionRecursos_() {
  var lista = recursos_(), s = JSON.stringify(lista), h = 0;
  for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return lista.length + '.' + h;
}

/* Todo lo que la pantalla del calendario necesita, en una sola llamada. */
function cargarTablero(token, desde, hasta, versionQueTiene) {
  sesion_(token);
  var d = ymd_(desde), h = ymd_(hasta);
  var firmadas = firmadas_();

  // Una sola pasada por las reservas: las del rango pedido y, de paso, la
  // cuenta de las que quedaron con la fecha ilegible.
  var reservas = [], ilegibles = 0;
  leer_('Reservas').forEach(function (r) {
    if (r.estado === 'cancelada') return;
    var ci = ymd_(r.checkIn), co = ymd_(r.checkOut);
    if (!ci || !co) { ilegibles++; return; }
    if (!chocan_(ci, co, d, h)) return;
    reservas.push({
      id: r.id, recurso: r.recurso, idUnidad: r.idUnidad, huesped: r.huesped,
      telefono: String(r.telefono || ''), email: r.email || '', canal: r.canal,
      firmada: !!firmadas[r.id],
      checkIn: ci, checkOut: co,
      estado: r.estado, total: Number(r.total) || 0, anticipo: Number(r.anticipo) || 0,
      addon: !!r.addon, addonFecha: r.addonFecha ? String(r.addonFecha) : '',
      notas: r.notas || '', grupo: String(r.grupo || ''),
      pax: Number(r.pax) || 1
    });
  });

  var version = versionRecursos_();
  return {
    // Estado de aseo de cada recurso, para verlo desde el mismo calendario
    // cuando llega alguien sin reserva y hay que saber qué está listo.
    aseo: aseoMapa_(),
    // El inventario solo viaja si cambió desde la última vez.
    recursos: (versionQueTiene && versionQueTiene === version) ? null : recursos_(),
    recursosVer: version,
    reservas: reservas, hoy: hoy_(),
    // Reservas que existen en la planilla pero no se pueden ubicar en el
    // calendario porque su fecha quedó ilegible: se avisa en pantalla.
    ilegibles: ilegibles,
    cfg: {
      altaIni: String(config_('temporadaAltaInicio', '12-15')),
      altaFin: String(config_('temporadaAltaFin', '03-15')),
      addonBase: Number(config_('addonBase', 30000)),
      addonAlta: Number(config_('addonAlta', 35000))
    }
  };
}

function tarifaNoche(token, recursoId, fecha) {
  sesion_(token);
  var r = recursos_().filter(function (x) { return x.id === recursoId; })[0];
  if (!r) return 0;
  return esAlta_(ymd_(fecha)) ? r.precioAlta : r.precioBase;
}

/* ===================== RESERVAS ===================== */

/* Verificación autoritativa de disponibilidad. Se ejecuta SIEMPRE antes de escribir. */
function verificarLibre_(recurso, checkIn, checkOut, ignorarId) {
  var ocupadas = leer_('Reservas').filter(function (r) {
    return String(r.recurso) === String(recurso)
      && r.estado !== 'cancelada' && r.estado !== 'no_show'
      && String(r.id) !== String(ignorarId || '')
      && chocan_(ymd_(r.checkIn), ymd_(r.checkOut), checkIn, checkOut);
  });
  if (ocupadas.length) {
    var o = ocupadas[0];
    throw new Error('Ocupado: ya hay una reserva de ' + o.huesped +
      ' del ' + ymd_(o.checkIn) + ' al ' + ymd_(o.checkOut) + '.');
  }
}

function validarFechas_(checkIn, checkOut) {
  var i = ymd_(checkIn), o = ymd_(checkOut);
  if (!i || !o) throw new Error('Faltan las fechas.');
  if (o <= i) throw new Error('El check-out debe ser posterior al check-in.');
  return { checkIn: i, checkOut: o };
}

function guardarReserva(token, datos) {
  var u = sesion_(token);
  var f = validarFechas_(datos.checkIn, datos.checkOut);
  if (!datos.recurso) throw new Error('Falta elegir el alojamiento.');
  // Una habitación que se vende por camas no se puede reservar entera: sus
  // filas del calendario son las camas, así que la reserva quedaría invisible.
  if (!recursos_().some(function (x) { return x.id === datos.recurso; })) {
    throw new Error('Ese alojamiento no está disponible para reservar. ' +
      'Si la habitación se vende por camas, elige una cama.');
  }
  if (!String(datos.huesped || '').trim()) throw new Error('Falta el nombre del huésped.');

  // El bloqueo evita que dos personas guarden a la vez y se pisen las reservas.
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    verificarLibre_(datos.recurso, f.checkIn, f.checkOut, datos.id);
    var unidad = recursos_().filter(function (x) { return x.id === datos.recurso; })[0];

    // Los pax no pueden pasarse de lo que cabe en el alojamiento.
    var tope = unidad ? (Number(unidad.capacidad) || 1) : 1;
    var pax = Math.min(Math.max(Number(datos.pax) || 1, 1), tope);

    var campos = {
      pax: pax,
      recurso: datos.recurso, idUnidad: unidad ? unidad.idUnidad : '',
      huesped: datos.huesped, telefono: datos.telefono || '', email: datos.email || '',
      canal: datos.canal || 'whatsapp',
      checkIn: f.checkIn, checkOut: f.checkOut, estado: datos.estado || 'confirmada',
      total: Number(datos.total) || 0, anticipo: Number(datos.anticipo) || 0,
      addon: !!datos.addon, addonFecha: datos.addonFecha || '', notas: datos.notas || ''
    };
    if (datos.grupo !== undefined) campos.grupo = datos.grupo || '';

    if (datos.id) {
      actualizar_('Reservas', 'id', datos.id, campos);
      return { id: datos.id };
    }

    var id = uid_('R');
    campos.id = id;
    campos.tokenFicha = '';
    campos.creado = ahora_();
    campos.creadoPor = u.nombre;
    insertar_('Reservas', campos);
    return { id: id };
  } finally {
    lock.releaseLock();
  }
}

/* ===================== RESERVA DE GRUPO =====================
   Una familia que toma dos habitaciones se carga una sola vez: se eligen
   los alojamientos y se crea una reserva por cada uno, todas con los
   mismos datos y unidas por un mismo número de grupo. */

function disponibles(token, checkIn, checkOut, ignorarGrupo) {
  sesion_(token);
  var f = validarFechas_(checkIn, checkOut);
  var ocupadas = leer_('Reservas').filter(function (r) {
    return r.estado !== 'cancelada' && r.estado !== 'no_show' &&
      String(r.grupo || '') !== String(ignorarGrupo || '\u0000') &&
      chocan_(ymd_(r.checkIn), ymd_(r.checkOut), f.checkIn, f.checkOut);
  });
  var tomadas = {};
  ocupadas.forEach(function (r) { tomadas[r.recurso] = r.huesped; });

  var alta = esAlta_(f.checkIn);
  var noches = Math.round((new Date(f.checkOut) - new Date(f.checkIn)) / 86400000);

  return recursos_().map(function (rec) {
    return {
      id: rec.id, unidad: rec.unidad, cama: rec.nombre || '', grupo: rec.grupo,
      capacidad: rec.capacidad,
      libre: !tomadas[rec.id],
      ocupadaPor: tomadas[rec.id] || '',
      precio: (alta ? rec.precioAlta : rec.precioBase) * noches
    };
  });
}

function guardarReservaGrupo(token, datos) {
  var u = sesion_(token);
  var f = validarFechas_(datos.checkIn, datos.checkOut);
  var lista = datos.recursos || [];
  if (!lista.length) throw new Error('Elige al menos un alojamiento.');
  if (!String(datos.huesped || '').trim()) throw new Error('Falta el nombre del huésped.');

  var validos = {};
  recursos_().forEach(function (x) { validos[x.id] = x; });

  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    // Primero se comprueban TODOS: o entra el grupo completo, o no entra
    // ninguno, para no dejar media familia cargada.
    lista.forEach(function (item) {
      var id = item.recurso || item;
      if (!validos[id]) throw new Error('Alojamiento no disponible para reservar: ' + id);
      verificarLibre_(id, f.checkIn, f.checkOut, null);
    });

    var grupo = uid_('G');
    var filas = lista.map(function (item, i) {
      var id = item.recurso || item;
      var rec = validos[id];
      return {
        id: uid_('R'), recurso: id, idUnidad: rec.idUnidad,
        pax: Math.min(Math.max(Number(item.pax) || Number(rec.capacidad) || 1, 1),
                      Number(rec.capacidad) || 1),
        huesped: datos.huesped, telefono: datos.telefono || '', email: datos.email || '',
        canal: datos.canal || 'whatsapp',
        checkIn: f.checkIn, checkOut: f.checkOut, estado: datos.estado || 'confirmada',
        total: Number(item.precio) || 0,
        // El abono se anota una sola vez, en la primera del grupo.
        anticipo: i === 0 ? (Number(datos.anticipo) || 0) : 0,
        addon: !!datos.addon, addonFecha: datos.addonFecha || '',
        notas: datos.notas || '', grupo: grupo,
        creado: ahora_(), creadoPor: u.nombre
      };
    });
    // Todas las habitaciones del grupo se escriben de una sola vez.
    insertarVarias_('Reservas', filas);
    var ids = filas.map(function (x) { return x.id; });
    logCambio_(u.nombre, 'grupo_creado', grupo + ' · ' + ids.length + ' alojamientos · ' + datos.huesped);
    return { grupo: grupo, ids: ids };
  } finally {
    lock.releaseLock();
  }
}

function reservasDelGrupo(token, grupo) {
  sesion_(token);
  if (!grupo) return [];
  var recs = recursos_();
  var nombre = function (id) {
    var r = recs.filter(function (x) { return x.id === id; })[0];
    return r ? (r.unidad + (r.nombre ? ' — ' + r.nombre : '')) : id;
  };
  return leer_('Reservas').filter(function (r) { return String(r.grupo) === String(grupo); })
    .map(function (r) {
      return {
        id: r.id, recurso: nombre(r.recurso), estado: r.estado,
        total: Number(r.total) || 0, anticipo: Number(r.anticipo) || 0
      };
    });
}

/* Aplica un estado a todas las reservas del grupo de una sola vez. */
function cambiarEstadoGrupo(token, grupo, estado) {
  sesion_(token);
  var ids = leer_('Reservas').filter(function (r) { return String(r.grupo) === String(grupo); })
    .map(function (r) { return r.id; });
  ids.forEach(function (id) { cambiarEstado(token, id, estado); });
  return ids.length;
}

/* Mover o extender arrastrando en el calendario. */
function moverReserva(token, id, recurso, checkIn, checkOut) {
  sesion_(token);
  var f = validarFechas_(checkIn, checkOut);
  if (!recursos_().some(function (x) { return x.id === recurso; })) {
    throw new Error('Ese alojamiento no está disponible para reservar.');
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    verificarLibre_(recurso, f.checkIn, f.checkOut, id);
    var unidad = recursos_().filter(function (x) { return x.id === recurso; })[0];
    actualizar_('Reservas', 'id', id, {
      recurso: recurso, idUnidad: unidad ? unidad.idUnidad : '',
      checkIn: f.checkIn, checkOut: f.checkOut
    });
    return true;
  } finally {
    lock.releaseLock();
  }
}

/* Estados de una reserva, en el orden en que ocurren de verdad:
   tentativa → confirmada → en_casa (check-in) → checkout (se fue).
   cancelada y no_show quedan fuera de esa línea. */
function cambiarEstado(token, id, estado) {
  var u = sesion_(token);
  var r = leer_('Reservas').filter(function (x) { return x.id === id; })[0];
  if (!r) throw new Error('No se encontró la reserva.');

  var cambios = { estado: estado };
  if (estado === 'en_casa' && !r.checkInReal) cambios.checkInReal = ahora_();
  if (estado === 'checkout' && !r.checkOutReal) cambios.checkOutReal = ahora_();
  actualizar_('Reservas', 'id', id, cambios);

  // Al hacer el check-out la habitación queda sucia sola: así el equipo de
  // aseo la ve al tiro en su pantalla, sin que nadie tenga que avisarle.
  if (estado === 'checkout' && r.recurso) {
    guardarOCrear_('Aseo', 'idUnidad', r.recurso, {
      idUnidad: r.recurso, estado: 'sucia', responsable: u.nombre,
      notas: 'Check-out de ' + r.huesped, actualizado: ahora_()
    });
  }
  logCambio_(u.nombre, 'reserva_estado', id + ' -> ' + estado);
  return true;
}

function eliminarReserva(token, id) {
  var u = sesion_(token);
  if (u.rol !== 'admin') throw new Error('Solo administración puede eliminar reservas.');
  borrar_('Reservas', 'id', id);
  return true;
}

/* ===================== DÍA DE HOY ===================== */

function panelHoy(token, fecha) {
  sesion_(token);
  var dia = ymd_(fecha) || hoy_();
  var recs = recursos_();
  var nombre = function (id) {
    var r = recs.filter(function (x) { return x.id === id; })[0];
    return r ? (r.unidad + (r.nombre ? ' — ' + r.nombre : '')) : id;
  };
  var todas = leer_('Reservas').filter(function (r) { return r.estado !== 'cancelada'; });
  var firmadas = firmadas_();
  var mapear = function (r) {
    return {
      id: r.id, huesped: r.huesped, telefono: String(r.telefono || ''), canal: r.canal,
      recurso: nombre(r.recurso), estado: r.estado, notas: r.notas || '',
      firmada: !!firmadas[r.id],
      addon: !!r.addon, addonFecha: r.addonFecha ? String(r.addonFecha) : '',
      saldo: (Number(r.total) || 0) - (Number(r.anticipo) || 0),
      checkIn: ymd_(r.checkIn), checkOut: ymd_(r.checkOut)
    };
  };
  return {
    fecha: dia,
    // Llegadas = los que TODAVÍA no han hecho el check-in. En cuanto se
    // registran pasan a "en casa", que es donde recepción los busca después.
    llegadas: todas.filter(function (r) {
      return ymd_(r.checkIn) === dia && r.estado !== 'en_casa' && r.estado !== 'checkout';
    }).map(mapear),
    salidas: todas.filter(function (r) { return ymd_(r.checkOut) === dia; }).map(mapear),
    enCasa: todas.filter(function (r) {
      if (r.estado === 'checkout') return false;
      if (r.estado === 'en_casa') return true;
      return ymd_(r.checkIn) < dia && ymd_(r.checkOut) > dia;
    }).map(mapear),
    addons: todas.filter(function (r) {
      return r.addon && ymd_(r.checkIn) >= dia;
    }).map(mapear)
  };
}

/* ===================== ASEO ===================== */

/* Situación de HOY de cada recurso: una habitación entera, o cada cama por
   separado en las compartidas, porque muchas veces se ensucia solo una cama
   y no la pieza completa. */
function situacionAseo_() {
  var dia = hoy_();
  var estados = leer_('Aseo');
  var reservas = leer_('Reservas').filter(function (r) { return r.estado !== 'cancelada'; });

  return recursos_().map(function (rec) {
    var e = estados.filter(function (x) { return x.idUnidad === rec.id; })[0];
    var suyas = reservas.filter(function (r) { return r.recurso === rec.id; });

    var sale = suyas.filter(function (r) { return ymd_(r.checkOut) === dia; })[0];
    var llega = suyas.filter(function (r) { return ymd_(r.checkIn) === dia; })[0];
    var dentro = suyas.filter(function (r) {
      return ymd_(r.checkIn) < dia && ymd_(r.checkOut) > dia && r.estado !== 'checkout';
    })[0];

    var yaSalio = !!(sale && sale.estado === 'checkout');
    var yaLlego = !!(llega && llega.estado === 'en_casa');

    var situacion, detalle, orden;
    if (yaSalio && llega && !yaLlego) { situacion = 'salio_y_llega'; detalle = 'Ya se fue · llega otro huésped hoy'; orden = 1; }
    else if (yaSalio) { situacion = 'salio'; detalle = 'Ya se fue'; orden = 2; }
    else if (sale && llega && !yaLlego) { situacion = 'sale_y_llega'; detalle = 'Sale hoy · llega otro huésped hoy'; orden = 3; }
    else if (sale && !yaSalio) { situacion = 'sale'; detalle = 'Sale hoy, todavía no se va'; orden = 4; }
    else if (yaLlego) { situacion = 'llego'; detalle = 'Ya hizo el check-in, está adentro'; orden = 6; }
    else if (llega) { situacion = 'llega'; detalle = 'Llega hoy, todavía no llega'; orden = 5; }
    else if (dentro) { situacion = 'ocupada'; detalle = 'Huésped alojado'; orden = 6; }
    else { situacion = 'libre'; detalle = 'Sin movimiento hoy'; orden = 7; }

    return {
      id: rec.id, idUnidad: rec.idUnidad, unidad: rec.unidad, cama: rec.nombre || '',
      nombre: rec.unidad + (rec.nombre ? ' — ' + rec.nombre : ''),
      grupo: rec.grupo,
      estado: e ? e.estado : 'limpia',
      responsable: e ? e.responsable : '',
      notas: e ? e.notas : '',
      actualizado: e ? String(e.actualizado) : '',
      situacion: situacion, detalle: detalle, orden: orden,
      // Fechas explícitas: si algo se ve raro, se nota al tiro cuál es el día.
      fechaSale: sale ? ymd_(sale.checkOut) : '',
      fechaLlega: llega ? ymd_(llega.checkIn) : '',
      salePronto: dentro ? ymd_(dentro.checkOut) : '',
      saleHoy: !!sale, llegaHoy: !!llega, yaSalio: yaSalio, yaLlego: yaLlego,
      huespedSale: sale ? sale.huesped : '',
      huespedLlega: llega ? llega.huesped : '',
      huespedDentro: dentro ? dentro.huesped : (yaLlego ? llega.huesped : '')
    };
  }).sort(function (a, b) {
    if (a.orden !== b.orden) return a.orden - b.orden;
    return String(a.nombre).localeCompare(String(b.nombre));
  });
}

function panelAseo(token) {
  sesion_(token);
  return situacionAseo_();
}

/* Solo tres estados, que es lo que de verdad se usa a diario. */
var ESTADOS_ASEO = ['sucia', 'limpia', 'bloqueada'];

function marcarAseo(token, idUnidad, estado, notas) {
  var u = sesion_(token);
  marcarAseo_(idUnidad, estado, u.nombre, notas);
  return true;
}

function marcarAseo_(idUnidad, estado, quien, notas) {
  if (ESTADOS_ASEO.indexOf(estado) === -1) throw new Error('Estado de aseo no válido: ' + estado);
  if (!recursos_().some(function (x) { return x.id === idUnidad; })) {
    throw new Error('Ese alojamiento no existe.');
  }
  guardarOCrear_('Aseo', 'idUnidad', idUnidad, {
    idUnidad: idUnidad, estado: estado, responsable: quien,
    notas: notas || '', actualizado: ahora_()
  });
  logCambio_(quien, 'aseo', idUnidad + ' -> ' + estado);
}

/* ===================== PANTALLA DE ASEO COMPARTIDA =====================
   Un enlace propio para la persona de aseo: entra sin clave desde su
   teléfono, ve qué pasa hoy en cada alojamiento y marca lo que va limpiando.
   Recepción ve el mismo estado al instante. */

function claveAseo_() {
  var c = String(config_('tokenAseo', ''));
  if (!c) {
    c = Utilities.getUuid().replace(/-/g, '');
    guardarOCrear_('Config', 'clave', 'tokenAseo', { clave: 'tokenAseo', valor: c });
  }
  return c;
}

function linkAseo(token) {
  var u = sesion_(token);
  exigirAdmin_(u);
  return { url: ScriptApp.getService().getUrl() + '?aseo=' + claveAseo_() };
}

function aseoPublicoCargar(clave) {
  if (!clave || String(clave) !== claveAseo_()) throw new Error('Enlace no válido.');
  return {
    fecha: hoy_(),
    horaSalida: hora_(config_('checkOut'), '11:00'),
    horaEntrada: hora_(config_('checkIn'), '15:00'),
    unidades: situacionAseo_()
  };
}

function aseoPublicoMarcar(clave, idUnidad, estado, quien) {
  if (!clave || String(clave) !== claveAseo_()) throw new Error('Enlace no válido.');
  marcarAseo_(idUnidad, estado, String(quien || 'Aseo'), '');
  return situacionAseo_();
}

/* ===================== FICHA DE REGISTRO ===================== */

function guardarFicha(token, idReserva, d) {
  sesion_(token);
  return guardarFicha_(idReserva, d);
}

/* Compartida por el check-in en recepción y por la firma a distancia. */
function guardarFicha_(idReserva, d) {
  if (!d.acepta) throw new Error('El huésped debe aceptar el reglamento.');
  if (!d.firma) throw new Error('Falta la firma.');

  var m = /^data:(image\/\w+);base64,(.+)$/.exec(d.firma);
  if (!m) throw new Error('Firma inválida.');
  var carpeta;
  var it = DriveApp.getFoldersByName('Casona Peumayén — Fichas');
  carpeta = it.hasNext() ? it.next() : DriveApp.createFolder('Casona Peumayén — Fichas');
  var archivo = carpeta.createFile(Utilities.newBlob(
    Utilities.base64Decode(m[2]), m[1], 'firma_' + idReserva + '.png'));

  insertar_('Fichas', {
    id: uid_('F'), idReserva: idReserva, nombre: d.nombre || '', documento: d.documento || '',
    nacionalidad: d.nacionalidad || '', nacimiento: d.nacimiento || '',
    procedencia: d.procedencia || '', destino: d.destino || '', motivo: d.motivo || '',
    emergencia: d.emergencia || '', firmaUrl: archivo.getUrl(), fecha: ahora_()
  });
  // Si firma antes de llegar, la reserva sigue "confirmada": solo pasa a
  // "en casa" cuando el registro se hace el día de la llegada o después.
  // El check-in lo hace siempre recepción a mano, así que firmar la ficha
  // nunca cambia el estado de la reserva por su cuenta.
  return true;
}

function fichaDe(token, idReserva) {
  sesion_(token);
  var f = leer_('Fichas').filter(function (x) { return x.idReserva === idReserva; })[0];
  if (!f) return null;
  return {
    nombre: f.nombre || '', documento: f.documento || '', nacionalidad: f.nacionalidad || '',
    nacimiento: String(f.nacimiento || ''), procedencia: f.procedencia || '',
    destino: f.destino || '', motivo: f.motivo || '', emergencia: f.emergencia || '',
    firmaUrl: f.firmaUrl || '', fecha: String(f.fecha || '')
  };
}

/* ===================== REGLAMENTO =====================
   Fuente única de las normas: las usan la ficha de recepción y la página
   que firma el huésped, así nunca se desincronizan. Para cambiar una regla
   se edita solo acá. */
function reglamento() {
  var entrada = hora_(config_('checkIn'), '15:00');
  var salida = hora_(config_('checkOut'), '11:00');
  return {
    es: [
      'Check-in desde las ' + entrada + ' y check-out hasta las ' + salida + '.',
      'Horario de silencio de 22:00 a 09:00. Después de esa hora, la música y las ' +
      'conversaciones solo en el espacio común y en voz baja.',
      'No se admiten mascotas.',
      'No se permite fumar dentro de las habitaciones ni de las carpas.',
      'El consumo de alcohol está permitido solo en el espacio común.',
      'Las personas no registradas como huéspedes no pueden pernoctar.',
      'El huésped es responsable de los daños al mobiliario o al equipamiento.',
      'En las habitaciones compartidas se pide cuidar el descanso de los demás: ' +
      'evitar ruidos y luces fuertes cuando alguien esté durmiendo.',
      'Cancelación: sin costo hasta 72 horas antes de la llegada; 50% de devolución ' +
      'entre 24 y 72 horas; sin devolución con menos de 24 horas o si no se presenta.'
    ],
    en: [
      'Check-in from ' + entrada + ' and check-out until ' + salida + '.',
      'Quiet hours from 10:00 pm to 9:00 am. After that, music and conversation only ' +
      'in the common area and at a low volume.',
      'Pets are not allowed.',
      'Smoking is not allowed inside the rooms or the tents.',
      'Alcohol may be consumed in the common area only.',
      'People not registered as guests may not stay overnight.',
      'Guests are responsible for any damage to the furniture or equipment.',
      'In shared rooms please respect other guests’ rest: avoid noise and bright ' +
      'lights while someone is sleeping.',
      'Cancellation: free of charge up to 72 hours before arrival; 50% refund between ' +
      '24 and 72 hours; no refund with less than 24 hours or in case of a no-show.'
    ]
  };
}

/* ===================== FIRMA A DISTANCIA =====================
   Genera un enlace propio de cada reserva para mandar por WhatsApp o correo.
   El huésped lo abre, lee el reglamento, lo acepta y firma desde su teléfono.
   El enlace no da acceso a nada más: solo a su propia reserva. */

function linkFicha(token, idReserva) {
  sesion_(token);
  var r = leer_('Reservas').filter(function (x) { return x.id === idReserva; })[0];
  if (!r) throw new Error('No se encontró la reserva.');
  var t = String(r.tokenFicha || '');
  if (!t) {
    t = Utilities.getUuid().replace(/-/g, '');
    actualizar_('Reservas', 'id', idReserva, { tokenFicha: t });
  }
  return { url: ScriptApp.getService().getUrl() + '?f=' + t, token: t };
}

function fichaPublicaCargar(t) {
  var r = leer_('Reservas').filter(function (x) {
    return String(x.tokenFicha) === String(t) && String(t) !== '';
  })[0];
  if (!r) throw new Error('Enlace no válido o vencido.');
  if (r.estado === 'cancelada') throw new Error('Esta reserva fue cancelada.');

  var rec = recursos_().filter(function (x) { return x.id === r.recurso; })[0];
  var yaFirmo = !!firmadas_()[r.id];
  return {
    huesped: r.huesped,
    unidad: rec ? (rec.unidad + (rec.nombre ? ' — ' + rec.nombre : '')) : '',
    checkIn: ymd_(r.checkIn), checkOut: ymd_(r.checkOut),
    horaEntrada: hora_(config_('checkIn'), '15:00'),
    horaSalida: hora_(config_('checkOut'), '11:00'),
    firmada: yaFirmo
  };
}

function fichaPublicaFirmar(t, d) {
  var r = leer_('Reservas').filter(function (x) {
    return String(x.tokenFicha) === String(t) && String(t) !== '';
  })[0];
  if (!r) throw new Error('Enlace no válido o vencido.');
  guardarFicha_(r.id, d);
  return true;
}

/* ===================== ALOJAMIENTO (habitaciones y carpas) =====================
   Todo el inventario es editable: se pueden sumar habitaciones del ala nueva
   o carpas sin tocar el código. */

function inventarioAdmin(token) {
  var u = sesion_(token);
  exigirAdmin_(u);
  var camas = leer_('Camas');
  return leer_('Unidades')
    .sort(function (a, b) { return Number(a.orden) - Number(b.orden); })
    .map(function (x) {
      return {
        id: x.id, nombre: x.nombre, grupo: x.grupo, capacidad: Number(x.capacidad) || 0,
        bano: x.bano, porCama: !!x.porCama,
        precioBase: Number(x.precioBase) || 0, precioAlta: Number(x.precioAlta) || 0,
        orden: Number(x.orden) || 0, activa: !!x.activa,
        camas: camas.filter(function (c) { return c.idUnidad === x.id; })
          .sort(function (a, b) { return Number(a.orden) - Number(b.orden); })
          .map(function (c) {
            return {
              id: c.id, nombre: c.nombre, precioBase: Number(c.precioBase) || 0,
              precioAlta: Number(c.precioAlta) || 0, activa: !!c.activa
            };
          })
      };
    });
}

function exigirAdmin_(u) {
  if (u.rol !== 'admin') throw new Error('Solo administración puede hacer este cambio.');
}

function guardarUnidad(token, d) {
  var u = sesion_(token);
  exigirAdmin_(u);
  if (!String(d.nombre || '').trim()) throw new Error('Falta el nombre de la habitación o carpa.');

  var campos = {
    nombre: d.nombre, grupo: d.grupo || 'Lodge', capacidad: Number(d.capacidad) || 1,
    bano: d.bano || 'privado', porCama: !!d.porCama,
    precioBase: Number(d.precioBase) || 0, precioAlta: Number(d.precioAlta) || 0,
    activa: d.activa === false ? false : true
  };

  if (d.id) {
    actualizar_('Unidades', 'id', d.id, campos);
    olvidarRecursos_();
  logCambio_(u.nombre, 'unidad_editada', d.id);
    return { id: d.id };
  }
  var existentes = leer_('Unidades');
  campos.id = uid_(campos.grupo === 'Glamping' ? 'G' : 'U');
  campos.orden = existentes.length + 1;
  insertar_('Unidades', campos);
  olvidarRecursos_();
  logCambio_(u.nombre, 'unidad_creada', campos.nombre);
  return { id: campos.id };
}

function guardarCama(token, d) {
  var u = sesion_(token);
  exigirAdmin_(u);
  if (!d.idUnidad) throw new Error('Falta indicar a qué habitación pertenece la cama.');
  if (!String(d.nombre || '').trim()) throw new Error('Falta el nombre de la cama.');

  var campos = {
    idUnidad: d.idUnidad, nombre: d.nombre,
    precioBase: Number(d.precioBase) || 0, precioAlta: Number(d.precioAlta) || 0,
    activa: d.activa === false ? false : true
  };
  if (d.id) {
    actualizar_('Camas', 'id', d.id, campos);
    return { id: d.id };
  }
  campos.id = uid_('B');
  campos.orden = leer_('Camas').length + 1;
  insertar_('Camas', campos);
  // Una unidad con camas propias se vende por cama.
  actualizar_('Unidades', 'id', d.idUnidad, { porCama: true });
  olvidarRecursos_();
  logCambio_(u.nombre, 'cama_creada', d.nombre);
  return { id: campos.id };
}

/* No se borra nunca: se archiva, para no perder el historial de reservas. */
function archivarUnidad(token, id, activa) {
  var u = sesion_(token);
  exigirAdmin_(u);
  actualizar_('Unidades', 'id', id, { activa: !!activa });
  leer_('Camas').filter(function (c) { return c.idUnidad === id; })
    .forEach(function (c) { actualizar_('Camas', 'id', c.id, { activa: !!activa }); });
  olvidarRecursos_();
  logCambio_(u.nombre, 'unidad_archivada', id + ' activa=' + !!activa);
  return true;
}

function archivarCama(token, id, activa) {
  var u = sesion_(token);
  exigirAdmin_(u);
  actualizar_('Camas', 'id', id, { activa: !!activa });
  olvidarRecursos_();
  return true;
}

function logCambio_(quien, accion, detalle) {
  try { insertar_('Log', { fecha: ahora_(), usuario: quien, accion: accion, detalle: detalle }); }
  catch (e) { /* el registro de cambios nunca debe impedir la operación */ }
}

/* ===================== DIAGNÓSTICO =====================
   Se llama desde la pantalla de acceso para saber si el proyecto quedó
   bien instalado, en vez de quedarse adivinando por qué no entra. */
function diagnostico() {
  var out = { ok: true, hojas: {}, usuarios: 0, unidades: 0, mensaje: '' };
  try {
    var ss = ss_();
    out.planilla = ss.getUrl();
    Object.keys(HOJAS).forEach(function (n) {
      out.hojas[n] = !!ss.getSheetByName(n);
      if (!out.hojas[n]) out.ok = false;
    });
    if (!out.ok) { out.mensaje = 'Faltan hojas: ejecuta setup() desde el editor.'; return out; }
    out.usuarios = leer_('Usuarios').length;
    out.unidades = leer_('Unidades').filter(function (u) { return u.activa; }).length;
    if (!out.usuarios) { out.ok = false; out.mensaje = 'No hay usuarios cargados: ejecuta setup().'; return out; }
    if (!out.unidades) { out.ok = false; out.mensaje = 'No hay habitaciones cargadas: ejecuta setup().'; return out; }

    var reservas = leer_('Reservas');
    out.reservas = reservas.length;
    out.ilegibles = reservas.filter(function (r) { return !ymd_(r.checkIn) || !ymd_(r.checkOut); }).length;
    if (out.ilegibles) {
      out.ok = false;
      out.mensaje = out.ilegibles + ' reserva(s) tienen fechas ilegibles y por eso no aparecen ' +
        'en el calendario. Ejecuta repararReservas() desde el editor para revisarlas.';
      return out;
    }
    out.mensaje = 'Todo en orden: ' + out.usuarios + ' usuario(s), ' + out.unidades +
      ' unidades y ' + out.reservas + ' reserva(s).';
  } catch (e) {
    out.ok = false;
    out.mensaje = 'Error: ' + e.message + '. Lo más probable es que falte ejecutar setup().';
  }
  return out;
}

/* ===================== INFORMES =====================
   Todo se calcula sobre las reservas ya guardadas: ocupación, ingresos,
   de dónde llegan los huéspedes y qué alojamiento rinde más. */

function informes(token, desde, hasta) {
  sesion_(token);
  var d = ymd_(desde), h = ymd_(hasta);
  if (!d || !h || h <= d) throw new Error('Rango de fechas inválido.');

  var recs = recursos_();
  var nombreDe = {};
  recs.forEach(function (r) { nombreDe[r.id] = r.unidad + (r.nombre ? ' — ' + r.nombre : ''); });

  var dias = Math.round((new Date(h) - new Date(d)) / 86400000);
  var nochesDisponibles = recs.length * dias;

  var reservas = leer_('Reservas').filter(function (r) {
    return r.estado !== 'cancelada' && r.estado !== 'no_show' &&
      chocan_(ymd_(r.checkIn), ymd_(r.checkOut), d, h);
  });
  var canceladas = leer_('Reservas').filter(function (r) {
    return (r.estado === 'cancelada' || r.estado === 'no_show') &&
      chocan_(ymd_(r.checkIn), ymd_(r.checkOut), d, h);
  });

  var nochesVendidas = 0, ingresos = 0, abonado = 0, conAddon = 0, paxNoches = 0;
  var porCanal = {}, porUnidad = {}, porMes = {};

  reservas.forEach(function (r) {
    var ini = ymd_(r.checkIn), fin = ymd_(r.checkOut);
    if (!ini || !fin) return;
    var nTotal = Math.round((new Date(fin) - new Date(ini)) / 86400000) || 1;
    // Solo la parte de la estadía que cae dentro del rango consultado.
    var vIni = ini < d ? d : ini, vFin = fin > h ? h : fin;
    var nDentro = Math.round((new Date(vFin) - new Date(vIni)) / 86400000);
    if (nDentro <= 0) return;

    var total = Number(r.total) || 0;
    var proporcion = total * (nDentro / nTotal);

    nochesVendidas += nDentro;
    paxNoches += nDentro * (Number(r.pax) || 1);
    ingresos += proporcion;
    abonado += (Number(r.anticipo) || 0) * (nDentro / nTotal);
    if (r.addon) conAddon++;

    var canal = String(r.canal || 'sin canal');
    porCanal[canal] = porCanal[canal] || { canal: canal, reservas: 0, noches: 0, ingresos: 0 };
    porCanal[canal].reservas++;
    porCanal[canal].noches += nDentro;
    porCanal[canal].ingresos += proporcion;

    var un = nombreDe[r.recurso] || r.recurso;
    porUnidad[un] = porUnidad[un] || { unidad: un, noches: 0, ingresos: 0 };
    porUnidad[un].noches += nDentro;
    porUnidad[un].ingresos += proporcion;

    var mes = vIni.slice(0, 7);
    porMes[mes] = porMes[mes] || { mes: mes, noches: 0, ingresos: 0 };
    porMes[mes].noches += nDentro;
    porMes[mes].ingresos += proporcion;
  });

  var ordenar = function (obj, campo) {
    return Object.keys(obj).map(function (k) { return obj[k]; })
      .sort(function (a, b) { return (b[campo] || 0) - (a[campo] || 0); })
      .map(function (x) {
        x.ingresos = Math.round(x.ingresos);
        return x;
      });
  };

  var fichas = Object.keys(firmadas_()).length;

  return {
    desde: d, hasta: h, dias: dias,
    unidadesActivas: recs.length,
    nochesDisponibles: nochesDisponibles,
    nochesVendidas: nochesVendidas,
    ocupacion: nochesDisponibles ? Math.round(nochesVendidas / nochesDisponibles * 1000) / 10 : 0,
    reservas: reservas.length,
    canceladas: canceladas.length,
    ingresos: Math.round(ingresos),
    abonado: Math.round(abonado),
    porCobrar: Math.round(ingresos - abonado),
    // Tarifa media por noche vendida: el indicador clásico de un hotel.
    tarifaMedia: nochesVendidas ? Math.round(ingresos / nochesVendidas) : 0,
    // Ingreso por unidad disponible, incluyendo las que quedaron vacías.
    ingresoPorUnidad: nochesDisponibles ? Math.round(ingresos / nochesDisponibles) : 0,
    estadiaMedia: reservas.length ? Math.round(nochesVendidas / reservas.length * 10) / 10 : 0,
    paxNoches: paxNoches,
    paxPromedio: nochesVendidas ? Math.round(paxNoches / nochesVendidas * 10) / 10 : 0,
    programasGlamping: conAddon,
    fichasFirmadas: fichas,
    porCanal: ordenar(porCanal, 'ingresos'),
    porUnidad: ordenar(porUnidad, 'ingresos'),
    porMes: Object.keys(porMes).sort().map(function (k) {
      porMes[k].ingresos = Math.round(porMes[k].ingresos);
      return porMes[k];
    })
  };
}

/* ===================== EQUIPO ===================== */

function listarEquipo(token) {
  var u = sesion_(token);
  if (u.rol !== 'admin') throw new Error('Solo administración.');
  return leer_('Usuarios').map(function (x) {
    return { nombre: x.nombre, rol: x.rol, activo: !!x.activo };
  });
}

function guardarMiembro(token, nombre, pinNuevo, rol) {
  var u = sesion_(token);
  if (u.rol !== 'admin') throw new Error('Solo administración.');
  if (!nombre || !pinNuevo) throw new Error('Falta nombre o PIN.');
  guardarOCrear_('Usuarios', 'nombre', nombre, {
    nombre: nombre, rol: rol, pinHash: pin_(String(pinNuevo)), activo: true
  });
  return true;
}
