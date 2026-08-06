/** Devuelve (y abre) la planilla que sirve de base de datos, creándola la primera vez. */
function getSpreadsheet_() {
  var props = PropertiesService.getScriptProperties();
  var id = props.getProperty('SPREADSHEET_ID');
  if (id) {
    return SpreadsheetApp.openById(id);
  }
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    ss = SpreadsheetApp.create('Casona Peumayén - PMS (Base de Datos)');
  }
  props.setProperty('SPREADSHEET_ID', ss.getId());
  return ss;
}

function getSheet_(key) {
  var def = SHEETS[key];
  if (!def) throw new Error('Hoja no definida: ' + key);
  var ss = getSpreadsheet_();
  var sh = ss.getSheetByName(def.name);
  if (!sh) throw new Error('Falta ejecutar setupProyecto(). No existe la hoja ' + def.name);
  return sh;
}

/** Lee una hoja completa y la devuelve como array de objetos {columna: valor, _row: nºfila}. */
function sheetToObjects_(key) {
  var sh = getSheet_(key);
  var values = sh.getDataRange().getValues();
  var headers = values[0];
  var out = [];
  for (var i = 1; i < values.length; i++) {
    var row = values[i];
    if (row.join('') === '') continue;
    var obj = {};
    for (var j = 0; j < headers.length; j++) obj[headers[j]] = row[j];
    obj._row = i + 1;
    out.push(obj);
  }
  return out;
}

function appendObject_(key, obj) {
  var def = SHEETS[key];
  var sh = getSheet_(key);
  var row = def.headers.map(function (h) { return obj[h] !== undefined ? obj[h] : ''; });
  sh.appendRow(row);
}

/** Actualiza la primera fila cuyo campo idField coincide con idValue. Devuelve true si encontró y actualizó. */
function updateByField_(key, idField, idValue, updates) {
  var def = SHEETS[key];
  var sh = getSheet_(key);
  var values = sh.getDataRange().getValues();
  var headers = values[0];
  var idIdx = headers.indexOf(idField);
  if (idIdx === -1) throw new Error('Campo no existe: ' + idField);
  for (var i = 1; i < values.length; i++) {
    if (String(values[i][idIdx]) === String(idValue)) {
      Object.keys(updates).forEach(function (k) {
        var colIdx = headers.indexOf(k);
        if (colIdx > -1) sh.getRange(i + 1, colIdx + 1).setValue(updates[k]);
      });
      return true;
    }
  }
  return false;
}

/** Inserta si no existe una fila con idValue en idField, o actualiza si ya existe (para Housekeeping). */
function upsertByField_(key, idField, idValue, obj) {
  var found = updateByField_(key, idField, idValue, obj);
  if (!found) appendObject_(key, obj);
}

function deleteByField_(key, idField, idValue) {
  var sh = getSheet_(key);
  var values = sh.getDataRange().getValues();
  var headers = values[0];
  var idIdx = headers.indexOf(idField);
  for (var i = values.length - 1; i >= 1; i--) {
    if (String(values[i][idIdx]) === String(idValue)) sh.deleteRow(i + 1);
  }
}

function newId_(prefix) {
  return prefix + '_' + Utilities.getUuid().slice(0, 8);
}

function nowStr_() {
  return Utilities.formatDate(new Date(), Session.getScriptTimeZone() || 'America/Santiago', "yyyy-MM-dd'T'HH:mm:ss");
}

function toDate_(v) {
  if (v instanceof Date) return v;
  return new Date(v);
}

/** true si los rangos [aStart,aEnd) y [bStart,bEnd) se superponen. */
function overlaps_(aStart, aEnd, bStart, bEnd) {
  return toDate_(aStart) < toDate_(bEnd) && toDate_(bStart) < toDate_(aEnd);
}

function logCambio_(usuario, accion, detalle) {
  appendObject_('LOG', { fecha: nowStr_(), usuario: usuario, accion: accion, detalle: detalle });
}

function getConfig_(clave, def) {
  var rows = sheetToObjects_('CONFIG');
  for (var i = 0; i < rows.length; i++) {
    if (rows[i].clave === clave) return rows[i].valor;
  }
  return def;
}

/** Temporada alta configurable en Config: temporadaAltaInicio / temporadaAltaFin como "MM-DD". Cruza fin de año. */
function esTemporadaAlta_(fecha) {
  var d = toDate_(fecha);
  var mmdd = Utilities.formatDate(d, Session.getScriptTimeZone() || 'America/Santiago', 'MM-dd');
  var inicio = getConfig_('temporadaAltaInicio', '12-15');
  var fin = getConfig_('temporadaAltaFin', '03-15');
  if (inicio <= fin) return mmdd >= inicio && mmdd <= fin;
  return mmdd >= inicio || mmdd <= fin; // rango que cruza el 31 de diciembre
}

/** Sugerencia de % de reembolso según política de cancelación configurada. */
function sugerirReembolso_(checkIn) {
  var horas = (toDate_(checkIn).getTime() - Date.now()) / 3600000;
  if (horas >= Number(getConfig_('cancelacionHoras72', 72))) return Number(getConfig_('cancelacionPct72', 100));
  if (horas >= Number(getConfig_('cancelacionHoras24', 24))) return Number(getConfig_('cancelacionPct24', 50));
  return Number(getConfig_('cancelacionPctMenos24', 0));
}

function getOrCreateFolder_(nombre) {
  var it = DriveApp.getFoldersByName(nombre);
  if (it.hasNext()) return it.next();
  return DriveApp.createFolder(nombre);
}

/** Guarda una imagen dataURL (firma) en Drive y devuelve la URL del archivo. */
function guardarImagenDataUrl_(dataUrl, nombreArchivo) {
  var match = /^data:(image\/\w+);base64,(.*)$/.exec(dataUrl || '');
  if (!match) throw new Error('Firma inválida');
  var blob = Utilities.newBlob(Utilities.base64Decode(match[2]), match[1], nombreArchivo);
  var folder = getOrCreateFolder_('CasonaPeumayen_Firmas');
  var file = folder.createFile(blob);
  return file.getUrl();
}
