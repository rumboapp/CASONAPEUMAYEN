/** Devuelve el inventario completo (habitaciones + glamping) con sus camas anidadas, listo para pintar el calendario. */
function listarUnidades(token) {
  validarSesion_(token);
  var unidades = sheetToObjects_('UNIDADES').filter(function (u) { return u.activa; });
  var camas = sheetToObjects_('CAMAS').filter(function (c) { return c.activa; });
  return unidades.map(function (u) {
    return {
      id: u.id,
      nombre: u.nombre,
      tipo: u.tipo,
      capacidad: u.capacidad,
      bano: u.bano,
      ventaPorCama: !!u.ventaPorCama,
      precioBase: u.precioBase,
      precioAlta: u.precioAlta,
      camas: camas.filter(function (c) { return c.idUnidad === u.id; }).map(function (c) {
        return { id: c.id, nombre: c.nombre, precioBase: c.precioBase, precioAlta: c.precioAlta };
      })
    };
  });
}

function precioSugerido(token, idUnidad, idCama, fecha) {
  validarSesion_(token);
  var alta = esTemporadaAlta_(fecha);
  if (idCama) {
    var cama = sheetToObjects_('CAMAS').filter(function (c) { return c.id === idCama; })[0];
    if (!cama) return 0;
    return Number(alta ? cama.precioAlta : cama.precioBase) || 0;
  }
  var unidad = sheetToObjects_('UNIDADES').filter(function (u) { return u.id === idUnidad; })[0];
  if (!unidad) return 0;
  return Number(alta ? unidad.precioAlta : unidad.precioBase) || 0;
}
