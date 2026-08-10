# Hasta dónde llegaré

Árbol genealógico familiar y colaborativo. Cada persona tiene fotos, nombres,
apellidos, fechas, lugar de nacimiento y contacto opcional; los vínculos se
navegan hacia arriba, hacia abajo y a los costados, y la ficha nombra cada
parentesco ("tía abuela", "primo segundo") en vez de pedir que se cargue.

**Hoy el sitio está abierto**: se entra con el link, se pregunta el nombre una
vez y se puede cargar y corregir sin contraseña. Eliminar está bloqueado para
todos. El acceso por *magic link* al correo de cada ficha está programado y
listo, y se enciende solo cuando estén puestas sus variables (ver
[`docs/05`](docs/05-acceso-y-permisos.md)).

> **Documentación completa en [`docs/`](docs/).** Y en el tablero del servidor,
> con estado en vivo: https://192.168.1.71/arbol

- **Producción (el árbol que vale):** https://hastadondellegare.vercel.app/
- **Repositorio:** https://github.com/arielbaudry/hastadondellegare
- **Espejo local de sólo lectura** en la LAN del servidor, puerto 8096. Se
  sincroniza solo cada 10 minutos y guarda un respaldo por día. **No se edita
  ahí**: la familia carga en producción, y editar en los dos lados haría
  divergir los árboles en silencio.

> **Este repositorio es público.** Nada de lo que se versiona lleva datos de la
> familia: `storage/` está en `.gitignore` y todas las credenciales y datos de
> contacto viven en variables de entorno, vacías en `.env.example`.

---

## Cómo se usa

1. **Cargate a vos primero.** Después, desde tu ficha, «+ Padre / madre».
2. El modal de edición tiene **una sección por tipo de vínculo** —ascendentes,
   hijos, hermanos, pareja— y las cuatro funcionan igual: se **elige de la
   lista** a alguien ya cargado, o se **crea** la ficha nueva ahí mismo, con el
   vínculo hecho de los dos lados. Los botones «Crear…» guardan primero lo que
   estabas editando.

   La ficha del costado es sólo para mirar: datos, contacto y linaje.
3. **El árbol se ve siempre completo.** Un clic en una caja abre esa ficha al
   costado; un doble clic la abre para editar. Para moverse hay cuatro caminos,
   y todos llevan al mismo lado:
   - el **buscador** del encabezado (`Ctrl`/`⌘ + K`, flechas y Enter);
   - los **saltos rápidos** de la barra de contexto (`↑` padres, `↓` hijos);
   - los **chips de relaciones** de la ficha;
   - **← Atrás**, que deshace el recorrido cuando te metiste por una rama.
4. La pestaña **Revisión** junta lo que no cierra: fechas que no pueden ser,
   vínculos cargados de un lado solo, personas sueltas, fichas repetidas.
   **Que falte un padre o una madre no se avisa** — puede que no se sepa, o que
   no se quiera cargar, y eso lo decide cada uno desde su ficha.
5. La pestaña **Personas** muestra todas las fichas: **tocar una la abre para
   editar**, y el botón del costado lleva al árbol parado en esa persona.
   También tiene buscador, filtros y el panel **«Hasta acá llegamos»**: las
   personas fallecidas de las que todavía no hay padres cargados. Ésa es la
   lista de lo que falta averiguar — el nombre del proyecto.
   Al pie están las dos descargas para llevarse la familia al teléfono: la
   agenda de **contactos** (`.vcf`) y los **cumpleaños** (`.ics`), con
   repetición anual y aviso esa misma mañana. Se tilda a quién te llevás y la
   lista arranca en la familia cercana.
6. **Ajustes** tiene **Deshacer el último cambio**, respaldos (JSON/CSV), tema,
   el registro de quién hizo qué y el desbloqueo de administración.

### Parentescos

La ficha no lista «padres, abuelos, tíos»: calcula **cómo se llama cada vínculo**
y muestra el linaje entero, de lo cercano a lo lejano — «tía abuela», «primo
segundo», «bisnieta», «cuñado», «madrastra». El método es el clásico de
genealogía (`src/lib/parentesco.ts`): se busca el antepasado común más cercano y
se miran las dos distancias hasta él.

Para decir «tía abuela» y no «tío/a abuelo/a» hace falta saber el género, así
que hay un campo opcional. Sin dato se muestra la forma neutra: nadie está
obligado a completarlo.

### Fotos

Cada persona tiene **una galería, no una foto**: se suman y ninguna pisa a la
anterior, así cada pariente sube la que tiene. La primera de la lista es la que
se usa de retrato en el árbol y en las tarjetas, y se cambia con ★. La ficha las
muestra todas con miniaturas para pasarlas.

Se achican en el navegador a 1400 px antes de subirlas, así el servidor no
procesa imágenes y la carga anda con datos móviles.

### Hermanos sin padres cargados

Ser hermanos quiere decir compartir padre o madre, así que para vincular a dos
personas hace falta al menos uno. Si no hay ninguno, «+ Hermano / hermana»
**crea la ficha del padre o madre igual**, sin nombre («Padre o madre
<apellido>»), y avisa que lo hace. Queda como una punta abierta más del árbol,
que es exactamente lo que es — y permite mandarle el link a un pariente para que
arranque a cargar desde su propia ficha sin saber nada de generaciones
anteriores.

### Fechas incompletas

De los bisabuelos rara vez se sabe el día exacto. Los campos de fecha aceptan
`1948`, `1948-03` o `1948-03-27`, y ordenan bien igual. Se pueden escribir, o
elegir con el **botón de calendario** que hay al lado, que abre el almanaque del
sistema y escribe la fecha completa en el campo de texto.

El calendario no reemplaza al texto: lo completa. Un `<input type="date">` solo
obligaría a una fecha exacta y haría imposible cargar la mitad de un árbol
genealógico.

### Vive / falleció

La fecha de fallecimiento **sólo se pregunta si la persona figura como
fallecida**. Al marcar a alguien como vivo se limpia el campo, para que no quede
escondido un dato contradictorio (el servidor lo rechazaría igual).

---

## Modelo de datos

La regla que sostiene todo: **sólo se guardan dos vínculos**, `padres` y
`parejas`. Hijos, nietos, hermanos, abuelos, tíos, primos y sobrinos se
*derivan* en `src/lib/tree.ts`. Nunca puede quedar una relación a medias del
tipo «A dice ser hijo de B pero B no lista a A».

```ts
Persona {
  id, nombres, apellidos, apodo?, apellidoNacimiento?, fotoUrl?,
  fechaNacimiento?, lugarNacimiento?, vivo, fechaFallecimiento?,
  celular?, email?, direccion?, notas?,
  fotos: string[],                                    // varias; la 1ª es el retrato
  padres: string[],                                   // ids, máximo 2
  parejas: { personaId, tipo, desde?, hasta? }[],     // recíprocas
  creadoPor?, actualizadoPor?, creadoEn, actualizadoEn
}
```

Todo el árbol es **un solo documento JSON** (`{ rev, esEjemplo, personas[] }`).
Para una familia de cientos de personas pesa unos pocos cientos de kB: no hace
falta base de datos relacional, y se manda entero al navegador de una.

### Nadie muta los datos al leerlos

Las funciones de `tree.ts` devuelven **el array guardado**, no una copia:
`ix.get(id).padres` es el array real de esa persona. Quien lo recorra tiene que
copiarlo antes de tocarlo.

> Esto no es teórico: `rolesRespectoA()` usaba ese array como pila de recorrido
> y lo vaciaba con `pop()`. Con sólo **seleccionar** a alguien se le borraban los
> padres en memoria, y al guardar la ficha el vacío se escribía en el servidor.
> Se veía como «cada vez que edito una ficha se desvinculan las relaciones».

Por el mismo motivo `FormularioPersona` copia `padres` y `parejas` al abrirse:
un spread superficial deja los mismos arrays que el estado de la app.

`src/lib/validar.ts` corre en **cada** escritura y deja el árbol coherente:

- borra vínculos a personas que ya no existen y auto-referencias;
- hace recíprocas las parejas;
- **corta ciclos de filiación** — nadie puede terminar siendo ancestro de sí
  mismo por un vínculo mal cargado.

---

## Arquitectura

```
src/
  app/
    page.tsx, layout.tsx, globals.css, icon.svg
    api/arbol/          GET     el árbol entero (siembra el ejemplo si está vacío)
    api/personas/       POST    alta
    api/personas/[id]/  PATCH   edición    DELETE  baja (limpia referencias)
    api/fotos/          POST    subida     GET /api/fotos/<archivo>  (sólo local)
    api/importar/       POST    restaurar un respaldo
    api/deshacer/       POST    volver a la versión anterior
    api/sembrar/        POST    { accion: "ejemplo" | "vaciar" }
  lib/
    types.ts     el modelo
    tree.ts      relaciones derivadas, métricas y el layout del diagrama
    store.ts     persistencia (driver fs | redis)
    fotos.ts     imágenes (driver fs | Vercel Blob)
    validar.ts   saneado de entrada y coherencia del árbol
    revision.ts  detección de inconsistencias del árbol (pestaña Revisión)
    ejemplo.ts   la familia de ejemplo (personas inventadas)
    cliente.ts   fetch + preferencias en localStorage
  components/    App, ArbolVista, BuscadorPersonas, FichaPersona,
                 FormularioPersona, ListaPersonas, Revision, Ajustes, Aviso,
                 CampoFecha, FotoInput, Retrato
```

### El dibujo del árbol

`diagramar()` en `tree.ts` dibuja **el árbol completo, siempre**: todas las
personas cargadas, en todo momento. El foco no filtra nada — sólo marca dónde
está parado uno y se usa para resaltar.

> Antes el diagrama se armaba caminando desde el foco hacia arriba y hacia
> abajo. Eso dejaba invisible cualquier rama lateral —los suegros, los primos,
> una familia todavía no enganchada con el resto— hasta pararse encima de ella,
> y daba la impresión de que el foco «saltaba» a otra persona cuando en realidad
> lo que cambiaba era el recorte.

El armado tiene cuatro pasos:

1. **Unidades.** Las parejas, y quienes comparten un hijo, se agrupan con
   union-find en una sola unidad que se dibuja como un bloque de cajas pegadas.
   Lo segundo importa: Héctor y Lidia nunca estuvieron marcados como pareja
   entre sí, sólo como padres de los mismos hijos.
2. **Niveles.** Cada unidad recibe un número de generación relajando la regla
   «los hijos van al menos un nivel más abajo que sus padres», con un tope de
   iteraciones por si algún dato armara un ciclo. Es lo que mantiene alineada
   una generación entera aunque falten eslabones.
3. **Orden horizontal.** Cada unidad cuelga de **una** unidad madre (la primera,
   si hay dos), lo que deja un bosque; ese bosque se acomoda con el layout
   *tidy* clásico: se mide de abajo hacia arriba y se centra cada bloque sobre
   su descendencia.
4. **Empaquetado.** Los árboles sueltos —familias que todavía no se conectaron—
   se ponen uno al lado del otro.

### Los hijos cuelgan de su pareja, no del bloque

Cada par de padres tiene un **punto de unión**: el medio exacto entre sus dos
cajas, con una barra que los une y un nudo. De ahí —y no de cada padre por
separado ni del centro del bloque— baja una línea a cada hijo.

Es lo que hace legibles las familias ensambladas. Si alguien tuvo hijos con dos
personas distintas, las tres cajas quedan pegadas, y sin puntos de unión parece
que todos los hijos son de los tres. Con ellos se ve de qué pareja viene cada
uno. Dos detalles que lo sostienen:

- **Dentro del bloque, cada quien queda pegado a su pareja.** Los miembros se
  ordenan recorriendo el grafo de parejas como un camino, así el que tuvo dos
  parejas queda en el medio.
- **Los hijos se ordenan por la pareja de la que cuelgan**, para que no se
  mezclen los de una y otra ni se crucen las líneas.

La ficha hace la misma distinción por escrito: separa **hermanos** de **medio
hermanos**, y en cada medio hermano dice por quién lo es.

**Las unidades "puente" van al borde.** Una unidad con padres en dos familias
distintas —alguien que se casó y trajo su propia rama— se manda al extremo del
grupo de hermanos que da hacia la otra familia (`ladoDe()`), para que quede
pegada a ella. Sin eso, un hermano de sangre termina dibujado entre gente de
otro apellido.

Los enlaces salen directo de los datos: como está todo el mundo en pantalla, no
hay nada que filtrar.

**Los roles van aparte del layout** (`rolesRespectoA()`). Es deliberado:
cambiar de foco no puede rearmar el diagrama ni mover la cámara, sólo cambia a
quién se resalta. Por eso `diagramar()` ni siquiera recibe el foco.

### En el celular

Una sola barra arriba —marca, buscador y menú—; las pestañas y el alta viven en
el desplegable. La ficha no es una sección debajo del árbol sino **una hoja que
sube desde abajo**, con manija y cierre, y arranca cerrada: lo primero que se ve
es el árbol. En escritorio nada de esto cambia (el envoltorio del menú es
`display: contents`).

### Cámara e interacción

- **Un clic** en una caja abre esa ficha en el panel y **encuadra su entorno**:
  padres, pareja e hijos, con la persona en el centro. Los hermanos quedan fuera
  del cálculo a propósito: sus ramas los empujan lejos y meterlos obligaría a
  alejar el zoom hasta no leer nada. Si aun así la familia no entra legible, se
  prioriza la legibilidad — zoom cómodo, la persona centrada, el resto a un
  arrastre.
- **Doble clic** abre la ficha para editar. Se detecta a mano y no con
  `onDoubleClick`: entre medio hay arrastre y captura de puntero, y el evento
  nativo se pierde según dónde termine el gesto. Por lo mismo, **la captura del
  puntero se toma recién cuando el gesto se confirma como arrastre** (4 px), no
  en el `pointerdown`; si se toma antes, los clics se despachan al contenedor y
  nunca llegan a la caja.
- `Ver todo` encuadra el árbol entero; `Centrar` lleva la cámara al foco sin
  tocar el zoom.
- Si para que entre el árbol habría que achicarlo por debajo de
  `ESCALA_LEGIBLE` (0.45; 0.55 en pantallas angostas) — pasa siempre en el
  celular — no se achica: se centra y se navega arrastrando.

**El texto de las tarjetas se ajusta a mano.** En SVG no hay `text-overflow`:
`ajustar()` achica la tipografía hasta un piso legible y recién si no alcanza
recorta con puntos suspensivos.

---

## Desarrollo

```bash
npm install
npm run dev      # http://localhost:8096 con recarga en caliente
npm run build && npm run start
npm run reset    # vacía storage/tree.json
```

**Probar contra datos reales sin tocarlos.** `ARBOL_DIR` apunta el
almacenamiento a otra carpeta, así que se puede levantar una segunda instancia
sobre una copia:

```bash
mkdir -p /tmp/prueba/storage && cp storage/tree.json /tmp/prueba/storage/
ARBOL_DIR=/tmp/prueba/storage npx next start -p 8097
```

Vale la pena la molestia: un script de reproducción que escriba sobre el árbol
de verdad borra datos de la familia.

La primera vez que se pide `/api/arbol` con el árbol vacío se siembra la
**familia de ejemplo** (15 personas inventadas, tres generaciones). El cartel
rojo lo avisa y se va solo al cargar la primera persona real; también se vacía
desde Ajustes.

**Arranque automático:** `@reboot cd /home/hpp/hastadondellegare && ./scripts/start_local.sh > storage/portal.log 2>&1`
(puerto 8096 abierto en ufw para `192.168.1.0/24`).

---

## Persistencia

Dos drivers, elegidos solos según las variables de entorno:

| | Árbol | Fotos |
|---|---|---|
| **Local** | `storage/tree.json` (escritura atómica + `tree.bak.json`) | `storage/uploads/`, servidas por `/api/fotos/<archivo>` |
| **Vercel** | Upstash Redis por REST, clave `ARBOL_KEY` | Vercel Blob, servidas por su CDN |

> ⚠️ **El disco de Vercel es efímero.** Si se despliega sin Upstash, el driver
> cae a `fs` y **los datos se pierden en cada deploy**. La pestaña Ajustes lo
> avisa en rojo, y `/api/arbol` devuelve el aviso en `almacenamiento.advertencia`.

Las escrituras se serializan en una cola por proceso. No es un lock
distribuido: como cada edición toca *una sola persona*, dos personas editando
a la vez no se pisan. El riesgo real —dos escrituras en la misma decena de
milisegundos— es aceptable para una familia y está anotado acá a propósito.

Las fotos se **redimensionan en el navegador** a 900 px / JPEG 0.82 antes de
subirse (`FotoInput.tsx`). Una foto de celular pasa de 6 MB a ~120 kB: el
servidor no procesa imágenes y la carga anda con datos móviles.

---

## Deploy en Vercel

**No hay base de datos en este proyecto.** El árbol entero es un archivo JSON.
Lo único que hace falta resolver es *dónde* guardarlo, porque el disco de Vercel
es de sólo lectura y ahí un archivo no se puede escribir.

La opción recomendada es **guardarlo en un repositorio privado de GitHub**, que
ya está a mano y encima resuelve otras dos cosas de arriba:

- **historial de todo**: cada cambio queda como un commit, con qué se modificó y
  cuándo. Para un árbol que editan veinte parientes vale más que cualquier
  respaldo manual — y es lo que usa el botón *Deshacer*;
- **dos personas guardando a la vez no se pisan**: GitHub exige mandar la
  versión que uno leyó y rechaza la escritura si cambió en el medio. Ante un
  choque se relee y se reintenta, en vez de que gane el último.

**1. Un repositorio privado para los datos.** Aparte del código, porque acá van
teléfonos y direcciones. Por ejemplo `arielbaudry/hastadondellegare-datos`,
marcado **Private**.

**2. Un token de acceso.** GitHub → *Settings → Developer settings → Personal
access tokens → Fine-grained tokens → Generate new token*:

- **Repository access**: sólo ese repositorio;
- **Permissions → Repository permissions → Contents: Read and write**;
- copiar el token (empieza con `github_pat_`).

**3. Pegar tres variables en Vercel** (*Settings → Environment Variables*):

| Variable | Valor |
|---|---|
| `GITHUB_REPO` | `arielbaudry/hastadondellegare-datos` |
| `GITHUB_TOKEN` | el token que copiaste |
| `ADMIN_CLAVE` | cualquier cosa larga que inventes |

**4. Redeploy** y verificar en Ajustes → *Dónde se guarda*: tiene que decir
*archivo JSON en GitHub*.

Las fotos van al mismo repositorio, al lado del JSON. No hay nada más que
configurar.

> **¿Y si preferís Upstash?** También funciona: con
> `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN` (una base Redis gratis
> de [upstash.com](https://upstash.com)) el árbol se guarda ahí. Y `BLOB_READ_WRITE_TOKEN`
> manda las fotos a Vercel Blob, si algún día son muchísimas. Los tres caminos
> guardan exactamente el mismo JSON; cambia sólo el estante.

### Pasar el árbol de local a producción

Una sola vez, desde el servidor:

```bash
SITIO=https://hastadondellegare.vercel.app ADMIN_CLAVE=<la que pusiste> npm run publicar
```

Sube las fotos y manda las personas con sus vínculos. No hace falta ningún token
más: las fotos viajan por la propia API del sitio.

`ADMIN_CLAVE` hace falta sólo para esto y mientras el acceso por enlace esté
apagado; una vez encendido, manda el rol de la sesión y esa variable deja de
usarse.

`storage/` está en `.gitignore`: los datos reales de la familia **no** van al
repositorio.

---

## Acceso: magic links

No hay contraseñas. Se pide un enlace al correo, y **sólo lo recibe quien ya
tiene una ficha en el árbol con ese correo cargado**: no hay registro abierto.
Quien todavía no figura, escribe a Ariel — su correo y su teléfono están en la
misma pantalla de acceso.

| Quién | Ve | Suma y corrige | Elimina |
|---|---|---|---|
| Sin sesión | — | — | — |
| Colaborador (cualquiera con ficha y correo) | ✔ | ✔ | — |
| Administrador (`ADMIN_EMAIL`) | ✔ | ✔ | ✔ |

Detalles que importan:

- **Sin sesión no se manda el árbol**, ni para leer. Tiene teléfonos y
  direcciones de la familia; no es material para dejar suelto en internet.
- **La respuesta al pedir el enlace es siempre la misma**, exista o no ese
  correo. Si dijera «ese correo no está», cualquiera podría averiguar quién
  figura en el árbol probando direcciones.
- El enlace vale **media hora**; la sesión, tres meses. Ambos van firmados y sin
  estado (HMAC), así funcionan igual en Vercel, donde no hay disco ni memoria
  compartida entre invocaciones.
- La firma **no alcanza**: al entrar, y en cada carga del árbol, se comprueba
  que el correo siga estando en alguna ficha. A quien saquen del árbol se le
  cae la sesión en el acto.
- **El candado se enciende solo si están `SESION_SECRETO` y el SMTP.** Sin eso
  el sitio queda abierto como estaba. Es a propósito: un deploy a medio
  configurar no puede dejar a la familia —ni a Ariel— afuera.

El correo sale por el **SMTP de DAS Latam** (Ferozo); las credenciales van por
variables de entorno, nunca al repositorio.

## Quién es quién mientras se carga

**El nombre se pregunta una sola vez**, la primera, y queda en ese navegador. No
es un login: sirve para que cada ficha diga quién la cargó y quién la corrigió, y
para la lista de conectados. El campo ofrece los nombres ya cargados, porque
quien entra suele estar en el árbol.

**Un globo en la barra** cuenta cuánta gente está mirando; al tocarlo dice
quiénes. La presencia se lleva **en memoria del servidor** (`presencia.ts`), no
en el árbol: con el JSON guardado en GitHub, anotar cada latido sería un commit
cada veinte segundos por persona. Es información que se vence sola y no merece
historial. Si el sitio corriera en varias instancias a la vez, cada una vería
sólo a los suyos y el número saldría bajo — el error posible es contar de menos,
nunca inventar gente.

### Dos personas guardando a la vez

- **Por ficha**: el navegador manda `actualizadoEn`, la versión que tenía a la
  vista, y el servidor responde 409 si otro tocó esa misma ficha mientras tanto.
  No se pierde lo escrito —el formulario queda abierto—, se adopta la versión
  nueva y el segundo intento entra.
- **Por archivo**: con el árbol en GitHub, la Contents API exige el `sha` de la
  versión leída; ante un choque se relee y se reintenta.
- **Al mirar**: el mismo latido trae la revisión del árbol, así que cuando otro
  guarda algo se recarga solo — salvo que haya un formulario abierto, para no
  pisar lo que se está escribiendo.

## Nadie borra

Mientras el árbol esté abierto **no se puede eliminar nada**, ni siquiera desde
Ajustes. Se puede sumar y se puede corregir: si alguien carga algo mal, se
edita. Lo único sin arreglo es perder lo que cargó otro, y con veinte parientes
escribiendo sin contraseña ese es el riesgo real.

Las tres operaciones destructivas —borrar una persona, importar un respaldo
(reemplaza todo) y sembrar el ejemplo— quedan detrás de `ADMIN_CLAVE`
(`src/lib/permisos.ts`):

- **Sin la variable configurada están bloqueadas para todos**, incluido el
  dueño. Es el default a propósito: un sitio público sin la clave puesta no
  debería poder vaciarse ni por accidente ni a propósito.
- Con la variable puesta, se desbloquean desde **Ajustes → Nada se borra**
  escribiendo la clave. Queda guardada sólo en ese navegador y se manda en la
  cabecera `x-clave-admin`.
- El bloqueo es **del servidor**, no de la interfaz: esconder botones no protege
  nada, la API rechaza con 403.

`Deshacer` queda libre a propósito: es el antídoto de los accidentes, y como se
puede deshacer el deshacer, no destruye nada.

## Seguridad — estado actual y hacia dónde va

**Hoy el sitio es deliberadamente abierto: cualquiera con el link lee y
escribe.** Es una decisión tomada para que la familia cargue sin trámite, no un
descuido, y el cartel de arriba lo dice en la cara. Lo que implica mientras dure:

- No cargar documentos, datos bancarios ni nada sensible.
- Pedir permiso antes de publicar el teléfono o la dirección de otra persona.
- `robots: noindex` en `layout.tsx` para que no lo levanten los buscadores. Eso
  no es protección: el link circula igual.
- Nadie puede borrar (ver [Nadie borra](#nadie-borra)), pero cualquiera puede
  **editar** cualquier ficha. Hay **Deshacer** para el último cambio —uno
  solo—, y conviene igual **bajar un respaldo JSON seguido**.
- No hay límite de escrituras por IP: si el link se filtra, se cierra el modo
  abierto antes de lo previsto.

**El paso siguiente**, cuando esté cargado lo grueso:

1. Cerrar la escritura pública.
2. Mandar *magic links* (enlace de un solo uso al correo cargado) a cada
   familiar. Ajustes ya lista los correos disponibles.
3. Ocultar el bloque de contacto a quien no esté autenticado.
4. Guardar quién editó qué con identidad real — hoy `creadoPor` es sólo el
   nombre que la persona declara en su navegador.

---

## Estado — versión 1.0 (10 de agosto de 2026)

Primera versión estable. El sitio está en producción, lo usa la familia y las
piezas que faltan son de crecimiento, no de armado.

| | |
|---|---|
| Personas cargadas | 80 |
| Con foto | 21 |
| Generaciones | desde Bautista Baudry (1908) hasta los bisnietos |
| Movimientos registrados | 58 |
| Modo de acceso | abierto, sin contraseña; eliminar bloqueado para todos |

**Lo que quedó funcionando:** el árbol completo con líneas por apellido y
posiciones estables; fichas con fotos múltiples, fechas parciales y linaje con
el nombre de cada parentesco; alta de personas por vínculo desde cualquier
ficha; presencia en vivo y bloqueo optimista por ficha; registro de movimientos
con los nombres unificados; versión de celular con menú; descargas de contactos
y cumpleaños; espejo local de sólo lectura con respaldo diario.

**Lo que queda pendiente**, en orden:

1. **Encender los magic links.** Falta sólo la contraseña SMTP de DAS Latam; el
   código está y se activa solo al aparecer las variables.
2. **Cambiar `ADMIN_CLAVE`** en Vercel: la que se usó para probar circuló en una
   conversación.
3. **Decidir la visibilidad del repositorio.** Es público y el teléfono personal
   de Ariel quedó en el historial de commits viejos. Pasarlo a privado lo
   resuelve.
4. Seguir cargando: 59 de las 80 fichas todavía no tienen foto, y la pestaña
   Personas lista las puntas abiertas del árbol.
