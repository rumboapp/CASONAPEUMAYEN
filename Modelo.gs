/**
 * Definición central de las hojas de cálculo que actúan como base de datos
 * del PMS. Cualquier cambio de columnas se hace acá y se propaga solo.
 */
var SHEETS = {
  UNIDADES: { name: 'Unidades', headers: ['id', 'nombre', 'tipo', 'capacidad', 'bano', 'ventaPorCama', 'precioBase', 'precioAlta', 'activa'] },
  CAMAS: { name: 'Camas', headers: ['id', 'idUnidad', 'nombre', 'precioBase', 'precioAlta', 'activa'] },
  HUESPEDES: { name: 'Huespedes', headers: ['id', 'nombre', 'documento', 'nacionalidad', 'telefono', 'email', 'notas', 'fechaCreacion'] },
  RESERVAS: { name: 'Reservas', headers: ['id', 'idHuesped', 'huespedNombre', 'canal', 'checkIn', 'checkOut', 'estado', 'anticipo', 'total', 'notas', 'fechaCreacion', 'creadoPor', 'reembolsoSugerido'] },
  RESERVA_ITEMS: { name: 'ReservaItems', headers: ['id', 'idReserva', 'idUnidad', 'idCama', 'etiqueta', 'precio'] },
  ADDONS: { name: 'Addons', headers: ['id', 'idReserva', 'tipo', 'fechaHora', 'estado', 'notas'] },
  HOUSEKEEPING: { name: 'Housekeeping', headers: ['idUnidad', 'estado', 'responsable', 'notas', 'actualizado'] },
  FICHAS: { name: 'FichasRegistro', headers: ['id', 'idReserva', 'nombreCompleto', 'documento', 'nacionalidad', 'fechaNacimiento', 'procedencia', 'destino', 'motivoViaje', 'contactoEmergencia', 'aceptaReglamento', 'firmaUrl', 'fechaFirma'] },
  USUARIOS: { name: 'Usuarios', headers: ['email', 'nombre', 'rol', 'pinHash', 'activo'] },
  SESIONES: { name: 'Sesiones', headers: ['token', 'email', 'nombre', 'rol', 'expira'] },
  LOG: { name: 'LogCambios', headers: ['fecha', 'usuario', 'accion', 'detalle'] },
  CONFIG: { name: 'Config', headers: ['clave', 'valor'] }
};

var ROLES = { ADMIN: 'admin', RECEPCION: 'recepcion', ASEO: 'aseo' };

var ESTADOS_RESERVA = { TENTATIVA: 'tentativa', CONFIRMADA: 'confirmada', CANCELADA: 'cancelada', NO_SHOW: 'no_show' };

var ESTADOS_UNIDAD = { SUCIA: 'sucia', LIMPIA: 'limpia', INSPECCIONADA: 'inspeccionada', FUERA_SERVICIO: 'fuera_servicio' };
