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
var VERSION = '2026-09-06';

function version() { return VERSION; }

var HOJAS = {
  // 'modo' dice cómo se vende cada pieza: entera, por camas, o las dos cosas.
  // Se agrega al final y convive con el 'porCama' antiguo, que sigue sirviendo
  // de respaldo para las instalaciones que vienen de antes.
  Unidades: ['id', 'nombre', 'grupo', 'capacidad', 'bano', 'porCama', 'precioBase', 'precioAlta', 'orden', 'activa', 'categoria', 'modo'],
  Camas: ['id', 'idUnidad', 'nombre', 'precioBase', 'precioAlta', 'orden', 'activa'],
  // Las columnas nuevas SIEMPRE se agregan al final: si se insertan en medio,
  // las filas ya guardadas quedan corridas y sus fechas se vuelven ilegibles.
  // 'ninos' son los menores de 6 que no pagan: no cuentan para el tope de
  // capacidad pero sí tienen que quedar en el registro de huéspedes.
  // 'extranjero' + 'dolar' van juntos: el tipo de cambio se fija al reservar
  // y se respeta después, aunque el dólar se mueva.
  // 'sinIva' dice si al alojamiento YA se le descontó el IVA. Mirando el
  // número no hay forma de saberlo —$45.000 puede ser con o sin impuesto—,
  // y sin ese dato la pantalla mentía: le decía "sin IVA" a un precio que
  // todavía lo llevaba, y descontarlo dos veces habría sido cosa de un clic.
  Reservas: ['id', 'recurso', 'idUnidad', 'huesped', 'telefono', 'canal', 'checkIn', 'checkOut', 'estado', 'total', 'anticipo', 'addon', 'addonFecha', 'notas', 'creado', 'creadoPor', 'email', 'tokenFicha', 'checkInReal', 'checkOutReal', 'grupo', 'pax', 'exentoIva', 'docTurismo', 'ninos', 'extranjero', 'dolar', 'sinIva', 'codigoDoc', 'programa', 'programaNombre', 'uidExterno', 'refExterna', 'feedExterno'],
  /* Los programas especiales. Un programa NO es un extra que se suma al
     alojamiento: es una TARIFA distinta que lo reemplaza. "Programa
     romántico" a $95.000 la noche se cobra en vez de los $70.000 de la
     pieza, no encima.

     'incluye' es texto libre, una cosa por línea, y sale tal cual en el
     comprobante del huésped: es lo que le promete el programa.

     'grupos' dice a qué se le puede aplicar —Lodge, Glamping, o vacío para
     todo—, porque un programa de carpa no tiene sentido en una habitación.

     No se borran nunca, se archivan: una reserva vieja tiene que poder
     seguir diciendo con qué programa se vendió. */
  Programas: ['id', 'nombre', 'incluye', 'precio', 'precioAlta', 'grupos', 'activo', 'orden', 'creado'],
  // Lo que se cobra por CADA noche de una reserva. El total de la reserva es
  // la suma de estas filas, así que alargarla o acortarla recalcula el precio
  // solo, y una noche de promoción se baja sin tocar las demás.
  Noches: ['idReserva', 'fecha', 'valor', 'ajustada', 'nota'],
  // La cuenta del huésped: cargos y pagos en un solo libro, en orden.
  // Un cargo suma y un pago resta; el saldo es la diferencia.
  // 'moneda' y 'usd' solo se llenan en los pagos: la exención de IVA a
  // turistas extranjeros exige que el pago haya sido en moneda extranjera,
  // así que hay que dejar constancia de en qué moneda entró cada peso.
  Cuenta: ['id', 'idReserva', 'fecha', 'clase', 'tipo', 'centro', 'descripcion', 'cantidad', 'unitario', 'total', 'exento', 'medio', 'anulado', 'creado', 'creadoPor', 'moneda', 'usd'],
  // Un renglón por día cerrado: deja constancia de qué se posteó y quién cerró.
  Cierres: ['fecha', 'ejecutado', 'por', 'noches', 'alojamiento', 'consumos', 'pagos', 'avisos'],
  Aseo: ['idUnidad', 'estado', 'responsable', 'notas', 'actualizado'],
  Fichas: ['id', 'idReserva', 'nombre', 'documento', 'nacionalidad', 'nacimiento', 'procedencia', 'destino', 'motivo', 'emergencia', 'firmaUrl', 'fecha'],
  // Quiénes más duermen en esa reserva. Firma solo el representante, pero el
  // registro de huéspedes tiene que nombrar a todos los que pernoctan.
  Acompanantes: ['id', 'idReserva', 'nombre', 'documento', 'nacionalidad', 'nacimiento', 'notas', 'creado', 'menor'],
  // Fotos de pasaporte y tarjeta PDI. El archivo vive en Drive; acá queda
  // solo la referencia, para no inflar la planilla con imágenes.
  Documentos: ['id', 'idReserva', 'tipo', 'nombre', 'archivoId', 'archivoUrl', 'subidoPor', 'creado'],
  Usuarios: ['nombre', 'rol', 'pinHash', 'activo'],
  Sesiones: ['token', 'nombre', 'rol', 'expira'],
  Log: ['fecha', 'usuario', 'accion', 'detalle'],
  Config: ['clave', 'valor']
};

/* Columnas que deben guardarse como TEXTO plano y no como fecha de Sheets.
   Esto era el origen del bug de reservas duplicadas: Sheets convertía
   "2026-08-07" en un objeto Date con hora local y las comparaciones fallaban. */
var COLS_TEXTO = {
  Reservas: ['checkIn', 'checkOut', 'addonFecha', 'creado', 'telefono', 'checkInReal', 'checkOutReal', 'docTurismo', 'refExterna'],
  Programas: ['creado'],
  Noches: ['fecha'],
  Acompanantes: ['nacimiento', 'creado'],
  Documentos: ['creado'],
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

  /* El calendario que lee Booking. No es una página: es un archivo .ics que
     Booking va a buscar solo cada cierto rato para bloquear en su lado las
     fechas que acá ya están tomadas. Va antes que todo lo demás porque no
     devuelve HTML. */
  if (p.ical) return icalDeRecurso_(String(p.ical), String(p.u || ''));

  if (p.f) {
    pagina = HtmlService.createTemplateFromFile('Ficha');
    pagina.token = String(p.f);
    pagina.codigoDoc = '';
    titulo = 'Casona Peumayén — Registro';
  } else if (p.d) {
    // La página de recepción. Es la MISMA plantilla, en modo "solo
    // documentos": no muestra la ficha, ni el reglamento, ni la firma, ni
    // ningún dato del huésped que no haga falta para sacar la foto. Se abre
    // escaneando el código QR que recepción tiene en pantalla, y la usa
    // recepción con su propio teléfono. El huésped no la ve nunca.
    pagina = HtmlService.createTemplateFromFile('Ficha');
    pagina.token = '';
    pagina.codigoDoc = String(p.d);
    titulo = 'Casona Peumayén — Documentos';
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
  try { CacheService.getScriptCache().remove('dolar'); } catch (e) {}
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

/* ===================== TIPO DE CAMBIO =====================
   El cambio lo fijan ellos: 'dolarManual' en Config manda por sobre todo lo
   demás, y viene con un valor puesto desde la instalación. Mientras haya uno,
   el sistema NO consulta nada afuera — así no depende de internet ni pide el
   permiso de consultas externas.

   Solo si lo dejan en 0 se busca el dólar observado del día en mindicador.cl,
   y aun así, si el servicio no contesta, se sigue con el último valor
   conocido. Nunca queda en cero: un cero convertiría cualquier precio en
   infinito y eso sí sería un problema. */
var DOLAR_RESPALDO = 950;

function dolarHoy_() {
  if (MEMO.__dolar) return MEMO.__dolar;

  // Fijado a mano: manda por sobre todo lo demás.
  var manual = Number(config_('dolarManual', 0)) || 0;
  if (manual > 0) { MEMO.__dolar = { valor: manual, fuente: 'manual', fecha: hoy_() }; return MEMO.__dolar; }

  try {
    var g = CacheService.getScriptCache().get('dolar');
    if (g) {
      var d = JSON.parse(g);
      if (d && d.fecha === hoy_() && d.valor > 0) { MEMO.__dolar = d; return d; }
    }
  } catch (e) {}

  var valor = 0;
  try {
    var r = UrlFetchApp.fetch('https://mindicador.cl/api/dolar', {
      muteHttpExceptions: true, followRedirects: true, validateHttpsCertificates: true
    });
    if (r.getResponseCode() === 200) {
      var j = JSON.parse(r.getContentText());
      if (j && j.serie && j.serie.length) valor = Number(j.serie[0].valor) || 0;
    }
  } catch (e) {}

  var fuente = 'observado';
  if (valor <= 0) {
    // No se pudo consultar: se usa el último que sí sirvió.
    valor = Number(config_('dolarUltimo', 0)) || DOLAR_RESPALDO;
    fuente = 'último conocido';
  } else {
    // Se guarda para poder seguir trabajando el día que el servicio se caiga.
    try { actualizarConfig_('dolarUltimo', valor); } catch (e) {}
  }

  var dato = { valor: Math.round(valor), fuente: fuente, fecha: hoy_() };
  MEMO.__dolar = dato;
  try { CacheService.getScriptCache().put('dolar', JSON.stringify(dato), 21600); } catch (e) {}
  return dato;
}

/* Escribe una clave de Config sin pasar por guardarConfiguracion(), que exige
   sesión de administración: esto lo llama el propio sistema. */
function actualizarConfig_(clave, valor) {
  var hay = leer_('Config').filter(function (c) { return c.clave === clave; })[0];
  if (hay) actualizar_('Config', 'clave', clave, { valor: valor });
  else insertar_('Config', { clave: clave, valor: valor });
  olvidarConfig_();
}

/* Los pesos de una reserva pasados a dólares, al cambio que se le fijó.
   Si la reserva no tiene cambio propio (las viejas), se usa el de hoy. */
function aUsd_(pesos, cambio) {
  var c = Number(cambio) || dolarHoy_().valor;
  if (!(c > 0)) return 0;
  return Math.round((Number(pesos) || 0) / c * 100) / 100;
}

/* El mismo número, ya escrito para leerse: "US$1,234.56". Los dólares llevan
   coma de miles y punto decimal, al revés que el peso. */
function usd_(pesos, cambio) {
  var v = aUsd_(pesos, cambio);
  var partes = Math.abs(v).toFixed(2).split('.');
  return (v < 0 ? '-' : '') + 'US$' +
    partes[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',') + '.' + partes[1];
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
      iva: 19,
      // El cambio lo fijan ellos desde Configuración. Viene con un valor
      // puesto a propósito: mientras haya uno, el sistema NO sale a internet
      // a buscar el dólar, y así no hace falta el permiso de consultas
      // externas. Poniéndolo en 0 se activa la búsqueda automática.
      dolarManual: DOLAR_RESPALDO
    };
    Object.keys(cfg).forEach(function (k) { insertar_('Config', { clave: k, valor: cfg[k] }); });
  }
  // Una instalación que viene de antes no tiene la clave: se le pone el
  // respaldo, para que tampoco salga a internet sin que nadie lo pida.
  if (config_('dolarManual', null) === null) actualizarConfig_('dolarManual', DOLAR_RESPALDO);

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

  // Las reservas cargadas antes de que existiera el plan por noche no tienen
  // filas en la hoja Noches, y por eso el comprobante decía "0 noches".
  // Acá se les arma el plan a partir de sus fechas y su total.
  var reparadas = repararNoches_();
  if (reparadas) Logger.log('Se repusieron ' + plural_(reparadas, 'noche', 'noches') + ' que faltaban.');

  // Las reservas de extranjeros cargadas antes de que existiera el descuento
  // quedaron con el IVA adentro. Se les descuenta una vez y quedan marcadas,
  // así que ejecutar setup() de nuevo no las vuelve a tocar.
  var netas = descontarIvaPendiente_();
  if (netas) Logger.log('A ' + plural_(netas, 'reserva', 'reservas') +
    ' de turistas extranjeros se les descontó el IVA que tenían pendiente.');

  // El programa fijo de tinaja + sushi pasó a ser un programa más, de los que
  // se crean desde Configuración. Las reservas que lo tenían marcado se pasan
  // al programa nuevo para no perder con qué se vendieron.
  var migradas = migrarAddonAPrograma_();
  if (migradas) Logger.log('Se pasaron ' + plural_(migradas, 'reserva', 'reservas') +
    ' del antiguo programa tinaja + sushi al sistema de programas.');

  return ss.getUrl();
}

/* El tinaja + sushi era un programa fijo, escrito en el código: una casilla
   en la reserva y dos precios en Configuración. Ahora los programas se crean
   desde la pantalla, así que ese deja de ser especial y pasa a ser uno más.

   Esto pasa las reservas que lo tenían marcado al programa nuevo, para no
   perder el dato. Es idempotente: una reserva que ya tiene programa no se
   vuelve a tocar, así que ejecutar setup() otra vez no hace nada. Y no cambia
   ni un peso de lo que ya estaba cobrado. */
function migrarAddonAPrograma_() {
  var conAddon = leer_('Reservas').filter(function (r) {
    return r.addon && !String(r.programa || '');
  });
  if (!conAddon.length) return 0;

  var NOMBRE = 'Tinaja + tabla de sushi';
  var p = programas_().filter(function (x) { return x.nombre === NOMBRE; })[0];
  if (!p) {
    var base = Number(config_('addonBase', 30000)) || 30000;
    var alta = Number(config_('addonAlta', 35000)) || base;
    var id = uid_('P');
    insertar_('Programas', {
      id: id, nombre: NOMBRE,
      incluye: 'Uso de la tinaja caliente\nTabla de sushi para dos',
      /* Los precios que tenía configurados el programa viejo. Ojo: antes se
         SUMABAN al alojamiento y ahora un programa lo reemplaza, así que hay
         que revisarlos antes de volver a venderlo. Por eso nace archivado:
         queda a la vista en Configuración, pero no se puede elegir por
         equivocación mientras nadie le mire el precio. */
      precio: base, precioAlta: alta,
      grupos: 'Glamping', activo: false,
      orden: programas_().length + 1, creado: ahora_()
    });
    olvidarProgramas_();
    p = programaPorId_(id);
  }
  if (!p) return 0;

  // Solo se les pone la etiqueta: los precios ya cobrados NO se tocan.
  // Recalcularlos ahora movería cuentas que ya están cerradas.
  actualizarVarias_('Reservas', function (r) {
    if (!r.addon || String(r.programa || '')) return null;
    return { programa: p.id, programaNombre: p.nombre };
  });
  return conAddon.length;
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

  Logger.log(plural_(malas.length, 'reserva', 'reservas') + ' con fechas ilegibles:');
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

/* ===================== PROGRAMAS =====================
   Un programa es una TARIFA distinta, no un extra que se suma. Elegir
   "Programa romántico" al reservar hace que la noche valga lo que vale el
   programa en vez de lo que vale la pieza — no una cosa más la otra.

   Eso es lo que lo hace encajar sin romper nada: el precio de una reserva ya
   se llevaba noche por noche, así que el programa solo cambia de dónde sale
   el número de cada noche. Alargar la estadía, bajar una noche a mano,
   repartir un total acordado y cobrar en dólares siguen funcionando igual.

   Se archivan, no se borran: una reserva del año pasado tiene que poder
   seguir diciendo con qué programa se vendió. */
function olvidarProgramas_() {
  try { CacheService.getScriptCache().remove('programas'); } catch (e) {}
  MEMO.__programas = null;
}

function programas_() {
  if (MEMO.__programas) return MEMO.__programas;
  try {
    var guardado = CacheService.getScriptCache().get('programas');
    if (guardado) { MEMO.__programas = JSON.parse(guardado); return MEMO.__programas; }
  } catch (e) { /* sin caché se lee de la planilla igual */ }

  var lista = [];
  try {
    lista = leer_('Programas').map(function (p) {
      return {
        id: String(p.id), nombre: String(p.nombre || ''),
        incluye: String(p.incluye || ''),
        precio: Math.round(Number(p.precio) || 0),
        precioAlta: Math.round(Number(p.precioAlta) || 0),
        grupos: String(p.grupos || ''),
        activo: !!p.activo, orden: Number(p.orden) || 0
      };
    }).sort(function (a, b) { return a.orden - b.orden; });
  } catch (e) {
    // La hoja todavía no existe: setup() sin ejecutar. Sin programas la app
    // funciona igual, así que no vale la pena tirar abajo la pantalla.
    lista = [];
  }
  MEMO.__programas = lista;
  try { CacheService.getScriptCache().put('programas', JSON.stringify(lista), 21600); } catch (e) {}
  return lista;
}

function programaPorId_(id) {
  if (!id) return null;
  return programas_().filter(function (p) { return p.id === String(id); })[0] || null;
}

/* Vuelve a poner precio a todas las noches de una reserva a la tarifa que
   corresponda ahora: la del programa nuevo, o la de la pieza si se le quitó.

   Se recotiza TODO, incluidas las noches que alguien había bajado a mano. Es
   a propósito: cambiar de programa es cambiar de tarifa, y dejar media
   estadía al precio viejo daría un total que no es ni uno ni el otro. Si
   había un precio conversado, se vuelve a escribir en el total del formulario
   y ajustarPlan_ lo reparte encima. */
function recotizarPorPrograma_(idReserva, idPrograma, exento, quien) {
  var r = leer_('Reservas').filter(function (x) { return x.id === idReserva; })[0];
  if (!r) return 0;
  var plan = planDe_(idReserva);
  if (!plan.length) return Math.round(Number(r.total) || 0);

  var nuevos = {};
  plan.forEach(function (n) {
    var v = tarifaDe_(r.recurso, n.fecha, idPrograma);
    // Al turista extranjero exento le corresponde el neto: la tarifa, venga
    // de la pieza o del programa, se escribe con IVA incluido.
    nuevos[n.fecha] = exento ? netoDe_(v) : v;
  });
  var p = programaPorId_(idPrograma);
  var total = aplicarValores_(idReserva, nuevos, p ? p.nombre : 'Tarifa normal');
  logCambio_(quien || '', 'programa', idReserva + ' · ' +
    (p ? p.nombre : 'sin programa') + ' · total ' + total);
  return total;
}

/* Lo que incluye, como lista. Es texto libre con una cosa por línea, igual
   que el reglamento: se escribe tal como se va a leer. */
function incluyeDe_(programa) {
  if (!programa) return [];
  return String(programa.incluye || '').split('\n')
    .map(function (x) { return x.trim(); })
    .filter(function (x) { return x !== ''; });
}

/* Si el programa se le puede aplicar a este alojamiento. Vacío = a todos. */
function programaSirvePara_(programa, recursoId) {
  if (!programa) return false;
  var g = String(programa.grupos || '').trim();
  if (!g) return true;
  var rec = recursos_().filter(function (x) { return x.id === recursoId; })[0];
  if (!rec) return true;
  return g.split(',').map(function (x) { return x.trim(); })
          .filter(function (x) { return x !== ''; })
          .indexOf(String(rec.grupo)) > -1;
}

/* Lo que la pantalla necesita saber de cada programa. */
function programasParaPantalla_(incluirArchivados) {
  return programas_().filter(function (p) { return incluirArchivados || p.activo; })
    .map(function (p) {
      return { id: p.id, nombre: p.nombre, incluye: p.incluye,
               lista: incluyeDe_(p), precio: p.precio, precioAlta: p.precioAlta,
               grupos: p.grupos, activo: p.activo, orden: p.orden };
    });
}

function programasAdmin(token) {
  var u = sesion_(token);
  exigirAdmin_(u);
  // Los archivados también: se ven en gris, para poder revivirlos.
  return { programas: programasParaPantalla_(true), iva: ivaPct_() };
}

function guardarPrograma(token, d) {
  var u = sesion_(token);
  exigirAdmin_(u);
  var nombre = String(d.nombre || '').trim();
  if (!nombre) throw new Error('El programa necesita un nombre.');
  var precio = Math.round(Number(d.precio) || 0);
  if (precio <= 0) throw new Error('Ponle un valor por noche al programa.');

  var campos = {
    nombre: nombre,
    incluye: String(d.incluye || ''),
    precio: precio,
    // Si no se escribe precio de temporada alta, se usa el mismo de siempre.
    precioAlta: Math.round(Number(d.precioAlta) || 0) || precio,
    grupos: String(d.grupos || ''),
    activo: d.activo === undefined ? true : !!d.activo,
    orden: Number(d.orden) || 0
  };

  if (d.id) {
    if (!programaPorId_(d.id)) throw new Error('No se encontró ese programa.');
    actualizar_('Programas', 'id', d.id, campos);
    logCambio_(u.nombre, 'programa_editado', d.id + ' · ' + nombre);
  } else {
    campos.id = uid_('P');
    campos.creado = ahora_();
    if (!campos.orden) campos.orden = programas_().length + 1;
    insertar_('Programas', campos);
    logCambio_(u.nombre, 'programa_creado', campos.id + ' · ' + nombre);
  }
  olvidarProgramas_();
  return programasAdmin(token);
}

/* Archivar y no borrar: las reservas que se vendieron con ese programa
   tienen que poder seguir diciéndolo. */
function archivarPrograma(token, id, archivar) {
  var u = sesion_(token);
  exigirAdmin_(u);
  if (!programaPorId_(id)) throw new Error('No se encontró ese programa.');
  actualizar_('Programas', 'id', id, { activo: !archivar });
  olvidarProgramas_();
  logCambio_(u.nombre, archivar ? 'programa_archivado' : 'programa_reactivado', id);
  return programasAdmin(token);
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
  // Los documentos escaneados, indexados de una sola lectura: recepción
  // necesita ver de un vistazo a quién le falta el pasaporte o la PDI.
  // Si la hoja todavía no existe —código nuevo con setup() sin ejecutar— se
  // sigue sin los avisos: quedarse sin calendario por eso sería mucho peor,
  // y el letrero de arriba ya está diciendo que hay que ejecutar setup().
  var docsPorReserva = {};
  try { docsPorReserva = agrupar_('Documentos', 'idReserva'); } catch (e) {}

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
      programa: String(r.programa || ''),
      programaNombre: String(r.programaNombre || ''),
      refExterna: String(r.refExterna || ''),
      // El enlace lo arma el servidor y no la pantalla: necesita el
      // identificador del establecimiento, que solo vive acá. Armándolo en el
      // navegador salía sin esa parte y Booking no sabía qué ficha abrir.
      linkBooking: r.refExterna ? bookingLinkReserva_(String(r.refExterna)) : '',
      notas: r.notas || '', grupo: String(r.grupo || ''),
      pax: Number(r.pax) || 1, ninos: Number(r.ninos) || 0,
      extranjero: !!r.extranjero, dolar: Number(r.dolar) || 0,
      // Si al total ya se le descontó el IVA. La pantalla no puede
      // deducirlo del número: $45.000 puede ser con o sin impuesto.
      sinIva: !!r.sinIva,
      docs: estadoDocs_(docsPorReserva[String(r.id)], !!r.extranjero)
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
    // Los programas activos, para poder elegir uno al hacer la reserva sin
    // salir del calendario. Son pocos y cambian poco: viajan enteros.
    programas: programasParaPantalla_(false),
    reservas: reservas, hoy: hoy_(),
    // Reservas que existen en la planilla pero no se pueden ubicar en el
    // calendario porque su fecha quedó ilegible: se avisa en pantalla.
    ilegibles: ilegibles,
    // El dólar del día, para cotizarle a un extranjero sin salir de la
    // pantalla. Se busca una vez al día, así que viaja gratis.
    dolar: dolarHoy_(),
    cfg: {
      altaIni: String(config_('temporadaAltaInicio', '12-15')),
      altaFin: String(config_('temporadaAltaFin', '03-15')),
      // La pantalla necesita el IVA para avisar cuánto baja el precio al
      // marcar a alguien como turista extranjero.
      iva: ivaPct_()
    }
  };
}

/* ===================== RESERVAS ===================== */

/* Calza el plan de noches con las fechas y, si desde el formulario vino un
   total distinto al que suman las noches, lo reparte entre ellas. Así el
   número que se ve en la reserva y el detalle noche a noche nunca se
   contradicen. */
/* ---------- En qué meses hay algo ----------
   Para el selector de mes del calendario. Sin esto, buscar una reserva de
   enero es correr las flechas semana por semana hasta topársela; con esto se
   abre el selector y se ve de una que enero tiene tres y febrero ninguna.

   Se cuentan RESERVAS que tocan cada mes, no noches: lo que se quiere saber
   es "¿hay algo acá?", y una estadía larga no debe pesar más que una corta.
   Una reserva a caballo entre dos meses cuenta en los dos. */
function mesesConReservas(token, anio) {
  sesion_(token);
  var a = Number(anio) || Number(hoy_().slice(0, 4));
  var cuenta = [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
  leer_('Reservas').forEach(function (r) {
    if (r.estado === 'cancelada' || r.estado === 'no_show') return;
    var ci = ymd_(r.checkIn), co = ymd_(r.checkOut);
    if (!ci || !co || co <= ci) return;
    // La última noche es la anterior al check-out: una reserva que sale el 1
    // de febrero no ocupa febrero.
    var ultima = ymd_(sumarDias_(co, -1));
    // Se recorre por meses y no por días: una estadía de un mes no puede
    // costar treinta vueltas cuando bastan dos.
    var y = Number(ci.slice(0, 4)), m = Number(ci.slice(5, 7));
    var yF = Number(ultima.slice(0, 4)), mF = Number(ultima.slice(5, 7));
    while (y < yF || (y === yF && m <= mF)) {
      if (y === a) cuenta[m - 1]++;
      m++;
      if (m > 12) { m = 1; y++; }
    }
  });
  return { anio: a, meses: cuenta };
}

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

    // Los pax no pueden pasarse de lo que cabe en el alojamiento. Los menores
    // de 6 no pagan y no ocupan cupo, así que van aparte y sin tope.
    var tope = unidad ? (Number(unidad.capacidad) || 1) : 1;
    var pax = Math.min(Math.max(Number(datos.pax) || 1, 1), tope);
    var ninos = Math.max(Number(datos.ninos) || 0, 0);

    var antes = datos.id
      ? leer_('Reservas').filter(function (x) { return x.id === datos.id; })[0]
      : null;

    var campos = {
      pax: pax, ninos: ninos,
      recurso: datos.recurso, idUnidad: unidad ? unidad.idUnidad : '',
      huesped: datos.huesped, telefono: datos.telefono || '', email: datos.email || '',
      canal: datos.canal || 'whatsapp',
      checkIn: f.checkIn, checkOut: f.checkOut, estado: datos.estado || 'confirmada',
      notas: datos.notas || ''
    };

    /* El programa. Se guarda el id Y el nombre: el id sirve para leer el
       precio y lo que incluye, y el nombre queda como copia congelada del
       día en que se vendió, para que una reserva vieja siga diciendo con qué
       se vendió aunque después el programa se archive o se le cambie el
       nombre. */
    var prog = null;
    if (datos.programa !== undefined) {
      prog = programaPorId_(datos.programa);
      if (datos.programa && !prog) throw new Error('Ese programa ya no existe.');
      if (prog && !programaSirvePara_(prog, datos.recurso)) {
        throw new Error('El programa "' + prog.nombre + '" no se puede aplicar a ' +
          'este alojamiento.');
      }
      campos.programa = prog ? prog.id : '';
      campos.programaNombre = prog ? prog.nombre : '';
    }
    if (datos.grupo !== undefined) campos.grupo = datos.grupo || '';

    // Huésped extranjero: se le fija el tipo de cambio del día en que reserva
    // y se le respeta después, aunque el dólar se mueva. La exención de IVA
    // viene de la mano, pero solo vale si termina pagando en moneda
    // extranjera: eso se comprueba al cobrar, no acá.
    // Cambiar la casilla desde el formulario tiene que hacer exactamente lo
    // mismo que marcarla desde la cuenta, incluido arrastrar los cargos de
    // alojamiento ya anotados. Si no, la reserva diría una cosa y su cuenta
    // otra distinta.
    // La casilla de turista extranjero no es solo una etiqueta: cambia el
    // precio, porque las tarifas de la casa llevan IVA incluido y al exento
    // le corresponde el neto. Quien hace ese trabajo es marcarExentoIva(),
    // así que acá NO se escribe la marca: se anota que cambió y se le pasa
    // el encargo. Si se escribiera antes, marcarExentoIva() vería la marca
    // ya puesta, creería que no cambió nada y no convertiría el precio.
    var esExtranjero = (datos.extranjero !== undefined)
      ? !!datos.extranjero : !!(antes && antes.extranjero);
    var cambio = Number(antes && antes.dolar) || dolarHoy_().valor;
    var cambiaExento = false;
    if (datos.extranjero !== undefined) {
      cambiaExento = !!antes && (!!antes.exentoIva !== !!datos.extranjero);
      if (!cambiaExento) {
        campos.extranjero = esExtranjero;
        campos.exentoIva = esExtranjero;
      }
      // El cambio se guarda en cuanto la reserva es de un extranjero y todavía
      // no tiene uno propio. Si no quedara escrito, cada vez que se abriera se
      // convertiría con el dólar de ESE día y el precio se movería solo.
      if (esExtranjero && !Number(antes && antes.dolar)) campos.dolar = cambio;
    }

    // Al extranjero se le cotiza en dólares, así que la cifra que llega del
    // formulario puede venir en US$. Lo dice 'moneda' y NO se adivina: fue
    // justamente adivinarlo lo que hacía que la misma reserva valiera
    // US$49 al crearla y otra cosa distinta al volver a abrirla. Un precio
    // en dólares ya viene sin impuesto: es lo que el huésped paga y punto.
    var enUsd = String(datos.moneda || '') === 'USD';
    var aPesos = function (n) {
      var v = Number(n) || 0;
      return enUsd ? Math.round(v * cambio) : Math.round(v);
    };
    campos.total = aPesos(datos.total);
    campos.anticipo = aPesos(datos.anticipo);

    var pedido = (datos.total === undefined || datos.total === null || datos.total === '')
      ? null : aPesos(datos.total);

    if (datos.id) {
      // Si la cuenta ya tiene pagos anotados, ella manda: el abonado de la
      // reserva es su espejo y no se puede pisar desde este formulario.
      var pagados = movimientosDe_(datos.id).filter(function (m) { return m.clase === 'pago'; });
      if (pagados.length) delete campos.anticipo;
      delete campos.total;                     // el total lo fija el plan de noches
      actualizar_('Reservas', 'id', datos.id, campos);
      campos.id = datos.id;
      // Primero la marca de exento —que convierte el plan que YA existía— y
      // recién después el total que pide el formulario. Al revés, el reparto
      // se hacía sobre el precio viejo y después se le descontaba el IVA a
      // una cifra que ya venía sin él.
      if (cambiaExento) {
        marcarExentoIva(token, datos.id, !!datos.extranjero,
                        antes ? String(antes.docTurismo || '') : '');
        olvidar_('Noches');
      }
      /* Cambiar de programa —o quitarlo— es cambiar de tarifa, así que las
         noches se vuelven a cotizar al precio nuevo. Si además se escribió un
         total a mano, ese manda y se reparte encima: lo hace ajustarPlan_ un
         par de líneas más abajo. */
      if (datos.programa !== undefined &&
          String(antes && antes.programa || '') !== String(campos.programa || '')) {
        recotizarPorPrograma_(datos.id, campos.programa,
                              !!(antes && antes.exentoIva), u.nombre);
        olvidar_('Noches');
      }
      var totalNuevo = ajustarPlan_(campos, pedido, u.nombre);
      return { id: datos.id, total: totalNuevo,
               moneda: esExtranjero ? 'USD' : 'CLP', usd: aUsd_(totalNuevo, cambio) };
    }

    var id = uid_('R');
    campos.id = id;
    campos.tokenFicha = '';
    campos.creado = ahora_();
    campos.creadoPor = u.nombre;
    // Las noches se arman antes de guardar, para que el total que queda en la
    // reserva sea ya la suma de sus noches y no haya que corregirlo después.
    var plan = armarNoches_(id, datos.recurso, f.checkIn, f.checkOut, pedido,
                            prog ? prog.id : '');
    campos.total = plan.total;
    insertar_('Reservas', campos);
    insertarVarias_('Noches', plan.noches);
    // Recién creada y ya marcada como extranjera. Si el precio vino en
    // dólares, ya viene sin impuesto y solo hay que dejar constancia de que
    // a este plan no se le descuenta nada más; si vino de las tarifas de la
    // casa, que llevan IVA incluido, se le descuenta.
    if (campos.exentoIva) {
      olvidar_('Noches');
      if (enUsd && pedido !== null) {
        actualizar_('Reservas', 'id', id, { sinIva: true });
      } else {
        campos.total = convertirAlojamiento_(id, true);
      }
      plan.total = campos.total;
    }
    // El abono que se escribe al crear la reserva entra a la cuenta como un
    // pago, para que exista un solo lugar donde vive la plata.
    if (campos.anticipo > 0) {
      anotar_(id, {
        clase: 'pago', tipo: 'pago', descripcion: 'Abono inicial',
        cantidad: 1, unitario: campos.anticipo, total: campos.anticipo,
        medio: datos.medioAnticipo || 'otro', fecha: hoy_()
      }, u.nombre);
    }
    // El aviso al grupo va al final, con todo ya escrito, y envuelto para que
    // un problema de Telegram no se lleve por delante la reserva.
    avisarReservaNueva_(id, u.nombre);
    return { id: id, total: plan.total,
             moneda: esExtranjero ? 'USD' : 'CLP', usd: aUsd_(plan.total, cambio) };
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

    // Un grupo de turistas extranjeros es UN grupo de turistas extranjeros:
    // las piezas se cotizan todas en dólares y sin IVA, con el mismo cambio.
    // Los precios llegan ya en esa moneda; acá se pasan a pesos, que es como
    // se guarda la planilla.
    // Un grupo se vende con UN programa para todas sus piezas, o con ninguno.
    var progGrupo = datos.programa ? programaPorId_(datos.programa) : null;
    if (datos.programa && !progGrupo) throw new Error('Ese programa ya no existe.');
    if (progGrupo) {
      lista.forEach(function (item) {
        var idr = item.recurso || item;
        if (!programaSirvePara_(progGrupo, idr)) {
          throw new Error('El programa "' + progGrupo.nombre + '" no se puede aplicar a ' +
            (validos[idr] ? validos[idr].unidad : idr) + '.');
        }
      });
    }

    var extranjero = !!datos.extranjero;
    var enUsd = String(datos.moneda || '') === 'USD';
    var cambio = dolarHoy_().valor;
    var aPesos = function (n) {
      var v = Number(n) || 0;
      return enUsd ? Math.round(v * cambio) : Math.round(v);
    };

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
        total: aPesos(item.precio),
        // El abono se anota una sola vez, en la primera del grupo.
        anticipo: i === 0 ? aPesos(datos.anticipo) : 0,
        notas: datos.notas || '', grupo: grupo,
        programa: progGrupo ? progGrupo.id : '',
        programaNombre: progGrupo ? progGrupo.nombre : '',
        extranjero: extranjero, exentoIva: extranjero,
        dolar: extranjero ? cambio : 0,
        // Un precio que llegó en dólares YA viene sin impuesto; uno que salió
        // de las tarifas de la casa todavía lo lleva y hay que sacárselo.
        sinIva: extranjero && enUsd,
        creado: ahora_(), creadoPor: u.nombre
      };
    });
    // Las noches se arman ANTES de escribir, para que el total que queda
    // guardado en cada reserva sea ya el que suman sus noches.
    var noches = [];
    filas.forEach(function (x) {
      var plan = armarNoches_(x.id, x.recurso, f.checkIn, f.checkOut,
                              Math.round(Number(x.total) || 0),
                              progGrupo ? progGrupo.id : '');
      x.total = plan.total;
      noches = noches.concat(plan.noches);
    });

    // Todas las habitaciones del grupo se escriben de una sola vez, y sus
    // noches también: si no, un grupo de tres piezas costaría tres rondas
    // completas de lectura y escritura.
    insertarVarias_('Reservas', filas);
    insertarVarias_('Noches', noches);
    var ids = filas.map(function (x) { return x.id; });
    // Grupo de extranjeros cotizado con las tarifas de la casa —porque no
    // había cambio con qué convertir—: esas tarifas llevan IVA incluido y al
    // exento le corresponde el neto.
    if (extranjero && !enUsd) {
      olvidar_('Noches');
      ids.forEach(function (id) { convertirAlojamiento_(id, true); });
    }
    logCambio_(u.nombre, 'grupo_creado', grupo + ' · ' + ids.length + ' alojamientos · ' + datos.huesped);
    avisarGrupoNuevo_(ids, u.nombre);
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
  var u = sesion_(token);
  var f = validarFechas_(checkIn, checkOut);
  if (!recursos_().some(function (x) { return x.id === recurso; })) {
    throw new Error('Ese alojamiento no está disponible para reservar.');
  }
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    verificarLibre_(recurso, f.checkIn, f.checkOut, id);
    // Cómo estaba antes, para poder contar en el grupo qué cambió.
    var previa = leer_('Reservas').filter(function (x) { return x.id === id; })[0];
    var antes = previa
      ? { recurso: previa.recurso, checkIn: ymd_(previa.checkIn), checkOut: ymd_(previa.checkOut) }
      : null;
    // Primero se le repone el plan si le faltaba: después de cambiarle las
    // fechas ya no se sabría por qué noches se acordó su precio.
    asegurarPlan_(id);
    var unidad = recursos_().filter(function (x) { return x.id === recurso; })[0];
    actualizar_('Reservas', 'id', id, {
      recurso: recurso, idUnidad: unidad ? unidad.idUnidad : '',
      checkIn: f.checkIn, checkOut: f.checkOut
    });
    // Alargar la reserva agrega esas noches al precio, y acortarla las quita:
    // el total nunca se queda pegado en lo que valía antes.
    var r = sincronizarNoches_({ id: id, recurso: recurso, checkIn: f.checkIn, checkOut: f.checkOut },
                               u.nombre);
    if (antes && previa) {
      avisarMovida_({ id: id, huesped: previa.huesped, recurso: recurso,
                      checkIn: f.checkIn, checkOut: f.checkOut }, antes, u.nombre);
    }
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
  avisarEstado_(r, estado, u.nombre);
  return true;
}

function eliminarReserva(token, id) {
  var u = sesion_(token);
  if (u.rol !== 'admin') throw new Error('Solo administración puede eliminar reservas.');
  // Los documentos van PRIMERO y con su archivo: son fotos del pasaporte y de
  // la tarjeta PDI de una persona. Si solo se borrara la reserva quedarían
  // sueltos en la planilla y en Drive, sin nadie a quien pertenecer y sin
  // forma de encontrarlos para borrarlos después.
  // La reserva se lee ANTES de borrarla: después no habría de qué avisar.
  var r = leer_('Reservas').filter(function (x) { return x.id === id; })[0];
  documentosDe_(id).forEach(function (d) {
    try { borrarDocumento(token, d.id); } catch (e) {}
  });
  borrar_('Reservas', 'id', id);
  borrar_('Cuenta', 'idReserva', id);
  borrar_('Noches', 'idReserva', id);
  borrar_('Acompanantes', 'idReserva', id);
  logCambio_(u.nombre, 'reserva_eliminada', id);
  if (r) avisarBorrada_(r, u.nombre);
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

/* Lo que vale UNA noche.

   Si la reserva va con un programa, manda el precio del programa: lo
   REEMPLAZA, no se le suma. Es el único lugar donde el programa entra al
   cálculo, y por eso todo lo demás —estirar la estadía, bajar una noche a
   mano, repartir un total, cobrar en dólares— sigue funcionando igual. */
function tarifaDe_(recursoId, fecha, idPrograma) {
  if (idPrograma) {
    var p = programaPorId_(idPrograma);
    if (p) return Math.round(Number(esAlta_(fecha) ? p.precioAlta : p.precio) || 0);
    // Programa borrado a mano de la planilla: se sigue con la tarifa de la
    // pieza en vez de cobrar cero.
  }
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
  // Si la reserva es de un turista extranjero exento, las noches que se
  // agreguen tienen que entrar SIN IVA: la tarifa de lista lo lleva incluido,
  // y estirar la estadía no puede colarle el impuesto de vuelta.
  var suya = leer_('Reservas').filter(function (x) { return x.id === reserva.id; })[0];
  var sinIva = !!(suya && suya.exentoIva);

  var total = 0, agregadas = 0, quitadas = 0, nuevas = [], sobran = {};
  Object.keys(quiero).forEach(function (f) {
    if (actuales[f]) { total += actuales[f].valor; return; }
    var valor = tarifaDe_(reserva.recurso, f, suya && suya.programa);
    if (sinIva) valor = netoDe_(valor);
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

/* El plan que se puede MOSTRAR, exista o no en la planilla.

   Las reservas cargadas antes de que existiera el plan por noche no tienen
   filas en la hoja Noches. Leerlas tal cual daba "0 noches" en el
   comprobante y un alojamiento pendiente de cero en la cuenta, aunque la
   reserva tuviera fechas y total correctos. Acá se arma uno en memoria a
   partir de las fechas, repartiendo el total de la reserva, para que nada se
   vea vacío mientras setup() no haya reparado los datos. */
function planEfectivo_(reserva) {
  var guardado = planDe_(reserva.id);
  if (guardado.length) return guardado;

  var ci = ymd_(reserva.checkIn), co = ymd_(reserva.checkOut);
  if (!ci || !co || co <= ci) return [];

  var dias = [];
  for (var f = ci; f < co; f = sumarDias_(f, 1)) {
    dias.push({ fecha: f, valor: tarifaDe_(reserva.recurso, f, reserva.programa) });
  }
  // El total guardado ya viene neto si la reserva es exenta, así que
  // repartirlo alcanza; si no hay total, la tarifa de lista se netea.
  if (reserva.exentoIva) dias.forEach(function (d) { d.valor = netoDe_(d.valor); });
  var total = Math.round(Number(reserva.total) || 0);
  var valores = total > 0 ? repartir_(total, dias) : null;
  return dias.map(function (d) {
    return {
      idReserva: reserva.id, fecha: d.fecha,
      valor: valores ? valores[d.fecha] : d.valor,
      ajustada: false, nota: ''
    };
  });
}

/* Le repone el plan a UNA reserva, si le falta, usando las fechas y el total
   que tiene guardados en ese momento. Hay que llamarlo ANTES de tocarle las
   fechas: si se mueve primero, ya no hay forma de saber por qué noches se
   acordó el precio, y la reserva terminaría recotizada a tarifa de lista. */
function asegurarPlan_(idReserva) {
  if (planDe_(idReserva).length) return 0;
  var r = leer_('Reservas').filter(function (x) { return x.id === idReserva; })[0];
  if (!r) return 0;
  var plan = planEfectivo_(r);
  if (!plan.length) return 0;
  insertarVarias_('Noches', plan);
  return plan.length;
}

/* Les descuenta el IVA a las reservas de turistas extranjeros que todavía lo
   llevan incluido: las que se cargaron antes de que el sistema hiciera ese
   descuento. La columna 'sinIva' es la que evita repetirlo. */
function descontarIvaPendiente_() {
  var hechas = 0;
  leer_('Reservas').forEach(function (r) {
    if (!r.exentoIva || r.sinIva) return;
    if (r.estado === 'cancelada') return;
    convertirAlojamiento_(r.id, true);
    hechas++;
  });
  return hechas;
}

/* Le devuelve sus noches a las reservas que quedaron sin plan. Lo llama
   setup(), así que se arregla solo la próxima vez que alguien lo ejecute.
   Es idempotente: una reserva que ya tiene noches no se toca. */
function repararNoches_() {
  var conPlan = agrupar_('Noches', 'idReserva');
  var faltan = [];
  leer_('Reservas').forEach(function (r) {
    if (r.estado === 'cancelada') return;
    if ((conPlan[String(r.id)] || []).length) return;
    planEfectivo_(r).forEach(function (n) { faltan.push(n); });
  });
  if (!faltan.length) return 0;
  insertarVarias_('Noches', faltan);
  return faltan.length;
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
  var plan = planEfectivo_(r).map(function (n) {
    n.posteada = !!posteadas[n.fecha];
    n.tarifa = tarifaDe_(r.recurso, n.fecha, r.programa);
    return n;
  });
  var total = plan.reduce(function (a, n) { return a + n.valor; }, 0);
  return {
    idReserva: idReserva, noches: plan, total: Math.round(total),
    checkIn: ymd_(r.checkIn), checkOut: ymd_(r.checkOut),
    // El detalle noche a noche de un extranjero se muestra en dólares, igual
    // que su reserva y su cuenta: en pantalla no aparece un peso.
    extranjero: !!r.extranjero, dolar: Number(r.dolar) || dolarHoy_().valor,
    iva: ivaPct_()
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
function armarNoches_(idReserva, recurso, checkIn, checkOut, totalPedido, idPrograma) {
  var dias = [];
  for (var d = checkIn; d < checkOut; d = sumarDias_(d, 1)) {
    dias.push({ fecha: d, valor: tarifaDe_(recurso, d, idPrograma) });
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
   exentos, y en ese caso lo que se le cobra YA es el neto. */
function desglosarIva_(total, exento) {
  var t = Math.round(Number(total) || 0);
  if (exento) return { total: t, neto: t, iva: 0 };
  return { total: t, neto: netoDe_(t), iva: t - netoDe_(t) };
}

/* Le saca el IVA a un precio que lo lleva incluido. Es la cuenta que hay que
   hacer para cobrarle a un turista extranjero exento: la tarifa de la casa
   son $55.000 con IVA, y a él le corresponde pagar $46.218. */
function netoDe_(bruto) {
  return Math.round((Number(bruto) || 0) / (1 + ivaPct_() / 100));
}

function brutoDe_(neto) {
  return Math.round((Number(neto) || 0) * (1 + ivaPct_() / 100));
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
  // Con planEfectivo_ una reserva sin plan guardado no aparece como si no
  // debiera nada: lo que falta se calcula desde sus propias fechas.
  var pend = 0;
  planEfectivo_(reserva).forEach(function (n) { if (!puestas[n.fecha]) pend += n.valor; });
  return pend > 0 ? pend : 0;
}

function cuentaDe(token, idReserva) {
  sesion_(token);
  var r = leer_('Reservas').filter(function (x) { return x.id === idReserva; })[0];
  if (!r) throw new Error('No se encontró la reserva.');
  var movs = movimientosDe_(idReserva);

  var cargos = 0, pagos = 0, neto = 0, iva = 0, exentos = 0;
  var pagadoEnPesos = 0, pagadoEnDolares = 0;
  var porCentro = {};
  var lista = movs.map(function (m) {
    var total = Math.round(Number(m.total) || 0);
    if (m.clase === 'pago') {
      pagos += total;
      if (String(m.moneda) === 'USD') pagadoEnDolares += total; else pagadoEnPesos += total;
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
      moneda: String(m.moneda || ''), usd: Number(m.usd) || 0,
      creado: String(m.creado || ''), creadoPor: m.creadoPor || ''
    };
  }).sort(function (a, b) {
    if (a.fecha !== b.fecha) return a.fecha < b.fecha ? -1 : 1;
    return String(a.creado).localeCompare(String(b.creado));
  });

  var pendiente = alojamientoPendiente_(r, movs);
  var cambio = Number(r.dolar) || dolarHoy_().valor;
  var saldo = cargos - pagos;

  // El aviso que importa: la exención de IVA a turistas extranjeros solo vale
  // si el pago entró en moneda extranjera. Si se marcó exento y se le cobró
  // en pesos, hay que decirlo mientras el huésped todavía está en la casa.
  // El peso no aparece en la cifra: esta cuenta se lleva en dólares. Lo que
  // se avisa es el problema —que entró plata en pesos—, no cuánta.
  var avisoExencion = '';
  if (r.exentoIva && pagadoEnPesos > 0) {
    avisoExencion = 'Hay pagos anotados en pesos. Esta cuenta va exenta de IVA por ' +
      'tratarse de un turista extranjero, y la exención exige que el pago entre en ' +
      'moneda extranjera: hay que cobrarlo en dólares.';
  } else if (r.exentoIva && pagos === 0) {
    avisoExencion = 'Cuenta exenta de IVA por turista extranjero. Para que la ' +
      'exención valga, el pago tiene que entrar en dólares.';
  }

  return {
    idReserva: idReserva, huesped: r.huesped,
    noches: noches_(ymd_(r.checkIn), ymd_(r.checkOut)),
    exentoIva: !!r.exentoIva, docTurismo: String(r.docTurismo || ''),
    // La cuenta de un turista extranjero se lleva en dólares de punta a
    // punta: él no cotiza en pesos, no paga en pesos y no tiene por qué ver
    // una cifra en pesos que después no le calza con lo que le cobraron.
    extranjero: !!r.extranjero, dolar: cambio,
    moneda: r.extranjero ? 'USD' : 'CLP',
    docs: estadoDocs_(docsDeReserva_(idReserva), !!r.extranjero),
    pagadoEnPesos: pagadoEnPesos, pagadoEnDolares: pagadoEnDolares,
    avisoExencion: avisoExencion,
    ivaPct: ivaPct_(),
    movimientos: lista,
    cargos: cargos, pagos: pagos, saldo: saldo,
    saldoUsd: aUsd_(saldo, cambio),
    neto: neto, iva: iva, exentos: exentos,
    porCentro: porCentro,
    alojamientoAcordado: Math.round(Number(r.total) || 0),
    alojamientoPendiente: pendiente,
    // Lo que quedaría por cobrar si la estadía se completa tal como está.
    saldoProyectado: saldo + pendiente,
    saldoProyectadoUsd: aUsd_(saldo + pendiente, cambio)
  };
}

/* "1 noche" y "2 noches", no "1 noche(s)": estos textos los lee gente. */
function plural_(n, uno, varios) {
  return n + ' ' + (Number(n) === 1 ? uno : varios);
}

function plataTxt_(n) {
  return '$' + String(Math.round(Number(n) || 0)).replace(/\B(?=(\d{3})+(?!\d))/g, '.');
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
    creado: ahora_(), creadoPor: quien || '',
    moneda: mov.moneda || '', usd: Number(mov.usd) || 0
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
  // La cuenta de un turista extranjero se lleva en dólares, así que el monto
  // puede llegar en US$. La planilla se guarda siempre en pesos: es la moneda
  // en la que se declara y en la que se leen los informes de la casa.
  var unitario;
  if (String(d.moneda || '') === 'USD') {
    unitario = Math.round((Number(d.unitario) || 0) * (Number(r.dolar) || dolarHoy_().valor));
  } else {
    unitario = Math.round(Number(d.unitario) || 0);
  }
  if (unitario <= 0) throw new Error('El monto tiene que ser mayor que cero.');

  var id = anotar_(idReserva, {
    clase: 'cargo', tipo: tipo,
    centro: d.centro || TIPOS_CARGO[tipo].centro,
    descripcion: String(d.descripcion || TIPOS_CARGO[tipo].rotulo),
    cantidad: cantidad, unitario: unitario, total: unitario * cantidad,
    exento: d.exento === undefined ? exentoPorDefecto_(r, tipo) : !!d.exento,
    fecha: ymd_(d.fecha) || hoy_()
  }, u.nombre);
  logCambio_(u.nombre, 'cargo', idReserva + ' · ' + tipo + ' · ' + (unitario * cantidad));
  return { id: id };
}

/* Qué cargos salen exentos cuando el huésped es turista extranjero.
   La exención del DL 825 cubre el servicio de alojamiento y lo que va
   incluido en él; el restaurante, el bar y la tinaja se venden aparte y
   llevan IVA. Por eso no basta con mirar al huésped: hay que mirar QUÉ se
   le está cobrando. */
var TIPOS_EXENTOS = { alojamiento: 1 };

function exentoPorDefecto_(reserva, tipo) {
  return !!reserva.exentoIva && !!TIPOS_EXENTOS[tipo];
}

/* Un pago puede entrar en pesos o en dólares. La distinción no es cosmética:
   la exención de IVA a turistas extranjeros exige que el pago haya sido en
   moneda extranjera, así que un exento pagado en pesos es un problema y el
   sistema tiene que poder decirlo. */
function agregarPago(token, idReserva, d) {
  var u = sesion_(token);
  var r = leer_('Reservas').filter(function (x) { return x.id === idReserva; })[0];
  if (!r) throw new Error('No se encontró la reserva.');
  var medio = MEDIOS_PAGO.indexOf(d.medio) > -1 ? d.medio : 'otro';
  var moneda = String(d.moneda || 'CLP').toUpperCase() === 'USD' ? 'USD' : 'CLP';
  var cambio = Number(r.dolar) || dolarHoy_().valor;

  // En dólares se escribe el monto en USD y se convierte; en pesos, al revés.
  var monto, usd;
  if (moneda === 'USD') {
    usd = Math.round((Number(d.monto) || 0) * 100) / 100;
    if (usd <= 0) throw new Error('El monto del pago tiene que ser mayor que cero.');
    monto = Math.round(usd * cambio);
  } else {
    monto = Math.round(Number(d.monto) || 0);
    if (monto <= 0) throw new Error('El monto del pago tiene que ser mayor que cero.');
    usd = aUsd_(monto, cambio);
  }

  // La descripción no lleva el tipo de cambio escrito: en la cuenta de un
  // extranjero no puede aparecer una cifra en pesos, y la columna de al lado
  // ya dice cuántos dólares entraron. El cambio queda en la bitácora.
  var id = anotar_(idReserva, {
    clase: 'pago', tipo: 'pago', centro: '',
    descripcion: String(d.descripcion || 'Pago'),
    cantidad: 1, unitario: monto, total: monto, medio: medio,
    moneda: moneda, usd: usd,
    fecha: ymd_(d.fecha) || hoy_()
  }, u.nombre);
  sincronizarAnticipo_(idReserva);
  logCambio_(u.nombre, 'pago', idReserva + ' · ' + medio + ' · ' + moneda + ' ' + monto);
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

  var noche = planEfectivo_(reserva).filter(function (n) { return n.fecha === fecha; })[0];
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

/* Marca de turista extranjero exento de IVA. Se acredita con el pasaporte y
   la tarjeta de turismo que entrega la PDI al entrar al país.

   Marcarlo a mitad de la estadía arrastra los cargos que ya estaban
   anotados: si no, la cuenta saldría mitad con IVA y mitad sin, que es
   justamente lo que no se puede llevar a una boleta. Pero solo arrastra los
   que corresponde — el alojamiento —, porque el restaurante y el bar se
   venden aparte y llevan IVA igual. */
function marcarExentoIva(token, idReserva, exento, docTurismo) {
  var u = sesion_(token);
  var r = leer_('Reservas').filter(function (x) { return x.id === idReserva; })[0];
  if (!r) throw new Error('No se encontró la reserva.');
  actualizar_('Reservas', 'id', idReserva, {
    exentoIva: !!exento, docTurismo: String(docTurismo || ''),
    // 'extranjero' es la casilla del formulario de reserva y 'exentoIva' la
    // marca de la cuenta: son el MISMO dato mirado desde dos pantallas. Si no
    // se mueven juntos, guardar la reserva después de marcarla en la cuenta
    // la desmarca sin avisar.
    extranjero: !!exento,
    // Si nunca se le fijó un tipo de cambio, se le fija ahora.
    dolar: Number(r.dolar) || (exento ? dolarHoy_().valor : 0)
  });
  movimientosDe_(idReserva).forEach(function (m) {
    if (m.clase !== 'cargo') return;
    var debeSer = !!exento && !!TIPOS_EXENTOS[m.tipo];
    if (!!m.exento === debeSer) return;
    actualizar_('Cuenta', 'id', m.id, { exento: debeSer });
  });

  // Y el alojamiento cambia de precio, no solo de etiqueta: las tarifas de la
  // casa llevan IVA incluido, así que al exento le corresponde el neto.
  // convertirAlojamiento_ se fija en la columna 'sinIva', así que llamarlo de
  // más no hace nada: no descuenta dos veces ni devuelve lo que no sacó.
  var total = convertirAlojamiento_(idReserva, !!exento);
  logCambio_(u.nombre, 'iva_exento', idReserva + ' · ' + (exento ? 'sí' : 'no') +
    ' · alojamiento ' + (exento ? 'sin' : 'con') + ' IVA: ' + total);
  return true;
}

/* Pasa el alojamiento de una reserva de con IVA a sin IVA, o al revés: las
   noches del plan y los cargos de alojamiento que ya estuvieran anotados.
   Devuelve el total que quedó. */
function convertirAlojamiento_(idReserva, aNeto) {
  var r = leer_('Reservas').filter(function (x) { return x.id === idReserva; })[0];
  if (!r) return 0;
  // El seguro contra descontar el IVA dos veces —o devolverlo sin haberlo
  // sacado—: si el alojamiento ya está como se pide, no se toca.
  if (!!r.sinIva === !!aNeto) return Math.round(Number(r.total) || 0);

  var nuevos = {};
  planDe_(idReserva).forEach(function (n) {
    nuevos[n.fecha] = aNeto ? netoDe_(n.valor) : brutoDe_(n.valor);
  });
  if (!Object.keys(nuevos).length) {
    actualizar_('Reservas', 'id', idReserva, { sinIva: !!aNeto });
    return Math.round(Number(r.total) || 0);
  }

  actualizarVarias_('Noches', function (n) {
    if (String(n.idReserva) !== String(idReserva)) return null;
    var f = ymd_(n.fecha);
    if (nuevos[f] === undefined) return null;
    return { valor: nuevos[f] };
  });
  actualizarVarias_('Cuenta', function (m) {
    if (String(m.idReserva) !== String(idReserva) || m.anulado) return null;
    if (m.clase !== 'cargo' || m.tipo !== 'alojamiento') return null;
    var f = ymd_(m.fecha);
    if (nuevos[f] === undefined) return null;
    return { unitario: nuevos[f], total: nuevos[f] };
  });

  var total = totalDelPlan_(idReserva);
  actualizar_('Reservas', 'id', idReserva, { total: total, sinIva: !!aNeto });
  return total;
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
          texto: 'Faltan ' + (esperados - anotados) + ' de ' +
                 plural_(esperados, 'acompañante', 'acompañantes') + ' por registrar.' });
      }
    }
    // Un exento que pagó en pesos pierde la exención. Mejor saberlo mientras
    // todavía está alojado y se puede arreglar, que al cerrar el mes.
    if (ci <= dia && co >= dia && r.exentoIva) {
      var enPesos = 0;
      movimientosDe_(r.id).forEach(function (m) {
        if (m.clase === 'pago' && String(m.moneda) !== 'USD') enPesos += Number(m.total) || 0;
      });
      if (enPesos > 0) {
        avisos.push({ tipo: 'exento_en_pesos', idReserva: r.id, huesped: r.huesped,
          monto: enPesos,
          texto: 'Marcado exento de IVA pero pagó ' + plataTxt_(enPesos) + ' en pesos: ' +
                 'la exención exige pago en moneda extranjera.' });
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

/* Convierte el HTML en un PDF y devuelve el archivo en bruto, SIN pasar por
   Drive. Es lo que se le entrega al navegador para que lo baje al tiro: no
   hay que esperar a que Drive lo guarde ni a que lo comparta, ni el huésped
   termina mirando un visor de Google.

   La conversión de Google a veces se atraganta con el logo incrustado, así
   que si falla se reintenta sin él. */
function pdfEnBruto_(html, nombreArchivo) {
  try {
    return { blob: Utilities.newBlob(html, 'text/html', nombreArchivo + '.html')
                     .getAs('application/pdf').setName(nombreArchivo + '.pdf'),
             aviso: '' };
  } catch (e1) {
    var sinLogo = html.replace(/<img class="logo"[^>]*>/, '<h1>Casona Peumayén</h1>');
    return { blob: Utilities.newBlob(sinLogo, 'text/html', nombreArchivo + '.html')
                     .getAs('application/pdf').setName(nombreArchivo + '.pdf'),
             aviso: 'El PDF se generó sin el logo: la conversión de Google no lo ' +
                    'aceptó (' + String(e1.message || e1) + ').' };
  }
}

/* El PDF listo para mandárselo al navegador: los bytes en base64 y el nombre
   con que se va a guardar. */
function pdfParaBajar_(html, nombreArchivo) {
  var r = pdfEnBruto_(html, nombreArchivo);
  return {
    nombre: nombreArchivo + '.pdf',
    datos: Utilities.base64Encode(r.blob.getBytes()),
    aviso: r.aviso
  };
}

/* Convierte el HTML en PDF y lo deja en Drive. Se usa para lo que es archivo
   —el cierre que sale por correo de madrugada, las fichas firmadas—, donde
   el documento necesita quedar guardado y nadie está esperando delante de la
   pantalla. Lo que se genera a pedido no pasa por acá.

   Si la conversión no se puede hacer de ninguna forma, se guarda el
   documento como página web para no dejar a nadie sin su comprobante. El
   motivo del fallo se devuelve, en vez de quedar en silencio. */
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

  // Drive ya NO hace falta para el comprobante ni para el cierre que se bajan
  // desde la pantalla: esos se arman y se entregan al navegador. Sigue
  // haciendo falta para el archivo —el cierre que sale por correo— y para
  // guardar las fotos de pasaporte, así que se revisa, pero sin cortar acá:
  // que Drive falle no significa que el comprobante no funcione.
  try { carpetaDocs_(hoy_(), 'Cierres');
        anotar('Acceso a Drive', true,
               'Disponible. Se usa para archivar los cierres y los documentos de huéspedes.'); }
  catch (e) {
    anotar('Acceso a Drive', false, String(e.message || e) +
      ' · El comprobante y el cierre se pueden bajar igual: no pasan por Drive.');
  }

  try {
    Utilities.newBlob('<html><body><p>prueba</p></body></html>', 'text/html', 'prueba.html')
      .getAs('application/pdf');
    anotar('Convertir a PDF', true, 'La conversión funciona.');
  } catch (e) {
    anotar('Convertir a PDF', false, String(e.message || e));
    return { ok: false, pasos: pasos,
      mensaje: 'Este proyecto no puede convertir a PDF, así que el comprobante y el ' +
        'cierre no se van a poder generar. Error exacto: ' + String(e.message || e) };
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

/* Devuelve el PDF mismo, no un enlace. Antes se guardaba en Drive y se abría
   su visor: había que esperar a que Drive lo creara y lo compartiera —con
   una pestaña en blanco mientras tanto— y el archivo terminaba viviendo allá.
   Ahora el comprobante llega al navegador y se baja como cualquier archivo,
   listo para adjuntarlo en un WhatsApp. */
function comprobante(token, idReserva) {
  var u = sesion_(token);
  var d = armarComprobante_(idReserva);
  var doc = pdfParaBajar_(d.html, 'Reserva ' + limpiarNombre_(d.huesped) + ' ' + d.checkIn);
  logCambio_(u.nombre, 'comprobante', idReserva);
  return { nombre: doc.nombre, datos: doc.datos, aviso: doc.aviso, huesped: d.huesped };
}

function armarComprobante_(idReserva) {
  var r = leer_('Reservas').filter(function (x) { return x.id === idReserva; })[0];
  if (!r) throw new Error('No se encontró la reserva.');

  var rec = recursos_().filter(function (x) { return x.id === r.recurso; })[0];
  // planEfectivo_ y no planDe_: una reserva vieja sin filas en Noches salía
  // con "0 noches" y sin el detalle, aunque su total estuviera bien.
  var plan = planEfectivo_(r);
  var entrada = hora_(config_('checkIn'), '15:00');
  var salida = hora_(config_('checkOut'), '11:00');
  var reglas = reglamento().es;
  var pagado = 0;
  movimientosDe_(idReserva).forEach(function (m) {
    if (m.clase === 'pago') pagado += Number(m.total) || 0;
  });
  var total = Math.round(Number(r.total) || 0);
  var cambioR = Number(r.dolar) || dolarHoy_().valor;
  // El programa con el que se vendió, si lo hubo. El nombre sale de la copia
  // congelada en la reserva —para que siga diciendo lo mismo aunque después
  // se archive o se le cambie el nombre— y lo que incluye se lee del
  // programa, que es lo que el huésped quiere ver escrito.
  var prog = programaPorId_(r.programa);
  var incluye = incluyeDe_(prog);

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
    '<tr><td>Personas</td><td class="n">' + (Number(r.pax) || 1) +
      (Number(r.ninos) ? ' + ' + Number(r.ninos) + ' menor(es) de 6' : '') + '</td></tr>' +
    (r.programa || r.programaNombre
      ? '<tr><td>Programa</td><td class="n">' +
        escapar_(String(r.programaNombre || (prog ? prog.nombre : ''))) + '</td></tr>'
      : '') +
    '</table>' +
    // Lo que el programa promete, tal como se escribió en Configuración. Es
    // la parte que el huésped va a leer con más atención.
    (incluye.length
      ? '<h2>Tu programa incluye</h2><ul class="reglas">' +
        incluye.map(function (x) { return '<li>' + escapar_(x) + '</li>'; }).join('') +
        '</ul>'
      : '') +
    (acompanantes.length
      ? '<h2>Quiénes se alojan</h2><table><tr><td>' + escapar_(r.huesped) +
        ' <span style="color:#6b7280">(titular)</span></td></tr>' +
        acompanantes.map(function (a) { return '<tr><td>' + escapar_(a.nombre) + '</td></tr>'; }).join('') +
        '</table>'
      : '') +
    '<h2>Valor</h2>' +
    // Al turista extranjero se le cotiza en dólares y nada más: el peso
    // chileno no aparece en su comprobante, porque no es la moneda en que
    // reservó ni en la que va a pagar, y ponerlo al lado solo confunde.
    (r.extranjero
      ? '<table><tr><th>Noche</th><th class="n">USD</th></tr>' +
        plan.map(function (n) {
          return '<tr><td>' + escapar_(n.fecha) + (n.nota ? ' · ' + escapar_(n.nota) : '') +
                 '</td><td class="n">' + usd_(n.valor, cambioR) + '</td></tr>';
        }).join('') +
        '<tr class="tot"><td>Total</td><td class="n">' + usd_(total, cambioR) + '</td></tr>' +
        (pagado ? '<tr><td>Abonado</td><td class="n">' + usd_(pagado, cambioR) + '</td></tr>' +
                  '<tr><td><b>Saldo al llegar</b></td><td class="n"><b>' +
                  usd_(total - pagado, cambioR) + '</b></td></tr>' : '') +
        '</table>' +
        '<p style="color:#6b7280;font-size:12.5px">Precios en dólares, <b>sin impuestos</b>: ' +
        'los servicios prestados a turistas extranjeros sin domicilio en Chile están exentos ' +
        'de IVA (DL 825, art. 12 E N°17). El pago debe hacerse en moneda extranjera.</p>'
      : '<table><tr><th>Noche</th><th class="n">Valor</th></tr>' + filas +
        '<tr class="tot"><td>Total</td><td class="n">' + plata_(total) + '</td></tr>' +
        (pagado ? '<tr><td>Abonado</td><td class="n">' + plata_(pagado) + '</td></tr>' +
                  '<tr><td><b>Saldo al llegar</b></td><td class="n"><b>' +
                  plata_(total - pagado) + '</b></td></tr>' : '') +
        '</table>') +
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

/* ---------- Resumen de la noche, para el dueño ---------- */
/* El cierre que se pide desde la pantalla se baja como archivo, igual que el
   comprobante. El que sale solo por correo de madrugada sí se archiva en
   Drive: ese es un archivo de verdad y nadie lo está esperando. */
function pdfCierre(token, fecha) {
  sesion_(token);
  var dia = ymd_(fecha) || hoy_();
  return pdfParaBajar_(armarCierre_(dia), 'Cierre ' + dia);
}

function pdfCierre_(dia) {
  return pdfDesdeHtml_(armarCierre_(dia), 'Cierre ' + dia, false, dia, 'Cierres');
}

function armarCierre_(dia) {
  var d = resumenDia_(dia);
  var rotulo = {
    sin_llegar: 'No se registró la llegada', sin_salir: 'No se marcó el check-out',
    sin_firma: 'Ficha sin firmar', sin_acompanantes: 'Faltan acompañantes por registrar',
    saldo: 'Se fue con saldo pendiente', sucia: 'Habitación sucia',
    exento_en_pesos: 'Exento de IVA pagado en pesos'
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
      ', cobrado ' + plata_(d.pagos) + '. ' +
      plural_(d.avisos.length, 'punto', 'puntos') + ' por revisar.',
    htmlBody: '<p>Resumen de la noche del <b>' + dia + '</b>:</p><ul>' +
      '<li>Alojamiento: ' + plata_(d.alojamiento) + '</li>' +
      '<li>Consumos: ' + plata_(d.consumos) + '</li>' +
      '<li>Cobrado en el día: ' + plata_(d.pagos) + '</li>' +
      '<li>Lodge ' + plata_((d.porCentro || {}).lodge || 0) +
      ' · restaurante ' + plata_((d.porCentro || {}).restaurante || 0) + '</li>' +
      '<li>' + plural_(d.avisos.length, 'punto', 'puntos') + ' por revisar</li></ul>' +
      '<p>El detalle va adjunto.</p>',
    attachments: [DriveApp.getFileById(doc.id).getBlob()]
  });
  return { enviado: para, url: doc.url, avisos: d.avisos.length,
           tipo: doc.tipo, aviso: doc.aviso };
}

/* ---------- El cierre, al grupo de Telegram ----------

   El mismo PDF que se le manda al dueño por correo, pero al grupo. Va con un
   resumen de una mirada en el mensaje, porque nadie abre un PDF en el
   teléfono para enterarse de cuánto se hizo: el archivo es para guardarlo y
   revisarlo después, el texto es para leerlo ahora.

   Si el PDF no se pudo generar —Drive caído, la conversión de Google
   fallando— igual se manda el texto. Enterarse de los números sin el adjunto
   es infinitamente mejor que no enterarse de nada. */
function cierreATelegram_(dia) {
  var d = resumenDia_(dia);
  var lineas = [
    '📕 <b>Cierre de la noche del ' + escTg_(fechaTg_(dia)) + '</b>', '',
    '🏠 Alojamiento: ' + plataTxt_(d.alojamiento),
    '🍽 Consumos: ' + plataTxt_(d.consumos),
    '💵 Cobrado en el día: ' + plataTxt_(d.pagos)
  ];
  var centros = d.porCentro || {};
  if (centros.lodge || centros.restaurante) {
    lineas.push('   lodge ' + plataTxt_(centros.lodge || 0) +
                '  ·  restaurante ' + plataTxt_(centros.restaurante || 0));
  }
  lineas.push((d.avisos || []).length
    ? '⚠️ ' + plural_(d.avisos.length, 'punto', 'puntos') + ' por revisar'
    : '✅ Sin puntos por revisar');

  var texto = lineas.join('\n');
  var doc = null;
  try { doc = pdfCierre_(dia); } catch (e) { /* sin PDF se manda el texto igual */ }

  if (doc && doc.tipo === 'pdf') {
    try {
      var blob = DriveApp.getFileById(doc.id).getBlob();
      if (telegramDocumento_(blob, texto)) return { mandado: true, conPdf: true };
    } catch (e) { /* si el archivo no se puede leer, queda el texto */ }
  }
  var ok = avisar_('cierre', texto + (doc ? '' :
    '\n\n(No se pudo generar el PDF; el detalle está en la app.)'));
  return { mandado: ok, conPdf: false };
}

function cierreATelegram(token, fecha) {
  var u = sesion_(token);
  exigirAdmin_(u);
  if (!telegramActivo_()) {
    throw new Error('El bot de Telegram todavía no está conectado. Se configura ' +
      'en Configuración → Avisos al grupo de Telegram.');
  }
  var dia = ymd_(fecha) || hoy_();
  var r = cierreATelegram_(dia);
  logCambio_(u.nombre, 'cierre_telegram', dia + (r.conPdf ? ' con PDF' : ' solo texto'));
  return r;
}

/* ===================== DÍA DE HOY ===================== */

function panelHoy(token, fecha) {
  sesion_(token);
  return panelHoy_(ymd_(fecha) || hoy_());
}

/* El mismo panel, sin sesión: lo necesita el resumen que sale solo a las ocho
   de la mañana, que no lo pide nadie desde una pantalla. */
function panelHoy_(dia) {
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
      programa: String(r.programaNombre || ''),
      saldo: (Number(r.total) || 0) - (Number(r.anticipo) || 0),
      // Con qué moneda se le habla a este huésped. Es la pantalla que mira
      // recepción cuando alguien llega o se va, así que es JUSTO donde el
      // saldo tiene que estar en la moneda en que se le va a cobrar.
      extranjero: !!r.extranjero, dolar: Number(r.dolar) || 0,
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
    // Las que llegan con un programa contratado: hay que tenerlo preparado.
    programas: todas.filter(function (r) {
      return r.programa && ymd_(r.checkIn) >= dia && r.estado !== 'checkout';
    }).map(mapear)
  };
}



/* ===================== ÓRDENES DESDE EL GRUPO =====================

   Hasta acá la conversación era de una sola vía: la app le hablaba a Telegram.
   Esto es la vuelta — escribir una orden en el grupo y que la app la ejecute.
   Sirve para lo que de verdad pasa: estás al teléfono con alguien que quiere
   una pieza para el fin de semana, y necesitas bloquearla AHORA, no cuando
   llegues al computador.

   CÓMO LLEGA. Telegram avisa por webhook: apenas alguien escribe en el grupo,
   llama a la dirección de esta misma app web. Es instantáneo y no gasta la
   cuota de tareas automáticas que ya usa Booking. Por eso hay un doPost.

   CÓMO SE PROTEGE, que es lo delicado. La app web es pública —tiene que
   serlo, si no Telegram no podría llamarla— así que hay tres cercos:

     1. La dirección lleva una clave de 32 caracteres. Sin ella, ni se mira
        el contenido.
     2. Solo se atienden mensajes del grupo configurado. De cualquier otro
        chat, nada.
     3. Solo obedecen las órdenes de una lista de personas autorizadas. Este
        es el cerco que de verdad importa: aunque alguien diera con la
        dirección, sin estar en la lista no puede crear nada.

   Apps Script no deja leer las cabeceras de una petición, así que el
   'secret_token' que ofrece Telegram para esto no se puede usar: por eso la
   clave va en la dirección. Es la misma protección del calendario de Booking,
   con la lista de autorizados encima porque acá no se lee, se escribe.

   RESPONDER SIEMPRE. Una orden sin respuesta es peor que una orden que falla:
   quien la escribió no sabe si quedó o no, y termina yendo al computador a
   revisar. Todo camino de acá abajo contesta algo. */

function claveTelegramWeb_() {
  var c = String(config_('telegramClaveWeb', '') || '');
  if (!c) {
    c = codigoCorto_(32);
    guardarOCrear_('Config', 'clave', 'telegramClaveWeb', { clave: 'telegramClaveWeb', valor: c });
    olvidarConfig_();
  }
  return c;
}

function telegramOrdenesActivas_() { return String(config_('telegramOrdenes', 'no')) === 'si'; }

function telegramAutorizados_() {
  try {
    var l = JSON.parse(String(config_('telegramAutorizados', '') || '[]'));
    return l.map(function (x) { return String(x.id); });
  } catch (e) { return []; }
}

function telegramAutorizadosLista_() {
  try { return JSON.parse(String(config_('telegramAutorizados', '') || '[]')); }
  catch (e) { return []; }
}

function telegramAutorizado_(id) {
  return telegramAutorizados_().indexOf(String(id)) > -1;
}

/* ---------- La puerta ---------- */
function doPost(e) {
  /* Telegram solo necesita un 200. Todo lo demás se resuelve contestando en
     el grupo, así que acá no se devuelve nada útil ni se lanza nunca: un
     error sin atrapar haría que Telegram reintentara el mismo mensaje una y
     otra vez, y una orden de reservar se ejecutaría varias veces.

     Y se contesta con HtmlService y NO con ContentService, aunque no haya
     nada de HTML que devolver. Con ContentService, Google contesta un 302
     que redirige a otro servidor suyo. Un navegador lo sigue sin que se note,
     pero Telegram NO sigue redirecciones en un webhook: lo toma como error,
     no entrega el mensaje y lo deja en cola. Es exactamente lo que pasaba —
     "Wrong response from the webhook: 302 Found"— y la única señal era que el
     bot no contestaba nada. */
  var vacio = HtmlService.createHtmlOutput('');
  try {
    var p = (e && e.parameter) || {};
    if (!p.tg || String(p.tg) !== claveTelegramWeb_()) return vacio;
    if (!telegramOrdenesActivas_()) return vacio;
    if (!e.postData || !e.postData.contents) return vacio;

    var upd = JSON.parse(e.postData.contents);
    // Solo mensajes nuevos. Un mensaje editado volvería a ejecutar la orden.
    var msg = upd && upd.message;
    if (!msg || !msg.text || !msg.chat) return vacio;
    if (String(msg.chat.id) !== telegramChat_()) return vacio;

    var texto = String(msg.text).trim();
    if (texto.charAt(0) !== '/') return vacio;      // conversación normal

    /* Una orden vieja NO se ejecuta. Cuando el webhook estuvo caído, Telegram
       guarda los mensajes y los entrega todos juntos apenas vuelve. Sin esto,
       arreglar la conexión haría que se ejecutaran de golpe todas las órdenes
       de prueba de las últimas horas, creando reservas que nadie pidió. */
    var edad = (new Date().getTime() / 1000) - Number(msg.date || 0);
    if (msg.date && edad > 600) {
      telegramResponder_('⌛ Esa orden es de hace ' + Math.round(edad / 60) +
        ' minutos y no la ejecuté, por si acaso. Si la sigues necesitando, ' +
        'vuelve a escribirla.', msg.message_id);
      return vacio;
    }

    var quien = msg.from || {};
    var nombre = String(quien.first_name || '') +
                 (quien.last_name ? ' ' + quien.last_name : '');
    nombre = nombre.trim() || String(quien.username || 'alguien');

    if (!telegramAutorizado_(quien.id)) {
      telegramResponder_(
        '🔒 <b>No estás en la lista</b>\n\n' +
        'Tu número de Telegram es <code>' + escTg_(String(quien.id)) + '</code>\n\n' +
        'Pídele a administración que lo agregue en Configuración → Avisos al grupo ' +
        '→ Órdenes desde el grupo.', msg.message_id);
      return vacio;
    }

    telegramOrden_(texto, nombre, msg.message_id);
    return vacio;
  } catch (err) {
    try {
      telegramMandar_('⚠️ Algo se cayó procesando esa orden: ' +
                      escTg_(String(err.message || err)));
    } catch (e2) {}
    return vacio;
  }
}

/* Contesta en el grupo, colgado del mensaje que lo pidió. Va directo y no por
   avisar_(): esto es la respuesta a una orden, no un aviso que se pueda
   apagar desde Configuración. */
function telegramResponder_(texto, responderA) {
  if (!telegramActivo_()) return false;
  try {
    var carga = {
      chat_id: telegramChat_(), text: texto,
      parse_mode: 'HTML', disable_web_page_preview: 'true'
    };
    if (responderA) carga.reply_to_message_id = String(responderA);
    var r = UrlFetchApp.fetch(
      'https://api.telegram.org/bot' + telegramToken_() + '/sendMessage',
      { method: 'post', muteHttpExceptions: true, payload: carga });
    return r.getResponseCode() === 200;
  } catch (e) { return false; }
}

/* ---------- Repartir la orden ---------- */
function telegramOrden_(texto, quien, msgId) {
  var m = texto.match(/^\/([a-zA-ZñÑáéíóú]+)(?:@\S+)?\s*([\s\S]*)$/);
  if (!m) return telegramResponder_(TG_AYUDA_, msgId);
  var orden = m[1].toLowerCase().replace(/[áàä]/g,'a').replace(/[éèë]/g,'e')
                                .replace(/[íìï]/g,'i').replace(/[óòö]/g,'o')
                                .replace(/[úùü]/g,'u').replace(/ñ/g,'n');
  var resto = String(m[2] || '').trim();

  if (orden === 'ayuda' || orden === 'start' || orden === 'help') {
    return telegramResponder_(TG_AYUDA_, msgId);
  }
  if (orden === 'hoy') {
    var parte = armarResumenDia_(hoy_());
    return telegramResponder_(parte || '🌙 Hoy no hay nadie alojado ni llega o se va nadie.', msgId);
  }
  if (orden === 'libres') return tgLibres_(resto, msgId);
  if (orden === 'buscar') return tgBuscar_(resto, msgId);
  if (orden === 'reservar') return tgReservar_(resto, quien, msgId);

  return telegramResponder_('No conozco la orden <code>/' + escTg_(orden) + '</code>.\n\n' +
                            TG_AYUDA_, msgId);
}

var TG_AYUDA_ = [
  '🏡 <b>Órdenes de Casona Peumayén</b>', '',
  '<b>/reservar</b> pieza desde hasta nombre',
  '   <code>/reservar hab3 12/09 14/09 Juan Pérez</code>',
  '   Agrega <code>2p</code> para decir cuántas personas.', '',
  '<b>/libres</b> desde hasta',
  '   <code>/libres 12/09 14/09</code>', '',
  '<b>/buscar</b> nombre',
  '   <code>/buscar juan</code>', '',
  '<b>/hoy</b> — el parte del día, cuando quieras', '',
  'Las fechas valen como <code>12/09</code>, <code>12-09</code> o ' +
  '<code>2026-09-12</code>. Sin año, se entiende la próxima vez que llegue ese día.'
].join('\n');

/* ---------- Leer una fecha escrita a la rápida ----------
   Nadie va a escribir "2026-09-12" desde el teléfono con alguien esperando al
   otro lado del fono. Se aceptan las formas que uno escribe de verdad, y sin
   año se toma la próxima vez que llegue ese día: pedir una pieza para una
   fecha ya pasada no tiene sentido. */
function tgFecha_(txt, hoyYmd) {
  var t = String(txt || '').trim().toLowerCase();
  var hoy = hoyYmd || hoy_();
  if (t === 'hoy') return hoy;
  if (t === 'manana' || t === 'mañana') return sumarDias_(hoy, 1);

  var m = t.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (m) return tgArmarFecha_(m[1], m[2], m[3]);

  m = t.match(/^(\d{1,2})[\/\-.](\d{1,2})(?:[\/\-.](\d{2,4}))?$/);
  if (!m) return '';
  var dia = m[1], mes = m[2];

  if (m[3]) return tgArmarFecha_(m[3].length === 2 ? '20' + m[3] : m[3], mes, dia);

  // Sin año: este año, y si ya pasó, el que viene. Pedir una pieza para una
  // fecha que ya pasó no tiene sentido; lo que se quiere es la próxima.
  var esteAnio = Number(hoy.slice(0, 4));
  var f = tgArmarFecha_(esteAnio, mes, dia);
  if (f && f < hoy) f = tgArmarFecha_(esteAnio + 1, mes, dia);
  return f;
}

/* Arma la fecha y comprueba que EXISTA. Un 31 de febrero pasa cualquier
   validación de rangos —el mes está entre 1 y 12, el día entre 1 y 31— y
   después se cuela hasta la reserva. Construyéndola y mirando si el
   calendario la devolvió igual, el 31 de febrero se cae solo: Date lo
   convierte en marzo y los números dejan de calzar. */
function tgArmarFecha_(anio, mes, dia) {
  var a = Number(anio), m = Number(mes), d = Number(dia);
  if (!(a >= 1900 && a <= 2200) || !(m >= 1 && m <= 12) || !(d >= 1 && d <= 31)) return '';
  var f = new Date(a, m - 1, d, 12, 0, 0);
  if (f.getFullYear() !== a || f.getMonth() !== m - 1 || f.getDate() !== d) return '';
  return a + '-' + ('0' + m).slice(-2) + '-' + ('0' + d).slice(-2);
}

/* Encontrar la pieza por como la nombra la gente: "hab3", "hab 3",
   "habitacion 3", "carpa a", o el número solo. */
function tgNormalizar_(s) {
  return String(s || '').toLowerCase()
    .replace(/[áàä]/g,'a').replace(/[éèë]/g,'e').replace(/[íìï]/g,'i')
    .replace(/[óòö]/g,'o').replace(/[úùü]/g,'u').replace(/ñ/g,'n')
    .replace(/[^a-z0-9]/g, '');
}

function tgRecurso_(txt) {
  var busca = tgNormalizar_(txt);
  if (!busca) return null;
  var recs = recursos_();

  // Primero el nombre completo, después la unidad sola, y al final el número
  // suelto. El orden importa: "7" tiene que dar la Habitación 7 y no la
  // primera pieza que contenga un 7 en cualquier parte.
  var exacto = recs.filter(function (r) {
    return tgNormalizar_(r.unidad + (r.nombre || '')) === busca ||
           tgNormalizar_(r.unidad) === busca;
  });
  if (exacto.length === 1) return exacto[0];

  var soloNumero = busca.match(/^(?:hab|habitacion|pieza)?(\d{1,2})$/);
  if (soloNumero) {
    var n = soloNumero[1];
    var porNumero = recs.filter(function (r) {
      var mm = String(r.unidad).match(/(\d{1,2})/);
      return mm && mm[1] === n;
    });
    if (porNumero.length === 1) return porNumero[0];
    if (porNumero.length > 1) return { ambiguo: porNumero };
  }

  var parcial = recs.filter(function (r) {
    return tgNormalizar_(r.unidad + (r.nombre || '')).indexOf(busca) > -1;
  });
  if (parcial.length === 1) return parcial[0];
  if (parcial.length > 1) return { ambiguo: parcial };
  return null;
}

/* Las dos fechas de una orden, vengan donde vengan. Devuelve también qué
   quedó antes y después, que es de donde salen la pieza y el nombre. */
function tgPartir_(resto) {
  var trozos = String(resto || '').split(/\s+/).filter(String);
  var fechas = [], donde = [];
  trozos.forEach(function (t, i) {
    if (fechas.length >= 2) return;
    var f = tgFecha_(t);
    if (f) { fechas.push(f); donde.push(i); }
  });
  if (fechas.length < 2) return null;
  return {
    desde: fechas[0], hasta: fechas[1],
    antes: trozos.slice(0, donde[0]).join(' '),
    despues: trozos.slice(donde[1] + 1).join(' ')
  };
}

/* ---------- /libres ---------- */
function tgLibres_(resto, msgId) {
  var p = tgPartir_(resto);
  if (!p) {
    return telegramResponder_('Me faltan las fechas.\n' +
      '<code>/libres 12/09 14/09</code>', msgId);
  }
  if (p.hasta <= p.desde) {
    return telegramResponder_('La salida tiene que ser después de la llegada.', msgId);
  }

  var ocupadas = {};
  leer_('Reservas').forEach(function (r) {
    if (r.estado === 'cancelada' || r.estado === 'no_show') return;
    if (!chocan_(ymd_(r.checkIn), ymd_(r.checkOut), p.desde, p.hasta)) return;
    var choca = conflictosDe_(r.recurso);
    Object.keys(choca).forEach(function (id) { ocupadas[id] = true; });
  });

  var libres = recursos_().filter(function (r) { return !ocupadas[r.id]; });
  var n = noches_(p.desde, p.hasta);
  if (!libres.length) {
    return telegramResponder_('🔴 <b>Completo</b>\n' + fechaTg_(p.desde) + ' → ' +
      fechaTg_(p.hasta) + '  ·  ' + plural_(n, 'noche', 'noches'), msgId);
  }

  var lineas = ['🟢 <b>Libres</b> · ' + fechaTg_(p.desde) + ' → ' + fechaTg_(p.hasta) +
                '  ·  ' + plural_(n, 'noche', 'noches'), ''];
  var grupo = '';
  libres.forEach(function (r) {
    if (r.grupo !== grupo) { grupo = r.grupo; lineas.push('<b>' + escTg_(grupo) + '</b>'); }
    lineas.push('   ' + escTg_(r.unidad + (r.nombre ? ' — ' + r.nombre : '')) +
                '  ·  ' + plataTxt_(tarifaDe_(r.id, p.desde, '')) + ' la noche');
  });
  return telegramResponder_(lineas.join('\n'), msgId);
}

/* ---------- /buscar ---------- */
function tgBuscar_(resto, msgId) {
  var q = tgNormalizar_(resto);
  if (!q) return telegramResponder_('¿A quién busco?\n<code>/buscar juan</code>', msgId);

  var hoy = hoy_();
  var halladas = leer_('Reservas').filter(function (r) {
    return tgNormalizar_(r.huesped).indexOf(q) > -1 && ymd_(r.checkOut) >= hoy;
  }).sort(function (a, b) { return ymd_(a.checkIn) < ymd_(b.checkIn) ? -1 : 1; });

  if (!halladas.length) {
    return telegramResponder_('No encontré a nadie con ese nombre de hoy en adelante.', msgId);
  }
  var r8 = recorteTg_(halladas, 8);
  var lineas = ['🔎 <b>' + plural_(halladas.length, 'reserva', 'reservas') + '</b>', ''];
  r8.muestra.forEach(function (r) {
    lineas.push('👤 <b>' + escTg_(r.huesped) + '</b>');
    lineas.push('   ' + escTg_(nombreRecurso_(r.recurso)) + '  ·  ' +
      fechaTg_(r.checkIn) + ' → ' + fechaTg_(r.checkOut) +
      '  ·  ' + escTg_(String(r.estado || '').replace('_', ' ')));
  });
  if (r8.resto) lineas.push('…y ' + r8.resto + ' más');
  return telegramResponder_(lineas.join('\n'), msgId);
}

/* ---------- /reservar ---------- */
function tgReservar_(resto, quien, msgId) {
  var p = tgPartir_(resto);
  if (!p) {
    return telegramResponder_('No entendí. Va así:\n' +
      '<code>/reservar hab3 12/09 14/09 Juan Pérez</code>', msgId);
  }
  if (p.hasta <= p.desde) {
    return telegramResponder_('La salida tiene que ser después de la llegada.', msgId);
  }
  if (!p.antes) {
    return telegramResponder_('Me falta la pieza, antes de las fechas:\n' +
      '<code>/reservar hab3 12/09 14/09 Juan Pérez</code>', msgId);
  }

  var rec = tgRecurso_(p.antes);
  if (!rec) {
    return telegramResponder_('No sé cuál es "' + escTg_(p.antes) + '".\n' +
      'Prueba con <code>hab3</code>, <code>habitación 3</code> o <code>carpa a</code>.', msgId);
  }
  if (rec.ambiguo) {
    return telegramResponder_('"' + escTg_(p.antes) + '" puede ser varias:\n' +
      rec.ambiguo.map(function (x) {
        return '   • ' + escTg_(x.unidad + (x.nombre ? ' — ' + x.nombre : ''));
      }).join('\n') + '\nDime cuál.', msgId);
  }

  // Las personas son opcionales y van como "2p" en cualquier parte del resto.
  var pax = 1, nombre = p.despues;
  var mp = nombre.match(/(?:^|\s)(\d{1,2})\s*p(?:ax|ers?o?n?a?s?)?(?=\s|$)/i);
  if (mp) { pax = Number(mp[1]) || 1; nombre = nombre.replace(mp[0], ' ').trim(); }
  nombre = nombre.replace(/\s+/g, ' ').trim();
  if (!nombre) {
    return telegramResponder_('Me falta el nombre del huésped, al final:\n' +
      '<code>/reservar hab3 12/09 14/09 Juan Pérez</code>', msgId);
  }
  var tope = Number(rec.capacidad) || 1;
  pax = Math.min(Math.max(pax, 1), tope);

  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) {
    return telegramResponder_('El sistema estaba ocupado. Manda la orden de nuevo.', msgId);
  }
  try {
    try {
      verificarLibre_(rec.id, p.desde, p.hasta, '');
    } catch (e) {
      return telegramResponder_('🔴 <b>No se pudo</b>\n' + escTg_(e.message), msgId);
    }

    var id = uid_('R');
    var plan = armarNoches_(id, rec.id, p.desde, p.hasta, null, '');
    insertar_('Reservas', {
      id: id, recurso: rec.id, idUnidad: rec.idUnidad,
      huesped: nombre, telefono: '', email: '', canal: 'whatsapp',
      checkIn: p.desde, checkOut: p.hasta, estado: 'confirmada',
      total: plan.total, anticipo: 0, pax: pax, ninos: 0,
      notas: 'Creada desde Telegram por ' + quien + '. Falta completar: teléfono, ' +
             'precio acordado y cuántas personas si no son ' + pax + '.',
      creado: ahora_(), creadoPor: quien, tokenFicha: ''
    });
    insertarVarias_('Noches', plan.noches);
    logCambio_(quien, 'reserva_telegram', id + ' ' + rec.id + ' ' + p.desde + '→' + p.hasta);

    var n = noches_(p.desde, p.hasta);
    return telegramResponder_([
      '✅ <b>Reservado</b>', '',
      '👤 <b>' + escTg_(nombre) + '</b>',
      '🛏 ' + escTg_(rec.unidad + (rec.nombre ? ' — ' + rec.nombre : '')),
      '📅 ' + fechaTg_(p.desde) + ' → ' + fechaTg_(p.hasta) + '  ·  ' +
        plural_(n, 'noche', 'noches'),
      '👥 ' + plural_(pax, 'persona', 'personas'),
      '💵 ' + plataTxt_(plan.total) + '  ·  a la tarifa de la casa',
      '',
      '⚠️ Falta completarla en la app: teléfono, precio acordado y abono.',
      '✏️ La creó ' + escTg_(quien)
    ].join('\n'), msgId);
  } finally {
    lock.releaseLock();
  }
}

/* ---------- Lo que usa la pantalla de Configuración ---------- */

function telegramOrdenesEstado(token) {
  var u = sesion_(token);
  exigirAdmin_(u);
  return {
    activas: telegramOrdenesActivas_(),
    conBot: telegramActivo_(),
    autorizados: telegramAutorizadosLista_(),
    url: ScriptApp.getService().getUrl() + '?tg=' + claveTelegramWeb_()
  };
}

/* Enciende las órdenes Y le dice a Telegram dónde avisar. Las dos cosas van
   juntas a propósito: encender el interruptor sin registrar el webhook
   dejaría un sistema que parece andando y no contesta nada. */
function telegramOrdenesEncender(token, encender) {
  var u = sesion_(token);
  exigirAdmin_(u);
  if (encender && !telegramActivo_()) {
    throw new Error('Primero hay que conectar el bot y el grupo, más arriba.');
  }
  var api = 'https://api.telegram.org/bot' + telegramToken_() + '/';
  var r;
  try {
    if (encender) {
      r = UrlFetchApp.fetch(api + 'setWebhook', {
        method: 'post', muteHttpExceptions: true,
        payload: {
          url: ScriptApp.getService().getUrl() + '?tg=' + claveTelegramWeb_(),
          allowed_updates: JSON.stringify(['message']),
          drop_pending_updates: 'true'
        }
      });
    } else {
      r = UrlFetchApp.fetch(api + 'deleteWebhook',
        { method: 'post', muteHttpExceptions: true, payload: { drop_pending_updates: 'true' } });
    }
  } catch (e) {
    throw new Error('No se pudo hablar con Telegram: ' + (e.message || e));
  }
  var res = {};
  try { res = JSON.parse(r.getContentText()); } catch (e) {}
  if (!res.ok) {
    throw new Error('Telegram no aceptó el cambio: ' +
      (res.description || r.getResponseCode()));
  }
  actualizarConfig_('telegramOrdenes', encender ? 'si' : 'no');
  logCambio_(u.nombre, 'telegram_ordenes', encender ? 'encendidas' : 'apagadas');
  return { activas: !!encender };
}

/* ---------- Por qué el bot no contesta ----------

   Cuando esto no funciona, el silencio es total: Telegram no avisa, la app
   tampoco, y no hay dónde mirar. Esta función pregunta las tres cosas que
   pueden estar mal y las contesta con lo que dice cada parte, no con lo que
   suponemos:

     1. ¿Telegram tiene registrada una dirección, y es la de AHORA? La causa
        más común de todas: se publicó una implementación nueva, la dirección
        cambió, y el webhook quedó apuntando a la vieja. Nadie se entera.
     2. ¿Telegram se quejó de algo la última vez que llamó? getWebhookInfo
        guarda el último error, y suele decir exactamente qué pasó.
     3. ¿La app web contesta un POST? Se llama a sí misma imitando lo que
        manda Telegram. Si la versión publicada es anterior al doPost, esto
        lo destapa al tiro.

   La prueba del punto 3 va con un chat que no existe a propósito: recorre el
   mismo camino que un mensaje de verdad pero se detiene antes de hacer nada,
   así que no ensucia el grupo con mensajes de prueba. */
function telegramDiagnostico(token) {
  var u = sesion_(token);
  exigirAdmin_(u);
  var pasos = [];
  var anotar = function (paso, ok, detalle) {
    pasos.push({ paso: paso, ok: !!ok, detalle: detalle || '' });
  };

  if (!telegramActivo_()) {
    anotar('Bot conectado', false, 'Falta el token o el grupo. Se configura más arriba.');
    return { pasos: pasos };
  }
  anotar('Bot conectado', true, 'Grupo ' + telegramChat_());

  var mia = ScriptApp.getService().getUrl() + '?tg=' + claveTelegramWeb_();

  /* 1 y 2 · lo que Telegram tiene registrado */
  var info = null;
  try {
    var r = UrlFetchApp.fetch(
      'https://api.telegram.org/bot' + telegramToken_() + '/getWebhookInfo',
      { muteHttpExceptions: true });
    info = JSON.parse(r.getContentText());
  } catch (e) {
    anotar('Telegram responde', false, String(e.message || e));
    return { pasos: pasos, url: mia };
  }
  if (!info || !info.ok) {
    anotar('Telegram responde', false,
           (info && info.description) || 'Respuesta rara de Telegram.');
    return { pasos: pasos, url: mia };
  }
  anotar('Telegram responde', true, 'La API contesta bien.');

  var reg = String((info.result && info.result.url) || '');
  if (!reg) {
    anotar('Webhook registrado', false,
      'Telegram no tiene NINGUNA dirección registrada. Apaga y vuelve a ' +
      'encender "Aceptar órdenes desde el grupo".');
  } else if (reg !== mia) {
    anotar('Webhook registrado', false,
      'Telegram está llamando a OTRA dirección, no a la de ahora. Casi siempre ' +
      'es porque se publicó una implementación nueva en vez de actualizar la ' +
      'que ya estaba. Apaga y vuelve a encender el interruptor para corregirlo.\n' +
      'Registrada: ' + reg);
  } else {
    anotar('Webhook registrado', true, 'Apunta a la dirección correcta.');
  }

  var res = info.result || {};
  if (res.last_error_message) {
    anotar('Última llamada de Telegram', false,
      'Telegram dice: "' + res.last_error_message + '"' +
      (res.last_error_date
        ? ' · ' + Utilities.formatDate(new Date(res.last_error_date * 1000), TZ,
                                       'dd-MM-yyyy HH:mm')
        : ''));
  } else if (reg) {
    anotar('Última llamada de Telegram', true, 'Sin errores.');
  }

  if (Number(res.pending_update_count) > 0) {
    anotar('Mensajes en cola', false,
      res.pending_update_count + ' mensaje(s) esperando ser entregados. Eso ' +
      'significa que Telegram está intentando y la app no los toma.');
  }

  /* 3 · ¿la app web contesta un POST? */
  try {
    var falso = JSON.stringify({
      update_id: 0,
      message: { message_id: 0, text: '/ayuda',
                 chat: { id: 'diagnostico-sin-chat' },
                 from: { id: 0, first_name: 'Diagnóstico' } }
    });
    /* SIN seguir la redirección, a propósito. Siguiéndola esto contestaba 200
       y daba luz verde mientras Telegram se estrellaba contra un 302, que es
       justamente lo que no seguir redirecciones significa. Hay que mirar lo
       mismo que mira Telegram. */
    var p = UrlFetchApp.fetch(mia, {
      method: 'post', contentType: 'application/json',
      payload: falso, muteHttpExceptions: true, followRedirects: false
    });
    var codigo = p.getResponseCode();
    var cuerpo = String(p.getContentText() || '');
    if (codigo === 301 || codigo === 302 || codigo === 303 || codigo === 307) {
      anotar('La app contesta el POST', false,
        'Contestó ' + codigo + ' (una redirección). Telegram no sigue ' +
        'redirecciones en un webhook: la toma como error y deja el mensaje en ' +
        'cola. Se corrige contestando con HtmlService en vez de ContentService, ' +
        'y hay que publicar una VERSIÓN NUEVA para que el cambio tome efecto.');
    } else if (codigo !== 200) {
      anotar('La app contesta el POST', false,
        'Contestó ' + codigo + '. La versión publicada no está atendiendo a Telegram.');
    } else if (/Se ha producido un error|error occurred|Script function not found/i.test(cuerpo)) {
      anotar('La app contesta el POST', false,
        'Contestó una página de error en vez de nada. La versión publicada es ' +
        'anterior al código que atiende a Telegram: hay que publicar una ' +
        'VERSIÓN NUEVA de la misma implementación.');
    } else {
      anotar('La app contesta el POST', true,
        'La versión publicada atiende a Telegram correctamente.');
    }
  } catch (e) {
    anotar('La app contesta el POST', false, String(e.message || e));
  }

  anotar('Autorizados', telegramAutorizados_().length > 0,
    telegramAutorizados_().length
      ? telegramAutorizados_().length + ' persona(s) pueden dar órdenes.'
      : 'No hay nadie autorizado: el bot va a contestar "no estás en la lista" a todos.');

  anotar('Órdenes encendidas', telegramOrdenesActivas_(),
    telegramOrdenesActivas_() ? 'El interruptor está encendido.'
                              : 'El interruptor está apagado.');

  return { pasos: pasos, url: mia };
}

function telegramAutorizar(token, id, nombre) {
  var u = sesion_(token);
  exigirAdmin_(u);
  var num = String(id || '').trim();
  if (!/^\d{5,}$/.test(num)) {
    throw new Error('Ese no parece un número de Telegram. Son solo dígitos, y los ' +
      'da el propio bot cuando alguien le escribe sin estar autorizado.');
  }
  var l = telegramAutorizadosLista_();
  if (l.some(function (x) { return String(x.id) === num; })) return { autorizados: l };
  l.push({ id: num, nombre: String(nombre || '').trim() || num });
  actualizarConfig_('telegramAutorizados', JSON.stringify(l));
  logCambio_(u.nombre, 'telegram_autorizado', num);
  return { autorizados: l };
}

function telegramDesautorizar(token, id) {
  var u = sesion_(token);
  exigirAdmin_(u);
  var l = telegramAutorizadosLista_().filter(function (x) {
    return String(x.id) !== String(id);
  });
  actualizarConfig_('telegramAutorizados', JSON.stringify(l));
  logCambio_(u.nombre, 'telegram_desautorizado', String(id));
  return { autorizados: l };
}

/* ===================== EL PARTE DE LA MAÑANA =====================

   Un mensaje al grupo temprano con lo del día: quién llega, quién se va y
   quién se queda. La idea es que a las ocho de la mañana todo el mundo sepa
   cómo viene el día sin abrir la app ni preguntarle a nadie.

   Qué lleva y qué no. Las llegadas y las salidas van con detalle, porque son
   lo que hay que hacer hoy. Los que se quedan van en una sola línea: saber
   que están alcanza, y una lista larga hace que nadie lea el mensaje entero.

   Lo que de verdad justifica el mensaje son las marcas de atención: una ficha
   sin firmar de alguien que llega hoy, y sobre todo un saldo pendiente de
   alguien que se va hoy. Enterarse de eso a las ocho es a tiempo; enterarse
   cuando el auto ya salió, no.

   Si no pasa nada y no hay nadie alojado, no se manda nada. Un grupo que
   recibe "hoy no hay novedades" todos los días termina con el bot silenciado,
   y ahí se pierden también los avisos que sí importan. */

var DIAS_LARGO_ = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];
var MESES_LARGO_ = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
                    'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

function fechaLargaTg_(ymd) {
  var f = ymd_(ymd);
  if (!f) return String(ymd || '');
  var d = new Date(f + 'T12:00');
  if (isNaN(d.getTime())) return f;
  return DIAS_LARGO_[d.getDay()] + ' ' + d.getDate() + ' de ' + MESES_LARGO_[d.getMonth()];
}

/* El saldo de una reserva, en la moneda en que se le va a cobrar a ese
   huésped. Al extranjero no se le habla en pesos ni acá. */
function saldoTg_(r) {
  var pesos = Number(r.saldo) || 0;
  if (pesos <= 0) return '';
  return r.extranjero
    ? usd_(pesos, Number(r.dolar) || dolarHoy_().valor)
    : plataTxt_(pesos);
}

/* Una lista larga rompe el mensaje —Telegram corta en 4.096 letras— y encima
   nadie la lee. Se muestran las primeras y se dice cuántas quedaron. */
function recorteTg_(lista, tope) {
  if (lista.length <= tope) return { muestra: lista, resto: 0 };
  return { muestra: lista.slice(0, tope), resto: lista.length - tope };
}

function armarResumenDia_(dia) {
  var p = panelHoy_(dia);
  var hayGente = p.llegadas.length || p.salidas.length || p.enCasa.length;
  if (!hayGente) return '';

  var lineas = ['☀️ <b>' + escTg_(fechaLargaTg_(dia)) + '</b>'];

  if (p.llegadas.length) {
    lineas.push('');
    lineas.push('🔑 <b>Llegan ' + p.llegadas.length + '</b>');
    var lleg = recorteTg_(p.llegadas, 12);
    lleg.muestra.forEach(function (r) {
      var n = noches_(r.checkIn, r.checkOut);
      lineas.push('• <b>' + escTg_(r.huesped) + '</b> — ' + escTg_(r.recurso));
      var detalle = [plural_(n, 'noche', 'noches')];
      if (r.programa) detalle.push('🎁 ' + r.programa);
      var s = saldoTg_(r);
      if (s) detalle.push('quedan ' + s + ' por cobrar');
      lineas.push('   ' + escTg_(detalle.join('  ·  ')));
      if (!r.firmada) lineas.push('   ⚠️ ficha sin firmar');
    });
    if (lleg.resto) lineas.push('   …y ' + lleg.resto + ' más');
  }

  if (p.salidas.length) {
    lineas.push('');
    lineas.push('🚪 <b>Se van ' + p.salidas.length + '</b>');
    var sal = recorteTg_(p.salidas, 12);
    sal.muestra.forEach(function (r) {
      lineas.push('• <b>' + escTg_(r.huesped) + '</b> — ' + escTg_(r.recurso));
      // Lo más importante del mensaje entero. Un saldo pendiente a las ocho de
      // la mañana se cobra; el mismo saldo cuando el auto ya salió, no.
      var s = saldoTg_(r);
      if (s) lineas.push('   ⚠️ <b>quedan ' + escTg_(s) + ' por cobrar</b>');
    });
    if (sal.resto) lineas.push('   …y ' + sal.resto + ' más');
    lineas.push('🧹 Después habrá que limpiar: ' +
      escTg_(sal.muestra.map(function (r) { return r.recurso; }).join(', ')) +
      (sal.resto ? ' y ' + sal.resto + ' más' : ''));
  }

  /* El estado de las piezas. Lo que se necesita a las ocho de la mañana no es
     el inventario completo sino el ORDEN DEL DÍA del aseo, y ese orden lo
     decide una sola cosa: si esa pieza recibe a alguien hoy. Una habitación
     sucia sin nadie por llegar se limpia cuando se pueda; una sucia con un
     huésped llegando a las tres de la tarde es lo primero de la mañana.

     Por eso van en dos grupos y no en una lista sola. Y las limpias no se
     nombran una por una: alcanza con cuántas hay. */
  var aseo = situacionAseo_();
  var sucias = aseo.filter(function (a) { return a.estado === 'sucia'; });
  var bloqueadas = aseo.filter(function (a) { return a.estado === 'bloqueada'; });
  var limpias = aseo.filter(function (a) { return a.estado === 'limpia'; });

  if (sucias.length || bloqueadas.length) {
    lineas.push('');
    lineas.push('🧹 <b>Aseo</b>');
    var urgentes = sucias.filter(function (a) { return a.llegaHoy && !a.yaLlego; });
    var resto = sucias.filter(function (a) { return !(a.llegaHoy && !a.yaLlego); });

    if (urgentes.length) {
      lineas.push('⏰ <b>Primero estas ' + plural_(urgentes.length, 'pieza', 'piezas') +
                  ', que reciben hoy:</b>');
      recorteTg_(urgentes, 8).muestra.forEach(function (a) {
        lineas.push('   • ' + escTg_(a.nombre) +
          (a.huespedLlega ? '  ·  llega ' + escTg_(a.huespedLlega) : ''));
      });
    }
    if (resto.length) {
      var r8 = recorteTg_(resto, 8);
      lineas.push((urgentes.length ? 'Después: ' : 'Por limpiar: ') +
        escTg_(r8.muestra.map(function (a) { return a.nombre; }).join(', ')) +
        (r8.resto ? ' y ' + r8.resto + ' más' : ''));
    }
    if (bloqueadas.length) {
      lineas.push('🚧 Fuera de servicio: ' +
        escTg_(bloqueadas.map(function (a) { return a.nombre; }).join(', ')));
    }
    if (limpias.length) {
      lineas.push('✨ ' + plural_(limpias.length, 'pieza lista', 'piezas listas'));
    }
  } else if (limpias.length) {
    lineas.push('');
    lineas.push('✨ <b>Aseo</b> · todo limpio, ' +
                plural_(limpias.length, 'pieza lista', 'piezas listas'));
  }

  // Los que siguen alojados: una sola línea. Saber que están alcanza, y una
  // lista larga hace que nadie lea el mensaje completo.
  var siguen = p.enCasa.filter(function (r) { return r.checkOut !== dia; });
  if (siguen.length) {
    lineas.push('');
    var q = recorteTg_(siguen, 8);
    lineas.push('🏠 <b>Se quedan ' + siguen.length + '</b>  ·  ' +
      escTg_(q.muestra.map(function (r) { return r.recurso; }).join(', ')) +
      (q.resto ? ' y ' + q.resto + ' más' : ''));
  }

  if (!p.llegadas.length && !p.salidas.length) {
    lineas.push('');
    lineas.push('Sin llegadas ni salidas hoy.');
  }
  return lineas.join('\n');
}

/* Lo que llama el disparador de la mañana. Sin token: no lo pide nadie. */
function resumenDelDia() {
  try {
    if (!resumenActivo_()) return false;
    var texto = armarResumenDia_(hoy_());
    if (!texto) return false;              // lodge vacío y sin movimiento
    return avisar_('resumen', texto);
  } catch (e) {
    // Un resumen que revienta no puede dejar el disparador muerto en silencio.
    try { logCambio_('sistema', 'resumen_error', String(e.message || e)); } catch (e2) {}
    return false;
  }
}

function resumenActivo_() { return String(config_('resumenDiario', 'no')) === 'si'; }

function resumenHora_() {
  var h = Number(config_('resumenHora', 8));
  return (h >= 0 && h <= 23) ? Math.floor(h) : 8;
}

/* Enciende o apaga el parte de la mañana. Se borran primero los disparadores
   que hubiera, para que cambiar la hora no deje dos mensajes al día. */
function resumenAutomatico(token, encender, hora) {
  var u = sesion_(token);
  exigirAdmin_(u);
  var h = (hora === undefined || hora === null || hora === '') ? resumenHora_() : Number(hora);
  if (!(h >= 0 && h <= 23)) throw new Error('Esa hora no existe.');
  h = Math.floor(h);
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'resumenDelDia') ScriptApp.deleteTrigger(t);
  });
  if (encender) {
    ScriptApp.newTrigger('resumenDelDia').timeBased().atHour(h).everyDays(1).create();
  }
  actualizarConfig_('resumenHora', h);
  actualizarConfig_('resumenDiario', encender ? 'si' : 'no');
  logCambio_(u.nombre, 'resumen_diario',
             encender ? 'encendido a las ' + h + ':00' : 'apagado');
  return { activo: !!encender, hora: h };
}

/* Para probarlo sin esperar a mañana. Manda el de hoy aunque esté apagado, y
   dice qué pasó, que es lo que uno quiere saber al apretar el botón. */
function resumenProbar(token) {
  var u = sesion_(token);
  exigirAdmin_(u);
  var texto = armarResumenDia_(hoy_());
  if (!texto) {
    return { mandado: false,
             motivo: 'Hoy no hay nadie alojado ni llega o se va nadie, así que no ' +
                     'habría mensaje. Un grupo que recibe "sin novedades" todos los ' +
                     'días termina silenciando al bot.' };
  }
  if (!telegramActivo_()) {
    return { mandado: false, texto: texto,
             motivo: 'El bot de Telegram todavía no está conectado, así que no se ' +
                     'mandó. Así se vería el mensaje.' };
  }
  return { mandado: telegramMandar_(texto), texto: texto };
}

function resumenEstado(token) {
  var u = sesion_(token);
  exigirAdmin_(u);
  return { activo: resumenActivo_(), hora: resumenHora_(),
           conBot: telegramActivo_() };
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
  avisarAseo_(idUnidad, estado, quien, notas);
}

/* El grupo se entera de cada pieza que cambia de estado. Es un mensaje corto a
   propósito: la persona de aseo marca varias seguidas y un párrafo por cada
   una llenaría el grupo. Y va con su propio interruptor, para poder apagarlo
   sin apagar los avisos de reservas. */
var ICONO_ASEO_ = { limpia: '✨', sucia: '🧹', bloqueada: '🚧' };
var TEXTO_ASEO_ = { limpia: 'lista', sucia: 'por limpiar', bloqueada: 'fuera de servicio' };

function avisarAseo_(idUnidad, estado, quien, notas) {
  try {
    var linea = (ICONO_ASEO_[estado] || '•') + ' <b>' + escTg_(nombreRecurso_(idUnidad)) +
      '</b> · ' + (TEXTO_ASEO_[estado] || estado);
    // Si esa pieza recibe a alguien hoy, se dice: es la diferencia entre "hay
    // que limpiarla en algún momento" y "hay que limpiarla ahora".
    if (estado === 'sucia') {
      var llega = llegaHoyA_(idUnidad);
      if (llega) linea += '  ·  ⏰ <b>llega ' + escTg_(llega) + ' hoy</b>';
    }
    if (notas) linea += '\n   ' + escTg_(String(notas).slice(0, 120));
    linea += '\n   ' + escTg_(quien);
    return avisar_('aseo', linea);
  } catch (e) {
    return false;
  }
}

/* Quién llega hoy a esa pieza, si es que llega alguien. */
function llegaHoyA_(idRecurso) {
  var dia = hoy_();
  var r = leer_('Reservas').filter(function (x) {
    return String(x.recurso) === String(idRecurso) &&
      x.estado !== 'cancelada' && x.estado !== 'no_show' && x.estado !== 'checkout' &&
      ymd_(x.checkIn) === dia;
  })[0];
  return r ? r.huesped : '';
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
        notas: String(a.notas || ''), menor: !!a.menor
      };
    });
}

function acompanantesDe(token, idReserva) {
  sesion_(token);
  var r = leer_('Reservas').filter(function (x) { return x.id === idReserva; })[0];
  if (!r) throw new Error('No se encontró la reserva.');
  var lista = acompanantesDe_(idReserva);
  // Los menores de 6 no ocupan cupo, así que no cuentan para lo que falta.
  var adultos = lista.filter(function (a) { return !a.menor; }).length;
  return {
    idReserva: idReserva, huesped: r.huesped, pax: Number(r.pax) || 1,
    ninos: Number(r.ninos) || 0,
    // El titular cuenta como una de las personas de la reserva.
    faltan: Math.max((Number(r.pax) || 1) - 1 - adultos, 0),
    lista: lista
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
        menor: !!a.menor,
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
  // Los menores de 6 van aparte y no ocupan cupo: el tope es solo de adultos.
  var adultos = (lista || []).filter(function (a) { return a && !a.menor; }).length;
  var tope = Math.max((Number(r.pax) || 1) - 1, 0);
  if (adultos > tope) {
    throw new Error('La reserva es para ' + plural_(Number(r.pax) || 1, 'persona', 'personas') +
      ': caben ' + plural_(tope, 'acompañante', 'acompañantes') + ' además del titular. ' +
      'Sube el número de personas de la reserva si van más.');
  }
  var n = guardarAcompanantes_(idReserva, lista);
  logCambio_(u.nombre, 'acompanantes', idReserva + ' · ' + n);
  return { guardados: n };
}

/* ===================== DOCUMENTOS DEL HUÉSPED =====================
   Foto del pasaporte y de la tarjeta de turismo PDI. Son los dos papeles que
   acreditan la exención de IVA, y hoy se piden en el mostrador con el
   huésped esperando. Si los sube antes desde su celular, el check-in se
   acorta; si no los sube, no pasa nada: se piden igual al llegar.

   La imagen no entra a la planilla — ahí quedaría ilegible y la inflaría —:
   va a Drive, en la misma carpeta por año y mes que el resto, y en la
   planilla queda solo la referencia. */
var TIPOS_DOC = {
  pasaporte: 'Pasaporte',
  pdi: 'Tarjeta de turismo PDI',
  cedula: 'Cédula de identidad',
  otro: 'Otro documento'
};

/* Qué papeles se le piden a este huésped.

   No es lo mismo un extranjero que un chileno, y mezclarlos confundía a los
   dos: al chileno se le ofrecía subir un pasaporte y una tarjeta PDI que no
   tiene, y en la reserva le quedaba una advertencia de que "faltaban
   documentos" que nunca iba a poder completar.

   - Al turista extranjero exento se le piden pasaporte Y tarjeta PDI. No es
     opcional: sin los dos, la exención de IVA no se sostiene ante el SII.
   - Al chileno no se le exige nada. Puede dejar una foto de su cédula si
     quiere, y sirve para tenerla a mano, pero es un gusto y no un trámite. */
function tiposDoc_(extranjero) {
  return extranjero ? ['pasaporte', 'pdi'] : ['cedula'];
}

/* Límite del archivo ya decodificado. Una foto de celular redimensionada
   pesa unos 300 KB; 8 MB deja aire de sobra y frena un video subido por
   error, que sí reventaría la ejecución. */
var TOPE_DOC = 8 * 1024 * 1024;

function guardarDocumento_(idReserva, d, quien) {
  var r = leer_('Reservas').filter(function (x) { return x.id === idReserva; })[0];
  if (!r) throw new Error('No se encontró la reserva.');

  var tipo = TIPOS_DOC[d.tipo] ? d.tipo : 'otro';
  var datos = String(d.datos || '');
  // Llega como data:image/jpeg;base64,AAAA… : se parte en tipo y contenido.
  var corte = datos.indexOf(',');
  var cabecera = corte > -1 ? datos.slice(0, corte) : '';
  var cuerpo = corte > -1 ? datos.slice(corte + 1) : datos;
  if (!cuerpo) throw new Error('No llegó ninguna imagen.');

  var mime = (cabecera.match(/data:([^;]+)/) || [])[1] || 'image/jpeg';
  if (!/^(image\/|application\/pdf)/.test(mime)) {
    throw new Error('Solo se aceptan fotos o archivos PDF.');
  }

  var bytes;
  try { bytes = Utilities.base64Decode(cuerpo); }
  catch (e) { throw new Error('La imagen llegó dañada. Inténtalo de nuevo.'); }
  if (bytes.length > TOPE_DOC) {
    throw new Error('El archivo pesa demasiado. Saca la foto de nuevo o usa una más liviana.');
  }

  var ext = mime === 'application/pdf' ? 'pdf' : (mime.split('/')[1] || 'jpg');
  // El nombre lleva la fecha de LLEGADA, no la del día en que se subió: el
  // documento es de esa estadía y es así como se busca después. Antes decía
  // el día de la subida y no calzaba con la reserva.
  var llegada = ymd_(r.checkIn) || hoy_();
  var nombre = tipo + '-' + limpiarNombre_(r.huesped) + '-' + llegada +
               '-' + uid_('').slice(0, 4) + '.' + ext;

  // Y se archiva en el mes de esa misma llegada.
  var carpeta = carpetaDocs_(llegada, 'Documentos de huéspedes');
  var archivo = carpeta.createFile(Utilities.newBlob(bytes, mime, nombre));

  var fila = {
    id: uid_('D'), idReserva: idReserva, tipo: tipo,
    nombre: String(d.nombre || TIPOS_DOC[tipo]),
    archivoId: archivo.getId(), archivoUrl: archivo.getUrl(),
    subidoPor: quien || 'el huésped', creado: ahora_()
  };
  insertar_('Documentos', fila);
  olvidar_('Documentos');
  return fila;
}

function limpiarNombre_(t) {
  return String(t || 'huesped').replace(/[^\wáéíóúñÁÉÍÓÚÑ ]+/g, '').trim().slice(0, 40) || 'huesped';
}

/* En qué está el escaneo de los documentos de una reserva, resumido para que
   la pantalla lo muestre de un vistazo. A un turista extranjero exento hay
   que pedirle los DOS papeles —pasaporte y tarjeta PDI— antes de que se vaya:
   sin ellos la exención de IVA no se sostiene ante el SII. Al huésped chileno
   no se le pide nada, así que su reserva no muestra ninguna advertencia. */
/* Las filas de Documentos de UNA reserva. Si la hoja todavía no existe
   —código nuevo con setup() sin ejecutar— devuelve vacío en vez de tirar
   abajo la pantalla que la estaba pidiendo. */
function docsDeReserva_(idReserva) {
  try { return agrupar_('Documentos', 'idReserva')[String(idReserva)] || []; }
  catch (e) { return []; }
}

function estadoDocs_(filas, extranjero) {
  var tiene = {};
  (filas || []).forEach(function (d) { tiene[String(d.tipo)] = true; });
  var n = (filas || []).length;
  // Lo que falta se calcula contra lo que se le PIDE a este huésped, no
  // contra una lista fija: a un chileno no le puede faltar un pasaporte.
  var pedidos = tiposDoc_(!!extranjero);
  var faltan = pedidos.filter(function (t) { return !tiene[t]; });
  return {
    total: n,
    pasaporte: !!tiene.pasaporte,
    pdi: !!tiene.pdi,
    cedula: !!tiene.cedula,
    // 'exige' decide si vale la pena advertir que falta algo: solo al
    // extranjero exento se le exigen. Al chileno la cédula es opcional, así
    // que su reserva nunca muestra una advertencia.
    exige: !!extranjero,
    faltan: faltan,
    completo: extranjero ? faltan.length === 0 : n > 0
  };
}

function documentosDe_(idReserva) {
  return (agrupar_('Documentos', 'idReserva')[String(idReserva)] || [])
    .map(function (d) {
      return {
        id: d.id, tipo: d.tipo, rotulo: TIPOS_DOC[d.tipo] || 'Documento',
        nombre: String(d.nombre || ''), archivoUrl: String(d.archivoUrl || ''),
        subidoPor: String(d.subidoPor || ''), creado: String(d.creado || '')
      };
    });
}

/* Desde recepción, con sesión. */
function documentosDe(token, idReserva) {
  sesion_(token);
  return documentosDe_(idReserva);
}

function subirDocumento(token, idReserva, d) {
  var u = sesion_(token);
  var fila = guardarDocumento_(idReserva, d, u.nombre);
  logCambio_(u.nombre, 'documento', idReserva + ' · ' + fila.tipo);
  return { id: fila.id, url: fila.archivoUrl, rotulo: TIPOS_DOC[fila.tipo] };
}

function borrarDocumento(token, id) {
  var u = sesion_(token);
  var d = leer_('Documentos').filter(function (x) { return x.id === id; })[0];
  if (!d) throw new Error('No se encontró el documento.');
  // El archivo se manda a la papelera de Drive: si fue un error, se recupera.
  try { DriveApp.getFileById(d.archivoId).setTrashed(true); } catch (e) {}
  borrar_('Documentos', 'id', id);
  olvidar_('Documentos');
  logCambio_(u.nombre, 'documento_borrado', id);
  return true;
}

/* Desde el celular del huésped, con el token de su ficha y sin sesión. */
function fichaPublicaSubir(t, d) {
  var r = porTokenFicha_(t);
  var fila = guardarDocumento_(r.id, d, 'el huésped');
  return { id: fila.id, rotulo: TIPOS_DOC[fila.tipo] };
}

/* ===================== EL QR DE RECEPCIÓN =====================
   Recepción no tiene escáner. Cuando llega un huésped que no subió sus
   documentos —o llega sin reserva—, hay que dejar registrada la foto del
   pasaporte y de la tarjeta PDI, y la única cámara que hay a mano es la del
   teléfono del recepcionista.

   El QR resuelve solo eso: se muestra en la pantalla del mostrador, el
   recepcionista lo escanea con SU teléfono y se le abre una página que no
   hace nada más que sacar las dos fotos. El huésped no ve este código en
   ningún momento y no es para él: su camino es el enlace de su ficha, que es
   otro y llega por WhatsApp.

   Por eso el código es corto y propio: mientras menos letras lleve el
   enlace, menos cuadritos tiene el QR, más grande queda cada uno y mejor lo
   agarra la cámara. Con el token de 32 letras de la ficha el código salía
   tan denso que costaba leerlo. */
function codigoDocDe_(idReserva) {
  var r = leer_('Reservas').filter(function (x) { return x.id === idReserva; })[0];
  if (!r) throw new Error('No se encontró la reserva.');
  var c = String(r.codigoDoc || '');
  if (!c) {
    c = codigoCorto_();
    actualizar_('Reservas', 'id', idReserva, { codigoDoc: c });
  }
  return c;
}

/* Diez caracteres al azar de un alfabeto de 32 sin letras que se confundan
   —no van la l, la ñ, la o ni el 0 ni el 1—: son 32^10 combinaciones, más de
   mil billones, de sobra para que nadie dé con uno probando, y bastante más
   corto que un UUID. */
function codigoCorto_(largo) {
  var abc = 'abcdefghijkmnpqrstuvwxyz23456789';
  var n = Number(largo) || 10, c = '';
  for (var i = 0; i < n; i++) c += abc.charAt(Math.floor(Math.random() * abc.length));
  return c;
}

function linkDocumentos(token, idReserva) {
  sesion_(token);
  var c = codigoDocDe_(idReserva);
  return { url: ScriptApp.getService().getUrl() + '?d=' + c, codigo: c };
}

function porCodigoDoc_(c) {
  var r = leer_('Reservas').filter(function (x) {
    return String(x.codigoDoc) === String(c) && String(c) !== '';
  })[0];
  if (!r) throw new Error('Este código ya no sirve. Pídele a recepción que lo muestre de nuevo.');
  return r;
}

/* Lo único que necesita saber la página de recepción: de quién son los
   documentos y cuáles ya están. Nada de la ficha, ni datos personales, ni
   la cuenta: es una pantalla para sacar dos fotos. */
function docsCargar(c) {
  var r = porCodigoDoc_(c);
  var rec = recursos_().filter(function (x) { return x.id === r.recurso; })[0];
  return {
    huesped: String(r.huesped || ''),
    unidad: rec ? (rec.unidad + (rec.nombre ? ' — ' + rec.nombre : '')) : '',
    checkIn: ymd_(r.checkIn), checkOut: ymd_(r.checkOut),
    extranjero: !!r.extranjero,
    documentos: documentosDe_(r.id).map(function (d) {
      return { id: d.id, tipo: d.tipo, rotulo: d.rotulo, creado: d.creado };
    })
  };
}

function docsSubir(c, d) {
  var r = porCodigoDoc_(c);
  var fila = guardarDocumento_(r.id, d, 'recepción');
  return { id: fila.id, rotulo: TIPOS_DOC[fila.tipo] };
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

/* ===================== AVISOS AL GRUPO DE TELEGRAM =====================

   Un bot que escribe en el grupo del equipo cada vez que pasa algo con una
   reserva. Es para que nadie tenga que estar mirando la app: la reserva cae y
   el grupo se entera.

   Tres reglas que ordenan todo lo de acá abajo:

   1. VIENE APAGADO. Sin token no se llama a nadie y no sale ni un paquete a
      internet. El resto del sistema funciona sin conexión a propósito, y esto
      no puede cambiarlo por defecto.

   2. UN AVISO NUNCA PUEDE VOLTEAR UNA RESERVA. Todo va envuelto en try/catch
      y el error se traga. Que Telegram esté caído, que cambiaran el token o
      que se acabe la cuota de Google no puede impedir que se guarde una
      reserva: el aviso es un lujo, la reserva es el trabajo.

   3. SOLO EL NOMBRE. Ni teléfono ni correo. El historial de un grupo de
      Telegram no lo controlamos nosotros y queda para siempre; el nombre
      alcanza para saber de quién se habla, y el resto está en la app. */

function telegramToken_() { return String(config_('telegramToken', '') || '').trim(); }
function telegramChat_()  { return String(config_('telegramChat', '') || '').trim(); }

function telegramActivo_() { return !!(telegramToken_() && telegramChat_()); }

/* Manda el mensaje. Devuelve true o false, nunca lanza. */
function telegramMandar_(texto) {
  if (!telegramActivo_()) return false;
  try {
    var r = UrlFetchApp.fetch(
      'https://api.telegram.org/bot' + telegramToken_() + '/sendMessage', {
        method: 'post',
        muteHttpExceptions: true,
        payload: {
          chat_id: telegramChat_(),
          text: texto,
          parse_mode: 'HTML',
          disable_web_page_preview: 'true'
        }
      });
    return r.getResponseCode() === 200;
  } catch (e) {
    return false;
  }
}

/* Manda un archivo al grupo. Es otra dirección de la API —sendDocument y no
   sendMessage— y va como formulario: el blob se pone tal cual en el campo y
   UrlFetchApp arma el multipart solo. Devuelve true o false, nunca lanza. */
function telegramDocumento_(blob, pie) {
  if (!telegramActivo_()) return false;
  try {
    var r = UrlFetchApp.fetch(
      'https://api.telegram.org/bot' + telegramToken_() + '/sendDocument', {
        method: 'post',
        muteHttpExceptions: true,
        payload: {
          chat_id: telegramChat_(),
          document: blob,
          caption: String(pie || '').slice(0, 1000),
          parse_mode: 'HTML'
        }
      });
    return r.getResponseCode() === 200;
  } catch (e) {
    return false;
  }
}

/* El punto por el que pasan TODOS los avisos. Mira si ese tipo de aviso está
   encendido y, si lo está, arma el texto y lo manda. Se llama siempre al
   final de la operación, con los datos ya guardados. */
function avisar_(tipo, texto) {
  try {
    if (!telegramActivo_()) return false;
    if (String(config_('telegramAvisa_' + tipo, 'si')) === 'no') return false;
    return telegramMandar_(texto);
  } catch (e) {
    return false;
  }
}

/* En HTML de Telegram solo hay que escapar estos tres. Un huésped que se
   apellide "Ortiz & Cía" no puede romper el mensaje. */
function escTg_(t) {
  return String(t == null ? '' : t)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

/* "vie 15 ago" — la fecha como se lee en el grupo, no como se guarda. */
var DIAS_TG_ = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
var MESES_TG_ = ['ene', 'feb', 'mar', 'abr', 'may', 'jun',
                 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
function fechaTg_(ymd) {
  var f = ymd_(ymd);
  if (!f) return String(ymd || '');
  var d = new Date(f + 'T12:00');
  if (isNaN(d.getTime())) return f;
  return DIAS_TG_[d.getDay()] + ' ' + d.getDate() + ' ' + MESES_TG_[d.getMonth()];
}

/* La plata en la moneda de esa reserva, igual que en pantalla: a quien
   reservó en dólares no se le habla en pesos ni siquiera acá. */
function plataTg_(reserva, pesos) {
  return reserva && reserva.extranjero
    ? usd_(pesos, Number(reserva.dolar) || dolarHoy_().valor)
    : plataTxt_(pesos);
}

function nombreRecurso_(recursoId) {
  var r = recursos_().filter(function (x) { return x.id === recursoId; })[0];
  return r ? (r.unidad + (r.nombre ? ' — ' + r.nombre : '')) : String(recursoId || '');
}

/* Las líneas que comparten todos los avisos de una reserva. */
function lineasReserva_(r) {
  var n = noches_(ymd_(r.checkIn), ymd_(r.checkOut));
  var pax = Number(r.pax) || 1, ninos = Number(r.ninos) || 0;
  return [
    '👤 <b>' + escTg_(r.huesped) + '</b>',
    '🛏 ' + escTg_(nombreRecurso_(r.recurso)),
    '📅 ' + fechaTg_(r.checkIn) + ' → ' + fechaTg_(r.checkOut) +
      '  ·  ' + plural_(n, 'noche', 'noches'),
    '👥 ' + plural_(pax, 'persona', 'personas') +
      (ninos ? ' + ' + plural_(ninos, 'menor de 6', 'menores de 6') : '')
  ];
}

/* ---------- Reserva nueva ---------- */
function avisarReservaNueva_(idReserva, quien) {
  var r = leer_('Reservas').filter(function (x) { return x.id === idReserva; })[0];
  if (!r) return false;
  var lineas = ['🆕 <b>Reserva nueva</b>', ''].concat(lineasReserva_(r));
  lineas.push('💵 ' + plataTg_(r, Number(r.total) || 0) +
              (r.extranjero ? '  ·  exenta de IVA' : ''));
  if (r.programaNombre) lineas.push('🎁 Programa: ' + escTg_(r.programaNombre));
  lineas.push('📲 ' + escTg_(r.canal || 'directo') + '  ·  la cargó ' + escTg_(quien));
  return avisar_('reserva', lineas.join('\n'));
}

/* ---------- Reserva de grupo ---------- */
function avisarGrupoNuevo_(ids, quien) {
  var todas = leer_('Reservas');
  var suyas = todas.filter(function (x) { return ids.indexOf(x.id) > -1; });
  if (!suyas.length) return false;
  var r = suyas[0];
  var total = 0;
  suyas.forEach(function (x) { total += Number(x.total) || 0; });
  var n = noches_(ymd_(r.checkIn), ymd_(r.checkOut));

  var lineas = [
    '🆕 <b>Reserva de grupo</b>  ·  ' + suyas.length + ' alojamientos', '',
    '👤 <b>' + escTg_(r.huesped) + '</b>',
    '📅 ' + fechaTg_(r.checkIn) + ' → ' + fechaTg_(r.checkOut) +
      '  ·  ' + plural_(n, 'noche', 'noches')
  ];
  suyas.forEach(function (x) {
    lineas.push('   🛏 ' + escTg_(nombreRecurso_(x.recurso)) +
                '  ·  ' + plataTg_(x, Number(x.total) || 0));
  });
  lineas.push('💵 <b>' + plataTg_(r, total) + '</b> en total' +
              (r.extranjero ? '  ·  exenta de IVA' : ''));
  lineas.push('📲 ' + escTg_(r.canal || 'directo') + '  ·  lo cargó ' + escTg_(quien));
  return avisar_('reserva', lineas.join('\n'));
}

/* ---------- Se movió de día o de pieza ---------- */
function avisarMovida_(r, antes, quien) {
  var cambioPieza = String(antes.recurso) !== String(r.recurso);
  var cambioFecha = ymd_(antes.checkIn) !== ymd_(r.checkIn) ||
                    ymd_(antes.checkOut) !== ymd_(r.checkOut);
  if (!cambioPieza && !cambioFecha) return false;

  var lineas = ['🔀 <b>Reserva movida</b>', '', '👤 <b>' + escTg_(r.huesped) + '</b>'];
  if (cambioPieza) {
    lineas.push('🛏 ' + escTg_(nombreRecurso_(antes.recurso)) +
                '  →  <b>' + escTg_(nombreRecurso_(r.recurso)) + '</b>');
  } else {
    lineas.push('🛏 ' + escTg_(nombreRecurso_(r.recurso)));
  }
  if (cambioFecha) {
    lineas.push('📅 ' + fechaTg_(antes.checkIn) + ' → ' + fechaTg_(antes.checkOut));
    lineas.push('     <b>' + fechaTg_(r.checkIn) + ' → ' + fechaTg_(r.checkOut) + '</b>  ·  ' +
                plural_(noches_(ymd_(r.checkIn), ymd_(r.checkOut)), 'noche', 'noches'));
  }
  lineas.push('✏️ La movió ' + escTg_(quien));
  return avisar_('cambio', lineas.join('\n'));
}

/* ---------- Cambió de estado ---------- */
function avisarEstado_(r, estado, quien) {
  var saldo = (Number(r.total) || 0) - (Number(r.anticipo) || 0);
  var lineas;

  if (estado === 'cancelada' || estado === 'no_show') {
    lineas = [estado === 'cancelada' ? '❌ <b>Reserva cancelada</b>'
                                     : '🚫 <b>No-show</b>  ·  nunca llegó', '']
      .concat(lineasReserva_(r));
    lineas.push('✏️ ' + escTg_(quien));
    return avisar_('cambio', lineas.join('\n'));
  }

  if (estado === 'en_casa') {
    lineas = ['🔑 <b>Check-in</b>', '']
      .concat(lineasReserva_(r).slice(0, 2));
    lineas.push('📅 se va el ' + fechaTg_(r.checkOut));
    lineas.push(saldo > 0 ? '💵 queda por cobrar ' + plataTg_(r, saldo)
                          : '💵 sin saldo pendiente');
    lineas.push('✏️ ' + escTg_(quien));
    return avisar_('check', lineas.join('\n'));
  }

  if (estado === 'checkout') {
    lineas = ['👋 <b>Check-out</b>', '']
      .concat(lineasReserva_(r).slice(0, 2));
    lineas.push(saldo > 0 ? '⚠️ <b>Se fue debiendo ' + plataTg_(r, saldo) + '</b>'
                          : '✅ Cuenta pagada');
    lineas.push('🧹 La pieza queda marcada como sucia');
    lineas.push('✏️ ' + escTg_(quien));
    return avisar_('check', lineas.join('\n'));
  }

  return false;
}

/* ---------- Se borró ---------- */
function avisarBorrada_(r, quien) {
  var lineas = ['🗑 <b>Reserva eliminada</b>', ''].concat(lineasReserva_(r));
  lineas.push('✏️ La eliminó ' + escTg_(quien));
  return avisar_('cambio', lineas.join('\n'));
}

/* ---------- Probar y encontrar el grupo, desde Configuración ---------- */

/* Manda un mensaje de prueba para que vean que llegó. */
function telegramProbar(token) {
  var u = sesion_(token);
  exigirAdmin_(u);
  if (!telegramToken_()) throw new Error('Falta pegar el token del bot.');
  if (!telegramChat_()) throw new Error('Falta el grupo. Usa "Buscar el grupo" acá abajo.');
  var ok = telegramMandar_(
    '✅ <b>Casona Peumayén</b>\n\nEl bot quedó conectado a este grupo. ' +
    'Desde ahora van a llegar acá los avisos de las reservas.');
  if (!ok) {
    throw new Error('No llegó. Revisa que el token esté bien pegado y que el bot ' +
      'siga dentro del grupo.');
  }
  return { ok: true };
}

/* Encuentra el ID del grupo sin que nadie tenga que averiguarlo a mano: se
   agrega el bot al grupo, se escribe cualquier cosa ahí, y esto lee el último
   mensaje que le llegó y se queda con el grupo de donde vino. */
function telegramBuscarGrupo(token) {
  var u = sesion_(token);
  exigirAdmin_(u);
  var t = telegramToken_();
  if (!t) throw new Error('Primero pega el token del bot y guarda.');

  var datos;
  try {
    var r = UrlFetchApp.fetch('https://api.telegram.org/bot' + t + '/getUpdates',
                              { muteHttpExceptions: true });
    datos = JSON.parse(r.getContentText());
  } catch (e) {
    throw new Error('No se pudo hablar con Telegram. Revisa el token.');
  }
  if (!datos || !datos.ok) {
    throw new Error('Telegram rechazó el token. Cópialo de nuevo desde BotFather.');
  }

  var chats = [];
  (datos.result || []).forEach(function (up) {
    var m = up.message || up.channel_post || up.my_chat_member;
    if (!m || !m.chat) return;
    var c = m.chat;
    if (chats.some(function (x) { return String(x.id) === String(c.id); })) return;
    chats.push({ id: String(c.id),
                 nombre: String(c.title || c.first_name || c.username || c.id),
                 tipo: String(c.type || '') });
  });

  if (!chats.length) {
    throw new Error('Telegram no tiene mensajes recientes para este bot. ' +
      'Agrégalo al grupo, escribe cualquier cosa ahí y vuelve a apretar.');
  }
  // El último es el más reciente: es el grupo donde acaban de escribir.
  var elegido = chats[chats.length - 1];
  guardarOCrear_('Config', 'clave', 'telegramChat',
                 { clave: 'telegramChat', valor: elegido.id });
  // El nombre se guarda solo para poder decir "conectado al grupo Equipo
  // Casona" en vez de escupir el número: quien lo lee no tiene por qué saber
  // qué es un -100777.
  guardarOCrear_('Config', 'clave', 'telegramChatNombre',
                 { clave: 'telegramChatNombre', valor: elegido.nombre });
  olvidarConfig_();
  logCambio_(u.nombre, 'telegram_grupo', elegido.nombre + ' (' + elegido.id + ')');
  return { id: elegido.id, nombre: elegido.nombre, tipo: elegido.tipo, encontrados: chats };
}

/* ===================== CONFIGURACIÓN =====================
   Lo que cambia con el tiempo se edita desde la app y no desde el código:
   horarios, normas, temporada, precios del programa y el correo del dueño. */

/* Lo que se edita a diario son las normas, y son un texto y nada más: se
   escriben tal como se van a leer. El resto casi nunca se toca, así que va
   guardado detrás de "ajustes que casi nunca se tocan". */
var CONFIG_EDITABLE = [
  // El cambio lo deciden ellos, así que el campo va al frente y no escondido.
  // En 0 se busca el dólar observado del día; con un valor puesto, manda ese.
  { clave: 'dolarManual', rotulo: 'Nuestro valor del dólar ($ por US$1)', tipo: 'numero', grupo: 'dolar' },
  // El bot del grupo de Telegram. Sin token no sale ni un paquete a internet.
  { clave: 'telegramToken', rotulo: 'Token del bot (te lo da @BotFather)', tipo: 'texto', grupo: 'telegram' },
  { clave: 'telegramAvisa_reserva', rotulo: 'Avisar las reservas nuevas', tipo: 'si_no', grupo: 'telegram' },
  { clave: 'telegramAvisa_cambio', rotulo: 'Avisar cancelaciones y cambios de fecha o pieza', tipo: 'si_no', grupo: 'telegram' },
  { clave: 'telegramAvisa_check', rotulo: 'Avisar los check-in y check-out', tipo: 'si_no', grupo: 'telegram' },
  { clave: 'telegramAvisa_booking', rotulo: 'Avisar lo que Booking mete solo', tipo: 'si_no', grupo: 'telegram' },
  { clave: 'telegramAvisa_aseo', rotulo: 'Avisar cuando una habitación cambia de estado de aseo', tipo: 'si_no', grupo: 'telegram' },
  { clave: 'reglasEs', rotulo: 'Normas de convivencia', tipo: 'texto_largo', grupo: 'normas' },
  { clave: 'reglasEn', rotulo: 'House rules (las mismas, en inglés)', tipo: 'texto_largo', grupo: 'normas' },
  { clave: 'correoDueno', rotulo: 'Correo para el cierre de cada noche', tipo: 'texto', grupo: 'avanzado' },
  { clave: 'checkIn', rotulo: 'Hora de check-in', tipo: 'hora', grupo: 'avanzado' },
  { clave: 'checkOut', rotulo: 'Hora de check-out', tipo: 'hora', grupo: 'avanzado' },
  { clave: 'temporadaAltaInicio', rotulo: 'Temporada alta desde (MM-DD)', tipo: 'texto', grupo: 'avanzado' },
  { clave: 'temporadaAltaFin', rotulo: 'Temporada alta hasta (MM-DD)', tipo: 'texto', grupo: 'avanzado' },
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
      // Los avisos vienen encendidos: si nadie los ha tocado, la casilla sale
      // marcada, que es lo que espera quien acaba de conectar el bot.
      if (c.tipo === 'si_no' && (v === undefined || v === null || v === '')) v = 'si';
      var valor = (v === undefined || v === null) ? '' : String(v);
      // El token del bot no vuelve a la pantalla: es una llave y no tiene por
      // qué andar viajando de vuelta cada vez que se abre Configuración. Se
      // manda una vez y se queda guardado.
      if (c.clave === 'telegramToken') valor = valor ? '•'.repeat(12) : '';
      // El cuadro de las normas nunca sale vacío: si nadie las ha escrito,
      // trae las que están rigiendo hoy, para editarlas encima.
      if (!valor && porDefecto[c.clave]) valor = porDefecto[c.clave];
      return { clave: c.clave, rotulo: c.rotulo, tipo: c.tipo,
               grupo: c.grupo, valor: valor };
    }),
    reglasPorDefecto: porDefecto,
    vistaPrevia: reglamento(),
    dolar: dolarHoy_(),
    // La dirección de la planilla se pregunta en vivo y no va escrita a mano:
    // así siempre apunta a la que el sistema está usando de verdad, aunque
    // algún día se cambie de planilla.
    planillaUrl: (function () { try { return ss_().getUrl(); } catch (e) { return ''; } })(),
    // El token NO viaja de vuelta a la pantalla: se manda una vez y se queda
    // en la planilla. Lo que la pantalla necesita saber es si ya hay uno
    // puesto y a qué grupo está apuntando.
    telegram: {
      conToken: !!telegramToken_(),
      chat: telegramChat_(),
      chatNombre: String(config_('telegramChatNombre', '') || ''),
      activo: telegramActivo_()
    }
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
    // El token vuelve tapado con puntos; si nadie lo tocó, llega igual y no
    // hay que guardarlo encima del bueno.
    if (k === 'telegramToken' && /^•+$/.test(String(v))) return;
    if (validas[k].tipo === 'hora') {
      v = hora_(v, '');
      if (!v) throw new Error('La hora de "' + validas[k].rotulo + '" tiene que ser como 15:00.');
    }
    if (validas[k].tipo === 'numero') v = Number(v) || 0;
    // Las de sí/no se guardan como palabra y no como true/false: en la
    // planilla se leen, y alguien las puede corregir a mano desde ahí.
    if (validas[k].tipo === 'si_no') v = (v === true || String(v) === 'si') ? 'si' : 'no';
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

/* ===================== EL CALENDARIO QUE LEE BOOKING =====================

   Booking no acepta conexiones directas de propiedades individuales: su API
   de dos vías es solo para channel managers certificados. Pero sí deja
   IMPORTAR un calendario externo desde el extranet, y eso alcanza para lo
   que de verdad duele — que Booking venda una pieza que acá ya se vendió.

   Cada alojamiento publica su propio archivo .ics con las fechas tomadas.
   Booking lo va a buscar solo cada varias horas y bloquea esas fechas de su
   lado. No es instantáneo: entre que se carga una reserva directa y Booking
   la ve hay una ventana de horas, y eso hay que saberlo.

   La dirección es pública porque Booking la lee sin identificarse, así que:
   lleva una clave larga, y adentro NO va ningún dato del huésped. Solo dice
   "ocupado" de tal día a tal día. Quien tenga la dirección aprende cuándo
   está lleno el lodge, nada más. */

function claveIcal_() {
  var c = String(config_('claveIcal', '') || '');
  if (!c) {
    /* Larga a propósito y no un UUID: esta dirección es pública y la única
       protección que tiene es que nadie la adivine. Treinta y dos caracteres
       de un alfabeto de 32 son 32^32 combinaciones. */
    c = codigoCorto_(32);
    guardarOCrear_('Config', 'clave', 'claveIcal', { clave: 'claveIcal', valor: c });
    olvidarConfig_();
  }
  return c;
}

function icalTexto_(lineas) {
  return ContentService.createTextOutput(lineas.join('\r\n'))
    .setMimeType(ContentService.MimeType.ICAL);
}

function icalDeRecurso_(clave, idRecurso) {
  // Clave mala: se contesta un calendario vacío y no un error. Booking
  // reintenta solo, y un atacante no aprende si acertó el alojamiento.
  var vacio = ['BEGIN:VCALENDAR', 'VERSION:2.0',
               'PRODID:-//Casona Peumayen//PMS//ES', 'END:VCALENDAR'];
  try {
    if (clave !== claveIcal_()) return icalTexto_(vacio);
    var rec = recursos_().filter(function (x) { return x.id === idRecurso; })[0];
    if (!rec) return icalTexto_(vacio);

    /* Qué bloquea a este alojamiento. Se usa la MISMA regla que impide una
       doble reserva en el calendario: en una habitación que se vende por
       camas, tomar una cama deja sin cupo a la pieza y al revés. Si acá se
       mirara solo el recurso exacto, Booking podría vender la pieza entera
       con una cama ya ocupada. */
    var choca = conflictosDe_(idRecurso);
    var hoy = hoy_();
    var lineas = ['BEGIN:VCALENDAR', 'VERSION:2.0',
                  'PRODID:-//Casona Peumayen//PMS//ES', 'CALSCALE:GREGORIAN',
                  'METHOD:PUBLISH',
                  'X-WR-CALNAME:' + icalEscapar_('Casona Peumayén — ' +
                    rec.unidad + (rec.nombre ? ' — ' + rec.nombre : ''))];

    leer_('Reservas').forEach(function (r) {
      if (!choca[String(r.recurso)]) return;
      // Se bloquea lo mismo que bloquea el calendario de acá: todo menos las
      // canceladas y los no-show. Una tentativa retiene la pieza igual.
      if (r.estado === 'cancelada' || r.estado === 'no_show') return;
      var ci = ymd_(r.checkIn), co = ymd_(r.checkOut);
      if (!ci || !co || co <= ci) return;
      // Lo que ya pasó no le sirve a nadie y solo engorda el archivo.
      if (co < hoy) return;

      lineas.push('BEGIN:VEVENT');
      lineas.push('UID:' + r.id + '@casonapeumayen');
      lineas.push('DTSTAMP:' + icalSello_());
      lineas.push('DTSTART;VALUE=DATE:' + ci.replace(/-/g, ''));
      // En iCal el final es exclusivo, igual que un check-out: la noche del
      // día de salida queda libre. Calza exacto con cómo se cuenta acá.
      lineas.push('DTEND;VALUE=DATE:' + co.replace(/-/g, ''));
      // Sin nombres. Este archivo lo puede leer cualquiera que tenga la
      // dirección, y el huésped no tiene por qué aparecer ahí.
      lineas.push('SUMMARY:Ocupado');
      lineas.push('END:VEVENT');
    });

    lineas.push('END:VCALENDAR');
    return icalTexto_(lineas);
  } catch (e) {
    // Un calendario que falla haría que Booking creyera que no hay nada
    // bloqueado y vendiera todo. Vacío es igual de malo, pero un error 500
    // hace que Booking conserve lo último que leyó, que es lo prudente.
    throw e;
  }
}

function icalSello_() {
  return Utilities.formatDate(new Date(), 'UTC', "yyyyMMdd'T'HHmmss'Z'");
}

function icalEscapar_(t) {
  return String(t == null ? '' : t)
    .replace(/\\/g, '\\\\').replace(/;/g, '\\;')
    .replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

/* Las direcciones que hay que pegar en Booking, una por alojamiento. */
function enlacesIcal(token) {
  var u = sesion_(token);
  exigirAdmin_(u);
  var base = ScriptApp.getService().getUrl() + '?ical=' + claveIcal_() + '&u=';
  return {
    enlaces: recursos_().map(function (r) {
      return {
        id: r.id,
        nombre: r.unidad + (r.nombre ? ' — ' + r.nombre : ''),
        grupo: r.grupo,
        url: base + encodeURIComponent(r.id)
      };
    })
  };
}

/* ===================== LO QUE BOOKING VENDE, ENTRA SOLO =====================

   Arriba está la ida: se le entrega a Booking un calendario para que no venda
   lo que acá ya está tomado. Esto es la vuelta: leer el calendario que Booking
   publica y meter acá lo que Booking vendió, sin que nadie toque nada.

   POR QUÉ NO POR CORREO. Lo primero que uno piensa es leer el correo que llega
   cuando cae una reserva. No sirve: ese correo dice el número de reserva y una
   fecha, y nada más. No dice qué habitación es, ni el nombre, ni cuántas
   noches, ni el precio. Con eso no se puede armar una reserva.

   POR QUÉ EL CALENDARIO SÍ. Porque hay UNO POR HABITACIÓN. La dirección que se
   pega abajo ya viene atada a una pieza de Booking, y acá se la amarra a un
   alojamiento nuestro. Eso resuelve justo lo que al correo le falta: saber qué
   pieza es. Las fechas vienen exactas en el archivo, y según cómo esté la
   cuenta, a veces también el nombre del huésped y el número de reserva.

   LO QUE NUNCA VIENE ES EL PRECIO. Ningún calendario iCal lo lleva. Así que la
   reserva entra completa en lo que de verdad importa —la pieza queda bloqueada
   y el equipo se entera— y con el precio puesto a la tarifa de la casa, que hay
   que revisar: lo que Booking deposita es esa cifra menos su comisión. Se deja
   dicho en las notas de la reserva y en el aviso al grupo, para que nadie
   suponga que ese número ya está bueno.

   CÓMO NO SE DUPLICA NADA. Cada evento del calendario viaja con un UID que
   Booking no cambia. Ese UID queda escrito en la reserva. Mañana se vuelve a
   leer el mismo archivo y, comparando UIDs, se sabe qué es nuevo, qué se movió
   de fecha y qué desapareció, sin crear dos veces lo mismo. */

function bookingUrlDe_(idRecurso) {
  return String(config_('bookingIcal_' + idRecurso, '') || '').trim();
}

/* Los rótulos que ponen Booking y compañía cuando NO quieren decir quién es.
   Si el resumen del evento es uno de estos, no hay nombre y se sigue de largo:
   es preferible una reserva que se llame "Booking 5459534227" a una que se
   llame "CLOSED - Not available". */
var SIN_NOMBRE_ = ['closed', 'not available', 'unavailable', 'reserved',
                   'blocked', 'busy', 'ocupado', 'no disponible', 'cerrado'];

function bookingNombre_(ev) {
  var s = String(ev.resumen || '').trim();
  if (!s) return '';
  var l = s.toLowerCase();
  for (var i = 0; i < SIN_NOMBRE_.length; i++) {
    if (l.indexOf(SIN_NOMBRE_[i]) > -1) return '';
  }
  return s.slice(0, 80);
}

/* El número de reserva de Booking: nueve o diez dígitos. Puede venir en el
   resumen, en la descripción o dentro del propio UID. El mínimo son nueve a
   propósito: ocho dígitos seguidos serían una fecha (20260820). */
function bookingNumero_(ev) {
  var m = [ev.resumen, ev.descripcion, ev.uid].join(' ').match(/\b(\d{9,10})\b/);
  return m ? m[1] : '';
}

/* ---------- Leer un archivo .ics ----------
   Un iCal es texto plano de "NOMBRE;parámetros:valor", una por línea, y las
   líneas largas vienen cortadas: la continuación empieza con un espacio o un
   tabulador. Si eso no se pega antes de nada, un nombre largo llega partido. */
function icalLeer_(texto) {
  var sueltas = String(texto || '').replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  var juntas = [];
  sueltas.forEach(function (l) {
    if (/^[ \t]/.test(l) && juntas.length) juntas[juntas.length - 1] += l.slice(1);
    else juntas.push(l);
  });

  var eventos = [], actual = null;
  juntas.forEach(function (l) {
    if (/^BEGIN:VEVENT/i.test(l)) { actual = {}; return; }
    if (/^END:VEVENT/i.test(l)) { if (actual) eventos.push(actual); actual = null; return; }
    if (!actual) return;
    var c = l.indexOf(':');
    if (c < 0) return;
    var campo = l.slice(0, c).split(';')[0].toUpperCase();
    var valor = l.slice(c + 1)
      .replace(/\\n/gi, ' ').replace(/\\,/g, ',')
      .replace(/\\;/g, ';').replace(/\\\\/g, '\\').trim();
    if (campo === 'UID') actual.uid = valor;
    else if (campo === 'DTSTART') actual.inicio = icalFecha_(valor);
    else if (campo === 'DTEND') actual.fin = icalFecha_(valor);
    else if (campo === 'SUMMARY') actual.resumen = valor;
    else if (campo === 'DESCRIPTION') actual.descripcion = valor;
  });
  return eventos;
}

/* "20260820" o "20260820T140000Z" → "2026-08-20". Solo interesa el día: acá
   las reservas se cuentan por noches, no por horas. */
function icalFecha_(v) {
  var m = String(v || '').match(/(\d{4})(\d{2})(\d{2})/);
  return m ? m[1] + '-' + m[2] + '-' + m[3] : '';
}

/* ---------- El aviso al grupo ---------- */
function avisarBookingNueva_(idReserva, numero, sinNombre) {
  var r = leer_('Reservas').filter(function (x) { return x.id === idReserva; })[0];
  if (!r) return false;
  var lineas = ['🟦 <b>Reserva nueva desde Booking</b>', ''].concat(lineasReserva_(r));
  if (numero) lineas.push('🔖 N° ' + escTg_(numero));
  lineas.push('💵 ' + plataTg_(r, Number(r.total) || 0) + '  ·  a la tarifa de la casa');
  lineas.push('⚠️ Hay que revisarla: Booking no manda el precio' +
              (sinNombre ? ' ni el nombre' : '') + ' ni cuántas personas vienen.');
  return avisar_('booking', lineas.join('\n'));
}

function avisarBookingCambio_(titulo, lineas) {
  return avisar_('booking', [titulo, ''].concat(lineas).join('\n'));
}

/* ---------- ¿Con qué se topa este evento? ----------
   Antes de crear nada hay que mirar qué hay en esa pieza en esas fechas.
   Devuelve las reservas vivas que chocan, para poder distinguir tres cosas
   que parecen la misma y no lo son:

     - la reserva que el recepcionista YA cargó a mano mirando el correo de
       Booking (hay que reconocerla, no duplicarla);
     - el eco de nuestro propio calendario, cuando Booking nos devuelve como
       "ocupado" un día que le cerramos nosotros (hay que ignorarlo);
     - una sobreventa de verdad (hay que gritar).                             */
function bookingChoques_(rec, ev) {
  var choca = conflictosDe_(rec.id);
  return leer_('Reservas').filter(function (x) {
    return choca[String(x.recurso)] &&
      x.estado !== 'cancelada' && x.estado !== 'no_show' &&
      chocan_(ymd_(x.checkIn), ymd_(x.checkOut), ev.inicio, ev.fin);
  });
}

/* Una sobreventa se avisa UNA vez, no en cada pasada. Sin esto, con el
   disparador prendido, el mismo choque llenaba el grupo de mensajes cada
   pocos minutos hasta que el huésped se iba. */
function bookingYaAvisado_(uid) {
  try {
    var l = JSON.parse(String(config_('bookingAvisados', '') || '[]'));
    return l.indexOf(String(uid)) > -1;
  } catch (e) { return false; }
}

function bookingAnotarAviso_(uid) {
  var l = [];
  try { l = JSON.parse(String(config_('bookingAvisados', '') || '[]')); } catch (e) {}
  if (l.indexOf(String(uid)) === -1) l.push(String(uid));
  // Se recorta para que la lista no crezca sin fin: los últimos 200 alcanzan
  // de sobra, y un choque de hace meses ya no interesa.
  if (l.length > 200) l = l.slice(l.length - 200);
  actualizarConfig_('bookingAvisados', JSON.stringify(l));
}

function bookingAvisarChoque_(pieza, ev, num, detalle, res) {
  res.chocadas++;
  res.avisos.push(pieza + ': Booking vendió del ' + ev.inicio + ' al ' + ev.fin +
                  ' y acá ya estaba tomado. ' + detalle);
  if (bookingYaAvisado_(ev.uid)) return;
  bookingAnotarAviso_(ev.uid);
  avisarBookingCambio_('⚠️ <b>Booking vendió algo ya tomado</b>', [
    '🛏 ' + escTg_(pieza),
    '📅 ' + fechaTg_(ev.inicio) + ' → ' + fechaTg_(ev.fin),
    num ? '🔖 N° ' + escTg_(num) : '',
    '', escTg_(detalle),
    'Hay que resolverlo a mano en el extranet.'
  ].filter(String));
}

/* ---------- Reconocer la que ya estaba cargada a mano ----------
   El caso normal del mundo real: cae el correo de Booking, el recepcionista
   abre el extranet y carga la reserva a mano. Días después se conecta el
   calendario. Si la app no supiera reconocerla, crearía una segunda reserva
   del mismo huésped —o, si la pieza está ocupada por ella misma, gritaría una
   sobreventa que no existe cada pocos minutos.

   Reconocerla es escribirle el identificador del evento. Desde ese momento
   son la misma cosa: si Booking la mueve o la cancela, esta reserva la sigue,
   con su ficha firmada y su cuenta intactas. */
function bookingAdoptar_(ya, ev, rec, res, num) {
  var pieza = rec.unidad + (rec.nombre ? ' — ' + rec.nombre : '');
  var ci = ymd_(ya.checkIn), co = ymd_(ya.checkOut);
  var cambios = { uidExterno: ev.uid, feedExterno: rec.id };
  if (num && !String(ya.refExterna || '')) cambios.refExterna = num;

  // Si el que la cargó a mano le puso otras fechas —el correo de Booking solo
  // trae una—, mandan las del calendario, que son las que Booking vendió.
  var corrige = (ci !== ev.inicio || co !== ev.fin);
  if (corrige) { cambios.checkIn = ev.inicio; cambios.checkOut = ev.fin; }
  actualizar_('Reservas', 'id', ya.id, cambios);
  if (corrige) {
    asegurarPlan_(ya.id);
    sincronizarNoches_({ id: ya.id, recurso: ya.recurso, checkIn: ev.inicio,
                         checkOut: ev.fin, total: ya.total }, 'Booking');
  }
  res.adoptadas++;

  var lineas = ['👤 <b>' + escTg_(ya.huesped) + '</b>', '🛏 ' + escTg_(pieza)];
  if (corrige) {
    lineas.push('📅 ' + fechaTg_(ci) + ' → ' + fechaTg_(co));
    lineas.push('     <b>' + fechaTg_(ev.inicio) + ' → ' + fechaTg_(ev.fin) +
                '</b>  ·  según Booking');
  } else {
    lineas.push('📅 ' + fechaTg_(ev.inicio) + ' → ' + fechaTg_(ev.fin));
  }
  if (num) lineas.push('🔖 N° ' + escTg_(num));
  lineas.push('Ya estaba cargada acá. Queda enlazada a Booking, sin duplicarla.');
  return avisarBookingCambio_('🔗 <b>Reconocida una reserva de Booking</b>', lineas);
}

/* ---------- Crear lo que Booking vendió ---------- */
function bookingCrear_(ev, rec, res) {
  var pieza = rec.unidad + (rec.nombre ? ' — ' + rec.nombre : '');
  var num = bookingNumero_(ev);
  var choques = bookingChoques_(rec, ev);

  if (choques.length) {
    /* Un solo choque, en la MISMA pieza y sin dueño externo todavía: es una de
       las dos historias inocentes. Con dos o más ya no se puede adivinar cuál
       es cuál, así que se avisa y decide una persona. */
    var c = (choques.length === 1) ? choques[0] : null;
    var suelta = c && String(c.recurso) === String(rec.id) && !String(c.uidExterno || '');

    if (suelta && String(c.canal || '') === 'booking') {
      return bookingAdoptar_(c, ev, rec, res, num);
    }

    /* El eco. Le cerramos el día a Booking porque acá hay una reserva directa,
       y Booking nos lo devuelve como ocupado. Se pide que las fechas calcen
       EXACTAS: así se distingue del caso en que Booking de verdad vendió algo
       encima. Y no se adopta —solo se ignora— porque adoptarla ataría una
       reserva de WhatsApp a un calendario ajeno: el día que ese bloqueo
       desapareciera, la app cancelaría al huésped de verdad. */
    if (suelta && ymd_(c.checkIn) === ev.inicio && ymd_(c.checkOut) === ev.fin) {
      res.ecos++;
      return;
    }

    var quien = choques[0];
    return bookingAvisarChoque_(pieza, ev, num,
      'Ya hay una reserva de ' + quien.huesped + ' del ' + ymd_(quien.checkIn) +
      ' al ' + ymd_(quien.checkOut) + '.', res);
  }

  var nombre = bookingNombre_(ev);
  var id = uid_('R');
  var plan = armarNoches_(id, rec.id, ev.inicio, ev.fin, null, '');

  insertar_('Reservas', {
    id: id, recurso: rec.id, idUnidad: rec.idUnidad,
    huesped: nombre || ('Booking' + (num ? ' ' + num : '')),
    telefono: '', email: '', canal: 'booking',
    checkIn: ev.inicio, checkOut: ev.fin,
    // Confirmada, porque en Booking ya lo está: la pieza está vendida y no hay
    // nada que confirmar de este lado.
    estado: 'confirmada',
    total: plan.total, anticipo: 0, pax: 1, ninos: 0,
    notas: 'Entró sola desde el calendario de Booking' + (num ? ' · N° ' + num : '') +
      '. Falta revisar: el precio quedó a la tarifa de la casa y Booking descuenta ' +
      'su comisión' + (nombre ? '' : ', Booking no mandó el nombre') +
      ', y las personas quedaron en 1 porque el calendario no lo dice.',
    creado: ahora_(), creadoPor: 'Booking', tokenFicha: '',
    uidExterno: ev.uid, refExterna: num, feedExterno: rec.id
  });
  insertarVarias_('Noches', plan.noches);
  res.creadas++;
  avisarBookingNueva_(id, num, !nombre);
}

/* ---------- La que ya estaba: ¿se movió, revivió, o no cambió nada? ----------
   Ojo con la pieza: se usa la de la RESERVA, no la del calendario. Si alguien
   la cambió de habitación acá —"te paso a la otra matrimonial"— esa decisión
   es de una persona y manda sobre el archivo. Mirando la pieza del calendario
   la reserva se veía perdida y se creaba una copia en la pieza original. */
function bookingActualizar_(ya, ev, rec, res) {
  var suPieza = String(ya.recurso || rec.id);
  var pieza = nombreRecurso_(suPieza);
  var ci = ymd_(ya.checkIn), co = ymd_(ya.checkOut);
  var muerta = (ya.estado === 'cancelada' || ya.estado === 'no_show');
  if (ci === ev.inicio && co === ev.fin && !muerta) return;   // igual que ayer

  try {
    verificarLibre_(suPieza, ev.inicio, ev.fin, ya.id);
  } catch (e) {
    res.chocadas++;
    res.avisos.push(pieza + ': la reserva de ' + ya.huesped + ' se movió en Booking al ' +
                    ev.inicio + '–' + ev.fin + ', pero acá esas fechas están tomadas.');
    if (bookingYaAvisado_(ev.uid + '@' + ev.inicio)) return;
    bookingAnotarAviso_(ev.uid + '@' + ev.inicio);
    avisarBookingCambio_('⚠️ <b>Booking movió una reserva a fechas tomadas</b>', [
      '👤 <b>' + escTg_(ya.huesped) + '</b>',
      '🛏 ' + escTg_(pieza),
      '📅 ' + fechaTg_(ev.inicio) + ' → ' + fechaTg_(ev.fin),
      '', escTg_(e.message), 'Hay que resolverlo a mano.'
    ]);
    return;
  }

  // El plan de noches se repone antes de mover las fechas: después ya no se
  // sabría por qué noches se había cotizado. Es el mismo cuidado que tiene
  // moverReserva() cuando alguien arrastra una burbuja en el calendario.
  asegurarPlan_(ya.id);
  var cambios = { checkIn: ev.inicio, checkOut: ev.fin };
  if (muerta) cambios.estado = 'confirmada';
  actualizar_('Reservas', 'id', ya.id, cambios);
  sincronizarNoches_({ id: ya.id, recurso: suPieza, checkIn: ev.inicio, checkOut: ev.fin,
                       total: ya.total }, 'Booking');
  res.movidas++;

  avisarBookingCambio_(muerta ? '🔁 <b>Booking revivió una reserva</b>'
                              : '🔀 <b>Booking movió una reserva</b>', [
    '👤 <b>' + escTg_(ya.huesped) + '</b>',
    '🛏 ' + escTg_(pieza),
    '📅 ' + fechaTg_(ci) + ' → ' + fechaTg_(co),
    '     <b>' + fechaTg_(ev.inicio) + ' → ' + fechaTg_(ev.fin) + '</b>'
  ]);
}

/* Cuántas revisiones seguidas lleva este calendario llegando vacío. Vive en
   la configuración y no en memoria porque cada pasada del disparador es una
   ejecución nueva: en memoria se olvidaría siempre y nunca llegaría a dos. */
function bookingVaciasSumar_(idRecurso) {
  var n = (Number(config_('bookingVacio_' + idRecurso, 0)) || 0) + 1;
  actualizarConfig_('bookingVacio_' + idRecurso, n);
  return n;
}

function bookingVaciasBorrar_(idRecurso) {
  if (Number(config_('bookingVacio_' + idRecurso, 0)) || 0) {
    actualizarConfig_('bookingVacio_' + idRecurso, 0);
  }
}

/* ---------- La pasada completa ----------
   Se llama sola desde el disparador cada cuarto de hora, y también a mano
   desde Configuración. Va con candado: si se cruza con alguien guardando una
   reserva desde la pantalla, una espera a la otra y no se pisan. */
function sincronizarBooking() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) {
    return { cuando: ahora_(), creadas: 0, adoptadas: 0, movidas: 0, canceladas: 0,
             chocadas: 0, ecos: 0, revisadas: 0, numeradas: 0, sinCargar: 0,
             avisos: ['El sistema estaba ocupado; se reintenta solo.'] };
  }
  try {
    return bookingSincronizar_();
  } catch (e) {
    // Un disparador que revienta deja de correr y nadie se entera. Mejor
    // dejarlo escrito y que la pantalla lo muestre.
    var mal = { cuando: ahora_(), creadas: 0, adoptadas: 0, movidas: 0, canceladas: 0,
                chocadas: 0, ecos: 0, revisadas: 0, numeradas: 0, sinCargar: 0,
                avisos: ['Falló la sincronización: ' + (e.message || e)] };
    try {
      actualizarConfig_('bookingUltima', JSON.stringify(mal));
    } catch (e2) {}
    return mal;
  } finally {
    lock.releaseLock();
  }
}

function bookingSincronizar_() {
  var res = { cuando: ahora_(), creadas: 0, adoptadas: 0, movidas: 0, canceladas: 0,
              chocadas: 0, ecos: 0, revisadas: 0, numeradas: 0, sinCargar: 0, avisos: [] };
  var conUrl = recursos_().filter(function (r) { return !!bookingUrlDe_(r.id); });
  if (!conUrl.length) {
    res.avisos.push('Todavía no hay ninguna dirección de Booking pegada.');
    actualizarConfig_('bookingUltima', JSON.stringify(res));
    bookingCorreoDeLaPasada_(res);
    return res;
  }
  var hoy = hoy_();

  conUrl.forEach(function (rec) {
    var pieza = rec.unidad + (rec.nombre ? ' — ' + rec.nombre : '');
    var texto;
    try {
      var r = UrlFetchApp.fetch(bookingUrlDe_(rec.id),
                                { muteHttpExceptions: true, followRedirects: true });
      if (r.getResponseCode() !== 200) {
        res.avisos.push(pieza + ': Booking contestó ' + r.getResponseCode() + '.');
        return;
      }
      texto = r.getContentText();
    } catch (e) {
      res.avisos.push(pieza + ': no se pudo leer el calendario (' + (e.message || e) + ').');
      return;
    }
    if (String(texto).indexOf('BEGIN:VCALENDAR') === -1) {
      res.avisos.push(pieza + ': esa dirección no devuelve un calendario.');
      return;
    }

    var eventos = icalLeer_(texto).filter(function (ev) {
      // Lo que ya terminó no se toca: Booking lo va sacando de su archivo y no
      // hay nada que hacer con una reserva del mes pasado.
      return ev.uid && ev.inicio && ev.fin && ev.fin > ev.inicio && ev.fin > hoy;
    });
    res.revisadas += eventos.length;

    /* Dos índices, y la diferencia importa.

       'conocidas' busca por identificador en TODAS las piezas, porque una
       reserva de Booking se puede haber cambiado de habitación acá y sigue
       siendo la misma. Mirando solo esta pieza se la daba por nueva y se
       creaba una copia en cada pasada.

       'mias' son las que llegaron por ESTE calendario —de ahí la columna
       feedExterno, que no cambia aunque la reserva se mude de pieza—, y sirve
       solo para el barrido de cancelaciones: desaparecer de este archivo dice
       algo de estas y de ninguna otra. */
    var conocidas = {}, mias = {};
    leer_('Reservas').forEach(function (x) {
      var u = String(x.uidExterno || '');
      if (!u) return;
      conocidas[u] = x;
      var feed = String(x.feedExterno || x.recurso);
      if (feed === String(rec.id)) mias[u] = x;
    });

    var vistos = {};
    eventos.forEach(function (ev) {
      vistos[ev.uid] = true;
      if (conocidas[ev.uid]) bookingActualizar_(conocidas[ev.uid], ev, rec, res);
      else bookingCrear_(ev, rec, res);
    });

    /* Lo que desapareció del calendario: Booking lo canceló.

       Con una red de seguridad, pero fina. Un archivo vacío es ambiguo: puede
       ser que se cancelaron todas —lo más común, porque una pieza sola pasa
       la mitad del año sin nada vendido— o puede ser Booking sirviendo mal el
       archivo por un rato. La primera versión no cancelaba NUNCA con el
       archivo vacío, y eso rompía el caso normal: cancelabas en Booking y la
       reserva se quedaba pegada acá para siempre.

       Ahora se pide que venga vacío DOS revisiones seguidas. Un tropiezo
       pasajero no alcanza; una cancelación de verdad sí, porque el archivo
       sigue vacío en la pasada siguiente. La cuenta se guarda por calendario
       y se borra apenas vuelve a llegar un evento. */
    var vivas = [];
    Object.keys(mias).forEach(function (u) {
      var x = mias[u];
      if (vistos[u]) return;
      if (x.estado === 'cancelada' || x.estado === 'no_show') return;
      if (ymd_(x.checkOut) < hoy) return;
      vivas.push(x);
    });
    if (eventos.length) bookingVaciasBorrar_(rec.id);
    if (!vivas.length) return;
    if (!eventos.length && bookingVaciasSumar_(rec.id) < 2) {
      res.avisos.push(pieza + ': el calendario vino vacío. Si sigue así en la ' +
        'próxima revisión se cancela' + (vivas.length === 1 ? ' la reserva que hay'
                                                            : 'n las ' + vivas.length + ' que hay') +
        '. Aprieta "Revisar ahora" otra vez si quieres que sea al tiro.');
      return;
    }
    bookingVaciasBorrar_(rec.id);
    vivas.forEach(function (x) {
      actualizar_('Reservas', 'id', x.id, { estado: 'cancelada' });
      res.canceladas++;
      avisarBookingCambio_('❌ <b>Booking canceló una reserva</b>', [
        '👤 <b>' + escTg_(x.huesped) + '</b>',
        '🛏 ' + escTg_(nombreRecurso_(x.recurso)),
        '📅 ' + fechaTg_(x.checkIn) + ' → ' + fechaTg_(x.checkOut)
      ]);
    });
  });

  bookingCorreoDeLaPasada_(res);
  actualizarConfig_('bookingUltima', JSON.stringify(res));
  return res;
}

/* El correo va pegado a la misma pasada: un solo disparador hace las dos
   cosas. Envuelto, porque un problema leyendo el correo no puede llevarse por
   delante la sincronización del calendario, que es la que de verdad importa. */
function bookingCorreoDeLaPasada_(res) {
  if (!bookingCorreoActivo_()) return;
  try {
    var c = bookingRevisarCorreo_();
    res.numeradas = c.numeradas;
    res.canceladas += c.canceladas;
    res.sinCargar = c.sinCargar;
    (c.avisos || []).forEach(function (a) { res.avisos.push(a); });
  } catch (e) {
    res.avisos.push('No se pudo revisar el correo: ' + (e.message || e));
  }
}

/* ---------- Lo que usa la pantalla de Configuración ---------- */

function bookingEstado(token) {
  var u = sesion_(token);
  exigirAdmin_(u);
  var ultima = null;
  try { ultima = JSON.parse(String(config_('bookingUltima', '') || 'null')); } catch (e) {}
  return {
    activo: String(config_('bookingAuto', 'no')) === 'si',
    correo: bookingCorreoActivo_(),
    cada: bookingCada_(),
    minutos: BOOKING_MINUTOS_,
    ultima: ultima,
    recursos: recursos_().map(function (r) {
      return {
        id: r.id,
        nombre: r.unidad + (r.nombre ? ' — ' + r.nombre : ''),
        grupo: r.grupo,
        url: bookingUrlDe_(r.id)
      };
    })
  };
}

function bookingGuardarUrl(token, idRecurso, url) {
  var u = sesion_(token);
  exigirAdmin_(u);
  var v = String(url || '').trim();
  // webcal:// es la misma dirección con otro nombre; UrlFetchApp solo entiende
  // http. Booking a veces la ofrece así y pegarla tal cual no funcionaría.
  if (/^webcal:\/\//i.test(v)) v = 'https://' + v.slice(9);
  if (v && !/^https?:\/\//i.test(v)) {
    throw new Error('Esa no parece una dirección de calendario. Tiene que empezar con https://');
  }
  actualizarConfig_('bookingIcal_' + idRecurso, v);
  logCambio_(u.nombre, 'booking_url', idRecurso + (v ? ' puesta' : ' borrada'));
  return true;
}

function bookingSincronizarAhora(token) {
  var u = sesion_(token);
  exigirAdmin_(u);
  return sincronizarBooking();
}

/* Cada cuánto se mira Booking. Google solo acepta estos cinco valores para un
   disparador por minutos; cualquier otro número lo rechaza. */
var BOOKING_MINUTOS_ = [1, 5, 10, 15, 30];

function bookingCada_() {
  var n = Number(config_('bookingCada', 5)) || 5;
  return BOOKING_MINUTOS_.indexOf(n) > -1 ? n : 5;
}

/* Enciende o apaga el disparador que lee Booking solo. Se borran primero los
   que hubiera: si no, cada vez que se apretara el botón quedaría uno más y
   terminarían corriendo cinco a la vez.

   Sobre el intervalo. Cinco minutos es el que viene puesto y es el que
   conviene. Se puede bajar a uno, pero Google le da a cada cuenta un rato
   limitado de disparadores al día —una hora y media en las cuentas gratis— y
   mirar Booking cada minuto son 1.440 pasadas diarias, cada una con una
   llamada por habitación conectada. Con varias piezas eso se come la cuota
   antes de que termine el día, y cuando se acaba el disparador deja de correr
   entero: se pasa de revisar cada minuto a no revisar nada. Cinco minutos
   gasta la quinta parte y la diferencia real son cuatro minutos de demora. */
function bookingAutomatico(token, encender, cada) {
  var u = sesion_(token);
  exigirAdmin_(u);
  var n = Number(cada) || bookingCada_();
  if (BOOKING_MINUTOS_.indexOf(n) === -1) {
    throw new Error('Google solo acepta ' + BOOKING_MINUTOS_.join(', ') + ' minutos.');
  }
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'sincronizarBooking') ScriptApp.deleteTrigger(t);
  });
  if (encender) {
    ScriptApp.newTrigger('sincronizarBooking').timeBased().everyMinutes(n).create();
  }
  actualizarConfig_('bookingCada', n);
  actualizarConfig_('bookingAuto', encender ? 'si' : 'no');
  logCambio_(u.nombre, 'booking_auto',
             (encender ? 'encendido cada ' + n + ' min' : 'apagado'));
  return { activo: !!encender, cada: n };
}


/* ===================== EL CORREO DE BOOKING =====================

   El calendario dice QUÉ pieza y QUÉ días. El correo dice el NÚMERO de la
   reserva. Ninguno de los dos dice el nombre del huésped —Booking eso lo
   guarda dentro del extranet y no lo publica en ninguna parte— así que lo
   mejor que se puede hacer es dejar el número pegado a la reserva y, con él,
   un enlace de un toque que abre esa reserva exacta en el extranet, donde sí
   sale de quién es.

   Cómo se cruzan. El asunto del correo trae las dos cosas que hacen falta:

     Booking.com - ¡Nueva reserva! (6276704596, viernes, 21 de agosto de 2026)

   el número y el día de llegada. Con esa fecha se busca la reserva que entró
   por el calendario y todavía no tiene número. Si hay exactamente una, es esa.
   Si hay dos que llegan el mismo día, no se adivina: se avisa y decide una
   persona.

   Y sirve para algo más. Si llega un correo de una reserva que acá no está
   —porque esa habitación todavía no tiene su calendario pegado— el grupo se
   entera igual. Es la única red que cubre las piezas sin conectar.

   Se lee y nada más. El permiso que pide es de SOLO LECTURA: está declarado
   en appsscript.json como gmail.readonly, así que aunque el código quisiera,
   no puede mandar, borrar ni mover un correo. */

var BOOKING_MESES_ = {
  enero: 1, febrero: 2, marzo: 3, abril: 4, mayo: 5, junio: 6, julio: 7,
  agosto: 8, septiembre: 9, setiembre: 9, octubre: 10, noviembre: 11, diciembre: 12,
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6, july: 7,
  august: 8, september: 9, october: 10, november: 11, december: 12
};

/* "viernes, 21 de agosto de 2026" → "2026-08-21". Aguanta también el inglés,
   por si la cuenta se cambia de idioma alguna vez. */
function bookingFechaTexto_(t) {
  var m = String(t || '').match(
    /(\d{1,2})\s+(?:de\s+)?([A-Za-zÁÉÍÓÚÑáéíóúñ]+)\s+(?:de\s+)?(\d{4})/);
  if (!m) return '';
  var mes = BOOKING_MESES_[m[2].toLowerCase()];
  if (!mes) return '';
  return m[3] + '-' + ('0' + mes).slice(-2) + '-' + ('0' + m[1]).slice(-2);
}

function bookingTipoCorreo_(asunto) {
  var a = String(asunto || '').toLowerCase();
  if (/cancelad|cancelled|canceled/.test(a)) return 'cancelada';
  if (/modificad|modified|cambio en la reserva/.test(a)) return 'modificada';
  if (/nueva reserva|new booking|new reservation/.test(a)) return 'nueva';
  return '';                                   // promociones, avisos, facturas
}

/* Todo lo que se le puede sacar a un correo, sin abrirlo entero. */
function bookingLeerCorreo_(asunto, cuerpo) {
  var tipo = bookingTipoCorreo_(asunto);
  if (!tipo) return null;
  var num = (String(asunto).match(/\b(\d{9,10})\b/) || [])[1] || '';
  if (!num && cuerpo) {
    // En el cuerpo el número viaja dos veces: en el título de la confirmación
    // y dentro del enlace al extranet. El del enlace es el más fiable.
    num = (String(cuerpo).match(/res_id=(\d{9,10})/) || [])[1] ||
          (String(cuerpo).match(/\b(\d{9,10})\b/) || [])[1] || '';
  }
  return { tipo: tipo, numero: num, fecha: bookingFechaTexto_(asunto) };
}

/* El identificador del establecimiento, para armar el enlace al extranet. No
   se pregunta: viaja en cada correo y se aprende solo la primera vez. */
function bookingHotelId_(cuerpo) {
  var g = String(config_('bookingHotelId', '') || '');
  if (g) return g;
  var m = String(cuerpo || '').match(/hotel_id=(\d+)/);
  if (m) { actualizarConfig_('bookingHotelId', m[1]); return m[1]; }
  return '';
}

function bookingLinkReserva_(num) {
  if (!num) return '';
  var h = String(config_('bookingHotelId', '') || '');
  return 'https://admin.booking.com/hotel/hoteladmin/extranet_ng/manage/booking.html' +
         '?res_id=' + encodeURIComponent(num) +
         (h ? '&hotel_id=' + encodeURIComponent(h) : '') + '&lang=es';
}

/* Los correos ya mirados. Se guardan sus identificadores para no volver a
   procesarlos, y se recortan: con catorce días de búsqueda, doscientos
   sobran. Va en la configuración y no en memoria porque cada pasada del
   disparador es una ejecución nueva. */
function bookingCorreosVistos_() {
  try {
    var l = JSON.parse(String(config_('bookingCorreosVistos', '') || '[]'));
    var m = {};
    l.forEach(function (x) { m[x] = 1; });
    return { mapa: m, lista: l };
  } catch (e) { return { mapa: {}, lista: [] }; }
}

function bookingCorreosGuardar_(v) {
  var l = v.lista;
  if (l.length > 200) l = l.slice(l.length - 200);
  actualizarConfig_('bookingCorreosVistos', JSON.stringify(l));
}

/* ---------- La pasada por el correo ---------- */
function bookingRevisarCorreo_() {
  var res = { mirados: 0, numeradas: 0, canceladas: 0, sinCargar: 0, dudosas: 0, avisos: [] };
  if (typeof GmailApp === 'undefined') {
    res.avisos.push('Este script todavía no tiene permiso para leer el correo.');
    return res;
  }

  var hilos;
  try {
    hilos = GmailApp.search('from:booking.com newer_than:14d', 0, 40);
  } catch (e) {
    res.avisos.push('No se pudo leer el correo: ' + (e.message || e));
    return res;
  }

  var vistos = bookingCorreosVistos_();
  var ahora = new Date().getTime();

  hilos.forEach(function (h) {
    h.getMessages().forEach(function (m) {
      var id;
      try { id = m.getId(); } catch (e) { return; }
      if (vistos.mapa[id]) return;

      var asunto = '', cuerpo = '';
      try { asunto = m.getSubject() || ''; } catch (e) {}
      var datos = bookingLeerCorreo_(asunto, '');
      if (!datos) { vistos.mapa[id] = 1; vistos.lista.push(id); return; }

      // El cuerpo solo se pide si hace falta: es lo caro de leer un correo.
      if (!datos.numero || !config_('bookingHotelId', '')) {
        try { cuerpo = m.getPlainBody() || ''; } catch (e) {}
        datos = bookingLeerCorreo_(asunto, cuerpo);
        bookingHotelId_(cuerpo);
      }
      res.mirados++;
      if (!datos.numero) { vistos.mapa[id] = 1; vistos.lista.push(id); return; }

      var edad = 0;
      try { edad = ahora - m.getDate().getTime(); } catch (e) {}

      if (bookingCruzarCorreo_(datos, edad, res)) {
        vistos.mapa[id] = 1;
        vistos.lista.push(id);
      }
      // Si devuelve false, el correo queda SIN marcar a propósito: es una
      // reserva recién caída que el calendario todavía no alcanzó a traer, y
      // se vuelve a intentar en la pasada siguiente.
    });
  });

  bookingCorreosGuardar_(vistos);
  return res;
}

/* Cruza UN correo con lo que hay acá. Devuelve true si el correo ya se puede
   dar por procesado, false si conviene reintentarlo más tarde. */
function bookingCruzarCorreo_(datos, edad, res) {
  var todas = leer_('Reservas');
  var conNumero = todas.filter(function (x) {
    return String(x.refExterna || '') === datos.numero;
  })[0];

  if (conNumero) {
    if (datos.tipo === 'cancelada' &&
        conNumero.estado !== 'cancelada' && conNumero.estado !== 'no_show') {
      // El correo de cancelación llega al instante; el calendario se demora en
      // vaciarse y encima necesita dos pasadas. Con el número en la mano no
      // hay ambigüedad ninguna, así que se cancela al tiro.
      actualizar_('Reservas', 'id', conNumero.id, { estado: 'cancelada' });
      res.canceladas++;
      avisarBookingCambio_('❌ <b>Booking canceló una reserva</b>', [
        '👤 <b>' + escTg_(conNumero.huesped) + '</b>',
        '🛏 ' + escTg_(nombreRecurso_(conNumero.recurso)),
        '📅 ' + fechaTg_(conNumero.checkIn) + ' → ' + fechaTg_(conNumero.checkOut),
        '🔖 N° ' + escTg_(datos.numero) + '  ·  lo dijo el correo'
      ]);
    }
    return true;
  }

  if (datos.tipo === 'cancelada') return true;   // nunca llegó a estar acá
  if (!datos.fecha) return true;                 // sin fecha no hay con qué cruzar

  var candidatas = todas.filter(function (x) {
    return String(x.canal || '') === 'booking' &&
      !String(x.refExterna || '') &&
      x.estado !== 'cancelada' && x.estado !== 'no_show' &&
      ymd_(x.checkIn) === datos.fecha;
  });

  if (candidatas.length === 1) {
    actualizar_('Reservas', 'id', candidatas[0].id, { refExterna: datos.numero });
    res.numeradas++;
    var link = bookingLinkReserva_(datos.numero);
    avisarBookingCambio_('🔖 <b>Reserva de Booking N° ' + escTg_(datos.numero) + '</b>', [
      '🛏 ' + escTg_(nombreRecurso_(candidatas[0].recurso)),
      '📅 ' + fechaTg_(candidatas[0].checkIn) + ' → ' + fechaTg_(candidatas[0].checkOut),
      '', 'Booking no manda el nombre del huésped en ninguna parte. Acá se ve:',
      link
    ]);
    return true;
  }

  if (candidatas.length > 1) {
    res.dudosas++;
    res.avisos.push('Llegaron ' + candidatas.length + ' reservas de Booking el ' +
      datos.fecha + '. No se puede saber cuál es la N° ' + datos.numero +
      ' sin mirarlo, así que ninguna quedó numerada.');
    return true;
  }

  /* No hay ninguna. Dos motivos posibles, y se distinguen por el reloj:
     - Recién cayó y el calendario todavía no la trae: se deja sin marcar y se
       reintenta. El calendario de Booking tarda unos minutos en incluirla.
     - Ya pasó media hora: esa habitación no tiene su calendario pegado, y esta
       es la única forma de enterarse. Se avisa. */
  if (edad < 30 * 60 * 1000) return false;

  res.sinCargar++;
  res.avisos.push('Cayó una reserva en Booking (N° ' + datos.numero + ', llega el ' +
    datos.fecha + ') que no está acá. Lo más probable es que esa habitación ' +
    'todavía no tenga su calendario pegado.');
  avisarBookingCambio_('📨 <b>Reserva de Booking sin cargar</b>', [
    '🔖 N° ' + escTg_(datos.numero),
    '📅 llega el ' + fechaTg_(datos.fecha),
    '', 'No apareció sola en el calendario. Puede que esa pieza no tenga ' +
        'pegada su dirección de Booking.',
    bookingLinkReserva_(datos.numero)
  ]);
  return true;
}

/* ---------- Correr esta función a mano, una vez ----------

   Declarar un permiso en appsscript.json no lo concede: solo dice cuál se va
   a pedir. Quien lo concede es una persona apretando "Permitir", y esa
   pantalla solo aparece corriendo algo desde el editor — la app web nunca la
   muestra: si le falta un permiso, falla y ya.

   Por eso existe esta función. No hace nada útil aparte de tocar el correo,
   que es justo lo que obliga a Google a pedir el permiso que falta. Se elige
   desde el editor de Apps Script, se aprieta Ejecutar, se acepta, y listo. */
function autorizarCorreo() {
  var n = GmailApp.search('from:booking.com newer_than:14d', 0, 10).length;
  var msg = 'Listo: el permiso está concedido. Se ven ' + n +
            ' conversación(es) de Booking de los últimos 14 días.' +
            (n ? '' : ' No hay ninguna, pero el permiso quedó dado igual.');
  Logger.log(msg);
  return msg;
}

function bookingCorreoActivo_() {
  return String(config_('bookingCorreo', 'no')) === 'si';
}

function bookingCorreoEncender(token, encender) {
  var u = sesion_(token);
  exigirAdmin_(u);
  actualizarConfig_('bookingCorreo', encender ? 'si' : 'no');
  logCambio_(u.nombre, 'booking_correo', encender ? 'encendido' : 'apagado');
  return { activo: !!encender };
}

function bookingCorreoAhora(token) {
  var u = sesion_(token);
  exigirAdmin_(u);
  var r = bookingRevisarCorreo_();
  actualizarConfig_('bookingCorreoUltima', JSON.stringify(
    { cuando: ahora_(), mirados: r.mirados, numeradas: r.numeradas,
      canceladas: r.canceladas, sinCargar: r.sinCargar, dudosas: r.dudosas,
      avisos: r.avisos }));
  return r;
}

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

/* El enlace de la ficha es la única llave del huésped: no hay sesión ni
   clave, así que la validación vive en un solo lugar. */
function porTokenFicha_(t) {
  var r = leer_('Reservas').filter(function (x) {
    return String(x.tokenFicha) === String(t) && String(t) !== '';
  })[0];
  if (!r) throw new Error('Enlace no válido o vencido.');
  if (r.estado === 'cancelada') throw new Error('Esta reserva fue cancelada.');
  return r;
}

function fichaPublicaCargar(t) {
  var r = porTokenFicha_(t);
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
    ninos: Number(r.ninos) || 0,
    // Si es turista extranjero, la página le ofrece subir pasaporte y PDI.
    extranjero: !!r.extranjero,
    documentos: documentosDe_(r.id).map(function (d) {
      return { id: d.id, tipo: d.tipo, rotulo: d.rotulo, creado: d.creado };
    }),
    acompanantes: acompanantesDe_(r.id)
  };
}

function fichaPublicaFirmar(t, d) {
  var r = porTokenFicha_(t);
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
  var cambio = dolarHoy_();
  var lista = leer_('Unidades')
    .sort(function (a, b) { return Number(a.orden) - Number(b.orden); })
    .map(function (x) {
      return {
        id: x.id, nombre: x.nombre, grupo: x.grupo, capacidad: Number(x.capacidad) || 0,
        bano: x.bano, porCama: !!x.porCama, modo: modoDe_(x),
        categoria: String(x.categoria || '') || categoriaPorDefecto_(x),
        precioBase: Number(x.precioBase) || 0, precioAlta: Number(x.precioAlta) || 0,
        // El precio en dólares va SIN IVA: es lo que se le cotiza a un
        // turista extranjero, que va exento. La tarifa de la casa lleva el
        // impuesto incluido, así que primero se le descuenta.
        usdBase: aUsd_(netoDe_(x.precioBase), cambio.valor),
        usdAlta: aUsd_(netoDe_(x.precioAlta), cambio.valor),
        orden: Number(x.orden) || 0, activa: !!x.activa,
        camas: camas.filter(function (c) { return c.idUnidad === x.id; })
          .sort(function (a, b) { return Number(a.orden) - Number(b.orden); })
          .map(function (c) {
            return {
              id: c.id, nombre: c.nombre, precioBase: Number(c.precioBase) || 0,
              precioAlta: Number(c.precioAlta) || 0, activa: !!c.activa,
              usdBase: aUsd_(netoDe_(c.precioBase), cambio.valor),
              usdAlta: aUsd_(netoDe_(c.precioAlta), cambio.valor)
            };
          })
      };
    });
  return { unidades: lista, dolar: cambio, iva: ivaPct_() };
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
      out.mensaje = plural_(out.ilegibles, 'reserva tiene', 'reservas tienen') +
        ' fechas ilegibles y por eso no ' + (out.ilegibles === 1 ? 'aparece' : 'aparecen') + ' ' +
        'en el calendario. Ejecuta repararReservas() desde el editor para revisarlas.';
      return out;
    }
    out.mensaje = 'Todo en orden: ' + plural_(out.usuarios, 'usuario', 'usuarios') + ', ' +
      plural_(out.unidades, 'unidad', 'unidades') + ' y ' +
      plural_(out.reservas, 'reserva', 'reservas') + '.';
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

  var nochesVendidas = 0, ingresos = 0, abonado = 0, conPrograma = 0, paxNoches = 0;
  var porCanal = {}, porUnidad = {}, porMes = {}, porPrograma = {};

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
    // Los programas vendidos: cuántas reservas y cuánta plata. Es lo que
    // dice si un programa vale la pena o si nadie lo pide.
    if (r.programa || r.programaNombre) {
      conPrograma++;
      var np = String(r.programaNombre || '') ||
               ((programaPorId_(r.programa) || {}).nombre) || 'Programa';
      porPrograma[np] = porPrograma[np] ||
        { nombre: np, reservas: 0, noches: 0, ingresos: 0 };
      porPrograma[np].reservas++;
      porPrograma[np].noches += nDentro;
      porPrograma[np].ingresos += proporcion;
    }

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
    conPrograma: conPrograma,
    porPrograma: ordenar(porPrograma, 'ingresos'),
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

/* El buscador acepta además un rango de fechas: "quiénes se alojaron en
   febrero". Una estadía entra si se cruza con el rango en aunque sea una
   noche, no solo si empieza dentro: alguien que llegó el 28 y se fue el 3
   estuvo en los dos meses. */
function huespedes(token, texto, desde, hasta) {
  sesion_(token);
  var busca = normalizar_(texto);
  var digitos = soloDigitos_(texto);
  var d = ymd_(desde), h = ymd_(hasta);

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
    // Se cruzan los rangos: la estadía toca el período si empieza antes de
    // que termine y termina después de que empieza.
    if (d && co <= d) return;
    if (h && ci >= h) return;
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
      // La misma cuenta vista desde el historial es la misma cuenta: si esa
      // estadía se cobró en dólares, acá también se lee en dólares.
      extranjero: !!r.extranjero, dolar: Number(r.dolar) || 0,
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
    x.documentos = documentosDe_(x.id);
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
