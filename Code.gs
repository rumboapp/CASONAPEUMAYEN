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
  Reservas: ['id', 'recurso', 'idUnidad', 'huesped', 'telefono', 'canal', 'checkIn', 'checkOut', 'estado', 'total', 'anticipo', 'addon', 'addonFecha', 'notas', 'creado', 'creadoPor'],
  Aseo: ['idUnidad', 'estado', 'responsable', 'notas', 'actualizado'],
  Fichas: ['id', 'idReserva', 'nombre', 'documento', 'nacionalidad', 'nacimiento', 'procedencia', 'destino', 'motivo', 'emergencia', 'firmaUrl', 'fecha'],
  Usuarios: ['nombre', 'rol', 'pinHash', 'activo'],
  Sesiones: ['token', 'nombre', 'rol', 'expira'],
  Config: ['clave', 'valor']
};

/* Columnas que deben guardarse como TEXTO plano y no como fecha de Sheets.
   Esto era el origen del bug de reservas duplicadas: Sheets convertía
   "2026-08-07" en un objeto Date con hora local y las comparaciones fallaban. */
var COLS_TEXTO = {
  Reservas: ['checkIn', 'checkOut', 'addonFecha', 'creado'],
  Fichas: ['nacimiento', 'fecha'],
  Aseo: ['actualizado'],
  Sesiones: ['expira']
};

function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Casona Peumayén')
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

function leer_(nombre) {
  var v = hoja_(nombre).getDataRange().getValues();
  if (v.length < 2) return [];
  var cab = v[0], out = [];
  for (var i = 1; i < v.length; i++) {
    if (String(v[i].join('')).trim() === '') continue;
    var o = {};
    for (var j = 0; j < cab.length; j++) o[cab[j]] = v[i][j];
    out.push(o);
  }
  return out;
}

function insertar_(nombre, obj) {
  hoja_(nombre).appendRow(HOJAS[nombre].map(function (c) {
    return obj[c] === undefined || obj[c] === null ? '' : obj[c];
  }));
}

function actualizar_(nombre, campoId, valorId, cambios) {
  var sh = hoja_(nombre), v = sh.getDataRange().getValues(), cab = v[0];
  var ci = cab.indexOf(campoId);
  for (var i = 1; i < v.length; i++) {
    if (String(v[i][ci]) === String(valorId)) {
      Object.keys(cambios).forEach(function (k) {
        var c = cab.indexOf(k);
        if (c > -1) sh.getRange(i + 1, c + 1).setValue(cambios[k]);
      });
      return true;
    }
  }
  return false;
}

function guardarOCrear_(nombre, campoId, valorId, obj) {
  if (!actualizar_(nombre, campoId, valorId, obj)) insertar_(nombre, obj);
}

function borrar_(nombre, campoId, valorId) {
  var sh = hoja_(nombre), v = sh.getDataRange().getValues(), ci = v[0].indexOf(campoId);
  for (var i = v.length - 1; i >= 1; i--) if (String(v[i][ci]) === String(valorId)) sh.deleteRow(i + 1);
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

function ahora_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd HH:mm'); }
function hoy_() { return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd'); }

/* Dos estadías chocan si se pisan. El día de check-out queda libre para el siguiente. */
function chocan_(inA, outA, inB, outB) { return inA < outB && inB < outA; }

function config_(clave, porDefecto) {
  var f = leer_('Config').filter(function (r) { return r.clave === clave; })[0];
  return f ? f.valor : porDefecto;
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

  Object.keys(HOJAS).forEach(function (nombre) {
    var sh = ss.getSheetByName(nombre) || ss.insertSheet(nombre);
    sh.getRange(1, 1, 1, HOJAS[nombre].length).setValues([HOJAS[nombre]]);
    sh.setFrozenRows(1);
    (COLS_TEXTO[nombre] || []).forEach(function (col) {
      var c = HOJAS[nombre].indexOf(col) + 1;
      if (c > 0) sh.getRange(1, c, sh.getMaxRows(), 1).setNumberFormat('@');
    });
  });

  ['Hoja 1', 'Sheet1', 'Hoja1'].forEach(function (n) {
    var sh = ss.getSheetByName(n);
    if (sh && ss.getSheets().length > 1) ss.deleteSheet(sh);
  });

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

function salir(token) { borrar_('Sesiones', 'token', token); return true; }

function sesion_(token) {
  var s = leer_('Sesiones').filter(function (x) { return x.token === token; })[0];
  if (!s) throw new Error('Sesión no válida. Vuelve a entrar.');
  if (String(s.expira) < ahora_()) { borrar_('Sesiones', 'token', token); throw new Error('Sesión expirada.'); }
  return { nombre: s.nombre, rol: s.rol };
}

/* ===================== DATOS DEL CALENDARIO ===================== */

/* Recursos = filas del calendario. Cada habitación entera, o cada cama en las compartidas. */
function recursos_() {
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
          precioBase: Number(c.precioBase) || 0, precioAlta: Number(c.precioAlta) || 0, capacidad: 1
        });
      });
    } else {
      out.push({
        id: u.id, idUnidad: u.id, grupo: u.grupo, unidad: u.nombre, nombre: '',
        precioBase: Number(u.precioBase) || 0, precioAlta: Number(u.precioAlta) || 0,
        capacidad: Number(u.capacidad) || 2
      });
    }
  });
  return out;
}

/* Todo lo que la pantalla del calendario necesita, en una sola llamada. */
function cargarTablero(token, desde, hasta) {
  sesion_(token);
  var d = ymd_(desde), h = ymd_(hasta);
  var reservas = leer_('Reservas')
    .filter(function (r) {
      return r.estado !== 'cancelada' && chocan_(ymd_(r.checkIn), ymd_(r.checkOut), d, h);
    })
    .map(function (r) {
      return {
        id: r.id, recurso: r.recurso, idUnidad: r.idUnidad, huesped: r.huesped,
        telefono: r.telefono, canal: r.canal,
        checkIn: ymd_(r.checkIn), checkOut: ymd_(r.checkOut),
        estado: r.estado, total: Number(r.total) || 0, anticipo: Number(r.anticipo) || 0,
        addon: !!r.addon, addonFecha: r.addonFecha ? String(r.addonFecha) : '',
        notas: r.notas || ''
      };
    });
  return {
    recursos: recursos_(), reservas: reservas, hoy: hoy_(),
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
  if (!datos.recurso) throw new Error('Falta elegir la habitación o cama.');
  if (!String(datos.huesped || '').trim()) throw new Error('Falta el nombre del huésped.');

  // El bloqueo evita que dos personas guarden a la vez y se pisen las reservas.
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    verificarLibre_(datos.recurso, f.checkIn, f.checkOut, datos.id);
    var unidad = recursos_().filter(function (x) { return x.id === datos.recurso; })[0];

    if (datos.id) {
      actualizar_('Reservas', 'id', datos.id, {
        recurso: datos.recurso, idUnidad: unidad ? unidad.idUnidad : '',
        huesped: datos.huesped, telefono: datos.telefono || '', canal: datos.canal || 'whatsapp',
        checkIn: f.checkIn, checkOut: f.checkOut, estado: datos.estado || 'confirmada',
        total: Number(datos.total) || 0, anticipo: Number(datos.anticipo) || 0,
        addon: !!datos.addon, addonFecha: datos.addonFecha || '', notas: datos.notas || ''
      });
      return { id: datos.id };
    }

    var id = uid_('R');
    insertar_('Reservas', {
      id: id, recurso: datos.recurso, idUnidad: unidad ? unidad.idUnidad : '',
      huesped: datos.huesped, telefono: datos.telefono || '', canal: datos.canal || 'whatsapp',
      checkIn: f.checkIn, checkOut: f.checkOut, estado: datos.estado || 'confirmada',
      total: Number(datos.total) || 0, anticipo: Number(datos.anticipo) || 0,
      addon: !!datos.addon, addonFecha: datos.addonFecha || '', notas: datos.notas || '',
      creado: ahora_(), creadoPor: u.nombre
    });
    return { id: id };
  } finally {
    lock.releaseLock();
  }
}

/* Mover o extender arrastrando en el calendario. */
function moverReserva(token, id, recurso, checkIn, checkOut) {
  sesion_(token);
  var f = validarFechas_(checkIn, checkOut);
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

function cambiarEstado(token, id, estado) {
  sesion_(token);
  actualizar_('Reservas', 'id', id, { estado: estado });
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
  var mapear = function (r) {
    return {
      id: r.id, huesped: r.huesped, telefono: r.telefono, canal: r.canal,
      recurso: nombre(r.recurso), estado: r.estado, notas: r.notas || '',
      addon: !!r.addon, addonFecha: r.addonFecha ? String(r.addonFecha) : '',
      saldo: (Number(r.total) || 0) - (Number(r.anticipo) || 0),
      checkIn: ymd_(r.checkIn), checkOut: ymd_(r.checkOut)
    };
  };
  return {
    fecha: dia,
    llegadas: todas.filter(function (r) { return ymd_(r.checkIn) === dia; }).map(mapear),
    salidas: todas.filter(function (r) { return ymd_(r.checkOut) === dia; }).map(mapear),
    enCasa: todas.filter(function (r) {
      return ymd_(r.checkIn) < dia && ymd_(r.checkOut) > dia;
    }).map(mapear),
    addons: todas.filter(function (r) {
      return r.addon && ymd_(r.checkIn) >= dia;
    }).map(mapear)
  };
}

/* ===================== ASEO ===================== */

function panelAseo(token) {
  sesion_(token);
  var estados = leer_('Aseo');
  var hoyStr = hoy_();
  var reservas = leer_('Reservas').filter(function (r) { return r.estado !== 'cancelada'; });

  return leer_('Unidades').filter(function (u) { return u.activa; })
    .sort(function (a, b) { return Number(a.orden) - Number(b.orden); })
    .map(function (u) {
      var e = estados.filter(function (x) { return x.idUnidad === u.id; })[0];
      var deUnidad = reservas.filter(function (r) { return r.idUnidad === u.id; });
      return {
        id: u.id, nombre: u.nombre, grupo: u.grupo,
        estado: e ? e.estado : 'limpia',
        responsable: e ? e.responsable : '',
        notas: e ? e.notas : '',
        actualizado: e ? String(e.actualizado) : '',
        saleHoy: deUnidad.some(function (r) { return ymd_(r.checkOut) === hoyStr; }),
        llegaHoy: deUnidad.some(function (r) { return ymd_(r.checkIn) === hoyStr; })
      };
    });
}

function marcarAseo(token, idUnidad, estado, notas) {
  var u = sesion_(token);
  guardarOCrear_('Aseo', 'idUnidad', idUnidad, {
    idUnidad: idUnidad, estado: estado, responsable: u.nombre,
    notas: notas || '', actualizado: ahora_()
  });
  return true;
}

/* ===================== FICHA DE REGISTRO ===================== */

function guardarFicha(token, idReserva, d) {
  sesion_(token);
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
  actualizar_('Reservas', 'id', idReserva, { estado: 'en_casa' });
  return true;
}

function fichaDe(token, idReserva) {
  sesion_(token);
  var f = leer_('Fichas').filter(function (x) { return x.idReserva === idReserva; })[0];
  return f ? { nombre: f.nombre, documento: f.documento, firmaUrl: f.firmaUrl, fecha: String(f.fecha) } : null;
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
