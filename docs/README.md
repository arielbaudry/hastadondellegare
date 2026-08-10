# Documentación — Hasta dónde llegaré

Árbol genealógico familiar. Cada archivo cubre un tema y se puede leer solo.

| Documento | De qué trata |
|---|---|
| [01-que-es.md](01-que-es.md) | Qué hace el sitio y cómo se usa |
| [02-modelo-de-datos.md](02-modelo-de-datos.md) | Cómo se guardan las personas y los vínculos |
| [03-el-dibujo-del-arbol.md](03-el-dibujo-del-arbol.md) | El algoritmo del diagrama y los parentescos |
| [04-donde-vive.md](04-donde-vive.md) | Producción, espejo local, repositorios, respaldos |
| [05-acceso-y-permisos.md](05-acceso-y-permisos.md) | Magic links, roles, y por qué nadie borra |
| [06-operacion.md](06-operacion.md) | Rutinas, crons, qué hacer si algo falla |
| [07-decisiones.md](07-decisiones.md) | Por qué está hecho así y no de otra manera |

## Estado — versión 1.0 (10 de agosto de 2026)

Primera versión estable: **80 personas cargadas, 21 con foto**, desde Bautista
Baudry (1908) hasta los bisnietos. El sitio está abierto —se carga y se corrige
sin contraseña, y nadie puede eliminar—; los magic links están programados y se
encienden solos cuando estén sus variables.

Pendiente, en orden: la contraseña SMTP para encender el acceso por enlace,
cambiar `ADMIN_CLAVE`, decidir si el repositorio queda público, y seguir
cargando fotos y antepasados.

**Lo mínimo que hay que saber:**

- El árbol que vale es **https://hastadondellegare.vercel.app**. Ahí carga la
  familia.
- El servidor de casa corre un **espejo de sólo lectura** en el puerto 8096, que
  se sincroniza solo cada 10 minutos y guarda un respaldo por día.
- Los datos son **un archivo JSON** en un repositorio privado de GitHub. No hay
  base de datos.
