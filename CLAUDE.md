# Hasta dónde llegaré — memoria del proyecto

Árbol genealógico familiar colaborativo. **La documentación está en la carpeta
[`docs/`](docs/)**, y hay una página con estado en vivo en el tablero del
servidor (https://192.168.1.71/arbol). El `README.md`: modelo de datos, arquitectura, algoritmo de dibujo, drivers de
persistencia, pasos de deploy en Vercel y el estado de seguridad.

Lo que conviene tener presente antes de tocar código:

- **Sólo se guardan `padres` y `parejas`.** Hijos, hermanos, nietos, tíos,
  primos y sobrinos se derivan en `src/lib/tree.ts`. No agregar campos de
  relación redundantes: es lo que evita que el árbol quede inconsistente.
- **`normalizar()` en `src/lib/validar.ts` corre en cada escritura** y es lo que
  garantiza reciprocidad de parejas y ausencia de ciclos. Toda ruta que mute el
  árbol tiene que llamarla.
- **Las fechas son parciales** (`AAAA`, `AAAA-MM`, `AAAA-MM-DD`). Nunca cambiar
  los campos a `<input type="date">`: de los ancestros lejanos casi siempre se
  sabe sólo el año. `CampoFecha` suma un calendario opcional que *escribe* en el
  campo de texto; es un agregado, no un reemplazo.
- **El árbol se dibuja SIEMPRE completo.** `diagramar(personas)` ni siquiera
  recibe el foco: agrupa a todos en unidades familiares (union-find sobre
  parejas y co-paternidad), les asigna nivel de generación y acomoda el bosque.
  No volver al recorrido desde el foco: dejaba invisibles las ramas laterales y
  parecía que el foco «saltaba» de persona.
- **Alinear la generación necesita tres reglas, no una.** Además de «los hijos
  van más abajo que sus padres», los hermanos comparten renglón y quien no tiene
  padres cargados baja hasta pegarse a sus hijos. Con la primera sola manda la
  cadena de ancestros más larga: los abuelos maternos quedaban un renglón arriba
  de los paternos, y unos hermanos arriba de la hermana casada del otro lado.
- **Los hijos cuelgan del punto de unión de su pareja**, no de cada padre ni del
  bloque. Sin eso, en una familia ensamblada todos los hijos parecen ser de
  todos los adultos del bloque. Va junto con ordenar los miembros de la unidad
  como un camino por el grafo de parejas, y ordenar los hijos por la pareja de
  la que cuelgan.
- **Los roles van aparte** (`rolesRespectoA()`), justamente para que cambiar de
  foco no rearme el diagrama ni mueva la cámara.
- **Los parentescos se calculan, no se cargan** (`src/lib/parentesco.ts`). El
  campo `genero` existe sólo para nombrarlos bien y **no se pregunta en el
  formulario**: en una familia puede incomodar. Se cargó una vez para las fichas
  históricas; sin dato va la forma neutra y no pasa nada. No reponer ese campo.
- **Hijos y hermanos no se guardan, pero el formulario los pide igual.**
  `hijos` y `hermanosDe` son instrucciones de `PersonaEntrada`, no campos: el
  cliente los saca de la entrada y los traduce (un hijo se escribe en el campo
  `padres` de ese hijo; unos hermanos quedan con los mismos padres). Las reglas
  —nadie con tres padres, nadie ascendente y descendente a la vez— se revisan
  **antes de escribir nada**: guardar la mitad deja la ficha en pantalla
  desactualizada y el reintento choca contra su propia versión.
- **`FormularioPersona` lleva `key`.** Sin eso React reusa el mismo formulario
  al pasar de editar a «+ Crear hijo/a» y arrastra los vínculos de la persona
  anterior.
- **`edad()` mira si el cumpleaños llegó**, y ante una fecha incompleta elige la
  edad menor. Restar los años a secas envejecía a todos un año durante casi todo
  el año.
- **La bitácora se firma con el nombre canónico** (`nombreCanonico()` en
  `coincidencias.ts`): «Ariel», «Ariel Baudry» y «Ariel Osvaldo Baudry» son uno
  solo. Es más permisivo que `esInequivoca()` a propósito —acá equivocarse sólo
  cambia cómo se escribe un nombre en un registro—, y ante empate real gana
  quien viene editando. **Hay dos Arieles en el árbol**: no endurecer ni aflojar
  esa regla sin probar con ese caso.
- **`fotos` es una lista, nunca un campo único.** Se suman y ninguna pisa a la
  anterior; la primera es el retrato. `store.migrar()` convierte el viejo
  `fotoUrl` en cada lectura: sin eso, un árbol guardado antes aparecería sin
  fotos hasta volver a guardar ficha por ficha.
- **No avisar por datos que faltan.** Que alguien no tenga padre o madre
  cargados no es un error: puede que no se sepa o que no se quiera cargar. La
  Revisión sólo señala lo que no puede ser cierto o quedó a medias.
- **Leer nunca puede mutar.** `ix.get(id).padres` es el array real de la persona,
  no una copia: copialo antes de recorrerlo con `pop()`/`splice()`. Este bug
  existió y era grave — seleccionar a alguien le vaciaba los padres en memoria y
  al guardar la ficha el vacío se persistía («cada vez que edito se desvinculan
  las relaciones»). Mismo motivo por el que `FormularioPersona` copia `padres` y
  `parejas` al abrirse.
- **Probar sobre datos reales sólo con `ARBOL_DIR`**, levantando una segunda
  instancia contra una copia. Un script de reproducción que escriba sobre el
  árbol de verdad borra datos de la familia; ya pasó una vez.
- `revision.ts` concentra la detección de inconsistencias. Al agregar un chequeo,
  ojo con la severidad: `error` es sólo lo que **no puede ser cierto**; deducir
  un padre por los hermanos es `aviso`, porque pueden ser medio hermanos.
- **En el lienzo, la captura del puntero se toma recién al confirmarse el
  arrastre** (4 px), no en el `pointerdown`. Si se toma antes, los clics se
  despachan al contenedor y nunca llegan a la caja de la persona: por eso el
  doble clic también se detecta a mano y no con `onDoubleClick`.
- **El diseño es neutro moderno** (índigo `--acento` sobre grises, sin serifas).
  Los tokens están todos en `:root` de `globals.css`; el modo oscuro sólo
  redefine los que cambian, en los dos bloques (`prefers-color-scheme` y
  `[data-tema]`).
- **No hay base de datos y no hay que agregarla.** El árbol es un archivo JSON;
  lo único que cambia entre entornos es dónde se guarda: repo de GitHub
  (recomendado, da historial y control de concurrencia), Upstash, o disco en
  local. Las fotos van siempre al mismo lugar que el árbol. Es un sitio
  familiar: no sumar infraestructura sin una razón concreta.
- **Puerto local 8096** (`scripts/start_local.sh`, `@reboot` en el crontab,
  regla ufw para `192.168.1.0/24`).
- `storage/` está en `.gitignore`: los datos de la familia no van al repo.

## El que manda es producción

**https://hastadondellegare.vercel.app es el árbol real.** El 8096 de este
servidor es un espejo de sólo lectura que se sincroniza cada 10 minutos
(`scripts/sincronizar.sh`). Nunca correr `npm run publicar` sin pensarlo: pisa lo
que cargó la familia con la copia local, que está siempre atrás. Por eso exige
`CONFIRMO=pisar-produccion`.

## Dónde vive

- **Repo:** https://github.com/arielbaudry/hastadondellegare — cuenta personal de
  Ariel (`ariel@baudry.com.ar`), no la de DAS Latam.
- **Producción:** https://hastadondellegare.vercel.app/ (Vercel, entrando con esa
  misma cuenta de GitHub).
- **Acceso del servidor al repo:** clave SSH propia del proyecto,
  `~/.ssh/id_ed25519_hastadondellegare`, con el host `github-hastadondellegare`
  en `~/.ssh/config`. Es una *deploy key* del repo, no una credencial de la
  cuenta: sirve para este repo y para nada más.

## Acceso y roles

Magic link al correo cargado en la ficha (`src/lib/sesion.ts`, `src/lib/permisos.ts`).
`ADMIN_EMAIL` es el único que borra; el resto colabora. Tres invariantes que no
hay que aflojar:

1. **El candado se enciende solo si `SESION_SECRETO` y el SMTP están puestos.**
   Sin eso el sitio queda abierto. Un deploy a medio configurar no puede dejar a
   nadie afuera.
2. **La respuesta de `/api/acceso/solicitar` es idéntica exista o no el correo.**
   Si no, se puede enumerar quién está en el árbol.
3. **La firma no alcanza**: al entrar y en cada `/api/arbol` se verifica que el
   correo siga en alguna ficha. Si no, la sesión se cae.

## Presencia y concurrencia

- La presencia va **en memoria** (`src/lib/presencia.ts`). No moverla al
  almacenamiento del árbol: sería un commit por latido.
- El bloqueo optimista por ficha se apoya en que `PersonaEntrada` incluya
  `actualizadoEn`. Si se saca ese campo, dos personas editando la misma ficha
  vuelven a pisarse en silencio.
- Tras un conflicto hay que **adoptar la versión nueva** (`versionAlDia`), si no
  el reintento choca para siempre contra el mismo 409.

## Nadie borra

Eliminar personas, importar respaldos y sembrar el ejemplo exigen `ADMIN_CLAVE`
(`src/lib/permisos.ts`), y **sin esa variable están bloqueados para todos**. No
aflojar este default: el sitio es público y sin login. Editar sí queda libre —
un dato mal cargado se corrige, uno borrado no vuelve.

## Herramientas de una pasada

El cruce con el CRM del servidor (`/home/hpp/padron`) y la importación de fotos
de WhatsApp fueron páginas temporales que ya se borraron: recuperaron 26 datos de
contacto y 8 fotos. Lo que quedó guardado, fuera del repo, está en
`storage/respaldos/` (`cotejo-crm-decisiones-*.json`, `whatsapp-avatares-*.json`).

Si hace falta volver a esa fuente: el bot de MCV en la VM de Oracle tiene el
endpoint de sólo lectura `/foto-perfil` (skill `servidor_oracle`, sección 4b), y
el reconocimiento facial con nombres del iPhone está en la memoria del agente
(`caras-con-nombre-iphone`). Dos trampas ya pagadas: WhatsApp da por bueno un
número argentino en formato local como si fuera de otro país, y las fotos del
iPhone se mapean por carpeta **y** nombre de archivo, nunca sólo por nombre.

Otras 5 fotos entraron después desde el reconocimiento facial del backup del
iPhone, con un script de una pasada; no quedó código que mantener.

## Pendiente

- **Encender los magic links**: falta sólo la contraseña SMTP de DAS Latam.
- **Cambiar `ADMIN_CLAVE`** en Vercel: la de prueba circuló en una conversación.
- **Decidir la visibilidad del repo**: es público y el teléfono de Ariel quedó en
  el historial de commits viejos.

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
