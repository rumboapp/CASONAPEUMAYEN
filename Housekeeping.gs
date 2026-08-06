function listarEstadoUnidades(token) {
  validarSesion_(token);
  var unidades = sheetToObjects_('UNIDADES').filter(function (u) { return u.activa; });
  var estados = sheetToObjects_('HOUSEKEEPING');
  return unidades.map(function (u) {
    var est = estados.filter(function (e) { return e.idUnidad === u.id; })[0];
    return {
      idUnidad: u.id,
      nombre: u.nombre,
      tipo: u.tipo,
      estado: est ? est.estado : ESTADOS_UNIDAD.LIMPIA,
      responsable: est ? est.responsable : '',
      notas: est ? est.notas : '',
      actualizado: est ? est.actualizado : ''
    };
  });
}

function actualizarEstadoUnidad(token, idUnidad, estado, notas) {
  var user = validarSesion_(token);
  exigirRol_(user, [ROLES.ADMIN, ROLES.RECEPCION, ROLES.ASEO]);
  upsertByField_('HOUSEKEEPING', 'idUnidad', idUnidad, {
    idUnidad: idUnidad, estado: estado, responsable: user.nombre, notas: notas || '', actualizado: nowStr_()
  });
  logCambio_(user.nombre, 'housekeeping', idUnidad + ' -> ' + estado);
  return true;
}
