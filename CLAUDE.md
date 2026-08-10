# Hasta dónde llegaré — memoria del proyecto

Árbol genealógico familiar colaborativo. **Toda la documentación está en
`README.md`**: modelo de datos, arquitectura, algoritmo de dibujo, drivers de
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

## Pendiente

- Cerrar el modo abierto y pasar a magic links cuando esté cargado lo grueso.
