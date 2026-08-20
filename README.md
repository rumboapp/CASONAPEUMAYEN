# Casona Peumayén — PMS

Sistema interno de reservas para el lodge y el glamping. Calendario visual,
estado de aseo, ficha de check-in con firma y coordinación del programa de
programas especiales.

Con Booking intercambia calendarios en las dos direcciones: bloquea allá lo que
acá ya se vendió, y mete acá lo que Booking vendió. Lo que llega por WhatsApp o
por teléfono se carga a mano, y todo se ve en un solo lugar sin que se pisen las
reservas.

## Los archivos

Son **seis**, y se copian tal cual:

| Archivo | Qué es | Cómo se crea en Apps Script |
|---|---|---|
| `Code.gs` | Todo el servidor: datos, reservas, aseo, fichas, usuarios | Archivo → Script |
| `Index.html` | La aplicación interna del equipo | Archivo → HTML |
| `Ficha.html` | La página que ve el huésped para firmar desde su teléfono | Archivo → HTML |
| `Aseo.html` | La pantalla del equipo de aseo, con su propio enlace | Archivo → HTML |
| `Plano.html` | El editor del plano de la planta, para el trámite sanitario | Archivo → HTML |
| `appsscript.json` | Configuración del proyecto | Ya existe; se activa en ⚙️ Configuración → "Mostrar appsscript.json" |

## Instalación

1. Entra a [script.google.com](https://script.google.com) con la cuenta del
   negocio → **Nuevo proyecto** → ponle "Casona Peumayén".
2. Borra el contenido del `Code.gs` de ejemplo y pega el de este repositorio.
3. **Archivo → HTML**, llámalo `Index` (sin escribir `.html`) y pega
   `Index.html`. Repite con `Ficha` y con `Aseo`, pegando el archivo del
   mismo nombre.
   Repite también con `Plano`.
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

Son **tres pasos, siempre los mismos**. Copiar los archivos no basta.

1. **Copia los archivos completos** que cambiaron, no un pedazo. Si cambió
   `Code.gs`, copia `Code.gs` entero; si cambió `Index.html`, ese entero.
2. **Ejecuta `setup()`.** En el desplegable de funciones elige *setup* y
   ▶️ *Ejecutar*.
3. **Vuelve a implementar**: *Implementar → Administrar implementaciones →
   ✏️ Editar → Versión: **Nueva** → Implementar*. La URL no cambia.

**El paso 3 es el que más se olvida y el que más confunde**, porque editar
los archivos **no** actualiza la app publicada: la implementación sigue
sirviendo la versión anterior. Si pegas el código nuevo y no reimplementas,
la pantalla nueva termina hablándole a un servidor viejo, y ahí aparecen los
errores raros.

#### ¿Hay que ejecutar `setup()` todas las veces?

**Estrictamente, no**: solo hace falta cuando el cambio agrega una columna o
una hoja nueva a la planilla. Pero **no hay forma de saberlo mirando el
código**, tarda dos segundos y **no rompe nada**, así que la regla práctica
es ejecutarlo siempre. Es lo más barato del proceso.

Lo que `setup()` hace es seguro por diseño:

- **Agrega las columnas y hojas que falten, al final**, sin correr ni tocar
  las que ya estaban. Los datos guardados quedan intactos.
- **No pisa nada.** El inventario y la configuración solo se escriben si están
  vacíos; si ya tienes habitaciones y precios cargados, ni los mira.
- **Borra lo que el sistema tenía guardado en memoria**, para que después del
  cambio nada quede mostrando información vieja.

Por eso también hay que ejecutarlo si alguna vez editas las columnas de la
planilla **a mano**.

#### Si algo quedó a medias, la app lo dice

`Code.gs` e `Index.html` llevan la misma marca de versión (`VERSION` y
`VERSION_ESPERADA`, arriba de cada archivo). **Si no calzan, la app avisa con
una franja roja arriba** apenas entras, en vez de fallar de a pedazos: es lo
que pasa cuando se copia un archivo y no el otro, o cuando la implementación
quedó en una versión antigua. Y si algo llama a una función que el servidor
publicado todavía no tiene, el mensaje lo dice con nombre y apellido en vez de
soltar un error de JavaScript.

Si no puedes entrar, la pantalla de acceso tiene un enlace
*"¿No puedes entrar? Revisar la instalación"* que dice exactamente qué falta.

**La primera vez que generes un PDF o mandes un correo**, Google va a pedir
permiso para usar Drive y Gmail. Es normal: los documentos se guardan en tu
Drive y los correos salen desde tu cuenta. Acepta una vez y no vuelve a
preguntar.

También va a pedir permiso para **crear carpetas en Drive**, porque los
documentos se archivan por año y mes. Es la misma pantalla de siempre con una
línea más.

**El sistema no sale a internet salvo que ustedes lo pidan.** El valor del
dólar lo fijan ustedes en *Configuración* y viene con uno puesto de fábrica,
así que en el uso normal no se consulta nada externo. Hay dos cosas —y solo
dos— que sí salen, y las dos vienen apagadas: dejar el dólar en **0** para que
busque el observado del día, y conectar el **bot de Telegram**. Recién ahí
Google pide el permiso de consultas externas.

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

**Las barras van de media mañana a media mañana**, como en cualquier tablero
de hotel: la de una reserva del 14 al 15 empieza a la mitad del día 14 y
termina a la mitad del 15. No es adorno — es lo que hace legible el recambio.
El día en que alguien se va, la mitad izquierda es suya y la derecha queda
libre, así que la reserva que entra ese mismo día se dibuja al lado, en la
misma fila, sin pisarse ni parecer que hay dos personas en la pieza.

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
- **Niños menores de 6**: van en un campo aparte porque **no pagan y no
  ocupan cupo** — una matrimonial con dos adultos y un bebé sigue siendo de 2
  pax. Pero el registro de huéspedes tiene que nombrarlos igual, así que
  aparecen como acompañantes marcados *menor de 6*, y la ficha se los pide al
  huésped junto con el resto.
- **Baño**: cada fila indica `PRIV` o `COMP` según sea privado o compartido,
  y el selector de la reserva lo repite junto a la capacidad.
- **El estado de aseo se ve en el propio calendario**: cada fila lleva un
  punto verde (limpia), rojo (sucia) o gris (fuera de servicio), y las sucias
  quedan con un tinte distinto. Sirve para decidir al vuelo dónde meter a
  alguien que llega sin reserva.
- **El formulario pide solo lo que se llena siempre**: fechas, alojamiento,
  huésped, teléfono, personas, niños, total y abonado. Con eso ya se guarda
  una reserva. Correo, canal, estado, turista extranjero y notas viven detrás
  de **Más datos**, plegado — antes eran trece campos y una reserva de
  mostrador quedaba a mitad de pantalla. Si la reserva que abres ya trae algo
  ahí adentro, se despliega sola: nada queda escondido sin avisar.
- **La reserva de grupo va numerada 1-2-3-4**, en el orden de la conversación
  real: cuándo vienen, quién es, qué piezas toman y cuánto. Correo, canal y
  notas también quedan en *Más datos*.
- **Dentro de la reserva, al frente está lo del día a día**: guardar, el
  check-in o el check-out según corresponda, la cuenta y el comprobante. Lo
  demás —acompañantes, documentos, la ficha, cancelar, eliminar— vive en el
  menú **Más ▾**, para que el pie del formulario no sea una hilera de ocho
  botones donde hay que ir a buscar el que se usa siempre.
- **En el teléfono el calendario muestra los días que caben** (unos cinco en
  vertical, el doble si lo giras), y se avanza con las flechas. Ver más — ver
  *Desde el teléfono*.

## Desde el teléfono

No hay una app aparte ni una dirección distinta: **es la misma pantalla, que
se acomoda al ancho que tenga**. Se abre el mismo enlace y listo. Al girar el
aparato se reacomoda sola, sin recargar.

Lo que cambia cuando la pantalla es angosta:

- **El calendario muestra los días que caben enteros** —unos cinco en un
  teléfono de pie, el doble acostado— y se avanza con ‹ ›. El selector de
  días solo ofrece lo que se puede mostrar completo.

  Es a propósito y vale la pena explicarlo: antes se apretaban catorce días y
  había que deslizar de lado, pero **al deslizar se iban los nombres de las
  habitaciones** y quedaba un tablero de casillas vacías sin saber qué fila
  era cuál. Preferimos ver menos días y saber siempre de qué pieza se trata.
- **El nombre de cada fila va en dos líneas**: arriba la habitación, abajo el
  tipo o la cama. En una sola quedaba "Hab. 1 · Mat…" o, peor, "H… · Litera
  superior", que no dice de qué habitación es.
- **La fila de días queda pegada arriba** al bajar por la lista, para no
  perder de vista qué día es cada columna. Y se desplaza **una sola cosa**, la
  página: antes había dos barras peleando y el dedo no sabía cuál iba a mover.
- **Los formularios suben desde abajo** ocupando el ancho completo, como una
  hoja, con los botones al alcance del pulgar.
- **Los campos son de 16px**, que es el tamaño mínimo para que el teléfono no
  haga zoom solo cada vez que tocas uno. Los botones se agrandan para poder
  tocarlos sin apuntar.
- **Las pestañas se deslizan** y la que abres se trae a la vista sola, aunque
  estuviera fuera de pantalla.

Para el trabajo de mostrador —ver quién llega hoy, hacer un check-in, cobrar,
marcar una habitación como limpia— el teléfono alcanza de sobra. Para mirar
dos semanas de ocupación de una vez, conviene el computador.

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

También se puede **filtrar por fechas**: *"quiénes se alojaron entre el 1 y el
28 de febrero"*, con atajos para **este mes** y **este año**. Una estadía cuenta
si toca el período aunque sea una noche, no solo si empieza dentro: alguien que
llegó el 28 de enero y se fue el 3 de febrero aparece en los dos meses, que es
lo correcto.

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
- Tiene la misma casilla de **turistas extranjeros**: una familia de afuera
  que toma tres piezas es una sola familia de afuera, así que las tres se
  cotizan en dólares y sin IVA con el mismo cambio, de una vez. Antes había
  que crear el grupo y después entrar pieza por pieza a marcarlas.
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

Si van más **adultos** de los que dice la reserva, primero hay que subir el
número de personas: el sistema no deja anotar más acompañantes que los que
caben. Los **menores de 6 no cuentan para ese tope** — van en el campo de niños
de la reserva, no pagan ni ocupan cupo, pero igual aparecen como acompañantes
marcados *menor de 6* para que el registro los nombre.

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

## Programas

Un **programa** es una tarifa especial con lo que incluye escrito: *Programa
Romántico*, *Escapada Full Day*, lo que quieran armar. Se crean en
*Configuración → Programas* y desde ahí se usan al reservar.

**Lo importante de entender: un programa NO es un extra que se suma al
alojamiento — es una tarifa que lo reemplaza.** Al hacer la reserva se elige
entre la *tarifa normal* y los programas disponibles, como botones uno al lado
del otro con su precio a la vista. Si la pieza vale $55.000 la noche y el
programa $95.000, la reserva queda en $95.000, no en $150.000.

Cada programa tiene:

- **Nombre** — el que ve el huésped en su comprobante.
- **Qué incluye** — texto libre, **una cosa por línea**. Sale tal cual en el
  comprobante, así que se escribe como se quiere que se lea.
- **Valor por noche**, con precio aparte de temporada alta si corresponde. Si
  se deja vacío, vale lo mismo todo el año.
- **Dónde se puede usar** — en todo, solo en el lodge o solo en el glamping.
  Un programa de carpa no aparece al reservar una habitación.

**Al reservar.** Los botones de tarifa están **junto al precio**, no escondidos
en *Más datos*: son de dónde sale el número que está justo abajo. Elegir un
programa **recotiza la estadía** al precio nuevo, y debajo se muestra lo que
incluye para no tener que ir a mirarlo a otra parte. El precio sigue siendo
editable a mano, como siempre, y el detalle noche a noche también.

Cambiar de programa —o quitarlo— vuelve a cotizar las noches. Guardar la
reserva **sin tocar el programa** no toca los precios: un valor conversado se
respeta.

**En el comprobante** aparece el nombre del programa y una sección *Tu programa
incluye* con la lista completa. Es lo que el huésped va a leer con más
atención.

**En los informes** hay una tabla *Programas vendidos* con cuántas reservas y
cuánto dejó cada uno, más un indicador de cuántas reservas del período fueron
con programa. Es lo que dice si un programa vale la pena o si nadie lo pide.

**Se archivan, no se borran.** Un programa que ya no se vende se archiva: deja
de ofrecerse al reservar, pero las reservas que se vendieron con él lo siguen
diciendo, y sus comprobantes también. La reserva guarda el nombre del programa
**congelado** al momento de venderla, así que cambiarle el nombre después no
reescribe la historia.

> El programa fijo de **tinaja + sushi** que existía antes pasó a ser uno más
> de estos. Al ejecutar `setup()`, las reservas que lo tenían marcado quedan
> apuntando a un programa nuevo con ese nombre, **archivado** y con los precios
> que estaban configurados. Nace archivado a propósito: antes ese valor se
> *sumaba* al alojamiento y ahora un programa lo *reemplaza*, así que hay que
> revisarle el precio antes de volver a venderlo. Ninguna reserva ya cobrada
> cambia de valor.

## La cuenta del huésped

Cada reserva tiene su propia cuenta: un libro donde **los cargos suman y los
pagos restan**. Se abre con el botón *Cuenta* de la reserva, o directo desde
la pestaña *Hoy*, donde el botón muestra lo que ese huésped debe.

La pantalla está ordenada en el orden en que uno la usa: **primero cuánto
debe**, que es a lo que se abre; después el detalle de lo cargado y lo pagado;
después lo que falta por cargar; después las dos cosas que uno viene a hacer
—anotar un consumo o cobrar—; y al final lo tributario, que se toca una vez y
no se vuelve a mirar.

El número de arriba incluye **el alojamiento que todavía no se ha anotado**: si
no, una estadía que recién empieza parecería no deber nada.

- **El alojamiento lo anota el cierre de día**, noche por noche, cada una por
  lo que vale (ver *El precio se arma noche a noche*). Si alguien paga la
  estadía completa al llegar y quieres dejar la cuenta lista de entrada, el
  botón **Cargar las noches que faltan** las anota todas de una vez. No es
  obligatorio: si no lo aprietas, se van cargando solas cada madrugada.
- **Lo demás se agrega cuando ocurre**: una cena, el bar, lavandería, un daño.
  Hay botones rápidos para lo más común.
- **Cada cargo sabe a qué centro de ingreso pertenece**, el lodge o el
  restaurante. Eso es lo que hace que el reparto con la cocina salga solo en
  los informes en vez de discutirse a fin de mes.
- **Los pagos se registran con su medio**: efectivo, transferencia, tarjeta o
  "lo cobra Booking". El campo *Abonado* de la reserva es el espejo de esos
  pagos, así que una vez que hay pagos se llena solo y deja de editarse a mano.
- **Nada se borra.** Un movimiento equivocado se *anula*: deja de sumar pero
  queda en la planilla como rastro de lo que pasó.

### Turistas extranjeros, el dólar y el IVA

Los servicios de hotelería a turistas extranjeros sin domicilio ni residencia
en Chile van **exentos del 19%**. La exención tiene tres condiciones que van
juntas, y el sistema está armado alrededor de eso:

1. Que sea **turista extranjero sin residencia**.
2. Que se acredite con **pasaporte y la tarjeta de turismo de la PDI**.
3. Que **el pago entre en moneda extranjera**.

**La tercera es la que se olvida.** Marcar a alguien como exento y cobrarle en
pesos no da la exención: da una diferencia de IVA que aparece en una
fiscalización. Por eso el sistema no se limita a la marca — registra en qué
moneda entró cada peso.

**Marcada la casilla *Turista extranjero*, esa reserva pasa a ser una reserva
en dólares.** La casilla está **justo debajo del precio**, a la vista: es la
que decide en qué moneda se escriben esas dos cifras, así que tenerla plegada
dentro de *Más datos* obligaba a abrir un panel para entender por qué el total
decía pesos.

No es una etiqueta: le cambia la moneda. De ahí en adelante **no
vuelve a aparecer un peso chileno en ninguna parte suya** —ni en el formulario,
ni en el detalle noche a noche, ni en su cuenta, ni en el comprobante que se le
manda— y **nada lleva impuesto**.

Al marcarla, de una vez:

- Las casillas **Total** y **Abonado** cambian de rótulo y pasan a decir
  **US$**. Lo que se escribe ahí son dólares, y son los dólares que paga.
- Se le **fija el tipo de cambio del día**, y **se le respeta después** aunque
  el dólar se mueva.
- El precio que propone el sistema sale de la tarifa de la casa **sin el IVA**
  —las tarifas se escriben con impuesto incluido, como se muestran en Chile— y
  ya convertido a dólares.

Desmarcarla hace el camino de vuelta: las casillas vuelven a decir pesos y el
precio recupera su IVA. Marcarla **no recotiza** un precio que hayas
conversado: solo lo pasa a dólares y le quita el impuesto.

Si por lo que sea no hay un valor del dólar cargado, la casilla lo dice y la
reserva **se queda en pesos** en vez de cotizar mal. Poner "US$" encima de una
cifra que son pesos sería lo peor que podría pasar: se le cobraría al huésped
casi mil veces de más.

> **Por qué la casilla es de dólares y no de pesos.** Antes decía pesos y el
> equivalente en dólares se calculaba en una nota abajo. El problema es que
> $45.000 se ve idéntico con IVA y sin IVA: al volver a abrir la reserva y
> guardarla, el formulario devolvía esa cifra y el impuesto se colaba de
> vuelta, así que la misma reserva valía una cosa al crearla y un 19% más al
> día siguiente. Con la casilla en dólares no hay nada que adivinar — lo que
> está escrito es lo que se cobra.

Por dentro la planilla se sigue llevando en pesos, porque en pesos se declara y
en pesos se leen el cierre de cada noche y los informes de la casa. Esa
conversión es cuenta interna y no aparece en ninguna pantalla.

Las reservas de extranjeros cargadas antes de que existiera el descuento se
corrigen solas la próxima vez que ejecutes `setup()`.

Lo mismo en la pestaña *Alojamiento*: el precio en dólares de cada pieza va
**sin IVA**, porque es el que se le cotiza a alguien de afuera.

**Al cobrar**, la cuenta de un extranjero ya viene puesta en dólares: el
consumo se anota en US$ y el pago también, y el sistema los convierte al cambio
de esa reserva antes de guardarlos. Si igual entra un pago en pesos, esa línea
queda marcada — porque es justamente lo que rompe la exención.

**Si algo no calza, se dice.** Un huésped marcado exento con pagos en pesos
sale con un aviso en su cuenta *y* en el cierre de esa noche, mientras todavía
está alojado y se puede arreglar — no a fin de mes.

**Qué cubre la exención.** El **alojamiento** y lo que va incluido en él. El
restaurante, el bar y la tinaja se venden aparte y llevan IVA aunque el
huésped sea extranjero. Marcar a alguien a mitad de la estadía arrastra el
alojamiento que ya estaba anotado —si no, la cuenta saldría mitad con IVA y
mitad sin— pero no toca sus consumos. Si se marcó por error, se desmarca y
vuelve todo atrás.

> Esto es cómo está programado, no una asesoría tributaria. Confirmen el
> criterio con su contador; si deciden otra cosa, se cambia.

**De dónde sale el dólar.** Lo fijan ustedes. Es la primera tarjeta de
*Configuración*, con su propio botón de guardar, y viene con un valor puesto
desde la instalación. Cambiarlo **no altera las reservas ya cotizadas**: cada
una se quedó con el valor que regía el día en que se hizo.

Si alguna vez prefieren el automático, dejen ese campo en **0** y el sistema
consulta el dólar observado del día una vez por jornada; si el servicio no
contesta, sigue con el último valor conocido y la pantalla dice cuál está
usando.

En **Alojamiento**, cada precio se muestra también en dólares al cambio de hoy,
para cotizarle a alguien de afuera sin sacar la calculadora.

### Documentos: pasaporte, tarjeta PDI y cédula

**A cada huésped se le pide lo que le corresponde, y nada más:**

| | Qué se le pide | ¿Es obligatorio? |
|---|---|---|
| **Turista extranjero** | Pasaporte **y** tarjeta de turismo PDI | Sí — de eso depende la exención de IVA |
| **Huésped chileno** | Cédula de identidad | **No**, es del todo opcional |

Antes se le ofrecían pasaporte y PDI a todo el mundo. A un chileno eso no le
sirve de nada —no los tiene— y además le dejaba en la reserva una advertencia
de "faltan documentos" que nunca iba a poder completarse. Ahora la reserva de
un chileno **no muestra ninguna advertencia**: si deja su cédula, queda
registrada; si no, no pasa nada.

Hay **dos caminos, y son de dos personas distintas**:

**1. El huésped, desde su celular, antes de llegar.** En el enlace de su ficha
—el que se le manda por WhatsApp— hay botones grandes de *Cargar aquí* que en
un teléfono abren la cámara directamente. Al extranjero le aparecen dos, uno
por cada papel; al chileno, uno solo para su cédula, diciéndole en la misma
página que es opcional. Funciona **aunque la ficha ya esté firmada**, que es el
caso normal, porque los papeles se piden después de firmar.

**2. Recepción, con el huésped enfrente.** Es para cuando no subió nada, o
llegó sin reserva. En la reserva: *Más ▾ → Pasaporte y tarjeta PDI*. Ahí hay un
**código QR** que **es una herramienta de recepción, no del huésped**: el
recepcionista lo escanea **con su propio teléfono** y se le abre una pantalla
que **no hace nada más que sacar las fotos que corresponden** —pasaporte y PDI
si es extranjero, cédula si es chileno— y guardarlas en esa reserva.
No muestra la ficha, ni el reglamento, ni la firma, ni datos personales — solo
de quién son los documentos, para no guardárselos a la reserva equivocada. Al
huésped no se le muestra este código en ningún momento.

Es la manera de registrar los documentos **sin escáner**, que es lo que hay en
el mostrador. Si el archivo ya está en el computador, en esa misma pantalla se
puede arrastrar o elegir, sin pasar por el teléfono.

**Que el QR se lea de verdad.** Es lo que más costó, y por una razón que vale
la pena dejar escrita.

El generador de QR está hecho a mano en el propio archivo —no se puede cargar
una librería de internet dentro de Apps Script sin salir a buscarla— y tenía
**dos errores que lo hacían ilegible para cualquier teléfono**:

- Los 15 bits del **formato** —los que le dicen al lector con qué máscara
  desenmascarar— se escribían **al revés**: el bit 14 donde va el 0. El valor
  era correcto; llegaba dado vuelta. Un lector lee esos bits antes que nada,
  así que con eso mal ni siquiera encuentra el código.
- Los **patrones de alineación** que caen sobre la línea de sincronía se
  descartaban por error. Existen de la versión 7 en adelante y son
  obligatorios; sin ellos, los huecos se llenaban con datos y el flujo entero
  quedaba corrido.

**Por qué no lo cachó ninguna prueba, que es lo importante.** La prueba
decodificaba el código con un lector escrito por la misma mano que el
generador. Los dos compartían el mismo malentendido, así que el viaje de ida y
vuelta cuadraba perfecto mientras ningún teléfono podía leer nada. Una prueba
que se mira al espejo no prueba nada.

Ahora se comprueba con **dos piezas ajenas**: la matriz se compara módulo por
módulo contra la de un generador de referencia, y el dibujo que sale a la
pantalla se fotografía en un navegador de verdad y se lee con **jsQR**, el
lector que usan los escáneres web —que sí verifica la corrección de errores—.
Se prueban las diez versiones, una por una, porque el segundo error solo
aparecía de la séptima en adelante.

Aparte de eso, tres cosas que ayudan a que la cámara lo agarre rápido:

- El enlace de recepción es **corto y propio**: un código de 10 letras en vez
  del token de 32 de la ficha. Son 22 letras menos dentro del código, y eso se
  traduce en cuadraditos más grandes.
- **Cada cuadradito mide 6 píxeles exactos.** Antes medía 3,88 y, al pedir
  bordes nítidos, unos salían de 3px y otros de 4px.
- Hay un botón **Ampliar para escanear** que lo pone a pantalla completa, con
  cuadraditos del doble de grandes y nada alrededor que le quite contraste, y
  debajo va el **enlace escrito con un botón para copiarlo**, por si aun así no
  hay caso.

**Y la reserva avisa si están o no.** Arriba del todo, apenas se abre: verde si
está todo lo que se le pide, ámbar si falta algo —diciendo qué—. A un huésped
chileno no se le exige nada, así que su reserva solo muestra la franja, en
verde, si dejó su cédula. La franja se aprieta y lleva derecho a subirlos.

El archivo se guarda con **la fecha de llegada** del huésped, no la del día en
que se subió: es de esa estadía y es así como se busca después.

La foto **se achica en el propio navegador antes de subirla**: una foto de
celular pesa varios megas y con datos móviles no llegaría nunca. Queda en unos
300 KB, que es más que suficiente para leer un pasaporte.

Los archivos se guardan en Drive, en `AAAA / MM mes / Documentos de huéspedes`,
y en la planilla queda solo la referencia. Borrar uno lo manda a la papelera de
Drive, no lo destruye.

## Avisos al grupo de Telegram

Un bot que escribe en el grupo del equipo cada vez que pasa algo con una
reserva, para que nadie tenga que estar mirando la app: la reserva cae y el
grupo se entera.

**Viene apagado.** Sin el token del bot no se manda nada y no sale ni un
paquete a internet — el resto del sistema funciona sin conexión a propósito, y
esto no lo cambia por defecto. Se enciende en *Configuración → Avisos al grupo
de Telegram*.

**Cómo se conecta, una sola vez:**

1. En Telegram, escríbele a **@BotFather** y manda `/newbot`. Te pide un nombre
   y te devuelve un **token**.
2. Pega ese token en la app y aprieta **Guardar**.
3. Agrega el bot al grupo del equipo y **escribe cualquier cosa** en ese grupo.
4. Aprieta **Buscar el grupo** — la app encuentra sola el ID, nadie tiene que
   averiguarlo — y después **Mandar una prueba** para verlo llegar.

El token queda guardado en la planilla y **no vuelve a la pantalla**: se
muestra tapado con puntos. Guardar la configuración sin tocarlo no lo pisa.

**Qué avisa**, y cada uno se puede apagar por separado:

- **Reservas nuevas** — huésped, pieza, fechas, noches, personas, total y por
  qué canal entró. Un grupo de tres piezas manda **un** mensaje, no tres.
- **Cancelaciones y cambios** — cuando se cancela, se elimina, o se mueve de
  día o de habitación. En una movida dice de dónde a dónde.
- **Check-in y check-out** — quién llegó y cuánto le queda por pagar; quién se
  fue y, sobre todo, **si se fue debiendo**, que es cuando ya no hay a quién
  cobrarle.

Así se ve uno:

```
🆕 Reserva nueva

👤 Ana Pérez
🛏 Habitación 1 · Matrimonial
📅 mar 14 feb → vie 17 feb  ·  3 noches
👥 2 personas + 1 menor de 6
💵 $150.000
🎁 Programa: Programa Romántico
📲 booking  ·  la cargó admin
```

A un huésped extranjero se le nombra **en dólares**, igual que en toda la app.

**Solo el nombre.** El mensaje no lleva teléfono ni correo. El historial de un
grupo de Telegram no lo controlamos nosotros y queda para siempre; el nombre
alcanza para saber de quién se habla y el resto está en la app.

**Un aviso nunca puede voltear una reserva.** Si Telegram está caído, si
cambiaron el token o si se acabó la cuota de Google, la reserva se guarda
igual y el error se traga en silencio. El aviso es un lujo; la reserva es el
trabajo. El botón *Mandar una prueba* sí avisa cuando algo falla — para eso
está.

> La primera vez que se mande un aviso, Google va a pedir permiso para hacer
> **consultas a servicios externos**. Es el mismo permiso que pediría el dólar
> automático. Se acepta una vez.

## Booking

### Por qué no hay una conexión "de verdad"

**Booking no acepta conexiones directas de propiedades individuales.** Su API
de dos vías —la que sincroniza disponibilidad, tarifas y reservas— es solo para
*Connectivity Partners* certificados: empresas que conectan muchos hoteles. Un
lodge de 11 unidades no entra, y no es cuestión de esfuerzo ni de plata. La
alternativa oficial es contratar un *channel manager*, que cuesta todos los
meses.

Así que se hace por los dos caminos que Booking sí deja abiertos, uno para cada
dirección.

### 1. Bloquear fechas en Booking (ya funciona)

Es la mitad urgente. Si alguien reserva **directo** por WhatsApp y se carga
acá, Booking no se entera y puede vender la misma pieza. Booking permite
**importar un calendario externo** desde el extranet, así que la app publica uno
por cada alojamiento y Booking bloquea solo esas fechas.

En *Configuración → Booking → 1* está la lista de direcciones,
una por alojamiento, con su botón de copiar. En el extranet de Booking:
**Rates & Availability → Sync calendars →** elegir la habitación **→ Import
calendar →** pegar la dirección.

Lo que hay que saber:

- **No es instantáneo.** Booking va a buscar el calendario cada varias horas.
  Entre que se carga una reserva y Booking la ve hay una ventana.
- **Bloquea lo mismo que bloquea el calendario de acá**: todo menos las
  canceladas y los no-show. Una tentativa retiene la pieza, así que también
  bloquea. Y en una habitación que se vende por camas, tomar una cama bloquea
  la pieza entera — la misma regla que impide una doble reserva internamente.
- **No lleva ningún dato del huésped.** Solo dice "Ocupado" de tal día a tal
  día. La dirección es pública porque Booking la lee sin identificarse, así que
  adentro no puede haber nombres, teléfonos ni notas.
- **La dirección es secreta.** Lleva una clave de 32 caracteres y es lo único
  que la protege. Quien la tenga puede ver qué días está lleno el lodge, nada
  más. Con la clave equivocada sale un calendario vacío, no un error.

### 2. Que la reserva de Booking entre sola (ya funciona)

La otra mitad: que una reserva hecha en Booking aparezca acá sin que nadie la
escriba.

**Por qué NO se hace leyendo el correo.** Era el plan obvio: Apps Script puede
leer el Gmail de la cuenta, y Booking manda un correo por cada reserva. Los
correos reales lo descartaron. Esto es todo lo que trae uno:

```
Asunto: Booking.com - ¡Nueva reserva! (5459534227, jueves, 20 de agosto de 2026)
Cuerpo:  Acabas de recibir una nueva reserva de un cliente de Booking.com.
         Booking confirmation — 5459534227
         [enlace al extranet]
```

No dice **qué habitación es**. Tampoco el nombre, ni el precio, ni cuántas
personas, ni desde cuándo hasta cuándo. Con eso no se puede armar una reserva:
lo único aprovechable es el número.

**Por qué el calendario sí.** Booking publica un `.ics` por habitación
(*Rates & Availability → Sync calendars → Export calendar*). Al pegar cada
dirección en la fila del alojamiento que le corresponde acá, queda dicho de una
vez y para siempre qué pieza de Booking es cuál de las nuestras — que es
exactamente lo que al correo le falta. Las fechas vienen exactas, y según cómo
esté la cuenta, a veces también el nombre del huésped y el número de reserva.

En *Configuración → Booking → 2* está la lista, una fila por alojamiento. Se
pega la dirección, se enciende el interruptor y cada quince minutos un
disparador revisa si Booking vendió algo nuevo. El botón **Revisar ahora**
hace la misma pasada en el momento.

Se puede poner cada 1, 5, 10, 15 o 30 minutos — son los únicos que acepta
Google. Viene en **5**, y conviene dejarlo ahí: Google le da a cada cuenta un
rato limitado de tareas automáticas al día (hora y media en las gratis), y
mirar cada minuto son 1.440 pasadas diarias con una llamada por habitación
conectada. Cuando esa cuota se acaba el disparador deja de correr entero, así
que bajarlo a 1 puede terminar en no revisar nada. La diferencia real son
cuatro minutos.

Cómo entra una reserva de Booking:

- **Confirmada**, con canal *booking*, con sus noches armadas y el grupo de
  Telegram enterado al tiro.
- Con el **UID del evento** guardado. Eso es lo que hace que mañana, al volver
  a leer el mismo archivo, se sepa qué es nuevo, qué se movió de fecha y qué
  desapareció, **sin duplicar nada**.
- Con el **número de reserva de Booking** cuando viene en el archivo — el mismo
  que llega por correo, para poder cruzarlos.
- Si Booking **la mueve de día**, se mueve acá y se rehace el plan de noches.
  Si **la cancela**, queda cancelada acá (cancelada, no borrada). Si **la
  revive**, vuelve a confirmarse sin crear una segunda.
- Si **tú la cambias de pieza** acá —"te paso a la otra matrimonial"— esa
  decisión manda: la app la sigue por su identificador y no por la habitación,
  así que no aparece una copia en la pieza original. Para eso está la columna
  `feedExterno`, que recuerda de qué calendario vino aunque la reserva se mude.

### Las tres cosas que se parecen y no son la misma

Cuando un evento del calendario cae encima de una reserva que ya existe acá,
hay tres historias posibles y confundirlas cuesta caro. La app las separa así:

- **La que ya cargaste a mano.** Es lo normal: cae el correo de Booking, el
  recepcionista abre el extranet y la carga, el huésped firma su ficha. Días
  después se conecta el calendario. Si el choque es con **una sola** reserva de
  esa misma pieza, sin identificador todavía y con canal *booking*, **se
  reconoce**: se le escribe el identificador del evento y quedan siendo la
  misma. No se duplica al huésped, la ficha firmada y la cuenta siguen
  intactas, y de ahí en adelante si Booking la mueve o la cancela, esta la
  sigue. Si el que la cargó le puso otra fecha de salida —el correo trae una
  sola fecha, es fácil equivocarse— manda la del calendario y el plan de noches
  se rehace.
- **El eco.** Acá hay una reserva directa de WhatsApp, la app le cierra ese día
  a Booking, y Booking nos devuelve el día cerrado como si fuera un evento. Se
  reconoce porque las fechas calzan **exactas** con una reserva que no es de
  Booking, y se ignora en silencio. No se adopta a propósito: atar una reserva
  de WhatsApp a un calendario ajeno significaría que el día que ese bloqueo
  desapareciera, la app cancelaría sola a un huésped de verdad.
- **La sobreventa de verdad.** Cualquier otra cosa: fechas que se pisan pero no
  calzan, o dos reservas distintas de por medio. Ahí no se toca nada y se avisa
  al grupo — **una sola vez**. Sin eso, con el disparador prendido, el mismo
  choque llenaba Telegram de mensajes cada pocos minutos hasta que el huésped
  se iba.

Lo que hay que saber:

- **El precio no viene.** Ningún iCal lo lleva. La reserva entra con la tarifa
  de la casa puesta y con una nota que lo dice: hay que revisarla, porque lo
  que Booking deposita es esa cifra menos su comisión. Las personas quedan en 1
  por lo mismo.
- **Nunca se pisa una reserva que ya existe.** Si Booking vende algo que acá ya
  estaba tomado, no entra: se cuenta como choque y avisa por Telegram para
  resolverlo a mano en el extranet.
- **Un calendario vacío cancela, pero recién a la segunda.** Un archivo sin
  eventos es ambiguo: puede ser que se cancelaron todas —lo más común, porque
  una pieza sola pasa medio año sin nada vendido— o Booking sirviendo mal el
  archivo por un rato. Se pide que venga vacío **dos revisiones seguidas**: un
  tropiezo pasajero no alcanza, una cancelación de verdad sí. En la primera la
  pantalla avisa qué va a pasar, y apretar *Revisar ahora* otra vez lo hace en
  el momento.
- **Si Booking no contesta** —error 500, la red caída, una dirección que
  devuelve cualquier cosa— no se crea ni se cancela nada. Se anota el problema
  y se reintenta en la pasada siguiente.
- **No es instantáneo.** Entre que Booking vende y esto lo ve pasan hasta
  quince minutos.

### 3. El número de reserva, desde el correo

Ni el calendario ni el correo traen **el nombre del huésped**. Booking eso no
lo publica en ninguna parte: solo vive dentro del extranet. Lo que el correo sí
trae, en el asunto, son las dos cosas que permiten cruzarlo con el calendario:

```
Booking.com - ¡Nueva reserva! (6276704596, viernes, 21 de agosto de 2026)
                                ↑ el número        ↑ el día de llegada
```

Con esa fecha se busca la reserva que entró por el calendario y todavía no
tiene número. Si hay exactamente una, es esa, y le queda escrito el número. Con
el número, la reserva muestra un **enlace de un toque** que abre esa reserva
exacta en el extranet — el único lugar donde el nombre existe. El identificador
del establecimiento que ese enlace necesita se aprende solo del primer correo,
no hay que configurarlo. El enlace lo arma **el servidor** y viaja armado a la
pantalla: ese identificador solo vive del lado del servidor, y construyéndolo
en el navegador salía sin esa parte y Booking abría una página vacía.

Se enciende en *Configuración → Booking → 3*, y va pegado a la misma pasada del
calendario: un solo disparador hace las dos cosas.

Hace tres cosas más que el calendario no puede:

- **Cancela al instante.** El correo de cancelación trae el número, así que no
  hay ninguna ambigüedad que resolver: se cancela sin esperar las dos
  revisiones vacías del calendario.
- **Avisa de las reservas que no están acá.** Si llega un correo de una reserva
  que no aparece —porque a esa habitación se le olvidó pegar su calendario— el
  grupo se entera. Es la única red que cubre las piezas sin conectar. Espera
  media hora antes de avisar: el calendario de Booking tarda unos minutos en
  incluir una reserva recién caída, y hasta entonces el correo se deja sin
  marcar y se reintenta.
- **No adivina.** Si llegan dos reservas de Booking el mismo día, no se le pega
  el número a ninguna: se avisa y lo mira una persona.

**Hay que conceder el permiso a mano, una vez.** Declararlo en el manifiesto
no lo concede: solo dice cuál se va a pedir. Quien lo concede es una persona
apretando *Permitir*, y esa pantalla **solo aparece corriendo algo desde el
editor** — la app web nunca la muestra: si le falta un permiso, falla y ya.
Para eso está la función `autorizarCorreo()`: se elige en el editor de Apps
Script, se aprieta Ejecutar, se acepta, y de paso dice cuántos correos de
Booking ve. Después conviene desplegar una versión nueva y apagar y encender
la revisión automática, para que el disparador se cree con el permiso puesto.

**El permiso es de solo lectura.** Está declarado en `appsscript.json` como
`gmail.readonly`, así que aunque el código quisiera, no puede mandar, borrar ni
mover un correo. Ese archivo declara ahora todos los permisos de forma
explícita; sin esa lista, usar `GmailApp` habría pedido acceso **completo** al
buzón. Si alguna vez algo deja de funcionar después de tocar esa lista, borrar
el bloque `oauthScopes` y volver a autorizar deja el proyecto como estaba.

Y si el correo falla —sin permiso, sin red, cuota agotada— el calendario sigue
andando igual: la lectura del correo va envuelta y su error se anota, no se
propaga.

## El parte de la mañana

Un mensaje al grupo de Telegram temprano con lo del día. Se enciende en
*Configuración → El parte de la mañana*, con la hora a elección.

```
☀️ miércoles 19 de agosto

🔑 Llegan 1
• Familia Rojas — Habitación 1 · Matrimonial
   2 noches  ·  quedan $120.000 por cobrar
   ⚠️ ficha sin firmar

🚪 Se van 2
• Pareja Torres — Habitación 2 · Twin
• Juan Moroso — Habitación 3 · Matrimonial + cama adicional
   ⚠️ quedan $100.000 por cobrar
🧹 Después habrá que limpiar: Habitación 2, Habitación 3

🏠 Se quedan 1  ·  Habitación 4 · Matrimonial
```

Las decisiones que lo hacen útil:

- **Llegadas y salidas con detalle, los que se quedan en una línea.** Lo
  primero es lo que hay que hacer hoy; lo segundo se sabe y basta. Una lista
  larga hace que nadie lea el mensaje entero.
- **Las marcas de atención son lo que justifica el mensaje.** Una ficha sin
  firmar de quien llega hoy —todavía hay tiempo de mandarle el enlace— y sobre
  todo un **saldo pendiente de quien se va hoy**. Enterarse de eso a las ocho
  de la mañana es a tiempo; enterarse cuando el auto ya salió, no. Van solo
  cuando corresponde: una marca que aparece siempre deja de significar algo.
- **Al extranjero se le habla en dólares**, igual que en pantalla y en su
  cuenta.
- **Si no hay nadie alojado ni llega o se va nadie, no se manda nada.** Un
  grupo que recibe "sin novedades" todos los días termina silenciando al bot, y
  ahí se pierden también los avisos que sí importan. Con gente alojada sí sale,
  aunque no haya movimiento.
- **La hora es aproximada.** Google corre las tareas programadas dentro de la
  hora pedida, así que "a las 8" son entre las 8:00 y las 9:00.

El botón *Ver cómo queda* manda el parte de hoy en el momento y lo muestra en
pantalla, sin esperar a mañana.

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
   firmar la ficha, quién se fue con saldo, qué habitaciones quedaron sucias y
   **quién está marcado exento de IVA pero pagó en pesos** — el único de la
   lista que cuesta plata si se descubre tarde.

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

La pestaña creció hasta no caber en una pantalla —Booking solo se llevó media—
así que **cada tarjeta se pliega**. Cerradas queda un índice de una línea por
tema, con una pista al lado que dice qué hay adentro sin abrirlo: *"fijo en
$950"*, *"3 programas"*, *"conectado"*. Se abre apretando el título, y lo que
queda abierto se recuerda en el navegador: quien está peleando con lo de
Booking la abre diez veces seguidas, y volver a buscarla cada vez sería peor
que no haber plegado nada.

No hay nada que hacer al agregar una tarjeta nueva: el plegado toma lo que haya
después del `<h2>` y lo mete en una caja, así que una tarjeta escrita como
siempre queda plegable sola.


Pestaña **Configuración** (solo administración). Arriba de todo está el
**valor del dólar**, porque es lo que más se toca y lo deciden ustedes: se
escribe, se aprieta *Guardar el valor* y listo. Tiene su propio botón a
propósito, para que guardarlo no arrastre las normas.

Debajo va el **cuadro de texto con las normas de convivencia**: es lo que el
huésped lee y acepta al firmar su ficha, y lo que sale en el comprobante. Se
escribe tal como se va a leer, **una norma por línea**, y se edita a mano.

Viene lleno con las normas que rigen hoy, así que se corrige encima en vez de
escribirlo de cero. Hay un botón para volver al texto original, y abajo una
vista previa de cómo lo verá el huésped. El cuadro de al lado es el mismo texto
en inglés.

Ojo con una cosa: **el texto manda**. Si cambias el horario de check-in, hay que
cambiarlo también en el texto de las normas; no se actualiza solo.

También está ahí el **enlace directo a la planilla de datos**, para no andar
buscándola en Drive. Todo lo que ves en la app vive ahí: reservas, cuentas,
noches, fichas y configuración, cada cosa en su hoja. Sirve para mirar los datos
en crudo, sacar una copia de respaldo o corregir algo puntual a mano. La
dirección se le pregunta al servidor en el momento, así que siempre apunta a la
planilla que el sistema está usando de verdad.

> Si editas a mano: la app busca cada dato **por el nombre de su columna**.
> Agregar columnas nuevas no molesta; renombrar o borrar las que ya están, sí.

Y el **bot de Telegram**, con su propia tarjeta y los cuatro pasos para
conectarlo.

Detrás de *Ajustes que casi nunca se tocan* quedan los datos que el sistema usa
por dentro y que casi nunca hay que mover: el correo al que llega el cierre de
cada noche, las horas de check-in y check-out (aparecen en la pantalla de aseo y
en el comprobante), las fechas de temporada alta y el IVA.

Ahí mismo está también **Probar la generación de documentos**, que dice en qué
paso falla un PDF: el permiso de Drive, la conversión, el logo o el correo. Casi
nunca se usa, pero el día que Drive se cae es lo único que responde *por qué*.

## Documentos en PDF

El sistema arma dos documentos con el logo: el **comprobante** de una reserva
y el **cierre** de una noche. Los dos se generan y **se bajan**, como cualquier
archivo. No pasan por Drive.

Lo que sí queda archivado en Drive es lo que es archivo de verdad y nadie está
esperando: el cierre que sale por correo cada noche, las fichas firmadas y las
fotos de pasaporte que suben los huéspedes. Eso va **ordenado por fecha**, para
que la carpeta no se convierta en un basurero de archivos sueltos:

```
Casona Peumayén — Documentos/
  2026/
    08 agosto/
      Cierres/                    cierre-2026-08-14.pdf
      Documentos de huéspedes/    pasaporte-Perez-....jpg
    09 septiembre/
      Cierres/
Casona Peumayén — Fichas/
  2026/
    08 agosto/                    ficha-Perez-....pdf
```

El año y el mes salen de **la fecha del documento, no del día en que se
generó**: la foto del pasaporte de una reserva que llega en diciembre queda
archivada en diciembre, aunque la haya subido hoy; el cierre queda en el mes de
la noche que cerró. Las carpetas se crean solas la primera vez y se reutilizan
después.

**Comprobante de la reserva.** Botón *Comprobante* dentro de la reserva:
**se genera el PDF y se baja**, como cualquier archivo. Nada más. Trae el
alojamiento, las fechas con sus horarios, las noches con su valor, quiénes se
alojan, lo abonado, el saldo que queda para el día de llegada y las
condiciones de la estadía. Desde ahí se adjunta a un WhatsApp o a un correo.

**No pasa por Drive.** Antes se guardaba allá y se abría su visor: había una
pestaña en blanco mientras Drive creaba y compartía el archivo, y el
documento terminaba viviendo en una carpeta que nadie pidió. Ahora el PDF se
arma y se entrega al navegador directamente.

**Cierre de la noche.** En la pestaña *Cierre*, *Generar PDF* arma el resumen
de esa noche y lo baja, igual que el comprobante. *Enviar al dueño* se lo manda
al correo configurado con el PDF adjunto — esa sí es otra acción, no otra forma
de hacer lo mismo. Si además dejaste el cierre automático de madrugada, **el
correo sale solo cada noche** apenas se cierra el día.

**Qué sigue guardándose en Drive.** Solo lo que es archivo de verdad y nadie
está esperando delante de la pantalla: el cierre que sale por correo cada
noche, las fichas firmadas y las fotos de pasaporte que suben los huéspedes.
Eso sí queda ordenado por año y mes. Lo que se pide desde la pantalla no deja
copias sueltas.

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

Hoy **todas se venden como habitación completa**. Por eso la pestaña
*Alojamiento* **no muestra ninguna cama**: aparecen solo cuando esa pieza está
en modo por cama. Antes se listaban igual, archivadas y en gris, y no eran más
que ruido debajo de cada habitación.

Cambiarlo es un botón: **Vender por cama** en la habitación que quieras. Sus
camas se reactivan solas —siguen guardadas con sus precios, nunca se borraron—
y pasan a ser filas del calendario. **Vender entera** las vuelve a archivar.
Para el detalle fino (los dos modos a la vez) está *Editar*. Para vender una
pieza completa hay que ponerle precio: el sistema no deja guardarla sin él.

Cada precio se muestra además **en dólares**, al cambio del día.

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

## Saltar a un mes lejano

El rango de fechas del calendario **es un botón**. Apretarlo abre los doce
meses del año, con las flechas de año al lado y, abajo, *Hoy* y un campo para
una fecha exacta. Antes era un rótulo, y llegar a enero significaba apretar la
flecha semana por semana.

Cada mes muestra **cuántas reservas tiene**. Esa es la mitad de la gracia: sin
el número el selector solo sirve si ya sabes adónde vas; con él se abre y se ve
de una que enero tiene tres y febrero ninguna, que es la pregunta de verdad
cuando alguien pide fecha para el verano. Los meses vacíos quedan en gris, pero
se puede entrar igual — ahí es justamente donde hay que vender.

Detalles que importan:

- Al mes elegido se entra por el **día 1**, salvo que sea el mes en curso: ahí
  lo que se quiere ver es hoy, no el principio de un mes que ya pasó.
- El rango escribe el **año** solo cuando no es el actual. Mirando el verano que
  viene, *"18 ene – 31 ene"* a secas deja la duda de qué enero es.
- Las cuentas se piden **una vez por año** y quedan guardadas: abrir y cerrar el
  selector no puede costar un viaje al servidor cada vez. Si fallan, el selector
  sirve igual, solo que sin los números.
- Una reserva **a caballo entre dos meses cuenta en los dos**, y la última noche
  es la anterior al check-out: quien sale el 1 de junio no ocupa junio.

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

- **Una reserva ocupa un recurso.** Hoy todas las habitaciones y las carpas se
  reservan completas, así que cada una es una fila del calendario. Si una pieza
  se pone a venderse por cama, cada cama pasa a ser su propia fila. Si un grupo
  toma dos habitaciones, se cargan dos reservas.
- **El día de check-out queda libre** para quien llega ese mismo día, como en
  cualquier hotel.
- **No se pueden pisar dos reservas.** Se valida en el navegador y otra vez en
  el servidor, con un bloqueo que evita que dos personas guarden a la vez.
- **Las fechas se guardan como texto** `AAAA-MM-DD` para que Sheets no las
  convierta a fecha con hora y zona horaria (eso rompía la detección de choques
  en la versión anterior).
- **Las columnas nuevas siempre se agregan al final.** Si se insertan en medio,
  las filas ya guardadas quedan corridas y sus fechas se vuelven ilegibles. Por
  eso `setup()` se puede ejecutar sobre una planilla vieja sin miedo.
- **El código QR se genera dentro de la propia página**, sin pedirle nada a
  ningún servicio de afuera — la misma razón por la que el logo viaja
  incrustado. Hay una prueba que lo codifica y lo vuelve a decodificar, para
  que no se publique nunca un código que un teléfono no pueda leer.

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
  neto y su IVA, marca lo exento y avisa cuando la exención no se sostiene,
  pero el documento se emite fuera.
- **No cobra en dólares por sí solo.** Registra que el pago entró en dólares y
  lo convierte, pero recibir la plata sigue siendo cosa tuya: efectivo,
  transferencia o el terminal de tarjeta.
- **De Booking no trae el precio ni el nombre del huésped.** La reserva entra
  sola y bloquea la pieza, pero el calendario de Booking no lleva plata: queda
  a la tarifa de la casa y hay que revisarla. El nombre viene solo si la cuenta
  de Booking lo publica. Una conexión completa exige la API de dos vías, que
  Booking abre únicamente a socios de conectividad certificados — eso pasaría
  por un channel manager pagado.
- **De Airbnb no importa nada todavía.** Airbnb publica el mismo tipo de
  calendario, así que es el mismo camino ya escrito; falta pegarlo.
- **Las tarifas base son por temporada, no por fecha.** Cada noche de una
  reserva sí se puede editar a mano, pero todavía no hay un calendario de
  precios por día, ni estadía mínima, ni "cerrado a la llegada".
- No hay perfil de huésped con historial de estadías anteriores.
- La política de cancelación está escrita en el reglamento pero no se calcula
  sola.
- No cobra en línea: no genera enlaces de pago.
- **El comprobante no se manda solo.** El botón genera el PDF y lo abre;
  mandarlo por WhatsApp o correo lo haces tú desde ahí. Era a propósito: los
  cuatro caminos que había antes terminaban igual, abriendo el PDF.
- La app interna está solo en español; la página del huésped sí es bilingüe.


## El plano de la planta

`Plano.html` es un editor de planos de planta hecho para la visita de la
SEREMI: se dibuja la cocina y los servicios arrastrando piezas, y sale una
lámina lista para imprimir o mandar por correo.

Se abre de dos maneras, la que sea más cómoda:

- **Sin instalar nada**: se guarda `Plano.html` en el computador y se abre con
  doble clic. Funciona sin internet.
- **Dentro de la app**: pegado como archivo HTML en el proyecto, queda en la
  URL de la aplicación agregándole `?plano=1` al final.

Cómo se usa:

- **Panel izquierdo**: las piezas. Un clic las agrega al centro de la vista —
  recintos, lavamanos, lavaplatos, cocina, horno, campana, freezer, cámara de
  frío, WC, duchas, casilleros, puertas y ventanas, con medidas reales de
  partida en centímetros.
- **En el plano**: se arrastra para mover, se tira de las esquinas para cambiar
  el tamaño, la rueda del ratón acerca y aleja y arrastrando el fondo se
  desplaza la vista. Las flechas del teclado mueven de a 5 cm (con Shift, de a
  50 cm) y Suprimir borra. Ctrl+Z deshace.
- **Panel derecho**: el nombre, las medidas exactas y la zona de lo que esté
  seleccionado; el listado de zonas; y las observaciones de la SEREMI, que
  quedan numeradas sobre el plano y se arrastran hasta el punto que
  corresponde.
- **Zonas**: cada elemento pertenece a una. La ✕ de una zona borra de una vez
  todo lo que hay dentro — así se saca del plano el sector de casa habitación
  que la SEREMI pidió eliminar. Y el ojo la esconde sin borrarla, para ver cómo
  queda antes de decidir.
- **Superficies**: cada recinto muestra sus metros cuadrados y sus medidas al
  pie del nombre, y el total va abajo a la derecha.

El trabajo se guarda solo en el mismo navegador. Para tener respaldo, o para
seguir en otro computador, **Guardar copia** entrega el plano como un texto que
se pega en un correo, y **Abrir copia** lo devuelve.

Para entregarlo: **Imprimir / PDF** (eligiendo "Guardar como PDF" en el
diálogo) o **Imagen**, que arma un PNG que se guarda con el botón derecho.
Los dos salen en papel blanco con tinta negra, aunque en pantalla se esté
trabajando en modo oscuro.

El plano que aparece al abrir es el dibujo a mano pasado en limpio: sirve de
punto de partida, no es un levantamiento medido. Las medidas se corrigen una
por una en el panel de la derecha, con el metro en la mano.
