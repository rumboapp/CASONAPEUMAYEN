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

Si alguna vez editas las columnas de la planilla **a mano**, vuelve a
ejecutar `setup()`: además de dejar el encabezado en orden, borra todo lo que
el sistema tenía guardado en memoria, para que nada quede desactualizado.

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
  tirador de cualquiera de sus dos extremos. La barra **se estira en vivo**
  mientras arrastras y, al soltar, queda puesta de inmediato: no hay que
  esperar al servidor. Mientras se confirma late suave, y si el servidor
  rechaza el cambio vuelve sola a donde estaba. Lo mismo al mover una
  reserva de día o de habitación.
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

## La cuenta del huésped

Cada reserva tiene su propia cuenta: un libro donde **los cargos suman y los
pagos restan**. Se abre con el botón *Cuenta* de la reserva, o directo desde
la pestaña *Hoy*, donde el botón muestra lo que ese huésped debe.

Arriba se ve de un vistazo lo cargado, lo pagado y lo que queda por cobrar.
Ese número incluye **el alojamiento que todavía no se ha anotado**: si no,
una estadía que recién empieza parecería no deber nada.

- **El alojamiento lo anota el cierre de día**, noche por noche, prorrateando
  el total acordado. La última noche absorbe el redondeo, así que las líneas
  suman exactamente el total y nunca queda un peso de diferencia. Si prefieres
  dejar la cuenta lista al hacer el check-in, el botón *Postear el alojamiento*
  las anota todas de una vez.
- **Lo demás se agrega cuando ocurre**: una cena, el bar, lavandería, un daño.
  Hay botones rápidos para lo más común.
- **Cada cargo sabe a qué centro de ingreso pertenece**, el lodge o el
  restaurante. Eso es lo que hace que el reparto con la cocina salga solo en
  los informes en vez de discutirse a fin de mes.
- **El programa tinaja + sushi se anota como dos líneas**, una a cada centro.
  El porcentaje que va al restaurante se ajusta en la hoja `Config`, en
  `addonParteRestaurante` (viene en 50).
- **Los pagos se registran con su medio**: efectivo, transferencia, tarjeta o
  "lo cobra Booking". El campo *Abonado* de la reserva es el espejo de esos
  pagos, así que una vez que hay pagos se llena solo y deja de editarse a mano.
- **Nada se borra.** Un movimiento equivocado se *anula*: deja de sumar pero
  queda en la planilla como rastro de lo que pasó.

### Turistas extranjeros y el IVA

Los servicios de hotelería a turistas extranjeros sin domicilio ni residencia
en Chile van **exentos del 19%**, cuando el ingreso se percibe en moneda
extranjera y la empresa está registrada ante el SII; se documenta con factura
de exportación y la calidad de turista se acredita con el pasaporte y la
tarjeta de turismo que entrega la PDI al entrar al país. Ojo: el SII aclaró
que **no se le puede exigir al huésped que pague en dólares**.

En la cuenta hay una marca *Turista extranjero — exento de IVA* y un campo
para el número de la tarjeta de turismo. Al marcarla, **toda la cuenta queda
sin IVA, también lo que ya estaba anotado**: la exención es una condición de
la persona, no de cada línea, y una cuenta mitad con IVA y mitad sin no se
puede llevar a una boleta. Si se marcó por error, se desmarca y vuelve todo
atrás.

## Cierre de día

Es lo que en un hotel grande se llama *night audit*, y es el corazón de que
los números cuadren. En la pestaña **Cierre** eliges la noche y aprietas
*Cerrar el día*. El sistema:

1. Anota en la cuenta de cada huésped alojado el alojamiento de esa noche.
2. Deja registrado el día como cerrado, con la hora y quién lo cerró.
3. Muestra el total del día separado en lodge y restaurante, con su neto y su
   IVA.
4. Lista **lo que hay que revisar antes de irse a dormir**: quién llegaba y no
   se registró, quién salía y no se marcó el check-out, quién está alojado sin
   firmar la ficha, quién se fue con saldo y qué habitaciones quedaron sucias.

Se puede ejecutar **más de una vez sin miedo**: no cobra dos veces la misma
noche. Y a propósito **no cambia el estado de nadie**: el check-in y los
no-show los sigue decidiendo recepción a mano, como pediste. El cierre solo
avisa.

Para dejarlo automático, en el editor de Apps Script: **Activadores → Añadir
activador → función `cierreAutomatico`, temporizador diario, entre 3 y 4 de la
mañana**. Cierra solo la noche que acaba de terminar.

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

Debajo va la **Caja del período**, que responde otra pregunta. Lo de arriba
dice *cuánto vendimos*; esto dice *cuánto pasó por la caja y de dónde salió*,
tomado de las cuentas de los huéspedes: lo cargado, lo cobrado, cuánto es del
lodge y cuánto del restaurante, el neto y el IVA, cuánto se facturó exento a
turistas extranjeros, y los desgloses por tipo de consumo y por medio de pago.

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

### Categorías, y cómo publicar la oferta en un canal

Cada unidad lleva una **categoría** — *Matrimonial con baño privado*, *Twin
con baño privado*, *Carpa glamping*… Es solo una etiqueta: **no cambia cómo se
reserva**, cada reserva sigue tomando una pieza concreta y se asigna a mano
como siempre. Si la dejas en blanco, se arma sola con la capacidad y el tipo
de baño.

Sirve para dos cosas:

1. **Responder rápido.** Cuando llega el mensaje "¿tienes algo matrimonial con
   baño privado del 12 al 15?", el sistema contesta por categoría y muestra
   cuáles quedan libres.
2. **Saber cómo publicar.** En Booking o Airbnb no se publica pieza por pieza
   sino por categoría, diciendo cuántas unidades tiene cada una. Abajo de la
   pestaña *Alojamiento* está la tabla **Cómo publicarlo en un canal**, ya
   armada: la categoría, cuántas unidades, desde qué precio y cuáles son.

Con casi una sola unidad por variante, esa tabla también deja ver dónde está
el riesgo real de sobreventa: las categorías con **una** unidad.

## Cómo se cuentan las noches

En el **selector de fechas** eliges entrada y salida: del 7 al 9 son 2 noches.

En la **grilla del calendario** cada celda es una noche, así que marcar el 7
y el 8 también son 2 noches — entra el 7 y sale el 9, que es justo lo que
muestra después el formulario. Un clic simple sobre un día vale por 1 noche.

## Por qué es rápido

Apps Script es lento sobre todo por las llamadas a la planilla: cada lectura
es una llamada remota. El sistema está armado para hacer las menos posibles.

- **Cada hoja se lee una sola vez por ejecución**, y leer y escribir comparten
  esa misma lectura: guardar una reserva ya no vuelve a pedir la hoja para
  saber en qué fila está.
- **Lo que el calendario necesita de las hojas grandes queda resumido y
  guardado** entre llamadas: qué reservas tienen la ficha firmada y cómo está
  el aseo de cada pieza. Los resúmenes se descartan solos en cuanto alguien
  firma una ficha o marca una habitación, así que nunca muestran algo viejo.
  Abrir el calendario pasó de leer tres hojas a leer una sola.
- **El inventario y la configuración también quedan guardados**, porque casi
  nunca cambian. La sesión, por unos minutos.
- **El inventario solo viaja cuando cambia.** Cada respuesta trae una huella
  de la lista de habitaciones y camas; si es la misma que ya tiene la
  pantalla, no se manda de nuevo y el refresco de fondo pesa menos.
- **Al guardar, la fila se escribe completa de una vez** en vez de campo por
  campo, y una reserva de grupo escribe todas sus habitaciones en una sola
  llamada.
- **El calendario pide tres semanas de más a cada lado.** Moverse de semana
  en semana se dibuja al instante con lo que ya está en memoria, sin esperar
  al servidor; solo se vuelve a pedir cuando de verdad te sales de ese rango.
- **Volver a una pestaña ya vista es instantáneo.** Hoy y Aseo se pintan con
  lo último que llegó y se actualizan por detrás.
- **El refresco de fondo no repinta si nada cambió**, para que la pantalla no
  parpadee mientras estás trabajando.
- **El logo viaja una sola vez y comprimido.** La página interna pasó de 232
  KB a 118 KB, y las de huésped y aseo de 79 KB a 31 KB: se abren mucho más
  rápido desde el teléfono.

Lecturas de planilla por operación, antes y ahora:

| Operación | Antes | Ahora |
|---|---|---|
| Abrir el calendario | 3 | **1** |
| Pestaña Hoy | 2 | **1** |
| Pestaña Aseo | 2 | 2 |
| Guardar una reserva | 2 | **1** |
| Cambiar de estado | 3 | **1** |
| Ver disponibilidad | 1 | 1 |
| Informes de un mes | 2 | **1** |
| Reserva de grupo de 3 piezas | 6 lecturas y 5 escrituras | **1 lectura y 2 escrituras** |
| **Total** | **21** | **10** |

(La primera carga del día lee 6 veces mientras arma lo que va a guardar; de
ahí en adelante son las cifras de la tabla.)

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

- **No emite la boleta ni la factura de exportación.** Lleva la cuenta con su
  neto y su IVA, y marca lo exento, pero el documento se emite fuera.
- **No importa reservas desde Booking ni Airbnb.** Es lo siguiente: la vía
  realista es leer los correos de reserva de Booking desde el mismo Apps
  Script y crear la reserva sola. La conexión de dos vías con Booking solo la
  abren a socios de conectividad certificados, así que eso pasaría por un
  channel manager intermedio.
- **Las tarifas son por temporada, no por fecha.** Todavía no hay precio por
  día, estadía mínima ni "cerrado a la llegada".
- No hay perfil de huésped con historial de estadías anteriores.
- La política de cancelación está escrita en el reglamento pero no se calcula
  sola.
- No cobra en línea: no genera enlaces de pago.
- No envía el enlace de la ficha solo: abre WhatsApp o el correo con el
  mensaje escrito, pero el envío lo haces tú.
- La app interna está solo en español; la página del huésped sí es bilingüe.
