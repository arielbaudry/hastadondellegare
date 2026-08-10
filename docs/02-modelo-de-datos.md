# Modelo de datos

**No hay base de datos.** Todo el árbol es un único documento JSON:
`{ rev, esEjemplo, actualizadoEn, personas[] }`. Para una familia de cientos de
personas pesa unos cientos de kB y se manda entero al navegador de una.

```ts
Persona {
  id, nombres, apellidos, apodo?, apellidoNacimiento?, genero?,
  fotos: string[],                                    // varias; la 1ª es el retrato
  fechaNacimiento?, lugarNacimiento?, vivo, fechaFallecimiento?,
  celular?, email?, direccion?, notas?,
  padres: string[],                                   // ids, máximo 2
  parejas: { personaId, tipo, desde?, hasta? }[],     // recíprocas
  creadoPor?, actualizadoPor?, creadoEn, actualizadoEn
}
```

## La regla que sostiene todo

**Sólo se guardan dos vínculos: `padres` y `parejas`.** Hijos, nietos, hermanos,
abuelos, tíos, primos y sobrinos se *derivan* en `src/lib/tree.ts`.

Que no se guarden no quiere decir que no se puedan cargar. El formulario los
pide igual, y los traduce a los dos campos que sí existen:

| Lo que se elige en el formulario | Lo que se guarda |
| --- | --- |
| `hijos: string[]` | esta persona entra (o sale) del campo `padres` de cada hijo |
| `hermanosDe: string[]` | esta ficha y esas personas quedan con los mismos padres |

Ninguno de los dos llega al servidor: `guardar()` en `App.tsx` los saca de la
entrada y los aplica como ediciones de las otras fichas. Los dos tienen reglas
que se revisan **antes de escribir nada**, porque guardar la mitad dejaría la
ficha en pantalla desactualizada:

- nadie puede tener más de dos padres;
- un ascendente no puede ser además hijo (`esAscendente()` corta el ciclo);
- a un hermano que ya tenga otros padres cargados no se le pisan: se respetan
  los suyos, que el dato de otro no se borra.

Así es imposible que quede una relación a medias del tipo «A dice ser hijo de B
pero B no lista a A». No agregar campos de relación redundantes.

## La bitácora viaja con el árbol

`arbol.bitacora` guarda los últimos 300 movimientos —quién entró, quién cargó o
corrigió a quién— dentro del mismo documento. Va con el árbol a donde sea que
esté guardado, y se poda sola. Las entradas se anotan **una por sesión**, no por
latido: si no, sería una línea cada veinte segundos por persona.

## Coherencia en cada escritura

`src/lib/validar.ts` corre siempre y deja el árbol sano:

- borra vínculos a personas que ya no existen y auto-referencias;
- hace recíprocas las parejas;
- **corta ciclos de filiación**: nadie puede terminar siendo ancestro de sí mismo.

## Dos trampas que ya costaron caras

**Leer no puede mutar.** `ix.get(id).padres` devuelve el array real de esa
persona, no una copia. `rolesRespectoA()` lo usaba como pila de recorrido y lo
vaciaba con `pop()`: con sólo **seleccionar** a alguien se le borraban los padres
en memoria, y al guardar la ficha el vacío se escribía en el servidor. Copiar
antes de recorrer.

**Las fechas son parciales.** Nunca cambiar los campos a `<input type="date">`:
obligaría a una fecha exacta y haría imposible cargar la mitad del árbol.

## La edad no es restar los años

`edad()` mira si el cumpleaños ya llegó. Restar 2026 − 1975 da uno de más
durante casi todo el año, y lo mismo pasaba con la edad al fallecer.

Con fechas incompletas se elige la edad **menor**: si sólo se sabe el mes y es
justo éste, el cumpleaños puede no haber pasado, y es preferible quedarse corto
que envejecer a alguien. Sabiendo sólo el año no hay nada que decidir.

## Cómo se firma un movimiento

Sin login, la bitácora se firma con el nombre que cada uno declara al entrar, y
la misma persona escribe el suyo distinto cada vez: «Ariel», «Ariel Baudry»,
«Ariel Osvaldo Baudry». En el registro parecían tres.

`nombreCanonico()` (en `coincidencias.ts`) resuelve el nombre declarado contra
las fichas del árbol y guarda el nombre completo de la ficha. Es más permisivo
que el `esInequivoca()` que decide en qué ficha abrirte el árbol —ahí
equivocarse molesta; acá es sólo cómo se escribe un nombre en un registro—.

Cuando hay empate de verdad, gana quien viene editando: en esta familia hay dos
Arieles, y «Ariel» a secas se parece igual a los dos, pero uno de ellos nunca
tocó el árbol. Si los dos editaran, el nombre queda tal como se escribió.

La corrección se aplica en dos lugares: al anotar cada movimiento nuevo, y en
`migrar()` sobre los que ya estaban guardados.
