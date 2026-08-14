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
   Esto crea la planilla con el inventario ya cargado (las 8 habitaciones y
   las 3 carpas) y el usuario inicial.
6. **Implementar → Nueva implementación → Aplicación web**:
   - *Ejecutar como*: *Yo*
   - *Quién tiene acceso*: *Cualquier usuario*
   - Copia la URL que termina en `/exec`. Esa es la app.

**Usuario inicial: `admin`, PIN `1234`.** Cámbialo apenas entres, desde la
pestaña *Equipo* (escribe `admin` con el PIN nuevo y guarda).

El logo va dentro de `Code.gs` y las tres pantallas se lo piden al servidor al
abrirse, sin depender de ningún archivo externo ni de permisos de Drive.

> La planilla de datos debe quedar **privada**. La app funciona igual porque
> se ejecuta con tu cuenta, y ahí se guardan documentos y firmas de huéspedes.

### Si cambias el código después

Editar los archivos **no** actualiza la app publicada: la implementación sigue
sirviendo la versión anterior. Cada vez que cambies algo:

1. Copia **los archivos completos** que cambiaron, no un pedazo.
2. **Implementar → Administrar implementaciones → ✏️ Editar → Versión: *Nueva*
   → Implementar**. La URL no cambia.

`Code.gs` e `Index.html` llevan la misma marca de versión (`VERSION` y
`VERSION_ESPERADA`, arriba de cada archivo). **Si no calzan, la app avisa con
una franja roja arriba** apenas entras, en vez de fallar de a pedazos: es lo
que pasa cuando se copia un archivo y no el otro, o cuando la implementación
quedó en una versión antigua. Y si algo llama a una función que el servidor
publicado todavía no tiene, el mensaje lo dice con nombre y apellido en vez de
soltar un error de JavaScript.

Si no puedes entrar, la pantalla de acceso tiene un enlace
*"¿No puedes entrar? Revisar la instalación"* que dice exactamente qué falta.

Si alguna vez editas las columnas de la planilla **a mano**, vuelve a
ejecutar `setup()`: además de dejar el encabezado en orden, borra todo lo que
el sistema tenía guardado en memoria, para que nada quede desactualizado.

**La primera vez que generes un PDF o mandes un correo**, Google va a pedir
permiso para usar Drive y Gmail. Es normal: los documentos se guardan en tu
Drive y los correos salen desde tu cuenta. Acepta una vez y no vuelve a
preguntar.

### Si no ves el logo

El logo ya no viaja dentro de la página: se pide aparte, así que si algo falla
falla solo el logo y en su lugar aparece el nombre escrito. Para saber qué
pasó, entra a *¿No puedes entrar? Revisar la instalación* en la pantalla de
acceso: ahí dice si el logo llegó y cuánto pesa. Si dice que **no llegó
completo**, es que `Code.gs` quedó pegado a medias — la línea del logo es muy
larga y se corta fácil al copiar. Vuelve a copiar el archivo entero, y después
**crea una versión nueva de la implementación** (Implementar → Administrar
implementaciones → ✏️ → Versión: *Nueva*), porque si no se sigue sirviendo la
versión vieja.

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
  al topar con una reserva existente. Si prefieres no buscar el día en la
  grilla, el botón **+ Nueva reserva** abre el mismo formulario con hoy, una
  noche y el primer alojamiento libre, y de ahí lo ajustas.
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
- **Dentro de la reserva, al frente está lo del día a día**: guardar, el
  check-in o el check-out según corresponda, la cuenta y el comprobante. Lo
  demás —acompañantes, la ficha, cancelar, eliminar— vive en el menú
  **Más ▾**, para que el pie del formulario no sea una hilera de ocho botones
  donde hay que ir a buscar el que se usa siempre.
- **En el teléfono** la columna de nombres se angosta y las pestañas se
  deslizan de lado, así que la grilla se sigue leyendo sin tener que girar el
  aparato.

## Huéspedes: buscador e historial

Pestaña **Huéspedes**. Están todos los que se han alojado o vienen a alojarse,
y se busca por **nombre, teléfono, correo, documento o por la habitación donde
estuvo**. Filtra mientras escribes, sin tildes y sin importar mayúsculas: buscar
*munoz* encuentra a *Muñoz*.

Lo importante es que **junta las visitas de la misma persona**, aunque el nombre
venga escrito distinto cada vez. Se agrupa por teléfono, y si no hay, por correo
o por el documento de la ficha; recién al final por el nombre. De cada persona
queda:

- Cuántas estadías y cuántas noches lleva, y si es **repetida**.
- Cuánto ha consumido, cuánto pagó y si quedó **debiendo**.
- Su primera visita, la última salida y, si tiene, **cuándo vuelve**.
- Sus datos, tomados de la visita donde los dejó más completos.

Al tocar a una persona se abre su historial: cada estadía con su alojamiento,
sus fechas, sus acompañantes, **el detalle de su cuenta movimiento por
movimiento** y un enlace para ver la ficha que firmó. Desde ahí se salta a la
reserva en el calendario.

Las reservas canceladas y los no-show quedan en el historial —para saber que
existieron— pero no suman noches ni estadías.

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

## Quiénes se alojan

**Firma una sola persona**, la que hace la reserva. No hay que perseguir a
todo el grupo con el teléfono.

Pero el registro de huéspedes tiene que nombrar a todos los que pernoctan, así
que la reserva lleva el número de personas y los datos del resto:

- En la reserva, el botón **Acompañantes** abre un bloque por cada persona
  además del titular. Lo único obligatorio es el nombre; documento,
  nacionalidad y fecha de nacimiento son opcionales.
- **El huésped los completa desde su enlace.** Si la reserva es para dos, la
  página que firma muestra un bloque de acompañante; si es para cuatro, tres.
  Vienen ya rellenos con lo que recepción hubiera cargado.
- **No se le exige.** Si todavía no sabe con quién viaja, puede firmar igual —
  es peor que invente un nombre para poder seguir. Los que falten aparecen en
  el cierre de día como *faltan acompañantes por registrar*, para pedirlos en
  el mesón, que es donde igual se ven los documentos.
- El texto que acepta dice explícitamente que firma **en su nombre y en el de
  las personas que lo acompañan**, en español y en inglés.

Si van más personas de las que dice la reserva, primero hay que subir el
número de personas: el sistema no deja anotar más acompañantes que los que
caben.

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

## El precio se arma noche a noche

El total de una reserva **no es un número suelto: es la suma de lo que vale
cada noche**. Cada noche parte con la tarifa que le corresponde por fecha
(baja o alta), y de ahí:

- **Si alargas la estadía, el total sube solo.** Estiras la reserva un día en
  el calendario y esa noche entra con su tarifa; el aviso te dice el total
  nuevo sin que tengas que abrir la reserva. Si la acortas, la noche se resta
  — y si ya se había cobrado, ese cargo se anula en la cuenta.
- **Puedes bajar una noche suelta.** En la reserva, *Ver noche por noche* abre
  el detalle y ahí cambias el valor de un día para una promoción, sin tocar
  las demás. La noche queda marcada como *a mano* y se respeta aunque después
  muevas la reserva.
- **O negociar el paquete completo.** Escribes el total acordado y se reparte
  entre las noches; la última absorbe el redondeo, así que la suma da exacto.
  También puedes escribir el total directo en el formulario de la reserva: si
  lo tocas, ese número manda y se reparte al guardar.
- **El cierre de día cobra el valor real de esa noche**, no un promedio. Si el
  martes era promoción, en la cuenta aparece el martes con su precio de
  promoción.

## La cuenta del huésped

Cada reserva tiene su propia cuenta: un libro donde **los cargos suman y los
pagos restan**. Se abre con el botón *Cuenta* de la reserva, o directo desde
la pestaña *Hoy*, donde el botón muestra lo que ese huésped debe.

Arriba se ve de un vistazo lo cargado, lo pagado y lo que queda por cobrar.
Ese número incluye **el alojamiento que todavía no se ha anotado**: si no,
una estadía que recién empieza parecería no deber nada.

- **El alojamiento lo anota el cierre de día**, noche por noche, cada una por
  lo que vale (ver *El precio se arma noche a noche*). Si prefieres dejar la
  cuenta lista al hacer el check-in, el botón *Postear el alojamiento* las
  anota todas de una vez.
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

### Un ejemplo: dos noches pagadas al llegar

Alguien llega el lunes, se va el miércoles y paga las dos noches completas al
hacer el check-in. Son 55.000 por noche, 110.000 en total.

**Lunes (noche 1).** Registras el pago de 110.000. Aunque todavía no cierres
nada, la cuenta ya muestra **saldo 0**, porque cuenta el alojamiento que falta
por anotar. Al cerrar el lunes, el cierre muestra:

| | |
|---|---|
| Alojamiento | 55.000 — lo que consumió *esta* noche |
| Cobrado hoy | 110.000 |
| De eso, adelanto de noches futuras | 55.000 |
| Por cobrar | 0 |

**Martes (noche 2).** Al cerrar el martes:

| | |
|---|---|
| Alojamiento | 55.000 |
| Cobrado hoy | 0 — ya había pagado |
| Adelanto | 0 |
| Por cobrar | 0 |

Y la cuenta del huésped queda: cargado 110.000, pagado 110.000, saldo 0.

Lo importante: **lo cobrado en un día no tiene por qué calzar con lo consumido
ese día**, y eso no es un descuadre. La plata entra el lunes pero se va
consumiendo noche a noche. Por eso el cierre muestra las dos cifras por
separado y dice cuánto de lo cobrado es adelanto. Es exactamente lo que hace
un hotel grande, y es lo que después permite decir "en agosto vendimos X
noches" sin que se mezcle con "en agosto entraron Y pesos a la caja".

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

## Configuración

Pestaña **Configuración** (solo administración). Lo principal es un **cuadro de
texto con las normas de convivencia**: es lo que el huésped lee y acepta al
firmar su ficha, y lo que sale en el comprobante. Se escribe tal como se va a
leer, **una norma por línea**, y se edita a mano.

Viene lleno con las normas que rigen hoy, así que se corrige encima en vez de
escribirlo de cero. Hay un botón para volver al texto original, y abajo una
vista previa de cómo lo verá el huésped. El cuadro de al lado es el mismo texto
en inglés.

Ojo con una cosa: **el texto manda**. Si cambias el horario de check-in, hay que
cambiarlo también en el texto de las normas; no se actualiza solo.

Detrás de *Ajustes que casi nunca se tocan* quedan los datos que el sistema usa
por dentro y que casi nunca hay que mover: el correo al que llega el cierre de
cada noche, las horas de check-in y check-out (aparecen en la pantalla de aseo y
en el comprobante), las fechas de temporada alta, el precio del programa tinaja
+ sushi, el porcentaje que va al restaurante y el IVA.

## Documentos en PDF

El sistema arma dos documentos con el logo y los deja en Drive, **ordenados por
fecha** para que la carpeta no se convierta en un basurero de archivos sueltos:

```
Casona Peumayén — Documentos/
  2026/
    08 agosto/
      Comprobantes/   comprobante-Perez-2026-08-14.pdf
      Cierres/        cierre-2026-08-14.pdf
    09 septiembre/
      Comprobantes/
      Cierres/
Casona Peumayén — Fichas/
  2026/
    08 agosto/        ficha-Perez-....pdf
```

El año y el mes salen de **la fecha del documento, no del día en que se
generó**: un comprobante de una reserva que llega en diciembre queda archivado
en diciembre, aunque lo hayas emitido hoy; el cierre queda en el mes de la
noche que cerró. Así, buscar "qué mandamos en marzo" es abrir una carpeta. Las
carpetas se crean solas la primera vez y se reutilizan después.

**Comprobante de la reserva.** Botón *Comprobante* dentro de la reserva. Trae
el alojamiento, las fechas con sus horarios, las noches con su valor, quiénes
se alojan, lo abonado, el saldo que queda para el día de llegada y las
condiciones de la estadía. Después se manda de tres formas: un botón que abre
**WhatsApp** con el mensaje y el enlace ya escritos, un botón que lo **envía
por correo** con el PDF adjunto, o el texto listo para copiar y pegar donde
sea. El archivo queda compartido por enlace, así que el huésped lo abre sin
tener cuenta de Google.

**Cierre de la noche.** En la pestaña *Cierre*, *Generar PDF* baja el resumen
de esa noche y *Enviar al dueño* se lo manda al correo configurado, con el PDF
adjunto. Si además dejaste el cierre automático de madrugada, **el correo sale
solo cada noche** apenas se cierra el día.

### Si el PDF no se genera

La conversión a PDF la hace Google y a veces no está disponible, o se atraganta
con el logo incrustado. El sistema no se queda callado:

1. Si falla con el logo, **lo genera igual sin el logo** y lo dice.
2. Si no puede convertir de ninguna forma, **guarda el documento como página
   web**, que se abre en el navegador y se imprime o se guarda como PDF desde
   ahí. También lo dice.
3. En *Configuración → Revisar los documentos* hay una prueba que dice en qué
   paso se cae: el permiso de Drive, la conversión, el logo o el correo, con el
   error textual de Google.

Y en los dos documentos hay un botón **Abrir para imprimir** que no pasa por
Drive ni por la conversión: abre el documento en una pestaña y lanza la
impresión del navegador, desde donde se guarda como PDF. Ese camino funciona
siempre, aunque Drive esté con problemas.

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
  calendario pero se conserva su historial de reservas. Las camas también, una
  por una, y al poner una habitación en modo cama sus camas se activan solas.

### La distribución de la casa

| Hab. | Qué tiene | Pax | Baño |
|---|---|---|---|
| 1 | Matrimonial | 2 | Privado |
| 2 | Twin | 2 | Privado |
| 3 | Matrimonial + cama adicional | 3 | Privado |
| 4 | Matrimonial | 2 | Privado |
| 5 | Single | 1 | Compartido |
| 6 | Single | 1 | Compartido |
| 7 | Matrimonial + litera | 4 | Compartido |
| 8 | Single + litera | 3 | Compartido |

Más las 3 carpas de glamping. **Todas se venden como habitación completa.**

Las camas de la 7 y la 8 están cargadas pero **archivadas**: si algún día se
vuelve a vender por cama, se activan y se le cambia el modo a esa habitación,
sin tener que crear nada.

Si algún día cambia la casa, las habitaciones se editan una por una desde
*Alojamiento*, sin tocar el código.

### Cómo se vende cada pieza

Cada alojamiento tiene un modo de venta:

- **Solo la habitación completa** — una fila en el calendario. Es como quedan
  las habitaciones 1 a 4 y las carpas.
- **Solo por cama** — cada cama es una fila propia, estilo hostal.
- **Las dos: completa o por cama** — la habitación **y** sus camas aparecen en
  el calendario, y **se bloquean entre sí**: si vendes la pieza completa a una
  familia, sus camas quedan sin cupo esas noches; si vendes una cama, la pieza
  completa deja de estar disponible. Las casillas que quedan sin cupo por esta
  razón salen rayadas en gris, y al pasar el mouse dicen quién tomó el
  espacio.

Esto se cambia cuando quieras desde *Alojamiento → Editar*. Si hoy prefieres
vender las habitaciones 5 a 8 completas, ponlas en **solo la habitación
completa** y dales un precio; las camas quedan guardadas y el día que quieras
volver a venderlas por cama —o las dos cosas— basta cambiar el modo. Para
vender una pieza completa hay que ponerle precio: el sistema no deja
guardarla sin él.

### Categorías, y cómo publicar la oferta en un canal

Cada unidad lleva una **categoría** — *Matrimonial con baño privado*, *Twin
con baño privado*, *Carpa glamping*… Es solo una etiqueta: **no cambia cómo se
reserva**, cada reserva sigue tomando una pieza concreta y se asigna a mano
como siempre. Si la dejas en blanco, se arma sola con la capacidad y el tipo
de baño.

**Saber cómo publicar.** En Booking o Airbnb no se publica pieza por pieza sino por
categoría, diciendo cuántas unidades tiene cada una. Abajo de la pestaña
*Alojamiento* está la tabla **Cómo publicarlo en un canal**, ya armada: la
categoría, cuántas unidades, desde qué precio y cuáles son.

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
- **Las hojas que se cruzan entre sí se indexan una vez y se consultan por
  llave.** Antes, para armar el historial de un huésped había que recorrer
  todas las noches y todos los movimientos por cada reserva suya; ahora esas
  hojas se agrupan una sola vez por reserva y después se buscan directo. Es la
  diferencia entre trabajo que crece al cuadrado y trabajo que crece derecho:
  es lo que hace que el sistema aguante años de datos y no solo un mes.

Lecturas de planilla por operación, medidas sobre la planilla actual:

| Operación | Lecturas | Escrituras |
|---|---|---|
| Abrir el calendario | 1 | 0 |
| Pestaña Hoy | 1 | 0 |
| Pestaña Aseo | 2 | 0 |
| Guardar una reserva | 2 | 2 |
| Cambiar de estado | 2 | 2 |
| Ver disponibilidad | 1 | 0 |
| Informes de un mes | 2 | 0 |
| Buscador de huéspedes | 4 | 0 |
| Reserva de grupo de 3 piezas | 2 | 3 |
| **Total de las 9** | **17** | |

(La primera carga del día lee 6 veces mientras arma lo que va a guardar; de
ahí en adelante son las cifras de la tabla. El calendario, que es lo que más
se abre, pasó de leer tres hojas a leer una.)

### Con tres años de datos encima

La prueba de carga arma 2.891 reservas, 5.782 noches y 5.782 movimientos —tres
años de operación— y cronometra cada pantalla:

| Pantalla | Tiempo |
|---|---|
| Abrir el calendario | 20 ms |
| Pestaña Hoy | 19 ms |
| Pestaña Aseo | 29 ms |
| Informes de un mes | 31 ms |
| Cierre de un día | 34 ms |
| Buscador de huéspedes | 69 ms |
| Buscar un nombre | 70 ms |

El buscador de huéspedes con ese volumen tardaba **10,2 segundos** antes de
los índices; ahora tarda **69 ms**, unas 140 veces menos. Ninguna pantalla
pasa de la décima de segundo con tres años de historia.

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
- **Las tarifas base son por temporada, no por fecha.** Cada noche de una
  reserva sí se puede editar a mano, pero todavía no hay un calendario de
  precios por día, ni estadía mínima, ni "cerrado a la llegada".
- No hay perfil de huésped con historial de estadías anteriores.
- La política de cancelación está escrita en el reglamento pero no se calcula
  sola.
- No cobra en línea: no genera enlaces de pago.
- El comprobante sí se manda por correo desde el sistema; el de WhatsApp abre
  el chat con el mensaje escrito, pero el envío lo aprietas tú.
- La app interna está solo en español; la página del huésped sí es bilingüe.
