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

Así es imposible que quede una relación a medias del tipo «A dice ser hijo de B
pero B no lista a A». No agregar campos de relación redundantes.

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
