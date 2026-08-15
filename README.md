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
- **El programa tinaja + sushi se anota como dos líneas**, una a cada centro.
  El porcentaje que va al restaurante se ajusta en la hoja `Config`, en
  `addonParteRestaurante` (viene en 50).
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

### Pasaporte y tarjeta PDI

Los dos papeles que acreditan la exención se piden en el mostrador con el
huésped esperando. Hay **dos caminos, y son de dos personas distintas**:

**1. El huésped, desde su celular, antes de llegar.** En el enlace de su ficha
—el que se le manda por WhatsApp— hay dos botones grandes de *Cargar aquí*, uno
para el pasaporte y otro para la tarjeta PDI. En un teléfono abren la cámara
directamente. **Es opcional a propósito**, y la propia página se lo dice: si no
lo hace, se le piden igual al llegar. Funciona **aunque la ficha ya esté
firmada** —que es el caso normal, porque el pasaporte se pide después de
firmar— y **para cualquier huésped**, no solo los marcados como extranjeros.

**2. Recepción, con el huésped enfrente.** Es para cuando no subió nada, o
llegó sin reserva. En la reserva: *Más ▾ → Pasaporte y tarjeta PDI*. Ahí hay un
**código QR** que **es una herramienta de recepción, no del huésped**: el
recepcionista lo escanea **con su propio teléfono** y se le abre una pantalla
que **no hace nada más que sacar las dos fotos** y guardarlas en esa reserva.
No muestra la ficha, ni el reglamento, ni la firma, ni datos personales — solo
de quién son los documentos, para no guardárselos a la reserva equivocada. Al
huésped no se le muestra este código en ningún momento.

Es la manera de registrar los documentos **sin escáner**, que es lo que hay en
el mostrador. Si el archivo ya está en el computador, en esa misma pantalla se
puede arrastrar o elegir, sin pasar por el teléfono.

**Que el QR se lea de verdad.** Es lo que más costó:

- El enlace de recepción es **corto y propio**: un código de 10 letras en vez
  del token de 32 de la ficha. Son 22 letras menos dentro del código, y eso se
  traduce directamente en cuadraditos más grandes.
- **Cada cuadradito mide 6 píxeles exactos.** Antes medía 3,88 y, al pedir
  bordes nítidos, unos salían de 3px y otros de 4px: el patrón se deformaba lo
  justo para que muchas cámaras no lo leyeran, aunque a la vista se viera
  perfecto.
- Hay un botón **Ampliar para escanear** que lo pone a pantalla completa, con
  cuadraditos del doble de grandes y nada alrededor que le quite contraste. Es
  la salida cuando el teléfono no coopera —pantalla con brillo, poca luz—.
- Y debajo va el **enlace escrito con un botón para copiarlo**, por si aun así
  no hay caso.

Todo esto está probado dibujando el código en un navegador de verdad, sacándole
una foto y volviendo a leerlo **desde los píxeles**, sin mirar el original: si
esa prueba pasa, un teléfono lo escanea.

**Y la reserva avisa si están o no.** Arriba del todo, apenas se abre: verde si
el pasaporte y la tarjeta PDI ya están escaneados, ámbar si falta alguno —
diciendo cuál—. A un huésped chileno no se le exige ninguno, así que su reserva
no muestra la advertencia. La franja se aprieta y lleva derecho a subirlos.

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
🛁 Con programa tinaja + tabla de sushi
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

Detrás de *Ajustes que casi nunca se tocan* quedan los datos que el sistema usa
por dentro y que casi nunca hay que mover: el correo al que llega el cierre de
cada noche, las horas de check-in y check-out (aparecen en la pantalla de aseo y
en el comprobante), las fechas de temporada alta, el precio del programa tinaja
+ sushi, el porcentaje que va al restaurante y el IVA.

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
- **El comprobante no se manda solo.** El botón genera el PDF y lo abre;
  mandarlo por WhatsApp o correo lo haces tú desde ahí. Era a propósito: los
  cuatro caminos que había antes terminaban igual, abriendo el PDF.
- La app interna está solo en español; la página del huésped sí es bilingüe.
