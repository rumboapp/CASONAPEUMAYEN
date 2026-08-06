/**
 * Ejecutar UNA VEZ desde el editor de Apps Script (menú "Ejecutar" > setupProyecto)
 * antes del primer despliegue. Crea la planilla base de datos (si no existe),
 * todas las hojas con sus encabezados, y precarga el inventario real de
 * Casona Peumayén, la configuración operativa y un usuario administrador.
 *
 * Es idempotente: se puede volver a ejecutar sin duplicar datos.
 */
function setupProyecto() {
  var ss = getSpreadsheet_();

  Object.keys(SHEETS).forEach(function (key) {
    var def = SHEETS[key];
    var sh = ss.getSheetByName(def.name);
    if (!sh) {
      sh = ss.insertSheet(def.name);
    }
    var firstRow = sh.getRange(1, 1, 1, def.headers.length).getValues()[0];
    var needsHeaders = def.headers.some(function (h, i) { return firstRow[i] !== h; });
    if (needsHeaders) {
      sh.getRange(1, 1, 1, def.headers.length).setValues([def.headers]);
      sh.setFrozenRows(1);
    }
  });

  // Elimina la hoja "Hoja 1" / "Sheet1" por defecto si quedó vacía y sin uso.
  ['Hoja 1', 'Sheet1'].forEach(function (n) {
    var sh = ss.getSheetByName(n);
    if (sh && sh.getLastRow() === 0) ss.deleteSheet(sh);
  });

  seedConfig_();
  seedUnidadesYCamas_();
  seedUsuarioAdmin_();

  Logger.log('Setup completo. Planilla: ' + ss.getUrl());
  return ss.getUrl();
}

function seedConfig_() {
  if (sheetToObjects_('CONFIG').length > 0) return;
  var valores = {
    checkIn: '15:00',
    checkOut: '11:00',
    horarioSilencioInicio: '22:00',
    horarioSilencioFin: '09:00',
    temporadaAltaInicio: '12-15',
    temporadaAltaFin: '03-15',
    cancelacionHoras72: 72,
    cancelacionHoras24: 24,
    cancelacionPct72: 100,
    cancelacionPct24: 50,
    cancelacionPctMenos24: 0,
    addonTinajaSushiBase: 30000,
    addonTinajaSushiAlta: 35000
  };
  Object.keys(valores).forEach(function (clave) {
    appendObject_('CONFIG', { clave: clave, valor: valores[clave] });
  });
}

function seedUnidadesYCamas_() {
  if (sheetToObjects_('UNIDADES').length > 0) return;

  var unidades = [
    { id: 'U1', nombre: 'Habitación 1 - Matrimonial', tipo: 'habitacion', capacidad: 2, bano: 'privado', ventaPorCama: false, precioBase: 55000, precioAlta: 70000 },
    { id: 'U2', nombre: 'Habitación 2 - Matrimonial', tipo: 'habitacion', capacidad: 2, bano: 'privado', ventaPorCama: false, precioBase: 55000, precioAlta: 70000 },
    { id: 'U3', nombre: 'Habitación 3 - Twin', tipo: 'habitacion', capacidad: 2, bano: 'privado', ventaPorCama: false, precioBase: 55000, precioAlta: 70000 },
    { id: 'U4', nombre: 'Habitación 4 - Matrimonial + Individual', tipo: 'habitacion', capacidad: 3, bano: 'privado', ventaPorCama: false, precioBase: 70000, precioAlta: 90000 },
    { id: 'U5', nombre: 'Habitación 5 - Mixta (Matrimonial + Litera)', tipo: 'habitacion', capacidad: 3, bano: 'compartido', ventaPorCama: true, precioBase: '', precioAlta: '' },
    { id: 'U6', nombre: 'Habitación 6 - Mixta (Individual + Litera)', tipo: 'habitacion', capacidad: 3, bano: 'compartido', ventaPorCama: true, precioBase: '', precioAlta: '' },
    { id: 'U7', nombre: 'Habitación 7 - Individual', tipo: 'habitacion', capacidad: 1, bano: 'compartido', ventaPorCama: true, precioBase: 33000, precioAlta: 42000 },
    { id: 'U8', nombre: 'Habitación 8 - Individual', tipo: 'habitacion', capacidad: 1, bano: 'compartido', ventaPorCama: true, precioBase: 33000, precioAlta: 42000 },
    { id: 'G1', nombre: 'Carpa Glamping A', tipo: 'glamping', capacidad: 2, bano: 'compartido', ventaPorCama: false, precioBase: 65000, precioAlta: 83000 },
    { id: 'G2', nombre: 'Carpa Glamping B', tipo: 'glamping', capacidad: 2, bano: 'compartido', ventaPorCama: false, precioBase: 65000, precioAlta: 83000 },
    { id: 'G3', nombre: 'Carpa Glamping C', tipo: 'glamping', capacidad: 2, bano: 'compartido', ventaPorCama: false, precioBase: 65000, precioAlta: 83000 }
  ];
  unidades.forEach(function (u) { u.activa = true; appendObject_('UNIDADES', u); });

  var camas = [
    { id: 'C_U5_1', idUnidad: 'U5', nombre: 'Cama matrimonial', precioBase: 28000, precioAlta: 36000 },
    { id: 'C_U5_2', idUnidad: 'U5', nombre: 'Litera - plaza superior', precioBase: 25000, precioAlta: 32000 },
    { id: 'C_U5_3', idUnidad: 'U5', nombre: 'Litera - plaza inferior', precioBase: 25000, precioAlta: 32000 },
    { id: 'C_U6_1', idUnidad: 'U6', nombre: 'Cama individual', precioBase: 25000, precioAlta: 32000 },
    { id: 'C_U6_2', idUnidad: 'U6', nombre: 'Litera - plaza superior', precioBase: 25000, precioAlta: 32000 },
    { id: 'C_U6_3', idUnidad: 'U6', nombre: 'Litera - plaza inferior', precioBase: 25000, precioAlta: 32000 },
    { id: 'C_U7_1', idUnidad: 'U7', nombre: 'Cama individual', precioBase: 33000, precioAlta: 42000 },
    { id: 'C_U8_1', idUnidad: 'U8', nombre: 'Cama individual', precioBase: 33000, precioAlta: 42000 }
  ];
  camas.forEach(function (c) { c.activa = true; appendObject_('CAMAS', c); });
}

function seedUsuarioAdmin_() {
  if (sheetToObjects_('USUARIOS').length > 0) return;
  appendObject_('USUARIOS', {
    email: 'admin@casonapeumayen.local',
    nombre: 'Admin',
    rol: ROLES.ADMIN,
    pinHash: hashPin_('0000'),
    activo: true
  });
  Logger.log('Usuario admin creado: nombre "Admin", PIN "0000". CÁMBIALO apenas entres (menú Usuarios).');
}
