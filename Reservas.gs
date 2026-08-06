/**
 * Reservas: cada reserva tiene 1+ "items" (una habitación completa o una
 * o más camas sueltas). El calendario dibuja un bloque por item.
 */

function listarReservas(token, fechaInicio, fechaFin) {
  validarSesion_(token);
  var reservas = sheetToObjects_('RESERVAS').filter(function (r) {
    return r.estado !== ESTADOS_RESERVA.CANCELADA && overlaps_(r.checkIn, r.checkOut, fechaInicio, fechaFin);
  });
  var items = sheetToObjects_('RESERVA_ITEMS');
  return reservas.map(function (r) {
    return {
      id: r.id,
      huespedNombre: r.huespedNombre,
      canal: r.canal,
      checkIn: r.checkIn,
      checkOut: r.checkOut,
      estado: r.estado,
      anticipo: r.anticipo,
      total: r.total,
      notas: r.notas,
      reembolsoSugerido: r.reembolsoSugerido,
      items: items.filter(function (it) { return it.idReserva === r.id; }).map(function (it) {
        return { idUnidad: it.idUnidad, idCama: it.idCama || '', etiqueta: it.etiqueta, precio: it.precio };
      })
    };
  });
}

function verificarConflicto_(items, checkIn, checkOut, ignorarReservaId) {
  var existentes = sheetToObjects_('RESERVAS').filter(function (r) {
    return r.id !== ignorarReservaId && r.estado !== ESTADOS_RESERVA.CANCELADA && r.estado !== ESTADOS_RESERVA.NO_SHOW &&
      overlaps_(r.checkIn, r.checkOut, checkIn, checkOut);
  });
  if (existentes.length === 0) return null;
  var idsExistentes = existentes.map(function (r) { return r.id; });
  var itemsExistentes = sheetToObjects_('RESERVA_ITEMS').filter(function (it) { return idsExistentes.indexOf(it.idReserva) > -1; });

  for (var i = 0; i < items.length; i++) {
    var nuevo = items[i];
    var clave = nuevo.idCama || nuevo.idUnidad;
    var choque = itemsExistentes.some(function (ex) { return (ex.idCama || ex.idUnidad) === clave; });
    if (choque) return 'La unidad/cama "' + nuevo.etiqueta + '" ya está reservada en esas fechas.';
  }
  return null;
}

/** payload: {huesped:{nombre,documento,telefono}, canal, checkIn, checkOut, items:[{idUnidad,idCama,etiqueta,precio}], anticipo, notas} */
function crearReserva(token, payload) {
  var user = validarSesion_(token);
  if (!payload || !payload.items || !payload.items.length) throw new Error('La reserva necesita al menos una habitación o cama.');
  if (!payload.checkIn || !payload.checkOut || toDate_(payload.checkIn) >= toDate_(payload.checkOut)) {
    throw new Error('Fechas de check-in / check-out inválidas.');
  }
  var conflicto = verificarConflicto_(payload.items, payload.checkIn, payload.checkOut, null);
  if (conflicto) throw new Error(conflicto);

  var idReserva = newId_('R');
  var total = payload.items.reduce(function (sum, it) { return sum + (Number(it.precio) || 0); }, 0);

  appendObject_('RESERVAS', {
    id: idReserva,
    idHuesped: '',
    huespedNombre: (payload.huesped && payload.huesped.nombre) || 'Sin nombre',
    canal: payload.canal || 'walk-in',
    checkIn: payload.checkIn,
    checkOut: payload.checkOut,
    estado: ESTADOS_RESERVA.CONFIRMADA,
    anticipo: payload.anticipo || 0,
    total: total,
    notas: payload.notas || '',
    fechaCreacion: nowStr_(),
    creadoPor: user.nombre,
    reembolsoSugerido: ''
  });

  payload.items.forEach(function (it) {
    appendObject_('RESERVA_ITEMS', {
      id: newId_('RI'),
      idReserva: idReserva,
      idUnidad: it.idUnidad,
      idCama: it.idCama || '',
      etiqueta: it.etiqueta || '',
      precio: it.precio || 0
    });
  });

  logCambio_(user.nombre, 'reserva_creada', idReserva + ' - ' + payload.huesped.nombre);
  return { id: idReserva };
}

/** Mueve/edita una reserva (usado por el drag&drop del calendario y por el formulario de edición). */
function moverReserva(token, idReserva, nuevoCheckIn, nuevoCheckOut, nuevosItems) {
  var user = validarSesion_(token);
  var conflicto = verificarConflicto_(nuevosItems, nuevoCheckIn, nuevoCheckOut, idReserva);
  if (conflicto) throw new Error(conflicto);

  updateByField_('RESERVAS', 'id', idReserva, { checkIn: nuevoCheckIn, checkOut: nuevoCheckOut });

  // Reemplaza los items por los nuevos (simple y suficiente para el volumen de este lodge).
  var items = sheetToObjects_('RESERVA_ITEMS').filter(function (it) { return it.idReserva === idReserva; });
  items.forEach(function (it) { deleteByField_('RESERVA_ITEMS', 'id', it.id); });
  nuevosItems.forEach(function (it) {
    appendObject_('RESERVA_ITEMS', {
      id: newId_('RI'), idReserva: idReserva, idUnidad: it.idUnidad, idCama: it.idCama || '',
      etiqueta: it.etiqueta || '', precio: it.precio || 0
    });
  });

  logCambio_(user.nombre, 'reserva_movida', idReserva);
  return true;
}

function cambiarEstadoReserva(token, idReserva, nuevoEstado) {
  var user = validarSesion_(token);
  var updates = { estado: nuevoEstado };
  if (nuevoEstado === ESTADOS_RESERVA.CANCELADA) {
    var reserva = sheetToObjects_('RESERVAS').filter(function (r) { return r.id === idReserva; })[0];
    if (reserva) updates.reembolsoSugerido = sugerirReembolso_(reserva.checkIn) + '%';
  }
  updateByField_('RESERVAS', 'id', idReserva, updates);
  logCambio_(user.nombre, 'reserva_estado', idReserva + ' -> ' + nuevoEstado);
  return true;
}

function actualizarNotasReserva(token, idReserva, notas) {
  var user = validarSesion_(token);
  updateByField_('RESERVAS', 'id', idReserva, { notas: notas });
  logCambio_(user.nombre, 'reserva_notas', idReserva);
  return true;
}

/** Llegadas y salidas del día (para la vista de recepción). */
function llegadasYSalidas(token, fecha) {
  validarSesion_(token);
  var dia = Utilities.formatDate(toDate_(fecha), Session.getScriptTimeZone() || 'America/Santiago', 'yyyy-MM-dd');
  var reservas = sheetToObjects_('RESERVAS').filter(function (r) { return r.estado !== ESTADOS_RESERVA.CANCELADA; });
  var fmt = function (d) { return Utilities.formatDate(toDate_(d), Session.getScriptTimeZone() || 'America/Santiago', 'yyyy-MM-dd'); };
  return {
    llegadas: reservas.filter(function (r) { return fmt(r.checkIn) === dia; }),
    salidas: reservas.filter(function (r) { return fmt(r.checkOut) === dia; })
  };
}
