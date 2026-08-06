# Casona Peumayén — PMS interno

Sistema interno de gestión de reservas (calendario, camas/habitaciones,
housekeeping, check-in con firma digital y coordinación del addon de
glamping) hecho en Google Apps Script. No es un channel manager conectado a
OTAs: sirve para que el equipo cargue manualmente lo que llega por WhatsApp,
Booking, Airbnb, etc., y tener todo en un solo calendario visual.

## Estructura del proyecto

| Archivo | Rol |
|---|---|
| `appsscript.json` | Manifiesto del proyecto (zona horaria, permisos del web app) |
| `Modelo.gs` | Definición de las hojas de cálculo (columnas) y constantes |
| `Utils.gs` | Helpers genéricos de lectura/escritura sobre Sheets |
| `Setup.gs` | Inicializa la planilla, crea las hojas y precarga el inventario real |
| `Auth.gs` | Login por nombre + PIN, sesiones, roles |
| `Unidades.gs` | Inventario de habitaciones/camas/carpas y precios |
| `Reservas.gs` | CRUD de reservas, detección de conflictos, mover (drag&drop) |
| `Housekeeping.gs` | Estado de aseo por unidad |
| `FichaRegistro.gs` | Ficha de check-in con firma digital (se guarda en Drive) |
| `Addons.gs` | Programa de tinaja + tabla de sushi del glamping |
| `Code.gs` | `doGet` y helper `include()` para armar el frontend |
| `Index.html` / `CSS.html` / `JS.html` | Frontend (SPA de una sola página) |

## Despliegue paso a paso

1. Ve a [script.google.com](https://script.google.com) con la cuenta de
   Google que van a usar para el proyecto → **Nuevo proyecto**.
2. Ponle nombre "Casona Peumayén - PMS".
3. Borra el `Code.gs` de ejemplo y copia el contenido de cada archivo de
   este repositorio en un archivo del mismo nombre dentro del editor
   (para los `.gs` usa "Archivo > Script"; para `Index`, `CSS`, `JS` usa
   "Archivo > HTML").
4. Abre `appsscript.json` desde el editor (⚙️ Configuración del proyecto →
   marca "Mostrar archivo de manifiesto appsscript.json") y reemplaza su
   contenido por el de este repositorio.
5. En el desplegable de funciones (arriba del editor) selecciona
   **setupProyecto** y presiona ▶️ Ejecutar. La primera vez te va a pedir
   autorizar permisos (Sheets, Drive) — acéptalos.
6. Revisa el **Registro de ejecución** (Ver → Registros): ahí sale el link
   a la planilla que se creó automáticamente con todo el inventario
   cargado, y un aviso con el usuario administrador por defecto:
   **usuario `Admin`, PIN `0000`** — cámbialo apenas entres, desde la
   pestaña "Usuarios" dentro de la app (crea tu propio usuario admin y
   deja de usar el default, o simplemente cambia su PIN volviendo a
   ejecutar `guardarUsuario` con esos datos).
7. **Implementar → Nueva implementación → Aplicación web**:
   - Ejecutar como: **Yo (tu cuenta)**
   - Quién tiene acceso: **Cualquier usuario** (así entra cualquiera del
     equipo sin necesidad de compartir la planilla con su cuenta de Google)
   - Implementar, y copiar la URL del web app.
8. Comparte esa URL con el resto del equipo (recepción y aseo). Cada uno
   entra con el nombre de usuario y PIN que le crees desde la pestaña
   "Usuarios" (solo visible para el rol admin).

## Notas de seguridad

El login es por nombre + PIN propio del sistema (no usa el inicio de
sesión de Google), pensado para que cualquiera del equipo pueda entrar
desde su teléfono sin tener una cuenta de Google Workspace. Es un nivel de
seguridad razonable para una herramienta interna operada por personal de
confianza, no para exposición pública amplia — no reutilicen PINs de otros
sistemas.

## Simplificaciones conscientes de esta primera versión

- El precio de cada reserva se sugiere automáticamente según la
  temporada, pero **siempre es editable** por el usuario al crear/editar
  la reserva (por ejemplo, para el caso de la cama matrimonial compartida
  ocupada por 2 personas).
- Una reserva puede tener varias habitaciones/camas, pero todas comparten
  las mismas fechas de check-in/check-out (si un mismo huésped necesita
  fechas distintas por unidad, se crean reservas separadas).
- Los reportes de ocupación/ingresos no están incluidos en esta primera
  versión — se puede armar directamente desde la planilla de Google
  Sheets con tablas dinámicas mientras se define qué reporte automatizar.
- El reparto de ingresos del addon de tinaja + sushi entre el lodge y el
  restaurant queda pendiente de definir; por ahora el sistema solo
  coordina el horario, no cobra ni factura.
