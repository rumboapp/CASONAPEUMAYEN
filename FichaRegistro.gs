/**
 * datos: {nombreCompleto, documento, nacionalidad, fechaNacimiento, procedencia,
 *         destino, motivoViaje, contactoEmergencia, aceptaReglamento, firmaDataUrl}
 */
function guardarFicha(token, idReserva, datos) {
  var user = validarSesion_(token);
  if (!datos.aceptaReglamento) throw new Error('El huésped debe aceptar el reglamento de convivencia.');
  if (!datos.firmaDataUrl) throw new Error('Falta la firma.');

  var firmaUrl = guardarImagenDataUrl_(datos.firmaDataUrl, 'firma_' + idReserva + '_' + Date.now() + '.png');

  appendObject_('FICHAS', {
    id: newId_('F'),
    idReserva: idReserva,
    nombreCompleto: datos.nombreCompleto || '',
    documento: datos.documento || '',
    nacionalidad: datos.nacionalidad || '',
    fechaNacimiento: datos.fechaNacimiento || '',
    procedencia: datos.procedencia || '',
    destino: datos.destino || '',
    motivoViaje: datos.motivoViaje || '',
    contactoEmergencia: datos.contactoEmergencia || '',
    aceptaReglamento: true,
    firmaUrl: firmaUrl,
    fechaFirma: nowStr_()
  });

  logCambio_(user.nombre, 'checkin_ficha', idReserva);
  return { ok: true, firmaUrl: firmaUrl };
}

function listarFichasPorReserva(token, idReserva) {
  validarSesion_(token);
  return sheetToObjects_('FICHAS').filter(function (f) { return f.idReserva === idReserva; });
}
