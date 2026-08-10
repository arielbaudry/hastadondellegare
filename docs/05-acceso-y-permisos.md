# Acceso y permisos

## Magic links

No hay contraseñas. Se pide un enlace al correo, y **sólo lo recibe quien ya
tiene una ficha en el árbol con ese correo cargado**: no hay registro abierto.
Quien todavía no figura, escribe a Ariel — su correo y su teléfono están en la
misma pantalla de acceso.

| Quién | Ve | Suma y corrige | Elimina |
|---|---|---|---|
| Sin sesión | — | — | — |
| Colaborador (ficha con correo) | ✔ | ✔ | — |
| Administrador (`ADMIN_EMAIL`) | ✔ | ✔ | ✔ |

Detalles que importan:

- **Sin sesión no se manda el árbol**, ni para leer. Tiene teléfonos y
  direcciones de la familia.
- **La respuesta al pedir el enlace es siempre la misma**, exista o no el correo.
  Si dijera «ese correo no está», cualquiera podría averiguar quién figura en el
  árbol probando direcciones.
- El enlace vale **media hora**; la sesión, tres meses. Van firmados y sin estado
  (HMAC), así funcionan igual en Vercel.
- **La firma no alcanza**: al entrar y en cada carga se comprueba que el correo
  siga en alguna ficha. A quien saquen del árbol se le cae la sesión.
- **El candado se enciende solo si están `SESION_SECRETO` y el SMTP.** Sin eso el
  sitio queda abierto. Un deploy a medio configurar no puede dejar a nadie afuera.

> Estado: falta la contraseña SMTP de DAS Latam, que vive en la base de Ferozo.
> Hasta entonces el acceso por enlace está apagado.

## Nadie borra

Mientras el árbol esté abierto **no se puede eliminar nada**. Se puede sumar y se
puede corregir: si alguien carga algo mal, se edita. Lo único sin arreglo es
perder lo que cargó otro, y con veinte parientes escribiendo ese es el riesgo
real.

Las tres operaciones destructivas —borrar una persona, importar un respaldo y
sembrar el ejemplo— quedan detrás de `ADMIN_CLAVE`. **Sin esa variable están
bloqueadas para todos**, incluido el dueño: es el default a propósito.

El bloqueo es **del servidor**, no de la interfaz: esconder botones no protege
nada, la API responde 403.

`Deshacer` queda libre: es el antídoto de los accidentes y se puede deshacer a sí
mismo, así que no destruye nada.

## Dos personas guardando a la vez

- **Por ficha**: el navegador manda `actualizadoEn`, la versión que tenía a la
  vista, y el servidor responde 409 si otro tocó esa misma ficha mientras tanto.
  No se pierde lo escrito, se adopta la versión nueva y el segundo intento entra.
- **Por archivo**: el `sha` de la Contents API de GitHub; ante un choque se relee
  y se reintenta.
- **Al mirar**: el latido de presencia trae la revisión del árbol, así que cuando
  otro guarda algo se recarga solo — salvo que haya un formulario abierto.

## Presencia

Un globo cuenta cuánta gente está mirando; al tocarlo dice quiénes. Se lleva **en
memoria del servidor**, no en el árbol: con el JSON en GitHub, anotar cada latido
sería un commit cada veinte segundos por persona.

Si el sitio corriera en varias instancias, cada una vería sólo a los suyos y el
número saldría bajo. El error posible es contar de menos, nunca inventar gente.
