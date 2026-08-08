# Casona Peumayén — PMS

Sistema interno de reservas para el lodge y el glamping. Calendario visual,
estado de aseo, ficha de check-in con firma y coordinación del programa de
tinaja + sushi.

No se conecta automáticamente con Booking ni Airbnb: sirve para que el equipo
cargue a mano lo que llega por cualquier canal y lo vea todo en un solo lugar,
sin que se pisen las reservas.

## Los archivos

Son **cinco**, y se copian tal cual:

| Archivo | Qué es | Cómo se crea en Apps Script |
|---|---|---|
| `Code.gs` | Todo el servidor: datos, reservas, aseo, fichas, usuarios | Archivo → Script |
| `Index.html` | La aplicación interna del equipo | Archivo → HTML |
| `Ficha.html` | La página que ve el huésped para firmar desde su teléfono | Archivo → HTML |
| `Aseo.html` | La pantalla del equipo de aseo, con su propio enlace | Archivo → HTML |
| `appsscript.json` | Configuración del proyecto | Ya existe; se activa en ⚙️ Configuración → "Mostrar appsscript.json" |

## Instalación

1. Entra a [script.google.com](https://script.google.com) con la cuenta del
   negocio → **Nuevo proyecto** → ponle "Casona Peumayén".
2. Borra el contenido del `Code.gs` de ejemplo y pega el de este repositorio.
3. **Archivo → HTML**, llámalo `Index` (sin escribir `.html`) y pega
   `Index.html`. Repite con `Ficha` y con `Aseo`, pegando el archivo del
   mismo nombre.
4. ⚙️ **Configuración del proyecto** → marca *Mostrar el archivo de manifiesto
   appsscript.json*. Vuelve al editor, abre `appsscript.json` en la lista de
   archivos de la izquierda y reemplaza su contenido.
5. En el desplegable de funciones elige **setup** y presiona ▶️ **Ejecutar**.
   La primera vez pedirá autorizar el acceso a Sheets y Drive: acéptalo.
   Esto crea la planilla con el inventario ya cargado (8 habitaciones,
   8 camas vendibles por separado y 3 carpas) y el usuario inicial.
6. **Implementar → Nueva implementación → Aplicación web**:
   - *Ejecutar como*: *Yo*
   - *Quién tiene acceso*: *Cualquier usuario*
   - Copia la URL que termina en `/exec`. Esa es la app.

**Usuario inicial: `admin`, PIN `1234`.** Cámbialo apenas entres, desde la
pestaña *Equipo* (escribe `admin` con el PIN nuevo y guarda).

El logo va incrustado dentro de `Code.gs`, así que las tres pantallas lo
muestran sin depender de ningún archivo externo ni de permisos de Drive.

> La planilla de datos debe quedar **privada**. La app funciona igual porque
> se ejecuta con tu cuenta, y ahí se guardan documentos y firmas de huéspedes.

### Si cambias el código después

Editar los archivos **no** actualiza la app publicada: la implementación sigue
sirviendo la versión anterior. Cada vez que cambies algo:
**Implementar → Administrar implementaciones → ✏️ Editar → Versión: *Nueva* →
Implementar**. La URL no cambia.

Si no puedes entrar, la pantalla de acceso tiene un enlace
*"¿No puedes entrar? Revisar la instalación"* que dice exactamente qué falta.

### Si una reserva sale en la planilla pero no en el calendario

Le pasó a la primera versión: se agregaron columnas **en medio** del
encabezado de `Reservas` y las filas ya guardadas quedaron corridas, así que
sus fechas dejaron de poder leerse y el calendario no podía dibujarlas.

Ya no vuelve a ocurrir: `setup()` ahora solo **agrega** las columnas que
falten al final y nunca reordena las que ya existen, y las escrituras se
hacen buscando cada columna por su nombre y no por su posición.

Para las filas que ya quedaron dañadas, ejecuta desde el editor:

- `repararReservas()` — solo informa cuáles están ilegibles (no borra nada).
- `repararReservas(true)` — elimina esas filas para volver a cargarlas.

El calendario ahora muestra un aviso amarillo cuando hay reservas en ese
estado, así que no hay que adivinar por qué una reserva "desapareció". Esas
filas tampoco aparecen en la pestaña *Hoy*, por la misma razón.

## Cómo se usa el calendario

- **Crear**: haz clic en un día libre, o mantén apretado y arrastra sobre
  varios días para elegir el rango de una vez. La selección se detiene sola
  al topar con una reserva existente.
- **Abrir o editar**: clic sobre la barra de color de una reserva.
- **Mover**: arrastra la barra a otro día u otra habitación. El día donde la
  sueltas pasa a ser el nuevo check-in y se mantiene la cantidad de noches.
- **Cambiar fechas desde el formulario**: clic en la fila de fechas; se abre
  un calendario donde el primer clic es la **entrada** y el segundo la
  **salida**, igual que en Booking. Del 7 al 9 son 2 noches.
- **Alargar o acortar**: pasa el cursor sobre una reserva y arrastra el
  tirador de cualquiera de sus dos extremos. El izquierdo cambia la llegada
  y el derecho la salida; si el nuevo rango choca con otra reserva, no se
  aplica.
- **Fichas sin firmar**: las reservas cuya ficha ya está firmada llevan un
  ✓ y las que no, un rayado diagonal. Así se ve quién falta sin abrirlas una
  por una.
- El precio se calcula solo según temporada, y siempre se puede editar a mano.
- **Personas**: cada reserva lleva su número de pax, con el máximo puesto por
  la capacidad del alojamiento. Una matrimonial parte en 2 y no deja poner
  más; una cama individual queda en 1. Los informes suman las pax-noche.
- **Baño**: cada fila indica `PRIV` o `COMP` según sea privado o compartido,
  y el selector de la reserva lo repite junto a la capacidad.
- **El estado de aseo se ve en el propio calendario**: cada fila lleva un
  punto verde (limpia), rojo (sucia) o gris (fuera de servicio), y las sucias
  quedan con un tinte distinto. Sirve para decidir al vuelo dónde meter a
  alguien que llega sin reserva.

## Reserva de grupo

Cuando una familia toma dos habitaciones no hay que escribir los datos dos
veces. El botón **+ Reserva de grupo** de la barra del calendario abre un
formulario con las fechas, los datos del huésped a cargo y la lista de
alojamientos con su disponibilidad para esas fechas: se marcan los que se
quieren y se crea una reserva por cada uno, todas con los mismos datos y
unidas por un mismo grupo.

- Los ocupados aparecen bloqueados, con el nombre de quien los tiene.
- El total se calcula solo y se reparte entre los alojamientos elegidos; si
  lo editas a mano, el reparto se ajusta en la misma proporción.
- El abono se anota una sola vez, no una por habitación.
- **O entra el grupo completo o no entra ninguno**: si al guardar uno de los
  alojamientos acaba de ocuparse, se rechaza todo y no queda media familia
  cargada.
- Al abrir cualquiera de esas reservas aparece la marca *Parte de un grupo* y
  la opción de aplicar el check-in o el check-out a todas de una vez.

## Ficha de registro y firma

Hay dos formas de tomar la ficha, y ambas guardan la firma como imagen en una
carpeta de Drive llamada *Casona Peumayén — Fichas*:

- **En recepción**: abre la reserva → *Firmar aquí*. El huésped firma con el
  dedo en el teléfono o tablet del mostrador.
- **A distancia, antes de llegar**: abre la reserva → *Copiar enlace de la
  ficha*. El enlace queda copiado al instante para pegarlo por WhatsApp,
  correo o donde prefieras. El huésped lo abre sin clave, ve su reserva, lee
  las normas de convivencia, las acepta y firma desde su teléfono.

Las normas que se muestran en los dos casos son **exactamente las mismas**:
salen de la función `reglamento()` en `Code.gs`, que es el único lugar donde
hay que editarlas. Ahí también se cambian de una vez para los dos idiomas.

La página del huésped está **en español e inglés**: detecta el idioma del
teléfono y además tiene un botón ES/EN. El enlace solo da acceso a esa reserva
y a nada más, y una vez firmada muestra la confirmación en lugar del formulario.

**Firmar la ficha nunca cambia el estado de la reserva.** El check-in lo hace
siempre recepción a mano, así que una ficha firmada desde el teléfono del
huésped solo queda registrada; la reserva sigue igual hasta que alguien
aprieta *Hacer check-in*.

El botón **Copiar enlace de la ficha** lo genera y lo deja copiado de una
sola vez, listo para pegar donde sea. Si ya está firmada, ese botón
desaparece y en su lugar aparece *Ver ficha firmada*.

## Estados de una reserva

Se ven en el calendario por color y se cambian con un toque desde la propia
reserva, sin tener que buscar el campo:

| Estado | Color | Qué significa |
|---|---|---|
| Tentativa | morado | Anotada pero sin confirmar |
| Confirmada | naranjo | Confirmada, el huésped todavía no llega |
| Check-in | verde | El huésped llegó y está alojado |
| Check-out | azul | El huésped ya se fue |
| No-show | gris claro | Nunca llegó |

Al abrir una reserva, arriba aparece en qué punto va y el botón del paso
siguiente: *Hacer check-in* o *Hacer check-out*. Ese botón guarda además la
hora real, que después alimenta los informes.

**Al hacer el check-out, el alojamiento se marca solo como sucio**, así el
equipo de aseo lo ve al instante en su pantalla sin que nadie tenga que
avisarle.

## Aseo

Solo tres estados, que es lo que se usa a diario: **sucia**, **limpia** y
**fuera de servicio**.

El estado se lleva **por cama, no por habitación**, en las piezas que se
venden por camas: muchas veces se ensucia una sola cama y no la pieza
entera, así que cada cama tiene su propio estado y su propia tarjeta.

En la pestaña *Aseo* hay un botón **Enlace para el equipo de aseo**: genera
una dirección que se le manda a la persona que limpia. La abre desde su
teléfono, sin clave, y ve los alojamientos ordenados por lo que hay que
hacer:

1. **Limpiar ahora** — los que ya hicieron check-out.
2. **Cuando se vayan** — los que salen hoy pero el huésped sigue adentro.
3. **Listas para recibir** — las que esperan a alguien hoy.
4. **Con huésped adentro** — incluye a los que ya hicieron el check-in, que
   se muestran como "ya llegó" y no como "llega a las 15:00".
5. **Sin movimiento hoy** — plegado, para no estorbar.

Escribe su nombre una vez y queda registrado quién limpió cada cosa.
Recepción ve el cambio al instante, y la pantalla se refresca sola cada
minuto y al volver a ella.

## Cuando algo no carga

La aplicación se refresca sola cada 45 segundos y cada vez que vuelves a la
pestaña, así que una ficha que el huésped firma desde su teléfono, o un
cambio hecho por la otra persona del equipo, aparece sin recargar.

Si el calendario no carga —Apps Script a veces falla al despertar— se
reintenta solo hasta tres veces y, si aun así falla, aparece un botón
*Reintentar* en lugar de dejarte la pantalla en blanco.

## Informes

La pestaña *Informes* (solo administración) calcula sobre las reservas ya
guardadas, para el período que elijas:

- **Ocupación**: noches vendidas sobre noches disponibles.
- **Ingresos**, lo ya abonado y lo que queda **por cobrar**.
- **Tarifa media por noche** y **ingreso por alojamiento disponible**, los dos
  indicadores que se miran en cualquier hotel.
- **Estadía media**, cancelaciones y no-shows.
- Desgloses **por canal** (de dónde llegan de verdad las reservas), **por
  alojamiento** (cuál rinde más) y **mes a mes**.

Cuando una estadía cruza el borde del período, solo se cuentan las noches
que caen dentro, para que los totales de meses distintos no se pisen.

## Agregar habitaciones y carpas

En la pestaña **Alojamiento** (solo administración) se agregan unidades nuevas
cuando habiliten el ala que falta, sin tocar el código. Aparecen de inmediato
como filas nuevas del calendario.

- Una unidad que se vende completa lleva su precio de temporada baja y alta.
- Una unidad tipo hostal se marca como *se vende por camas separadas* y después
  se le agregan las camas, cada una con su precio; cada cama pasa a ser una
  fila propia del calendario.
- Las unidades no se borran, se **archivan**: dejan de aparecer en el
  calendario pero se conserva su historial de reservas.

## Cómo se cuentan las noches

En el **selector de fechas** eliges entrada y salida: del 7 al 9 son 2 noches.

En la **grilla del calendario** cada celda es una noche, así que marcar el 7
y el 8 también son 2 noches — entra el 7 y sale el 9, que es justo lo que
muestra después el formulario. Un clic simple sobre un día vale por 1 noche.

## Por qué es rápido

Apps Script es lento sobre todo por las llamadas a la planilla: cada lectura
es una llamada remota. El sistema está armado para hacer las menos posibles.

- **Cada hoja se lee una sola vez por ejecución.** Antes, abrir el calendario
  leía la planilla 11 veces; ahora son 3.
- **El inventario y la configuración quedan guardados** entre llamadas,
  porque casi nunca cambian, y se descartan solos en cuanto alguien los
  edita. La sesión también, por unos minutos.
- **Al guardar, la fila se escribe completa de una vez** en vez de campo por
  campo.
- **El calendario pide tres semanas de más a cada lado.** Moverse de semana
  en semana se dibuja al instante con lo que ya está en memoria, sin esperar
  al servidor; solo se vuelve a pedir cuando de verdad te sales de ese rango.
- **El refresco de fondo no repinta si nada cambió**, para que la pantalla no
  parpadee mientras estás trabajando.

En total, las siete operaciones más usadas bajaron de 45 a 16 lecturas de
planilla.

## Reglas del modelo

- **Una reserva ocupa un recurso.** Las habitaciones 1 a 4 y las carpas se
  reservan completas; las habitaciones 5 a 8 se reservan por cama, así que
  cada cama es una fila propia en el calendario. Si un grupo toma dos
  habitaciones, se cargan dos reservas.
- **El día de check-out queda libre** para quien llega ese mismo día, como en
  cualquier hotel.
- **No se pueden pisar dos reservas.** Se valida en el navegador y otra vez en
  el servidor, con un bloqueo que evita que dos personas guarden a la vez.
- **Las fechas se guardan como texto** `AAAA-MM-DD` para que Sheets no las
  convierta a fecha con hora y zona horaria (eso rompía la detección de choques
  en la versión anterior).

## Roles

| Rol | Ve |
|---|---|
| `admin` | Todo, incluidas Alojamiento y Equipo |
| `recepcion` | Calendario, Hoy y Aseo |
| `aseo` | Solo la pestaña Aseo |

Si te quedas fuera del sistema, puedes recuperar el acceso ejecutando desde el
editor la función `crearUsuario("nombre", "pin", "admin")`.

## Lo que todavía no hace

- No genera boletas ni facturas.
- No importa reservas automáticamente desde Booking o Airbnb.
- No envía el enlace de la ficha solo: abre WhatsApp o el correo con el
  mensaje escrito, pero el envío lo haces tú.
- La app interna está solo en español; la página del huésped sí es bilingüe.
- No hay reportes de ocupación e ingresos dentro de la app; por ahora se
  pueden sacar desde la planilla con una tabla dinámica.
