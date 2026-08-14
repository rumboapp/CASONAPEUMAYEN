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

/* Versión del servidor. La pantalla trae la misma escrita y las compara: si
   no calzan es que se copió un archivo y no el otro, o que la implementación
   quedó publicando una versión anterior. Ese descalce daba errores raros
   ("runner[fn] is undefined") que costaba entender; ahora se dice derecho.
   Al cambiar el código, subir la fecha en LOS DOS archivos. */
var VERSION = '2026-08-09';

function version() { return VERSION; }

var HOJAS = {
  // 'modo' dice cómo se vende cada pieza: entera, por camas, o las dos cosas.
  // Se agrega al final y convive con el 'porCama' antiguo, que sigue sirviendo
  // de respaldo para las instalaciones que vienen de antes.
  Unidades: ['id', 'nombre', 'grupo', 'capacidad', 'bano', 'porCama', 'precioBase', 'precioAlta', 'orden', 'activa', 'categoria', 'modo'],
  Camas: ['id', 'idUnidad', 'nombre', 'precioBase', 'precioAlta', 'orden', 'activa'],
  // Las columnas nuevas SIEMPRE se agregan al final: si se insertan en medio,
  // las filas ya guardadas quedan corridas y sus fechas se vuelven ilegibles.
  Reservas: ['id', 'recurso', 'idUnidad', 'huesped', 'telefono', 'canal', 'checkIn', 'checkOut', 'estado', 'total', 'anticipo', 'addon', 'addonFecha', 'notas', 'creado', 'creadoPor', 'email', 'tokenFicha', 'checkInReal', 'checkOutReal', 'grupo', 'pax', 'exentoIva', 'docTurismo'],
  // Lo que se cobra por CADA noche de una reserva. El total de la reserva es
  // la suma de estas filas, así que alargarla o acortarla recalcula el precio
  // solo, y una noche de promoción se baja sin tocar las demás.
  Noches: ['idReserva', 'fecha', 'valor', 'ajustada', 'nota'],
  // La cuenta del huésped: cargos y pagos en un solo libro, en orden.
  // Un cargo suma y un pago resta; el saldo es la diferencia.
  Cuenta: ['id', 'idReserva', 'fecha', 'clase', 'tipo', 'centro', 'descripcion', 'cantidad', 'unitario', 'total', 'exento', 'medio', 'anulado', 'creado', 'creadoPor'],
  // Un renglón por día cerrado: deja constancia de qué se posteó y quién cerró.
  Cierres: ['fecha', 'ejecutado', 'por', 'noches', 'alojamiento', 'consumos', 'pagos', 'avisos'],
  Aseo: ['idUnidad', 'estado', 'responsable', 'notas', 'actualizado'],
  Fichas: ['id', 'idReserva', 'nombre', 'documento', 'nacionalidad', 'nacimiento', 'procedencia', 'destino', 'motivo', 'emergencia', 'firmaUrl', 'fecha'],
  // Quiénes más duermen en esa reserva. Firma solo el representante, pero el
  // registro de huéspedes tiene que nombrar a todos los que pernoctan.
  Acompanantes: ['id', 'idReserva', 'nombre', 'documento', 'nacionalidad', 'nacimiento', 'notas', 'creado'],
  Usuarios: ['nombre', 'rol', 'pinHash', 'activo'],
  Sesiones: ['token', 'nombre', 'rol', 'expira'],
  Log: ['fecha', 'usuario', 'accion', 'detalle'],
  Config: ['clave', 'valor']
};

/* Columnas que deben guardarse como TEXTO plano y no como fecha de Sheets.
   Esto era el origen del bug de reservas duplicadas: Sheets convertía
   "2026-08-07" en un objeto Date con hora local y las comparaciones fallaban. */
var COLS_TEXTO = {
  Reservas: ['checkIn', 'checkOut', 'addonFecha', 'creado', 'telefono', 'checkInReal', 'checkOutReal', 'docTurismo'],
  Noches: ['fecha'],
  Acompanantes: ['nacimiento', 'creado'],
  Cuenta: ['fecha', 'creado'],
  Cierres: ['fecha', 'ejecutado'],
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

  // El logo ya NO se incrusta en la plantilla: la página lo pide aparte con
  // logoImagen(). Así, si algo falla, falla solo el logo y no la página
  // entera, y además el HTML que viaja pesa bastante menos.
  return pagina.evaluate()
    .setTitle(titulo)
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/* El logo, para las tres pantallas. No pide clave: es la imagen del lugar. */
function logoImagen() { return LOGO; }

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

/* Filas agrupadas por el valor de una columna, armado una sola vez.
   Sin esto, buscar en el historial recorría TODOS los movimientos por cada
   reserva: con tres años de datos eran diez segundos de espera. Con el índice
   es instantáneo, y el costo de armarlo se paga una vez por ejecución. */
function agrupar_(nombre, campo) {
  var clave = '__idx_' + nombre + '_' + campo;
  if (MEMO[clave]) return MEMO[clave];
  var idx = {};
  leer_(nombre).forEach(function (fila) {
    var k = String(fila[campo]);
    (idx[k] || (idx[k] = [])).push(fila);
  });
  MEMO[clave] = idx;
  return idx;
}

function olvidar_(nombre) {
  delete MEMO[nombre];
  delete MEMO['__raw_' + nombre];
  delete MEMO['__cab_' + nombre];
  Object.keys(MEMO).forEach(function (k) {
    if (k.indexOf('__idx_' + nombre + '_') === 0) delete MEMO[k];
  });
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

/* Cambia VARIAS filas de una hoja con una sola lectura y una sola escritura.
   `decidir(fila)` recibe cada fila como objeto y devuelve los cambios, o
   null si no hay que tocarla. Sin esto, corregir el precio de cinco noches
   costaba cinco viajes a Google en vez de uno. */
function actualizarVarias_(nombre, decidir) {
  var sh = hoja_(nombre), v = crudo_(nombre), cab = v[0] || [];
  if (!cab.length) return 0;
  var min = -1, max = -1, tocadas = 0;
  for (var i = 1; i < v.length; i++) {
    var obj = {};
    for (var j = 0; j < cab.length; j++) obj[cab[j]] = v[i][j];
    var cambios = decidir(obj);
    if (!cambios) continue;
    for (var k in cambios) {
      var c = cab.indexOf(k);
      if (c > -1) v[i][c] = cambios[k];
    }
    tocadas++;
    if (min === -1) min = i;
    max = i;
  }
  if (!tocadas) return 0;
  // Se escribe el bloque completo entre la primera y la última fila tocada:
  // las de en medio se reescriben con su mismo contenido, que no cuesta nada.
  var bloque = [];
  for (var r = min; r <= max; r++) {
    var fila = (v[r] || []).slice(0, cab.length);
    while (fila.length < cab.length) fila.push('');
    bloque.push(fila);
  }
  sh.getRange(min + 1, 1, bloque.length, cab.length).setValues(bloque);
  olvidar_(nombre);
  return tocadas;
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
      addonBase: 30000, addonAlta: 35000,
      // Porcentaje del programa tinaja + sushi que se anota al restaurante.
      // Cámbialo acá cuando definan el reparto con la cocina.
      addonParteRestaurante: 50,
      iva: 19
    };
    Object.keys(cfg).forEach(function (k) { insertar_('Config', { clave: k, valor: cfg[k] }); });
  }

  if (!leer_('Unidades').length) {
    // La distribución real de la casa. Todas se venden como habitación
    // completa; la categoría es solo una etiqueta, para buscar por tipo y
    // para saber cómo agrupar la oferta al publicarla en un canal.
    var unidadesIniciales = DISTRIBUCION.map(function (d) {
      return { id: d.id, nombre: d.nombre, grupo: 'Lodge', capacidad: d.capacidad,
               bano: d.bano, precioBase: d.precioBase, precioAlta: d.precioAlta,
               categoria: d.categoria };
    }).concat([
      { id: 'G1', nombre: 'Carpa A', grupo: 'Glamping', capacidad: 2, bano: 'compartido',
        precioBase: 65000, precioAlta: 83000, categoria: 'Carpa glamping' },
      { id: 'G2', nombre: 'Carpa B', grupo: 'Glamping', capacidad: 2, bano: 'compartido',
        precioBase: 65000, precioAlta: 83000, categoria: 'Carpa glamping' },
      { id: 'G3', nombre: 'Carpa C', grupo: 'Glamping', capacidad: 2, bano: 'compartido',
        precioBase: 65000, precioAlta: 83000, categoria: 'Carpa glamping' }
    ]);

    unidadesIniciales.forEach(function (u, i) {
      insertar_('Unidades', {
        id: u.id, nombre: u.nombre, grupo: u.grupo, capacidad: u.capacidad, bano: u.bano,
        modo: 'entera', porCama: false,
        precioBase: u.precioBase, precioAlta: u.precioAlta,
        orden: i + 1, activa: true, categoria: u.categoria
      });
    });

    // Las camas de las dos piezas que las tienen quedan cargadas pero
    // ARCHIVADAS: si algún día se vuelve a vender por cama, están listas y
    // basta cambiar el modo de la habitación.
    [
      ['B71', 'U7', 'Cama matrimonial', 28000, 36000],
      ['B72', 'U7', 'Litera superior', 25000, 32000],
      ['B73', 'U7', 'Litera inferior', 25000, 32000],
      ['B81', 'U8', 'Cama individual', 25000, 32000],
      ['B82', 'U8', 'Litera superior', 25000, 32000],
      ['B83', 'U8', 'Litera inferior', 25000, 32000]
    ].forEach(function (b, i) {
      insertar_('Camas', {
        id: b[0], idUnidad: b[1], nombre: b[2], precioBase: b[3], precioAlta: b[4],
        orden: i + 1, activa: false
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

/* Si nadie escribió una categoría, se arma una razonable con lo que ya se
   sabe de la unidad, para que la búsqueda nunca quede vacía. */
function categoriaPorDefecto_(u) {
  if (String(u.grupo) === 'Glamping') return 'Carpa glamping';
  var bano = (u.bano || 'privado') === 'privado' ? 'con baño privado' : 'con baño compartido';
  if (u.porCama) return 'Compartida ' + bano;
  var cap = Number(u.capacidad) || 2;
  return (cap >= 3 ? 'Familiar ' : cap === 1 ? 'Individual ' : 'Doble ') + bano;
}

/* Recursos = filas del calendario. Cada habitación entera, o cada cama en las compartidas. */
/* Cómo se vende una pieza:
     'entera' — solo la habitación completa (una fila en el calendario)
     'camas'  — solo por cama (una fila por cama)
     'ambas'  — las dos cosas: la habitación y sus camas conviven en el
                calendario y se bloquean entre sí, para poder vender la pieza
                completa a una familia o cama por cama a mochileros.
   Las instalaciones antiguas no tienen esta columna, así que se deduce del
   'porCama' de siempre. */
function modoDe_(u) {
  var m = String(u.modo || '').trim();
  if (m === 'entera' || m === 'camas' || m === 'ambas') return m;
  return u.porCama ? 'camas' : 'entera';
}

function recursosDesdePlanilla_() {
  var unidades = leer_('Unidades').filter(function (u) { return u.activa; })
    .sort(function (a, b) { return Number(a.orden) - Number(b.orden); });
  var camas = leer_('Camas').filter(function (c) { return c.activa; })
    .sort(function (a, b) { return Number(a.orden) - Number(b.orden); });
  var out = [];
  unidades.forEach(function (u) {
    var modo = modoDe_(u);
    var mias = camas.filter(function (c) { return c.idUnidad === u.id; });
    var cat = String(u.categoria || '') || categoriaPorDefecto_(u);

    if (modo === 'entera' || modo === 'ambas') {
      out.push({
        id: u.id, idUnidad: u.id, grupo: u.grupo, unidad: u.nombre, nombre: '',
        precioBase: Number(u.precioBase) || 0, precioAlta: Number(u.precioAlta) || 0,
        capacidad: Number(u.capacidad) || 2, bano: u.bano || 'privado',
        categoria: cat, modo: modo, esUnidad: true,
        // Vender la pieza completa deja sin cupo a todas sus camas.
        bloquea: modo === 'ambas' ? mias.map(function (c) { return c.id; }) : []
      });
    }
    if (modo === 'camas' || modo === 'ambas') {
      mias.forEach(function (c) {
        out.push({
          id: c.id, idUnidad: u.id, grupo: u.grupo, unidad: u.nombre, nombre: c.nombre,
          precioBase: Number(c.precioBase) || 0, precioAlta: Number(c.precioAlta) || 0,
          capacidad: 1, bano: u.bano || 'compartido',
          categoria: cat, modo: modo, esUnidad: false,
          // Vender una cama deja sin cupo a la pieza completa.
          bloquea: modo === 'ambas' ? [u.id] : []
        });
      });
    }
  });
  return out;
}

/* Todos los recursos que quedan tomados cuando se reserva uno: él mismo y
   los que se pisan con él. Es lo que evita vender la habitación completa y
   una cama de esa misma habitación para la misma noche. */
function conflictosDe_(recursoId) {
  var todos = recursos_();
  var yo = todos.filter(function (r) { return r.id === recursoId; })[0];
  var set = {};
  set[recursoId] = true;
  if (yo && yo.bloquea) yo.bloquea.forEach(function (id) { set[id] = true; });
  // Y al revés: si alguien más me nombra, también choca conmigo.
  todos.forEach(function (r) {
    if (r.bloquea && r.bloquea.indexOf(recursoId) > -1) set[r.id] = true;
  });
  return set;
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

/* ===================== RESERVAS ===================== */

/* Calza el plan de noches con las fechas y, si desde el formulario vino un
   total distinto al que suman las noches, lo reparte entre ellas. Así el
   número que se ve en la reserva y el detalle noche a noche nunca se
   contradicen. */
function ajustarPlan_(reserva, totalPedido, quien) {
  var r = sincronizarNoches_(reserva, quien);
  if (totalPedido === null || totalPedido === r.total) return r.total;
  // Un total en cero suele ser "todavía no lo cotizo": se deja la tarifa.
  if (totalPedido <= 0) return r.total;
  var plan = planDe_(reserva.id);
  if (!plan.length) return r.total;
  aplicarValores_(reserva.id, repartir_(totalPedido, plan), 'Total acordado');
  return totalPedido;
}

/* Verificación autoritativa de disponibilidad. Se ejecuta SIEMPRE antes de escribir. */
function verificarLibre_(recurso, checkIn, checkOut, ignorarId) {
  // No basta con mirar ese mismo recurso: en una habitación que se vende
  // completa Y por cama, tomar la pieza deja sin cupo a sus camas, y tomar
  // una cama deja sin cupo a la pieza.
  var choca = conflictosDe_(recurso);
  var ocupadas = leer_('Reservas').filter(function (r) {
    return choca[String(r.recurso)]
      && r.estado !== 'cancelada' && r.estado !== 'no_show'
      && String(r.id) !== String(ignorarId || '')
      && chocan_(ymd_(r.checkIn), ymd_(r.checkOut), checkIn, checkOut);
  });
  if (ocupadas.length) {
    var o = ocupadas[0];
    var nombres = {};
    recursos_().forEach(function (x) {
      nombres[x.id] = x.unidad + (x.nombre ? ' — ' + x.nombre : '');
    });
    var mismo = String(o.recurso) === String(recurso);
    throw new Error('Ocupado: ya hay una reserva de ' + o.huesped +
      ' del ' + ymd_(o.checkIn) + ' al ' + ymd_(o.checkOut) +
      (mismo ? '.' : ' en ' + (nombres[o.recurso] || o.recurso) +
        ', que ocupa el mismo espacio.'));
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

    var pedido = (datos.total === undefined || datos.total === null || datos.total === '')
      ? null : Math.round(Number(datos.total) || 0);

    if (datos.id) {
      // Si la cuenta ya tiene pagos anotados, ella manda: el abonado de la
      // reserva es su espejo y no se puede pisar desde este formulario.
      var pagados = movimientosDe_(datos.id).filter(function (m) { return m.clase === 'pago'; });
      if (pagados.length) delete campos.anticipo;
      delete campos.total;                     // el total lo fija el plan de noches
      actualizar_('Reservas', 'id', datos.id, campos);
      campos.id = datos.id;
      return { id: datos.id, total: ajustarPlan_(campos, pedido, u.nombre) };
    }

    var id = uid_('R');
    campos.id = id;
    campos.tokenFicha = '';
    campos.creado = ahora_();
    campos.creadoPor = u.nombre;
    // Las noches se arman antes de guardar, para que el total que queda en la
    // reserva sea ya la suma de sus noches y no haya que corregirlo después.
    var plan = armarNoches_(id, datos.recurso, f.checkIn, f.checkOut, pedido);
    campos.total = plan.total;
    insertar_('Reservas', campos);
    insertarVarias_('Noches', plan.noches);
    // El abono que se escribe al crear la reserva entra a la cuenta como un
    // pago, para que exista un solo lugar donde vive la plata.
    if (campos.anticipo > 0) {
      anotar_(id, {
        clase: 'pago', tipo: 'pago', descripcion: 'Abono inicial',
        cantidad: 1, unitario: campos.anticipo, total: campos.anticipo,
        medio: datos.medioAnticipo || 'otro', fecha: hoy_()
      }, u.nombre);
    }
    return { id: id, total: plan.total };
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
  // Una cama tomada deja sin cupo a su habitación completa, y al revés: por
  // eso lo ocupado se propaga a los recursos que se pisan entre sí.
  var tomadas = {};
  var porId = {};
  recursos_().forEach(function (x) { porId[x.id] = x; });
  ocupadas.forEach(function (r) {
    tomadas[r.recurso] = r.huesped;
    var rec = porId[r.recurso];
    if (rec && rec.bloquea) {
      rec.bloquea.forEach(function (id) { if (!tomadas[id]) tomadas[id] = r.huesped; });
    }
  });

  var alta = esAlta_(f.checkIn);
  var noches = Math.round((new Date(f.checkOut) - new Date(f.checkIn)) / 86400000);

  return recursos_().map(function (rec) {
    return {
      id: rec.id, unidad: rec.unidad, cama: rec.nombre || '', grupo: rec.grupo,
      capacidad: rec.capacidad, categoria: rec.categoria || '', bano: rec.bano,
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
    // Las noches se arman ANTES de escribir, para que el total que queda
    // guardado en cada reserva sea ya el que suman sus noches.
    var noches = [];
    filas.forEach(function (x) {
      var plan = armarNoches_(x.id, x.recurso, f.checkIn, f.checkOut,
                              Math.round(Number(x.total) || 0));
      x.total = plan.total;
      noches = noches.concat(plan.noches);
    });

    // Todas las habitaciones del grupo se escriben de una sola vez, y sus
    // noches también: si no, un grupo de tres piezas costaría tres rondas
    // completas de lectura y escritura.
    insertarVarias_('Reservas', filas);
    insertarVarias_('Noches', noches);
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
    // Alargar la reserva agrega esas noches al precio, y acortarla las quita:
    // el total nunca se queda pegado en lo que valía antes.
    var r = sincronizarNoches_({ id: id, recurso: recurso, checkIn: f.checkIn, checkOut: f.checkOut },
                               sesion_(token).nombre);
    return { total: r.total, agregadas: r.agregadas, quitadas: r.quitadas };
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
  borrar_('Cuenta', 'idReserva', id);
  borrar_('Noches', 'idReserva', id);
  borrar_('Acompanantes', 'idReserva', id);
  return true;
}

/* ===================== PRECIO NOCHE A NOCHE =====================
   El total de una reserva NO es un número suelto: es la suma de lo que vale
   cada noche. Con eso, alargar la reserva un día suma esa noche sola,
   acortarla la resta, y una noche de promoción se baja sin tocar las demás.

   Cada noche parte con la tarifa que corresponde a esa fecha (baja o alta) y
   queda marcada como "ajustada" si alguien le puso un precio a mano, para
   respetarlo cuando después se mueva la reserva. */

function planDe_(idReserva) {
  return (agrupar_('Noches', 'idReserva')[String(idReserva)] || [])
    .map(function (n) {
      return {
        idReserva: n.idReserva, fecha: ymd_(n.fecha),
        valor: Math.round(Number(n.valor) || 0),
        ajustada: !!n.ajustada, nota: String(n.nota || '')
      };
    })
    .sort(function (a, b) { return a.fecha < b.fecha ? -1 : 1; });
}

function tarifaDe_(recursoId, fecha) {
  var r = recursos_().filter(function (x) { return x.id === recursoId; })[0];
  if (!r) return 0;
  return Math.round(Number(esAlta_(fecha) ? r.precioAlta : r.precioBase) || 0);
}

/* Deja el plan calzado con las fechas de la reserva: agrega las noches que
   falten con su tarifa, y saca las que sobren si la estadía se acortó. Las
   noches que ya estaban se respetan tal cual, incluidas las de promoción. */
function sincronizarNoches_(reserva, quien) {
  var ci = ymd_(reserva.checkIn), co = ymd_(reserva.checkOut);
  if (!ci || !co) return { total: Math.round(Number(reserva.total) || 0), agregadas: 0, quitadas: 0 };

  var actuales = {};
  planDe_(reserva.id).forEach(function (n) { actuales[n.fecha] = n; });

  var quiero = {};
  for (var f = ci; f < co; f = sumarDias_(f, 1)) quiero[f] = true;

  // El total se lleva en memoria mientras se decide qué agregar y qué sacar:
  // así no hay que volver a leer la hoja para saber cuánto quedó.
  var total = 0, agregadas = 0, quitadas = 0, nuevas = [], sobran = {};
  Object.keys(quiero).forEach(function (f) {
    if (actuales[f]) { total += actuales[f].valor; return; }
    var valor = tarifaDe_(reserva.recurso, f);
    nuevas.push({ idReserva: reserva.id, fecha: f, valor: valor, ajustada: false, nota: '' });
    total += valor;
    agregadas++;
  });
  Object.keys(actuales).forEach(function (f) {
    if (quiero[f]) return;
    sobran[f] = true;
    quitadas++;
  });

  if (quitadas) {
    borrarNoches_(reserva.id, sobran);
    // Las noches que ya se habían anotado en la cuenta se anulan: la estadía
    // se acortó y cobrarlas sería un error.
    actualizarVarias_('Cuenta', function (m) {
      if (String(m.idReserva) !== String(reserva.id) || m.anulado) return null;
      if (m.clase !== 'cargo' || m.tipo !== 'alojamiento') return null;
      if (!sobran[ymd_(m.fecha)]) return null;
      return { anulado: true,
               descripcion: String(m.descripcion || '') + ' · ANULADO: la estadía se acortó' };
    });
  }
  if (nuevas.length) insertarVarias_('Noches', nuevas);

  actualizar_('Reservas', 'id', reserva.id, { total: total });
  if (agregadas || quitadas) {
    logCambio_(quien || '', 'noches', reserva.id + ' · +' + agregadas + ' / -' + quitadas +
      ' · total ' + total);
  }
  return { total: total, agregadas: agregadas, quitadas: quitadas };
}

/* Borra de una vez todas las noches que sobran, en lugar de una por una. */
function borrarNoches_(idReserva, fechas) {
  var sh = hoja_('Noches'), v = crudo_('Noches'), cab = v[0] || [];
  var ci = cab.indexOf('idReserva'), cf = cab.indexOf('fecha');
  if (ci === -1 || cf === -1) return;
  for (var i = v.length - 1; i >= 1; i--) {
    if (String(v[i][ci]) === String(idReserva) && fechas[ymd_(v[i][cf])]) sh.deleteRow(i + 1);
  }
  olvidar_('Noches');
}

function totalDelPlan_(idReserva) {
  var t = 0;
  planDe_(idReserva).forEach(function (n) { t += n.valor; });
  return Math.round(t);
}

/* El detalle noche a noche, para verlo y editarlo desde la reserva. */
function nochesDe(token, idReserva) {
  sesion_(token);
  var r = leer_('Reservas').filter(function (x) { return x.id === idReserva; })[0];
  if (!r) throw new Error('No se encontró la reserva.');
  var movs = movimientosDe_(idReserva);
  var posteadas = {};
  movs.forEach(function (m) {
    if (m.clase === 'cargo' && m.tipo === 'alojamiento') posteadas[ymd_(m.fecha)] = true;
  });
  var plan = planDe_(idReserva).map(function (n) {
    n.posteada = !!posteadas[n.fecha];
    n.tarifa = tarifaDe_(r.recurso, n.fecha);
    return n;
  });
  return {
    idReserva: idReserva, noches: plan, total: totalDelPlan_(idReserva),
    checkIn: ymd_(r.checkIn), checkOut: ymd_(r.checkOut)
  };
}

/* Cambia lo que vale UNA noche. Es lo que se usa para una promoción o para
   corregir un precio mal puesto, sin tocar el resto de la estadía. */
function guardarNoche(token, idReserva, fecha, valor, nota) {
  var u = sesion_(token);
  var f = ymd_(fecha);
  var existe = planDe_(idReserva).filter(function (n) { return n.fecha === f; })[0];
  if (!existe) throw new Error('Esa noche no es parte de la reserva.');

  var v = Math.round(Number(valor) || 0);
  if (v < 0) throw new Error('El valor de la noche no puede ser negativo.');

  var nuevos = {};
  nuevos[f] = v;
  var total = aplicarValores_(idReserva, nuevos, String(nota || ''));
  logCambio_(u.nombre, 'noche_editada', idReserva + ' · ' + f + ' · ' + v);
  return { total: total };
}

/* Deja las noches indicadas en su nuevo valor, corrige de paso las que ya
   estaban anotadas en la cuenta y actualiza el total de la reserva. Todo con
   una lectura y una escritura por hoja, aunque cambien diez noches. */
function aplicarValores_(idReserva, valorPorFecha, nota) {
  actualizarVarias_('Noches', function (n) {
    if (String(n.idReserva) !== String(idReserva)) return null;
    var f = ymd_(n.fecha);
    if (valorPorFecha[f] === undefined) return null;
    return { valor: valorPorFecha[f], ajustada: true, nota: nota || n.nota || '' };
  });

  actualizarVarias_('Cuenta', function (m) {
    if (String(m.idReserva) !== String(idReserva) || m.anulado) return null;
    if (m.clase !== 'cargo' || m.tipo !== 'alojamiento') return null;
    var f = ymd_(m.fecha);
    if (valorPorFecha[f] === undefined) return null;
    return { unitario: valorPorFecha[f], total: valorPorFecha[f] };
  });

  var total = totalDelPlan_(idReserva);
  actualizar_('Reservas', 'id', idReserva, { total: total });
  return total;
}

/* Cuando se negocia un precio por el paquete completo ("las 3 noches en
   150.000"), se reparte entre las noches y la última absorbe el redondeo,
   para que la suma dé exactamente lo acordado. */
function repartirTotal(token, idReserva, total) {
  var u = sesion_(token);
  var plan = planDe_(idReserva);
  if (!plan.length) throw new Error('La reserva no tiene noches que repartir.');
  var t = Math.round(Number(total) || 0);
  if (t < 0) throw new Error('El total no puede ser negativo.');

  var reparto = repartir_(t, plan);
  aplicarValores_(idReserva, reparto, 'Total repartido');
  logCambio_(u.nombre, 'total_repartido', idReserva + ' · ' + t);
  return { total: t, porNoche: Math.round(t / plan.length) };
}

/* Arma el plan de noches de una reserva SIN escribir nada: devuelve las filas
   y el total. Sirve para dejar la reserva y sus noches guardadas de una sola
   vez, en vez de crear la reserva y después corregirle el total. */
function armarNoches_(idReserva, recurso, checkIn, checkOut, totalPedido) {
  var dias = [];
  for (var d = checkIn; d < checkOut; d = sumarDias_(d, 1)) {
    dias.push({ fecha: d, valor: tarifaDe_(recurso, d) });
  }
  if (!dias.length) return { noches: [], total: 0 };

  var acordado = (totalPedido === null || totalPedido === undefined || totalPedido <= 0)
    ? null : Math.round(totalPedido);
  var valores = acordado ? repartir_(acordado, dias) : null;

  var noches = dias.map(function (n) {
    return {
      idReserva: idReserva, fecha: n.fecha,
      valor: valores ? valores[n.fecha] : n.valor,
      ajustada: !!valores, nota: valores ? 'Total acordado' : ''
    };
  });
  var total = acordado || dias.reduce(function (a, n) { return a + n.valor; }, 0);
  return { noches: noches, total: total };
}

/* Reparte un total entre las noches. La última absorbe el redondeo, para que
   la suma dé exactamente lo acordado y no sobre ni falte un peso. */
function repartir_(total, plan) {
  var porNoche = Math.round(total / plan.length), puesto = 0, mapa = {};
  plan.forEach(function (n, i) {
    var v = (i === plan.length - 1) ? (total - puesto) : porNoche;
    puesto += v;
    mapa[n.fecha] = v;
  });
  return mapa;
}

/* ===================== CUENTA DEL HUÉSPED =====================
   Un solo libro por reserva: los cargos suman y los pagos restan. El saldo
   es la diferencia. El alojamiento lo postea el cierre de día, noche por
   noche; lo demás se agrega a mano cuando ocurre.

   Cada cargo sabe a qué centro de ingreso pertenece (el lodge o el
   restaurante), así el reparto con la cocina sale solo en los informes en
   vez de discutirse a fin de mes. */

var TIPOS_CARGO = {
  alojamiento: { rotulo: 'Alojamiento', centro: 'lodge' },
  tinaja:      { rotulo: 'Tinaja',      centro: 'lodge' },
  sushi:       { rotulo: 'Sushi',       centro: 'restaurante' },
  restaurante: { rotulo: 'Restaurante', centro: 'restaurante' },
  bar:         { rotulo: 'Bar',         centro: 'restaurante' },
  lavanderia:  { rotulo: 'Lavandería',  centro: 'lodge' },
  danos:       { rotulo: 'Daños',       centro: 'lodge' },
  otro:        { rotulo: 'Otro',        centro: 'lodge' }
};

var MEDIOS_PAGO = ['efectivo', 'transferencia', 'tarjeta', 'booking', 'otro'];

function ivaPct_() { return Number(config_('iva', 19)) || 0; }

/* En Chile los precios se muestran con IVA incluido, así que el neto se saca
   del total. Los servicios a turistas extranjeros sin domicilio en Chile van
   exentos, y en ese caso el total ES el neto. */
function desglosarIva_(total, exento) {
  var t = Math.round(Number(total) || 0);
  if (exento) return { total: t, neto: t, iva: 0 };
  var neto = Math.round(t / (1 + ivaPct_() / 100));
  return { total: t, neto: neto, iva: t - neto };
}

function movimientosDe_(idReserva) {
  var suyos = agrupar_('Cuenta', 'idReserva')[String(idReserva)] || [];
  return suyos.filter(function (m) { return !m.anulado; });
}

/* Cuánto del alojamiento todavía no se ha anotado en la cuenta: la suma de
   las noches del plan que el cierre aún no ha posteado. Sirve para que el
   saldo que ve recepción sea el de la estadía completa y no solo el de las
   noches ya cerradas. */
function alojamientoPendiente_(reserva, movs) {
  var puestas = {};
  movs.forEach(function (m) {
    if (m.clase === 'cargo' && m.tipo === 'alojamiento') puestas[ymd_(m.fecha)] = true;
  });
  var pend = 0;
  planDe_(reserva.id).forEach(function (n) { if (!puestas[n.fecha]) pend += n.valor; });
  return pend > 0 ? pend : 0;
}

function cuentaDe(token, idReserva) {
  sesion_(token);
  var r = leer_('Reservas').filter(function (x) { return x.id === idReserva; })[0];
  if (!r) throw new Error('No se encontró la reserva.');
  var movs = movimientosDe_(idReserva);

  var cargos = 0, pagos = 0, neto = 0, iva = 0, exentos = 0;
  var porCentro = {};
  var lista = movs.map(function (m) {
    var total = Math.round(Number(m.total) || 0);
    if (m.clase === 'pago') {
      pagos += total;
    } else {
      cargos += total;
      var d = desglosarIva_(total, m.exento);
      neto += d.neto; iva += d.iva;
      if (m.exento) exentos += total;
      var c = m.centro || 'lodge';
      porCentro[c] = (porCentro[c] || 0) + total;
    }
    return {
      id: m.id, fecha: ymd_(m.fecha), clase: m.clase, tipo: m.tipo,
      centro: m.centro || '', descripcion: m.descripcion || '',
      cantidad: Number(m.cantidad) || 1, unitario: Math.round(Number(m.unitario) || 0),
      total: total, exento: !!m.exento, medio: m.medio || '',
      creado: String(m.creado || ''), creadoPor: m.creadoPor || ''
    };
  }).sort(function (a, b) {
    if (a.fecha !== b.fecha) return a.fecha < b.fecha ? -1 : 1;
    return String(a.creado).localeCompare(String(b.creado));
  });

  var pendiente = alojamientoPendiente_(r, movs);
  return {
    idReserva: idReserva, huesped: r.huesped,
    noches: noches_(ymd_(r.checkIn), ymd_(r.checkOut)),
    exentoIva: !!r.exentoIva, docTurismo: String(r.docTurismo || ''),
    ivaPct: ivaPct_(),
    movimientos: lista,
    cargos: cargos, pagos: pagos, saldo: cargos - pagos,
    neto: neto, iva: iva, exentos: exentos,
    porCentro: porCentro,
    alojamientoAcordado: Math.round(Number(r.total) || 0),
    alojamientoPendiente: pendiente,
    // Lo que quedaría por cobrar si la estadía se completa tal como está.
    saldoProyectado: cargos - pagos + pendiente
  };
}

function noches_(desde, hasta) {
  if (!desde || !hasta) return 0;
  var n = Math.round((new Date(hasta + 'T12:00') - new Date(desde + 'T12:00')) / 86400000);
  return n > 0 ? n : 0;
}

/* Escribe un movimiento. Todo lo que entra a la cuenta pasa por acá. */
function anotar_(idReserva, mov, quien) {
  var fila = {
    id: uid_('M'), idReserva: idReserva, fecha: mov.fecha || hoy_(),
    clase: mov.clase, tipo: mov.tipo || '', centro: mov.centro || '',
    descripcion: mov.descripcion || '', cantidad: Number(mov.cantidad) || 1,
    unitario: Math.round(Number(mov.unitario) || 0),
    total: Math.round(Number(mov.total) || 0),
    exento: !!mov.exento, medio: mov.medio || '', anulado: false,
    creado: ahora_(), creadoPor: quien || ''
  };
  insertar_('Cuenta', fila);
  return fila.id;
}

function agregarCargo(token, idReserva, d) {
  var u = sesion_(token);
  var r = leer_('Reservas').filter(function (x) { return x.id === idReserva; })[0];
  if (!r) throw new Error('No se encontró la reserva.');

  var tipo = TIPOS_CARGO[d.tipo] ? d.tipo : 'otro';
  var cantidad = Math.max(Number(d.cantidad) || 1, 1);
  var unitario = Math.round(Number(d.unitario) || 0);
  if (unitario <= 0) throw new Error('El monto tiene que ser mayor que cero.');

  var id = anotar_(idReserva, {
    clase: 'cargo', tipo: tipo,
    centro: d.centro || TIPOS_CARGO[tipo].centro,
    descripcion: String(d.descripcion || TIPOS_CARGO[tipo].rotulo),
    cantidad: cantidad, unitario: unitario, total: unitario * cantidad,
    // Si el huésped está marcado como turista extranjero exento, sus cargos
    // salen exentos salvo que se diga lo contrario.
    exento: d.exento === undefined ? !!r.exentoIva : !!d.exento,
    fecha: ymd_(d.fecha) || hoy_()
  }, u.nombre);
  logCambio_(u.nombre, 'cargo', idReserva + ' · ' + tipo + ' · ' + (unitario * cantidad));
  return { id: id };
}

function agregarPago(token, idReserva, d) {
  var u = sesion_(token);
  var r = leer_('Reservas').filter(function (x) { return x.id === idReserva; })[0];
  if (!r) throw new Error('No se encontró la reserva.');
  var monto = Math.round(Number(d.monto) || 0);
  if (monto <= 0) throw new Error('El monto del pago tiene que ser mayor que cero.');
  var medio = MEDIOS_PAGO.indexOf(d.medio) > -1 ? d.medio : 'otro';

  var id = anotar_(idReserva, {
    clase: 'pago', tipo: 'pago', centro: '',
    descripcion: String(d.descripcion || 'Pago'),
    cantidad: 1, unitario: monto, total: monto, medio: medio,
    fecha: ymd_(d.fecha) || hoy_()
  }, u.nombre);
  sincronizarAnticipo_(idReserva);
  logCambio_(u.nombre, 'pago', idReserva + ' · ' + medio + ' · ' + monto);
  return { id: id };
}

function anularMovimiento(token, id, motivo) {
  var u = sesion_(token);
  var m = leer_('Cuenta').filter(function (x) { return x.id === id; })[0];
  if (!m) throw new Error('No se encontró el movimiento.');
  actualizar_('Cuenta', 'id', id, {
    anulado: true,
    descripcion: String(m.descripcion || '') + ' · ANULADO' + (motivo ? ': ' + motivo : '')
  });
  if (m.clase === 'pago') sincronizarAnticipo_(m.idReserva);
  logCambio_(u.nombre, 'movimiento_anulado', id + (motivo ? ' · ' + motivo : ''));
  return true;
}

/* El "anticipo" de la reserva es el espejo de lo pagado en la cuenta: así la
   pestaña Hoy y los informes siguen mostrando el saldo correcto sin tener
   dos verdades distintas sobre lo mismo. */
function sincronizarAnticipo_(idReserva) {
  var pagado = 0;
  movimientosDe_(idReserva).forEach(function (m) {
    if (m.clase === 'pago') pagado += Number(m.total) || 0;
  });
  actualizar_('Reservas', 'id', idReserva, { anticipo: pagado });
  return pagado;
}

/* Postea de una vez todas las noches que falten. Es lo que se usa al hacer
   el check-in cuando se quiere dejar la cuenta lista de entrada. */
function postearAlojamiento(token, idReserva) {
  var u = sesion_(token);
  var r = leer_('Reservas').filter(function (x) { return x.id === idReserva; })[0];
  if (!r) throw new Error('No se encontró la reserva.');
  var ci = ymd_(r.checkIn), co = ymd_(r.checkOut);
  var puestas = 0;
  for (var f = ci; f < co; f = sumarDias_(f, 1)) {
    if (postearNoche_(r, f, u.nombre)) puestas++;
  }
  return { noches: puestas };
}

function sumarDias_(ymd, n) {
  var d = new Date(ymd + 'T12:00');
  d.setDate(d.getDate() + n);
  return Utilities.formatDate(d, TZ, 'yyyy-MM-dd');
}

/* Postea UNA noche de alojamiento, si no estaba ya puesta. El monto sale del
   plan de noches: es exactamente lo que se acordó cobrar por ESA noche, con
   su promoción si la tiene. */
function postearNoche_(reserva, fecha, quien) {
  var ci = ymd_(reserva.checkIn), co = ymd_(reserva.checkOut);
  if (!(fecha >= ci && fecha < co)) return false;

  var yaEsta = movimientosDe_(reserva.id).some(function (m) {
    return m.clase === 'cargo' && m.tipo === 'alojamiento' && ymd_(m.fecha) === fecha;
  });
  if (yaEsta) return false;

  var noche = planDe_(reserva.id).filter(function (n) { return n.fecha === fecha; })[0];
  var monto = noche ? noche.valor : 0;
  if (monto <= 0) return false;

  anotar_(reserva.id, {
    clase: 'cargo', tipo: 'alojamiento', centro: 'lodge',
    descripcion: 'Noche del ' + fecha + (noche.nota ? ' · ' + noche.nota : ''),
    cantidad: 1, unitario: monto, total: monto,
    exento: !!reserva.exentoIva, fecha: fecha
  }, quien || 'cierre de día');
  return true;
}

/* La tinaja + sushi es un programa que reparte plata entre el lodge y la
   cocina, así que se anota como dos líneas: cada una a su centro. El
   porcentaje que va al restaurante se ajusta en la hoja Config. */
function cargarPrograma(token, idReserva, monto) {
  var u = sesion_(token);
  var r = leer_('Reservas').filter(function (x) { return x.id === idReserva; })[0];
  if (!r) throw new Error('No se encontró la reserva.');

  var t = Math.round(Number(monto) || 0);
  if (t <= 0) t = Math.round(Number(esAlta_(ymd_(r.checkIn))
    ? config_('addonAlta', 35000) : config_('addonBase', 30000)) || 0);

  var pct = Math.min(Math.max(Number(config_('addonParteRestaurante', 50)) || 0, 0), 100);
  var parteSushi = Math.round(t * pct / 100);
  var parteTinaja = t - parteSushi;
  var exento = !!r.exentoIva;
  var fecha = ymd_(r.addonFecha) || hoy_();

  if (parteTinaja > 0) {
    anotar_(idReserva, { clase: 'cargo', tipo: 'tinaja', centro: 'lodge',
      descripcion: 'Programa tinaja + sushi · parte tinaja', cantidad: 1,
      unitario: parteTinaja, total: parteTinaja, exento: exento, fecha: fecha }, u.nombre);
  }
  if (parteSushi > 0) {
    anotar_(idReserva, { clase: 'cargo', tipo: 'sushi', centro: 'restaurante',
      descripcion: 'Programa tinaja + sushi · parte sushi', cantidad: 1,
      unitario: parteSushi, total: parteSushi, exento: exento, fecha: fecha }, u.nombre);
  }
  logCambio_(u.nombre, 'programa_cargado', idReserva + ' · ' + t);
  return { total: t, tinaja: parteTinaja, sushi: parteSushi };
}

/* Marca de turista extranjero exento de IVA. Se acredita con el pasaporte y
   la tarjeta de turismo que entrega la PDI al entrar al país.

   La exención es una condición de la PERSONA, no de cada línea: si se marca
   a mitad de la estadía, los cargos que ya estaban anotados también quedan
   exentos. Si no, la cuenta saldría mitad con IVA y mitad sin, que es
   justamente lo que no se puede llevar a una boleta. */
function marcarExentoIva(token, idReserva, exento, docTurismo) {
  var u = sesion_(token);
  actualizar_('Reservas', 'id', idReserva, {
    exentoIva: !!exento, docTurismo: String(docTurismo || '')
  });
  movimientosDe_(idReserva).forEach(function (m) {
    if (m.clase !== 'cargo') return;
    if (!!m.exento === !!exento) return;
    actualizar_('Cuenta', 'id', m.id, { exento: !!exento });
  });
  logCambio_(u.nombre, 'iva_exento', idReserva + ' · ' + (exento ? 'sí' : 'no'));
  return true;
}

/* ===================== CIERRE DE DÍA =====================
   Lo que en un hotel grande se llama night audit. Cada noche postea el
   alojamiento de todos los que están adentro, deja constancia del día
   cerrado y avisa de lo que quedó pendiente. Se puede volver a ejecutar sin
   miedo: no postea dos veces la misma noche.

   A propósito NO cambia el estado de nadie: el check-in y el no-show los
   decide recepción a mano. El cierre solo avisa. */
function cierreDia(token, fecha) {
  var u = sesion_(token);
  var dia = ymd_(fecha) || hoy_();

  var lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    var reservas = leer_('Reservas').filter(function (r) {
      return r.estado !== 'cancelada' && r.estado !== 'no_show';
    });

    var puestas = 0, alojamiento = 0;
    reservas.forEach(function (r) {
      if (postearNoche_(r, dia, u.nombre)) {
        puestas++;
        var n = noches_(ymd_(r.checkIn), ymd_(r.checkOut)) || 1;
        alojamiento += Math.round((Number(r.total) || 0) / n);
      }
    });

    var resumen = resumenDia_(dia, reservas);
    var cuando = ahora_();
    guardarOCrear_('Cierres', 'fecha', dia, {
      fecha: dia, ejecutado: cuando, por: u.nombre,
      noches: puestas, alojamiento: resumen.alojamiento,
      consumos: resumen.consumos, pagos: resumen.pagos,
      avisos: resumen.avisos.length
    });
    logCambio_(u.nombre, 'cierre_dia', dia + ' · ' + puestas + ' noches');

    resumen.fecha = dia;
    resumen.nochesPosteadas = puestas;
    resumen.cerrado = true;
    resumen.cerradoEl = cuando;
    resumen.cerradoPor = u.nombre;
    return resumen;
  } finally {
    lock.releaseLock();
  }
}

/* Lo que pasó ese día, mirado desde la cuenta: sirve para el cierre y para
   revisar un día cualquiera sin cerrarlo. */
function resumenDia_(dia, reservas) {
  reservas = reservas || leer_('Reservas').filter(function (r) {
    return r.estado !== 'cancelada' && r.estado !== 'no_show';
  });
  var porId = {};
  reservas.forEach(function (r) { porId[r.id] = r; });

  var alojamiento = 0, consumos = 0, pagos = 0;
  var porCentro = { lodge: 0, restaurante: 0 };
  var neto = 0, iva = 0;

  leer_('Cuenta').forEach(function (m) {
    if (m.anulado || ymd_(m.fecha) !== dia) return;
    var total = Math.round(Number(m.total) || 0);
    if (m.clase === 'pago') { pagos += total; return; }
    if (m.tipo === 'alojamiento') alojamiento += total; else consumos += total;
    var c = m.centro || 'lodge';
    porCentro[c] = (porCentro[c] || 0) + total;
    var d = desglosarIva_(total, m.exento);
    neto += d.neto; iva += d.iva;
  });

  // Lo cobrado en el día no tiene por qué calzar con lo consumido en el día:
  // si alguien paga la estadía completa al llegar, parte de esa plata es un
  // anticipo de noches que todavía no llegan. Se calcula para poder decirlo
  // en pantalla y que el cierre no parezca descuadrado.
  var anticipos = 0, porCobrar = 0;
  reservas.forEach(function (r) {
    var ci = ymd_(r.checkIn), co = ymd_(r.checkOut);
    if (!ci || !co || ci > dia || co <= dia) return;   // no está adentro esa noche
    var cargado = 0, pagado = 0;
    movimientosDe_(r.id).forEach(function (m) {
      if (ymd_(m.fecha) > dia) return;                 // aún no ocurre
      var t = Math.round(Number(m.total) || 0);
      if (m.clase === 'pago') pagado += t; else cargado += t;
    });
    if (pagado > cargado) anticipos += pagado - cargado;
    else porCobrar += cargado - pagado;
  });

  // Lo que conviene mirar antes de irse a dormir.
  var avisos = [];
  var firmadas = firmadas_();
  var aseo = aseoMapa_();

  reservas.forEach(function (r) {
    var ci = ymd_(r.checkIn), co = ymd_(r.checkOut);
    if (ci === dia && r.estado !== 'en_casa' && r.estado !== 'checkout') {
      avisos.push({ tipo: 'sin_llegar', idReserva: r.id, huesped: r.huesped,
        texto: 'Llegaba hoy y no se registró: revisar si es no-show.' });
    }
    if (co === dia && r.estado !== 'checkout') {
      avisos.push({ tipo: 'sin_salir', idReserva: r.id, huesped: r.huesped,
        texto: 'Salía hoy y no se marcó el check-out.' });
    }
    if (ci <= dia && co > dia && !firmadas[r.id]) {
      avisos.push({ tipo: 'sin_firma', idReserva: r.id, huesped: r.huesped,
        texto: 'Está alojado y no ha firmado la ficha de registro.' });
    }
    // El registro de huéspedes tiene que nombrar a todos los que duermen. La
    // ficha los pide pero no obliga, así que acá se avisa de los que faltan.
    if (ci <= dia && co > dia) {
      var esperados = Math.max((Number(r.pax) || 1) - 1, 0);
      var anotados = acompanantesDe_(r.id).length;
      if (esperados > anotados) {
        avisos.push({ tipo: 'sin_acompanantes', idReserva: r.id, huesped: r.huesped,
          texto: 'Faltan ' + (esperados - anotados) + ' de ' + esperados +
                 ' acompañante(s) por registrar.' });
      }
    }
    if (co === dia) {
      var movs = movimientosDe_(r.id);
      var c = 0, p = 0;
      movs.forEach(function (m) {
        if (m.clase === 'pago') p += Number(m.total) || 0; else c += Number(m.total) || 0;
      });
      var saldo = c - p + alojamientoPendiente_(r, movs);
      if (saldo > 0) {
        avisos.push({ tipo: 'saldo', idReserva: r.id, huesped: r.huesped, monto: saldo,
          texto: 'Se fue hoy con saldo pendiente.' });
      }
    }
  });
  Object.keys(aseo).forEach(function (k) {
    if (aseo[k] === 'sucia') {
      avisos.push({ tipo: 'sucia', idUnidad: k, texto: 'Quedó marcada como sucia.' });
    }
  });

  var cerrado = leer_('Cierres').filter(function (c) { return ymd_(c.fecha) === dia; })[0];
  return {
    fecha: dia,
    alojamiento: alojamiento, consumos: consumos, pagos: pagos,
    total: alojamiento + consumos,
    // De lo que hay cobrado a los que están adentro esta noche, cuánto es
    // adelanto de noches futuras y cuánto queda todavía por cobrar.
    anticipos: anticipos, porCobrar: porCobrar,
    porCentro: porCentro, neto: neto, iva: iva,
    avisos: avisos,
    cerrado: !!cerrado,
    cerradoEl: cerrado ? String(cerrado.ejecutado) : '',
    cerradoPor: cerrado ? String(cerrado.por) : ''
  };
}

function panelCierre(token, fecha) {
  sesion_(token);
  return resumenDia_(ymd_(fecha) || hoy_());
}

/* Para dejarlo automático: en el editor, Activadores → nuevo activador →
   cierreAutomatico, temporizador diario, entre 3 y 4 de la mañana. */
function cierreAutomatico() {
  var dia = sumarDias_(hoy_(), -1);          // la noche que acaba de terminar
  var reservas = leer_('Reservas').filter(function (r) {
    return r.estado !== 'cancelada' && r.estado !== 'no_show';
  });
  var puestas = 0;
  reservas.forEach(function (r) { if (postearNoche_(r, dia, 'cierre automático')) puestas++; });
  var resumen = resumenDia_(dia, reservas);
  guardarOCrear_('Cierres', 'fecha', dia, {
    fecha: dia, ejecutado: ahora_(), por: 'automático',
    noches: puestas, alojamiento: resumen.alojamiento, consumos: resumen.consumos,
    pagos: resumen.pagos, avisos: resumen.avisos.length
  });
  // Y si hay un correo configurado, el resumen de la noche sale solo.
  var para = String(config_('correoDueno', '') || '').trim();
  if (para) {
    try { enviarCierre_(dia, para); }
    catch (e) { logCambio_('automático', 'cierre_envio_falló', String(e.message || e)); }
  }
  return puestas;
}

/* ===================== DOCUMENTOS EN PDF =====================
   Apps Script no tiene una librería de PDF: lo que sí sabe hacer es convertir
   un HTML en PDF. Así que los documentos se arman como página y se convierten.
   Quedan guardados en una carpeta de Drive y se comparten por enlace, que es
   lo que después se pega en un WhatsApp o en un correo. */

/* Los documentos se guardan ordenados por fecha, no todos revueltos en una
   carpeta que a los dos años tiene mil archivos:

     Casona Peumayén — Documentos / 2026 / 08 agosto / Comprobantes
                                                     / Cierres
     Casona Peumayén — Fichas     / 2026 / 08 agosto

   La fecha es la del documento, no la del día que se generó: el comprobante
   se archiva por la llegada del huésped y el cierre por la noche que cierra,
   que es como uno los busca después.

   Buscar y crear carpetas en Drive cuesta una llamada cada vez, así que
   dentro de una misma ejecución se recuerdan. */
var MESES_ = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
              'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function subcarpeta_(padre, nombre) {
  var clave = '__dir_' + (padre ? padre.getId() : 'raiz') + '/' + nombre;
  if (MEMO[clave]) return MEMO[clave];
  var it = padre ? padre.getFoldersByName(nombre) : DriveApp.getFoldersByName(nombre);
  var f = it.hasNext() ? it.next()
                       : (padre ? padre.createFolder(nombre) : DriveApp.createFolder(nombre));
  MEMO[clave] = f;
  return f;
}

function carpetaFecha_(raiz, fecha, sub) {
  var d = ymd_(fecha) || hoy_();
  var anio = d.slice(0, 4);
  var mes = d.slice(5, 7) + ' ' + (MESES_[Number(d.slice(5, 7)) - 1] || '');
  var f = subcarpeta_(null, raiz);
  f = subcarpeta_(f, anio);
  f = subcarpeta_(f, mes.trim());
  return sub ? subcarpeta_(f, sub) : f;
}

function carpetaDocs_(fecha, sub) {
  return carpetaFecha_('Casona Peumayén — Documentos', fecha, sub);
}

/* Convierte el HTML en PDF y lo deja en Drive. La conversión de Google a
   veces se atraganta con el logo incrustado, así que si falla se reintenta
   sin él; y si igual no se puede, se guarda el documento como página web
   para no dejar a nadie sin su comprobante. El motivo del fallo se devuelve,
   en vez de quedar en silencio. */
function pdfDesdeHtml_(html, nombreArchivo, publico, fecha, sub) {
  var carpeta = carpetaDocs_(fecha, sub);
  var archivo = null, tipo = 'pdf', aviso = '';

  try {
    archivo = carpeta.createFile(
      Utilities.newBlob(html, 'text/html', nombreArchivo + '.html')
        .getAs('application/pdf').setName(nombreArchivo + '.pdf'));
  } catch (e1) {
    aviso = String(e1.message || e1);
    try {
      // Segundo intento sin la imagen: es lo que más pesa del documento.
      var sinLogo = html.replace(/<img class="logo"[^>]*>/, '<h1>Casona Peumayén</h1>');
      archivo = carpeta.createFile(
        Utilities.newBlob(sinLogo, 'text/html', nombreArchivo + '.html')
          .getAs('application/pdf').setName(nombreArchivo + '.pdf'));
      aviso = 'El PDF se generó sin el logo: la conversión de Google no lo aceptó (' + aviso + ').';
    } catch (e2) {
      // Último recurso: queda como página web, que se abre y se imprime igual.
      archivo = carpeta.createFile(
        Utilities.newBlob(html, 'text/html', nombreArchivo + '.html'));
      tipo = 'html';
      aviso = 'No se pudo convertir a PDF (' + String(e2.message || e2) +
        '). Quedó como página web: se abre en el navegador y desde ahí se ' +
        'puede imprimir o guardar como PDF.';
    }
  }

  if (publico) {
    // El enlace es largo y no se adivina; se comparte solo con quien lo recibe.
    try { archivo.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); }
    catch (e) { /* si el dominio no lo permite, queda privado */ }
  }
  return { url: archivo.getUrl(), id: archivo.getId(), nombre: archivo.getName(),
           tipo: tipo, aviso: aviso };
}

/* Prueba corta para saber si este proyecto puede generar PDFs, con el error
   textual si no puede. Se llama desde Configuración. */
function probarDocumentos(token) {
  var u = sesion_(token);
  exigirAdmin_(u);
  var pasos = [];
  var anotar = function (paso, ok, detalle) { pasos.push({ paso: paso, ok: ok, detalle: detalle || '' }); };

  try { carpetaDocs_(hoy_(), 'Comprobantes');
        anotar('Acceso a Drive', true, 'La carpeta del mes está disponible.'); }
  catch (e) {
    anotar('Acceso a Drive', false, String(e.message || e));
    return { ok: false, pasos: pasos,
      mensaje: 'Google todavía no dio permiso para usar Drive. Genera un documento una vez ' +
        'y acepta el permiso que pide, o ejecuta setup() desde el editor.' };
  }

  try {
    Utilities.newBlob('<html><body><p>prueba</p></body></html>', 'text/html', 'prueba.html')
      .getAs('application/pdf');
    anotar('Convertir a PDF', true, 'La conversión funciona.');
  } catch (e) {
    anotar('Convertir a PDF', false, String(e.message || e));
    return { ok: false, pasos: pasos,
      mensaje: 'Este proyecto no puede convertir a PDF. Los documentos se van a guardar ' +
        'como página web, que se abre en el navegador y se imprime o se guarda como PDF ' +
        'desde ahí. Error exacto: ' + String(e.message || e) };
  }

  try {
    Utilities.newBlob(hojaHtml_('Prueba', '<p>prueba</p>'), 'text/html', 'prueba.html')
      .getAs('application/pdf');
    anotar('Convertir con el logo', true, 'El logo no da problemas.');
  } catch (e) {
    anotar('Convertir con el logo', false, String(e.message || e));
    return { ok: false, pasos: pasos,
      mensaje: 'La conversión funciona, pero se cae con el logo incrustado. Los documentos ' +
        'se van a generar sin logo. Error exacto: ' + String(e.message || e) };
  }

  try { MailApp.getRemainingDailyQuota(); anotar('Enviar correo', true, 'Se puede enviar correo.'); }
  catch (e) { anotar('Enviar correo', false, String(e.message || e)); }

  return { ok: true, pasos: pasos, mensaje: 'Todo listo: los documentos se generan en PDF.' };
}

function plata_(n) {
  var s = String(Math.round(Number(n) || 0));
  return '$' + s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function escapar_(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* El marco común de los dos documentos: el logo arriba y una hoja sobria. */
function hojaHtml_(titulo, cuerpo) {
  return '<!DOCTYPE html><html><head><meta charset="utf-8"><style>' +
    'body{font:13px/1.5 Helvetica,Arial,sans-serif;color:#16191d;margin:34px}' +
    'img.logo{height:52px;display:block;margin-bottom:18px}' +
    'h1{font-size:19px;margin:0 0 4px}' +
    '.sub{color:#6b7280;font-size:12px;margin-bottom:20px}' +
    'h2{font-size:12px;text-transform:uppercase;letter-spacing:.05em;color:#6b7280;' +
    'margin:22px 0 8px;border-bottom:1px solid #e4e6ea;padding-bottom:5px}' +
    'table{width:100%;border-collapse:collapse;font-size:13px}' +
    'td,th{padding:6px 4px;border-bottom:1px solid #eef0f3;text-align:left}' +
    'th{color:#6b7280;font-weight:500;font-size:11px;text-transform:uppercase}' +
    'td.n,th.n{text-align:right;white-space:nowrap}' +
    '.tot td{border-top:2px solid #16191d;border-bottom:none;font-weight:bold;font-size:14px}' +
    '.pie{margin-top:26px;color:#9aa1ab;font-size:11px;border-top:1px solid #e4e6ea;padding-top:10px}' +
    '.reglas li{margin-bottom:5px;font-size:11.5px;color:#4b5563}' +
    '</style></head><body>' +
    (typeof LOGO === 'string' && LOGO.indexOf('data:image/') === 0
      ? '<img class="logo" src="' + LOGO + '">' : '<h1>Casona Peumayén</h1>') +
    cuerpo +
    '<div class="pie">Casona Peumayén · Lodge, restaurante, sushi &amp; wok<br>' +
    'Documento generado el ' + ahora_() + '</div>' +
    '</body></html>';
}

/* ---------- Comprobante de la reserva, para mandarle al huésped ---------- */

/* Devuelve el documento como página, sin pasar por Drive. Sirve para abrirlo
   en el navegador e imprimirlo o guardarlo como PDF desde ahí: es el camino
   que funciona siempre, sin permisos ni conversiones. */
function comprobanteHtml(token, idReserva) {
  sesion_(token);
  return armarComprobante_(idReserva).html;
}

function cierreHtml(token, fecha) {
  sesion_(token);
  return armarCierre_(ymd_(fecha) || hoy_());
}

function comprobante(token, idReserva) {
  var u = sesion_(token);
  var d = armarComprobante_(idReserva);
  var doc = pdfDesdeHtml_(d.html, 'Reserva ' + d.huesped + ' ' + d.checkIn, true,
                          d.checkIn, 'Comprobantes');
  logCambio_(u.nombre, 'comprobante', idReserva);
  return {
    url: doc.url, tipo: doc.tipo, aviso: doc.aviso,
    texto: d.texto.replace('{url}', doc.url),
    whatsapp: 'https://wa.me/' + d.telefono +
              '?text=' + encodeURIComponent(d.texto.replace('{url}', doc.url)),
    correo: d.correo
  };
}

function armarComprobante_(idReserva) {
  var r = leer_('Reservas').filter(function (x) { return x.id === idReserva; })[0];
  if (!r) throw new Error('No se encontró la reserva.');

  var rec = recursos_().filter(function (x) { return x.id === r.recurso; })[0];
  var plan = planDe_(idReserva);
  var entrada = hora_(config_('checkIn'), '15:00');
  var salida = hora_(config_('checkOut'), '11:00');
  var reglas = reglamento().es;
  var pagado = 0;
  movimientosDe_(idReserva).forEach(function (m) {
    if (m.clase === 'pago') pagado += Number(m.total) || 0;
  });
  var total = Math.round(Number(r.total) || 0);

  var filas = plan.map(function (n) {
    return '<tr><td>' + escapar_(n.fecha) + (n.nota ? ' · ' + escapar_(n.nota) : '') +
           '</td><td class="n">' + plata_(n.valor) + '</td></tr>';
  }).join('');

  var acompanantes = acompanantesDe_(idReserva);
  var cuerpo =
    '<h1>Confirmación de reserva</h1>' +
    '<div class="sub">' + escapar_(r.huesped) + ' · reserva ' + escapar_(r.id) + '</div>' +
    '<h2>Tu estadía</h2>' +
    '<table>' +
    '<tr><td>Alojamiento</td><td class="n">' +
      escapar_(rec ? rec.unidad + (rec.nombre ? ' — ' + rec.nombre : '') : r.recurso) + '</td></tr>' +
    '<tr><td>Llegada</td><td class="n">' + ymd_(r.checkIn) + ' desde las ' + entrada + '</td></tr>' +
    '<tr><td>Salida</td><td class="n">' + ymd_(r.checkOut) + ' hasta las ' + salida + '</td></tr>' +
    '<tr><td>Noches</td><td class="n">' + plan.length + '</td></tr>' +
    '<tr><td>Personas</td><td class="n">' + (Number(r.pax) || 1) + '</td></tr>' +
    (r.addon ? '<tr><td>Programa tinaja + tabla de sushi</td><td class="n">incluido</td></tr>' : '') +
    '</table>' +
    (acompanantes.length
      ? '<h2>Quiénes se alojan</h2><table><tr><td>' + escapar_(r.huesped) +
        ' <span style="color:#6b7280">(titular)</span></td></tr>' +
        acompanantes.map(function (a) { return '<tr><td>' + escapar_(a.nombre) + '</td></tr>'; }).join('') +
        '</table>'
      : '') +
    '<h2>Valor</h2>' +
    '<table><tr><th>Noche</th><th class="n">Valor</th></tr>' + filas +
    '<tr class="tot"><td>Total</td><td class="n">' + plata_(total) + '</td></tr>' +
    (pagado ? '<tr><td>Abonado</td><td class="n">' + plata_(pagado) + '</td></tr>' +
              '<tr><td><b>Saldo al llegar</b></td><td class="n"><b>' +
              plata_(total - pagado) + '</b></td></tr>' : '') +
    '</table>' +
    '<h2>Condiciones de la estadía</h2><ul class="reglas">' +
    reglas.map(function (x) { return '<li>' + escapar_(x) + '</li>'; }).join('') +
    '</ul>';

  return {
    html: hojaHtml_('Confirmación', cuerpo),
    huesped: r.huesped, checkIn: ymd_(r.checkIn), checkOut: ymd_(r.checkOut),
    telefono: String(r.telefono || '').replace(/[^\d]/g, ''),
    correo: String(r.email || ''),
    texto: 'Hola ' + r.huesped + ', te confirmamos tu reserva en Casona Peumayén del ' +
      ymd_(r.checkIn) + ' al ' + ymd_(r.checkOut) + '. Acá va el comprobante: {url}'
  };
}

function enviarComprobante(token, idReserva, correo) {
  var u = sesion_(token);
  var r = leer_('Reservas').filter(function (x) { return x.id === idReserva; })[0];
  if (!r) throw new Error('No se encontró la reserva.');
  var para = String(correo || r.email || '').trim();
  if (!para) throw new Error('Esa reserva no tiene correo. Escríbelo en la reserva o pásalo por WhatsApp.');

  var d = armarComprobante_(idReserva);
  var doc = pdfDesdeHtml_(d.html, 'Reserva ' + d.huesped + ' ' + d.checkIn, true,
                          d.checkIn, 'Comprobantes');
  MailApp.sendEmail({
    to: para,
    subject: 'Casona Peumayén · confirmación de tu reserva',
    body: d.texto.replace('{url}', doc.url),
    htmlBody: 'Hola ' + escapar_(r.huesped) + ',<br><br>Te confirmamos tu reserva del ' +
      ymd_(r.checkIn) + ' al ' + ymd_(r.checkOut) + '.<br>' +
      'Adjuntamos el comprobante, y también lo puedes ver acá: ' +
      '<a href="' + doc.url + '">' + doc.url + '</a><br><br>Te esperamos.',
    // Si la conversión falló, el adjunto va como página web: es preferible
    // eso a que el huésped no reciba nada.
    attachments: [DriveApp.getFileById(doc.id).getBlob()]
  });
  logCambio_(u.nombre, 'comprobante_enviado', idReserva + ' → ' + para);
  return { enviado: para, url: doc.url, tipo: doc.tipo, aviso: doc.aviso };
}

/* ---------- Resumen de la noche, para el dueño ---------- */
function pdfCierre(token, fecha) {
  sesion_(token);
  return pdfCierre_(ymd_(fecha) || hoy_());
}

function pdfCierre_(dia) {
  return pdfDesdeHtml_(armarCierre_(dia), 'Cierre ' + dia, false, dia, 'Cierres');
}

function armarCierre_(dia) {
  var d = resumenDia_(dia);
  var rotulo = {
    sin_llegar: 'No se registró la llegada', sin_salir: 'No se marcó el check-out',
    sin_firma: 'Ficha sin firmar', sin_acompanantes: 'Faltan acompañantes por registrar',
    saldo: 'Se fue con saldo pendiente', sucia: 'Habitación sucia'
  };
  var cuerpo =
    '<h1>Cierre de la noche del ' + dia + '</h1>' +
    '<div class="sub">' + (d.cerrado ? 'Cerrado por ' + escapar_(d.cerradoPor) + ' el ' +
      escapar_(d.cerradoEl) : 'Todavía sin cerrar') + '</div>' +
    '<h2>Ingresos de la noche</h2>' +
    '<table>' +
    '<tr><td>Alojamiento</td><td class="n">' + plata_(d.alojamiento) + '</td></tr>' +
    '<tr><td>Consumos</td><td class="n">' + plata_(d.consumos) + '</td></tr>' +
    '<tr class="tot"><td>Total consumido</td><td class="n">' + plata_(d.total) + '</td></tr>' +
    '<tr><td>Neto</td><td class="n">' + plata_(d.neto) + '</td></tr>' +
    '<tr><td>IVA</td><td class="n">' + plata_(d.iva) + '</td></tr>' +
    '</table>' +
    '<h2>Por centro de ingreso</h2>' +
    '<table>' +
    '<tr><td>Lodge</td><td class="n">' + plata_((d.porCentro || {}).lodge || 0) + '</td></tr>' +
    '<tr><td>Restaurante</td><td class="n">' + plata_((d.porCentro || {}).restaurante || 0) + '</td></tr>' +
    '</table>' +
    '<h2>Caja</h2>' +
    '<table>' +
    '<tr><td>Cobrado hoy</td><td class="n">' + plata_(d.pagos) + '</td></tr>' +
    '<tr><td>De eso, adelanto de noches futuras</td><td class="n">' + plata_(d.anticipos) + '</td></tr>' +
    '<tr><td>Por cobrar a los que están adentro</td><td class="n">' + plata_(d.porCobrar) + '</td></tr>' +
    '</table>' +
    '<h2>Pendientes de la noche</h2>' +
    (d.avisos.length
      ? '<table><tr><th>Qué revisar</th><th>Quién</th></tr>' +
        d.avisos.map(function (a) {
          return '<tr><td>' + escapar_(rotulo[a.tipo] || a.tipo) + '</td><td>' +
            escapar_(a.huesped || a.idUnidad || '') +
            (a.monto ? ' · ' + plata_(a.monto) : '') + '</td></tr>';
        }).join('') + '</table>'
      : '<p style="color:#0e8a5f">Todo en orden: nada pendiente de esta noche.</p>');

  return hojaHtml_('Cierre ' + dia, cuerpo);
}

function enviarCierre(token, fecha, correo) {
  var u = sesion_(token);
  var dia = ymd_(fecha) || hoy_();
  var para = String(correo || config_('correoDueno', '') || '').trim();
  if (!para) {
    throw new Error('Falta el correo del dueño. Ponlo en Configuración, en ' +
      '"Correo para el cierre de cada noche".');
  }
  var r = enviarCierre_(dia, para);
  logCambio_(u.nombre, 'cierre_enviado', dia + ' → ' + para);
  return r;
}

function enviarCierre_(dia, para) {
  var d = resumenDia_(dia);
  var doc = pdfCierre_(dia);
  MailApp.sendEmail({
    to: para,
    subject: 'Casona Peumayén · cierre de la noche del ' + dia,
    body: 'Alojamiento ' + plata_(d.alojamiento) + ', consumos ' + plata_(d.consumos) +
      ', cobrado ' + plata_(d.pagos) + '. ' + d.avisos.length + ' punto(s) por revisar.',
    htmlBody: '<p>Resumen de la noche del <b>' + dia + '</b>:</p><ul>' +
      '<li>Alojamiento: ' + plata_(d.alojamiento) + '</li>' +
      '<li>Consumos: ' + plata_(d.consumos) + '</li>' +
      '<li>Cobrado en el día: ' + plata_(d.pagos) + '</li>' +
      '<li>Lodge ' + plata_((d.porCentro || {}).lodge || 0) +
      ' · restaurante ' + plata_((d.porCentro || {}).restaurante || 0) + '</li>' +
      '<li>' + d.avisos.length + ' punto(s) por revisar</li></ul>' +
      '<p>El detalle va adjunto.</p>',
    attachments: [DriveApp.getFileById(doc.id).getBlob()]
  });
  return { enviado: para, url: doc.url, avisos: d.avisos.length,
           tipo: doc.tipo, aviso: doc.aviso };
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
  // Agrupado por recurso una sola vez: si no, cada habitación recorría la
  // lista completa de reservas, y esta pantalla se refresca sola cada minuto.
  var porRecurso = agrupar_('Reservas', 'recurso');
  var porUnidad = agrupar_('Aseo', 'idUnidad');

  return recursos_().map(function (rec) {
    var e = (porUnidad[rec.id] || [])[0];
    var suyas = (porRecurso[rec.id] || []).filter(function (r) {
      return r.estado !== 'cancelada';
    });

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
  // La firma se archiva por el día en que se firmó, que es la fecha que pide
  // el registro de huéspedes.
  var carpeta = carpetaFecha_('Casona Peumayén — Fichas', hoy_(), '');
  var archivo = carpeta.createFile(Utilities.newBlob(
    Utilities.base64Decode(m[2]), m[1], 'firma_' + idReserva + '.png'));

  insertar_('Fichas', {
    id: uid_('F'), idReserva: idReserva, nombre: d.nombre || '', documento: d.documento || '',
    nacionalidad: d.nacionalidad || '', nacimiento: d.nacimiento || '',
    procedencia: d.procedencia || '', destino: d.destino || '', motivo: d.motivo || '',
    emergencia: d.emergencia || '', firmaUrl: archivo.getUrl(), fecha: ahora_()
  });
  // Los acompañantes van con la ficha: firma uno solo, pero el registro de
  // huéspedes tiene que nombrar a todos los que van a pernoctar.
  guardarAcompanantes_(idReserva, d.acompanantes || []);
  // Si firma antes de llegar, la reserva sigue "confirmada": solo pasa a
  // "en casa" cuando el registro se hace el día de la llegada o después.
  // El check-in lo hace siempre recepción a mano, así que firmar la ficha
  // nunca cambia el estado de la reserva por su cuenta.
  return true;
}

function fichaDe(token, idReserva) {
  sesion_(token);
  var f = leer_('Fichas').filter(function (x) { return x.idReserva === idReserva; })[0];
  if (!f) return { acompanantes: acompanantesDe_(idReserva) };
  return {
    nombre: f.nombre || '', documento: f.documento || '', nacionalidad: f.nacionalidad || '',
    nacimiento: String(f.nacimiento || ''), procedencia: f.procedencia || '',
    destino: f.destino || '', motivo: f.motivo || '', emergencia: f.emergencia || '',
    firmaUrl: f.firmaUrl || '', fecha: String(f.fecha || ''),
    acompanantes: acompanantesDe_(idReserva)
  };
}

/* ===================== ACOMPAÑANTES =====================
   La ficha la firma una sola persona, la que hace la reserva. Pero el
   registro de huéspedes tiene que decir quiénes más durmieron, así que la
   reserva guarda los nombres de los acompañantes. El único dato obligatorio
   es el nombre; el resto se pide por si se necesita, no para trabar. */

function acompanantesDe_(idReserva) {
  return (agrupar_('Acompanantes', 'idReserva')[String(idReserva)] || [])
    .map(function (a) {
      return {
        id: a.id, nombre: String(a.nombre || ''), documento: String(a.documento || ''),
        nacionalidad: String(a.nacionalidad || ''), nacimiento: String(a.nacimiento || ''),
        notas: String(a.notas || '')
      };
    });
}

function acompanantesDe(token, idReserva) {
  sesion_(token);
  var r = leer_('Reservas').filter(function (x) { return x.id === idReserva; })[0];
  if (!r) throw new Error('No se encontró la reserva.');
  return {
    idReserva: idReserva, huesped: r.huesped, pax: Number(r.pax) || 1,
    // El titular cuenta como una de las personas de la reserva.
    faltan: Math.max((Number(r.pax) || 1) - 1 - acompanantesDe_(idReserva).length, 0),
    lista: acompanantesDe_(idReserva)
  };
}

/* Reemplaza la lista completa: es más simple de entender que ir agregando y
   borrando de a uno, y evita quedar con gente repetida. */
function guardarAcompanantes_(idReserva, lista) {
  var limpia = (lista || [])
    .filter(function (a) { return String((a && a.nombre) || '').trim() !== ''; })
    .map(function (a) {
      return {
        id: uid_('A'), idReserva: idReserva,
        nombre: String(a.nombre || '').trim(),
        documento: String(a.documento || '').trim(),
        nacionalidad: String(a.nacionalidad || '').trim(),
        nacimiento: String(a.nacimiento || '').trim(),
        notas: String(a.notas || '').trim(),
        creado: ahora_()
      };
    });
  borrar_('Acompanantes', 'idReserva', idReserva);
  if (limpia.length) insertarVarias_('Acompanantes', limpia);
  return limpia.length;
}

function guardarAcompanantes(token, idReserva, lista) {
  var u = sesion_(token);
  var r = leer_('Reservas').filter(function (x) { return x.id === idReserva; })[0];
  if (!r) throw new Error('No se encontró la reserva.');
  var tope = Math.max((Number(r.pax) || 1) - 1, 0);
  if ((lista || []).length > tope) {
    throw new Error('La reserva es para ' + (Number(r.pax) || 1) + ' persona(s): ' +
      'caben ' + tope + ' acompañante(s) además del titular. ' +
      'Sube el número de personas de la reserva si van más.');
  }
  var n = guardarAcompanantes_(idReserva, lista);
  logCambio_(u.nombre, 'acompanantes', idReserva + ' · ' + n);
  return { guardados: n };
}

/* ===================== REGLAMENTO =====================
   Fuente única de las normas: las usan la ficha de recepción y la página
   que firma el huésped, así nunca se desincronizan. Para cambiar una regla
   se edita solo acá. */
/* Las normas son texto libre: se escriben tal cual, una por línea, desde la
   pestaña Configuración. Si nadie las ha tocado, valen las de siempre. */
function reglamento() {
  var base = reglamentoPorDefecto_(hora_(config_('checkIn'), '15:00'),
                                   hora_(config_('checkOut'), '11:00'));
  var es = reglasGuardadas_('reglasEs');
  var en = reglasGuardadas_('reglasEn');
  return { es: es.length ? es : base.es, en: en.length ? en : base.en };
}

function reglasGuardadas_(clave) {
  return String(config_(clave, '') || '')
    .split('\n')
    .map(function (r) { return r.trim(); })
    .filter(function (r) { return r !== ''; });
}

function reglamentoPorDefecto_(entrada, salida) {
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

/* ===================== CONFIGURACIÓN =====================
   Lo que cambia con el tiempo se edita desde la app y no desde el código:
   horarios, normas, temporada, precios del programa y el correo del dueño. */

/* Lo que se edita a diario son las normas, y son un texto y nada más: se
   escriben tal como se van a leer. El resto casi nunca se toca, así que va
   guardado detrás de "ajustes que casi nunca se tocan". */
var CONFIG_EDITABLE = [
  { clave: 'reglasEs', rotulo: 'Normas de convivencia', tipo: 'texto_largo', grupo: 'normas' },
  { clave: 'reglasEn', rotulo: 'House rules (las mismas, en inglés)', tipo: 'texto_largo', grupo: 'normas' },
  { clave: 'correoDueno', rotulo: 'Correo para el cierre de cada noche', tipo: 'texto', grupo: 'avanzado' },
  { clave: 'checkIn', rotulo: 'Hora de check-in', tipo: 'hora', grupo: 'avanzado' },
  { clave: 'checkOut', rotulo: 'Hora de check-out', tipo: 'hora', grupo: 'avanzado' },
  { clave: 'temporadaAltaInicio', rotulo: 'Temporada alta desde (MM-DD)', tipo: 'texto', grupo: 'avanzado' },
  { clave: 'temporadaAltaFin', rotulo: 'Temporada alta hasta (MM-DD)', tipo: 'texto', grupo: 'avanzado' },
  { clave: 'addonBase', rotulo: 'Programa tinaja + sushi (baja)', tipo: 'numero', grupo: 'avanzado' },
  { clave: 'addonAlta', rotulo: 'Programa tinaja + sushi (alta)', tipo: 'numero', grupo: 'avanzado' },
  { clave: 'addonParteRestaurante', rotulo: '% del programa que va al restaurante', tipo: 'numero', grupo: 'avanzado' },
  { clave: 'iva', rotulo: 'IVA (%)', tipo: 'numero', grupo: 'avanzado' }
];

function configuracion(token) {
  var u = sesion_(token);
  exigirAdmin_(u);
  var actual = configTodo_();
  var base = reglamentoPorDefecto_(hora_(config_('checkIn'), '15:00'),
                                   hora_(config_('checkOut'), '11:00'));
  var porDefecto = { reglasEs: base.es.join('\n'), reglasEn: base.en.join('\n') };

  return {
    campos: CONFIG_EDITABLE.map(function (c) {
      var v = actual[c.clave];
      if (c.tipo === 'hora') v = hora_(v, '');
      var valor = (v === undefined || v === null) ? '' : String(v);
      // El cuadro de las normas nunca sale vacío: si nadie las ha escrito,
      // trae las que están rigiendo hoy, para editarlas encima.
      if (!valor && porDefecto[c.clave]) valor = porDefecto[c.clave];
      return { clave: c.clave, rotulo: c.rotulo, tipo: c.tipo,
               grupo: c.grupo, valor: valor };
    }),
    reglasPorDefecto: porDefecto,
    vistaPrevia: reglamento()
  };
}

function guardarConfiguracion(token, cambios) {
  var u = sesion_(token);
  exigirAdmin_(u);
  var validas = {};
  CONFIG_EDITABLE.forEach(function (c) { validas[c.clave] = c; });

  Object.keys(cambios || {}).forEach(function (k) {
    if (!validas[k]) return;                       // nada fuera de la lista
    var v = cambios[k];
    if (validas[k].tipo === 'hora') {
      v = hora_(v, '');
      if (!v) throw new Error('La hora de "' + validas[k].rotulo + '" tiene que ser como 15:00.');
    }
    if (validas[k].tipo === 'numero') v = Number(v) || 0;
    guardarOCrear_('Config', 'clave', k, { clave: k, valor: v });
  });
  olvidarConfig_();
  logCambio_(u.nombre, 'config', Object.keys(cambios || {}).join(', '));
  return configuracion(token);
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
    firmada: yaFirmo,
    // Cuántas personas vienen: la página pide los datos del resto, para que
    // el titular los complete de una vez y no haya que perseguirlos después.
    pax: Number(r.pax) || 1,
    acompanantes: acompanantesDe_(r.id)
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
        bano: x.bano, porCama: !!x.porCama, modo: modoDe_(x),
        categoria: String(x.categoria || '') || categoriaPorDefecto_(x),
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

  var modo = ['entera', 'camas', 'ambas'].indexOf(String(d.modo || '')) > -1
    ? String(d.modo) : (d.porCama ? 'camas' : 'entera');
  var campos = {
    nombre: d.nombre, grupo: d.grupo || 'Lodge', capacidad: Number(d.capacidad) || 1,
    bano: d.bano || 'privado',
    modo: modo,
    // Se mantiene al día para no romper nada que todavía lo mire.
    porCama: modo === 'camas',
    precioBase: Number(d.precioBase) || 0, precioAlta: Number(d.precioAlta) || 0,
    activa: d.activa === false ? false : true
  };
  if (modo !== 'camas' && !campos.precioBase) {
    throw new Error('Para vender la habitación completa hay que ponerle precio.');
  }
  campos.categoria = String(d.categoria || '').trim() || categoriaPorDefecto_(campos);

  if (d.id) {
    actualizar_('Unidades', 'id', d.id, campos);
    // Si la pieza pasa a venderse por cama, sus camas se activan solas: si no,
    // quedaría una habitación en modo cama sin ninguna cama que mostrar.
    if (modo !== 'entera') {
      leer_('Camas').filter(function (c) { return c.idUnidad === d.id && !c.activa; })
        .forEach(function (c) { actualizar_('Camas', 'id', c.id, { activa: true }); });
    }
    olvidarRecursos_();
    logCambio_(u.nombre, 'unidad_editada', d.id + ' · ' + modo);
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

/* La distribución de la casa. La usa setup() para dejar el inventario
   armado en una instalación nueva. */
var DISTRIBUCION = [
  { id: 'U1', nombre: 'Habitación 1 · Matrimonial', capacidad: 2, bano: 'privado',
    precioBase: 55000, precioAlta: 70000, categoria: 'Matrimonial con baño privado' },
  { id: 'U2', nombre: 'Habitación 2 · Twin', capacidad: 2, bano: 'privado',
    precioBase: 55000, precioAlta: 70000, categoria: 'Twin con baño privado' },
  { id: 'U3', nombre: 'Habitación 3 · Matrimonial + cama adicional', capacidad: 3, bano: 'privado',
    precioBase: 70000, precioAlta: 90000, categoria: 'Matrimonial con cama adicional, baño privado' },
  { id: 'U4', nombre: 'Habitación 4 · Matrimonial', capacidad: 2, bano: 'privado',
    precioBase: 55000, precioAlta: 70000, categoria: 'Matrimonial con baño privado' },
  { id: 'U5', nombre: 'Habitación 5 · Single', capacidad: 1, bano: 'compartido',
    precioBase: 33000, precioAlta: 42000, categoria: 'Single con baño compartido' },
  { id: 'U6', nombre: 'Habitación 6 · Single', capacidad: 1, bano: 'compartido',
    precioBase: 33000, precioAlta: 42000, categoria: 'Single con baño compartido' },
  { id: 'U7', nombre: 'Habitación 7 · Matrimonial + litera', capacidad: 4, bano: 'compartido',
    precioBase: 78000, precioAlta: 96000, categoria: 'Matrimonial + litera, baño compartido' },
  { id: 'U8', nombre: 'Habitación 8 · Single + litera', capacidad: 3, bano: 'compartido',
    precioBase: 70000, precioAlta: 88000, categoria: 'Single + litera, baño compartido' }
];

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
  var out = { ok: true, hojas: {}, usuarios: 0, unidades: 0, mensaje: '', version: VERSION };
  // Si el logo no se ve, lo primero es saber si llegó completo: cuando se
  // copia el código a medias, esta línea queda cortada y la imagen no carga.
  out.logoLargo = (typeof LOGO === 'string') ? LOGO.length : 0;
  out.logoOk = out.logoLargo > 5000 && LOGO.indexOf('data:image/') === 0;
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

  // Lo que de verdad pasó por la caja en el período, tomado de la cuenta de
  // los huéspedes. Va aparte de la venta de alojamiento porque responde otra
  // pregunta: no "cuánto vendimos" sino "cuánto entró y de dónde".
  var caja = { cargos: 0, pagos: 0, neto: 0, iva: 0, exento: 0 };
  var porCentro = { lodge: 0, restaurante: 0 };
  var porTipo = {}, porMedio = {};
  leer_('Cuenta').forEach(function (m) {
    if (m.anulado) return;
    var f = ymd_(m.fecha);
    if (!(f >= d && f < h)) return;
    var total = Math.round(Number(m.total) || 0);
    if (m.clase === 'pago') {
      caja.pagos += total;
      var medio = String(m.medio || 'otro');
      porMedio[medio] = (porMedio[medio] || 0) + total;
      return;
    }
    caja.cargos += total;
    var des = desglosarIva_(total, m.exento);
    caja.neto += des.neto; caja.iva += des.iva;
    if (m.exento) caja.exento += total;
    var c = m.centro || 'lodge';
    porCentro[c] = (porCentro[c] || 0) + total;
    var t = String(m.tipo || 'otro');
    porTipo[t] = (porTipo[t] || 0) + total;
  });

  var enLista = function (obj) {
    return Object.keys(obj).map(function (k) { return { nombre: k, total: obj[k] }; })
      .sort(function (a, b) { return b.total - a.total; });
  };

  return {
    desde: d, hasta: h, dias: dias,
    caja: caja,
    porCentro: porCentro,
    porTipo: enLista(porTipo),
    porMedio: enLista(porMedio),
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

/* ===================== HUÉSPEDES =====================
   La misma persona vuelve, cambia de habitación y a veces escribe su nombre
   distinto. Acá se juntan sus estadías para poder buscarla y ver de un golpe
   qué reservó, qué consumió y si firmó.

   Se agrupa por teléfono, correo o documento cuando existen, y si no por el
   nombre: es lo que de verdad identifica a alguien en un lugar chico. */

function normalizar_(s) {
  return String(s == null ? '' : s).toLowerCase()
    .replace(/[áàä]/g, 'a').replace(/[éèë]/g, 'e').replace(/[íìï]/g, 'i')
    .replace(/[óòö]/g, 'o').replace(/[úùü]/g, 'u').replace(/ñ/g, 'n')
    .replace(/\s+/g, ' ').trim();
}

function soloDigitos_(s) { return String(s == null ? '' : s).replace(/[^\d]/g, ''); }

/* La llave con la que dos reservas son "la misma persona". */
function llaveHuesped_(r, ficha) {
  var tel = soloDigitos_(r.telefono);
  if (tel.length >= 8) return 'tel:' + tel.slice(-8);
  var mail = normalizar_(r.email);
  if (mail.indexOf('@') > 0) return 'mail:' + mail;
  var doc = ficha ? normalizar_(ficha.documento).replace(/[.\-]/g, '') : '';
  if (doc) return 'doc:' + doc;
  return 'nom:' + normalizar_(r.huesped);
}

function huespedes(token, texto) {
  sesion_(token);
  var busca = normalizar_(texto);
  var digitos = soloDigitos_(texto);

  var fichasPorReserva = {};
  leer_('Fichas').forEach(function (f) { fichasPorReserva[f.idReserva] = f; });

  var recs = {};
  recursos_().forEach(function (x) {
    recs[x.id] = x.unidad + (x.nombre ? ' — ' + x.nombre : '');
  });

  var hoy = hoy_();
  var gente = {};

  leer_('Reservas').forEach(function (r) {
    var ci = ymd_(r.checkIn), co = ymd_(r.checkOut);
    if (!ci || !co) return;
    var ficha = fichasPorReserva[r.id];
    var llave = llaveHuesped_(r, ficha);

    if (!gente[llave]) {
      gente[llave] = {
        llave: llave, nombre: String(r.huesped || ''),
        telefono: String(r.telefono || ''), email: String(r.email || ''),
        documento: ficha ? String(ficha.documento || '') : '',
        nacionalidad: ficha ? String(ficha.nacionalidad || '') : '',
        estadias: 0, noches: 0, gastado: 0, pagado: 0, porCobrar: 0,
        conFicha: 0, primera: '', ultima: '', proxima: '',
        canales: {}, reservas: []
      };
    }
    var g = gente[llave];
    // Se queda con los datos más completos que haya dejado en cualquier visita.
    if (String(r.huesped || '').length > g.nombre.length) g.nombre = String(r.huesped);
    if (!g.telefono && r.telefono) g.telefono = String(r.telefono);
    if (!g.email && r.email) g.email = String(r.email);
    if (!g.documento && ficha && ficha.documento) g.documento = String(ficha.documento);
    if (!g.nacionalidad && ficha && ficha.nacionalidad) g.nacionalidad = String(ficha.nacionalidad);

    var movs = movimientosDe_(r.id);
    var cargos = 0, pagos = 0;
    movs.forEach(function (m) {
      var t = Math.round(Number(m.total) || 0);
      if (m.clase === 'pago') pagos += t; else cargos += t;
    });

    var cancelada = (r.estado === 'cancelada' || r.estado === 'no_show');
    if (!cancelada) {
      g.estadias++;
      g.noches += noches_(ci, co);
      g.gastado += cargos;
      g.pagado += pagos;
      var pend = cargos - pagos + alojamientoPendiente_(r, movs);
      if (pend > 0) g.porCobrar += pend;
      if (ficha) g.conFicha++;
      if (!g.primera || ci < g.primera) g.primera = ci;
      if (co <= hoy && (!g.ultima || co > g.ultima)) g.ultima = co;
      if (ci >= hoy && (!g.proxima || ci < g.proxima)) g.proxima = ci;
      var canal = String(r.canal || 'sin canal');
      g.canales[canal] = (g.canales[canal] || 0) + 1;
    }

    g.reservas.push({
      id: r.id, alojamiento: recs[r.recurso] || String(r.recurso),
      checkIn: ci, checkOut: co, noches: noches_(ci, co),
      estado: r.estado, canal: String(r.canal || ''), pax: Number(r.pax) || 1,
      total: Math.round(Number(r.total) || 0),
      cargos: cargos, pagos: pagos,
      firmada: !!ficha, grupo: String(r.grupo || ''),
      notas: String(r.notas || '')
    });
  });

  var lista = Object.keys(gente).map(function (k) {
    var g = gente[k];
    g.reservas.sort(function (a, b) { return a.checkIn < b.checkIn ? 1 : -1; });
    g.canal = Object.keys(g.canales).sort(function (a, b) {
      return g.canales[b] - g.canales[a];
    })[0] || '';
    delete g.canales;
    g.repetido = g.estadias > 1;
    return g;
  });

  if (busca) {
    lista = lista.filter(function (g) {
      if (normalizar_(g.nombre).indexOf(busca) > -1) return true;
      if (normalizar_(g.email).indexOf(busca) > -1) return true;
      if (normalizar_(g.documento).indexOf(busca) > -1) return true;
      if (digitos.length >= 3 && soloDigitos_(g.telefono).indexOf(digitos) > -1) return true;
      // También se busca por el alojamiento donde estuvo.
      return g.reservas.some(function (x) {
        return normalizar_(x.alojamiento).indexOf(busca) > -1;
      });
    });
  }

  // Primero los que vienen; después, los más recientes.
  lista.sort(function (a, b) {
    if (!!a.proxima !== !!b.proxima) return a.proxima ? -1 : 1;
    if (a.proxima && b.proxima) return a.proxima < b.proxima ? -1 : 1;
    return (b.ultima || '') < (a.ultima || '') ? -1 : 1;
  });

  return { total: lista.length, huespedes: lista.slice(0, 200), hoy: hoy };
}

/* Todo lo de una persona: sus estadías, su ficha y el detalle de su cuenta. */
function huesped(token, llave) {
  sesion_(token);
  var g = huespedes(token, '').huespedes.filter(function (x) { return x.llave === llave; })[0];
  if (!g) throw new Error('No se encontró a esa persona.');
  g.reservas.forEach(function (x) {
    x.cuenta = cuentaDe(token, x.id);
    x.ficha = fichaDe(token, x.id);
    x.acompanantes = acompanantesDe_(x.id);
  });
  return g;
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
