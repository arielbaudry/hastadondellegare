# Dónde vive

## El árbol que vale es el publicado

**https://hastadondellegare.vercel.app** — ahí carga la familia. Todo lo demás es
copia.

Los datos son **un archivo JSON en un repositorio privado de GitHub**, junto con
las fotos. No hay base de datos: lo único que hacía falta resolver era dónde
escribir ese archivo, porque el disco de Vercel es de sólo lectura.

Guardarlo en un repo trae dos cosas de regalo:

- **historial completo**: cada cambio es un commit. De ahí sale el botón
  *Deshacer*, que lee la versión anterior del archivo en vez de guardar copias
  aparte;
- **control de concurrencia real**: la Contents API exige mandar el `sha` de la
  versión leída y rechaza la escritura si cambió en el medio. Ante un choque se
  relee y se reintenta, en vez de que gane el último.

## El servidor de casa es un espejo de sólo lectura

Puerto **8096**. Se sincroniza solo cada 10 minutos desde producción y **no se
puede editar**: la API rechaza cualquier escritura y la app muestra un cartel con
el link al sitio bueno.

Es a propósito. Editar en los dos lados haría divergir los árboles en silencio
hasta que una sincronización se llevara puesto el trabajo de alguien.

Las fotos que el espejo no tiene se piden al sitio publicado, así se ven igual.

## Repositorios

| | |
|---|---|
| Código | `arielbaudry/hastadondellegare` — **público** |
| Datos | repositorio privado, configurado en `GITHUB_REPO` |

El repo de código no lleva ningún dato de la familia: `storage/` está en
`.gitignore` y las credenciales y datos de contacto viven en variables de
entorno, vacías en `.env.example`.

> Pendiente: el teléfono personal de Ariel quedó en el **historial** de git de
> commits viejos, aunque ya no está en los archivos. Pasar el repo a privado lo
> resuelve de un clic.

## Variables de entorno

| Variable | Para qué |
|---|---|
| `GITHUB_REPO`, `GITHUB_TOKEN` | dónde vive el JSON. Imprescindible en producción |
| `ADMIN_CLAVE` | habilita eliminar e importar mientras no haya magic links |
| `SESION_SECRETO` + `SMTP_*` | encienden el acceso por enlace (ver 05) |
| `ES_ESPEJO`, `SITIO_PRINCIPAL` | marcan una instancia como copia de sólo lectura |
| `ARBOL_DIR` | apunta el almacenamiento a otra carpeta, para probar sin tocar nada |

Alternativas que también funcionan y guardan el mismo JSON: `UPSTASH_REDIS_REST_*`
(Redis) y `BLOB_READ_WRITE_TOKEN` (fotos en Vercel Blob).

## Respaldos

Un archivo por día en `storage/respaldos/`, bajado de producción, con los últimos
60 días. Es una copia fuera de Vercel y fuera de GitHub.

Además, desde Ajustes se puede exportar el árbol en JSON o CSV en cualquier
momento.
