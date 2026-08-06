var ESTADOS_ADDON = { PENDIENTE: 'pendiente', COORDINADO: 'coordinado', HECHO: 'hecho' };

function crearAddon(token, idReserva, tipo, fechaHora, notas) {
  var user = validarSesion_(token);
  var id = newId_('AD');
  appendObject_('ADDONS', {
    id: id, idReserva: idReserva, tipo: tipo || 'tinaja_sushi',
    fechaHora: fechaHora || '', estado: ESTADOS_ADDON.PENDIENTE, notas: notas || ''
  });
  logCambio_(user.nombre, 'addon_creado', idReserva + ' - ' + tipo);
  return { id: id };
}

function listarAddons(token) {
  validarSesion_(token);
  var addons = sheetToObjects_('ADDONS');
  var reservas = sheetToObjects_('RESERVAS');
  return addons.map(function (a) {
    var r = reservas.filter(function (x) { return x.id === a.idReserva; })[0];
    return {
      id: a.id, idReserva: a.idReserva, tipo: a.tipo, fechaHora: a.fechaHora,
      estado: a.estado, notas: a.notas,
      huespedNombre: r ? r.huespedNombre : '(reserva eliminada)',
      checkIn: r ? r.checkIn : ''
    };
  });
}

function actualizarEstadoAddon(token, idAddon, estado) {
  var user = validarSesion_(token);
  updateByField_('ADDONS', 'id', idAddon, { estado: estado });
  logCambio_(user.nombre, 'addon_estado', idAddon + ' -> ' + estado);
  return true;
}
