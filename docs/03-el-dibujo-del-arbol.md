# El dibujo del árbol y los parentescos

## El árbol se dibuja completo, siempre

`diagramar()` no recibe el foco. Todas las personas, en todo momento; el foco
sólo marca dónde está parado uno.

> Antes se armaba caminando desde el foco hacia arriba y hacia abajo. Eso dejaba
> invisible cualquier rama lateral —los suegros, los primos, una familia todavía
> no enganchada— hasta pararse encima, y daba la impresión de que el foco
> «saltaba» de persona cuando lo que cambiaba era el recorte.

Cuatro pasos:

1. **Unidades.** Las parejas, y quienes comparten un hijo, se agrupan con
   union-find en un bloque de cajas pegadas. Lo segundo importa: dos personas
   pueden ser padres de los mismos hijos sin que nadie haya cargado que son
   pareja.
2. **Niveles.** Cada unidad recibe un número de generación relajando la regla
   «los hijos van al menos un nivel más abajo que sus padres», con tope de
   iteraciones por si un dato armara un ciclo.
3. **Orden horizontal.** Cada unidad cuelga de **una** unidad madre, lo que deja
   un bosque; se acomoda con el layout *tidy* clásico.
4. **Empaquetado.** Los árboles sueltos se ponen uno al lado del otro.

## Los hijos cuelgan de su pareja, no del bloque

Cada par de padres tiene un **punto de unión**: el medio exacto entre sus dos
cajas, con una barra y un nudo. De ahí baja una línea a cada hijo.

Es lo que hace legibles las familias ensambladas. Si alguien tuvo hijos con dos
personas distintas, las tres cajas quedan pegadas, y sin puntos de unión parece
que todos los hijos son de los tres. Dos detalles lo sostienen: los miembros del
bloque se ordenan recorriendo el grafo de parejas **como un camino** —así quien
tuvo dos parejas queda en el medio— y los hijos se ordenan por la pareja de la
que cuelgan.

## Un color por rama, un carril por pareja

Las líneas se pintan con el color de la rama del hijo: cuando cambia el apellido,
cambia el color. El orden lo da la frecuencia, así la rama principal se queda
siempre con el primero.

Y cada pareja baja por **su propio carril horizontal** en vez de por el medio del
hueco: sin eso las líneas de familias distintas se superponen y se leen como un
solo trazo.

## Las unidades «puente» van al borde

Una unidad con padres en dos familias distintas —alguien que se casó y trajo su
propia rama— se manda al extremo del grupo de hermanos que da hacia la otra
familia. Sin eso, un hermano de sangre termina dibujado entre gente de otro
apellido.

## Los parentescos se calculan

La ficha no lista «padres, abuelos, tíos»: calcula **cómo se llama cada vínculo**
y muestra el linaje entero, de lo cercano a lo lejano — «tía abuela», «primo
segundo», «bisnieta», «cuñado», «madrastra».

El método es el clásico: se busca el antepasado común más cercano y se miran las
dos distancias hasta él. Con `a` = cuánto sube el primero y `b` el segundo:

| | |
|---|---|
| `a=0` | ascendiente directo (padre, abuelo, bisabuelo…) |
| `b=0` | descendiente directo (hijo, nieto, bisnieto…) |
| `a=1, b=1` | hermanos |
| `a=1, b>1` | sobrinos (nietos, bisnietos…) |
| `a>1, b=1` | tíos (abuelos, bisabuelos…) |
| `a>1, b>1` | primos de grado `min(a,b)-1`, removidos `|a-b|` veces |

Lo que no sale por sangre se busca por afinidad: la pareja de un pariente o el
pariente de la pareja (suegros, cuñados, yernos, tíos políticos).

**El género no se pregunta.** Sólo sirve para decir «tía abuela» en vez de
«tío/a abuelo/a», y en una familia puede incomodar. Se cargó una vez para las
fichas históricas a partir del nombre de pila; sin dato va la forma neutra y no
pasa nada. El título de cada grupo lleva género sólo si **todo** el grupo lo
comparte.

## Cámara

- **Un clic** abre la ficha y encuadra el entorno: padres, pareja e hijos, con la
  persona centrada. Los hermanos quedan fuera del cálculo a propósito — sus ramas
  los empujan lejos y meterlos obligaría a alejar el zoom hasta no leer nada.
- **Doble clic** edita. Se detecta a mano: entre medio hay arrastre y captura de
  puntero, y el evento nativo se pierde.
- La captura del puntero se toma **recién al confirmarse el arrastre** (4 px). Si
  se toma en el `pointerdown`, los clics se despachan al contenedor y nunca
  llegan a la caja.
- El reencuadre automático corre mientras el usuario no haya movido la cámara. En
  cuanto arrastra, hace zoom o elige a alguien, la cámara es suya.
