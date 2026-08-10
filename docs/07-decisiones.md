# Por qué está hecho así

Las decisiones que costaron discusión, para no volver a discutirlas ni
deshacerlas por descuido.

## Un archivo JSON, no una base de datos

Para un árbol familiar no hace falta más. No hay tablas ni esquema: el árbol es
un documento. Lo único que hubo que resolver fue **dónde escribirlo**, y la
respuesta —un repositorio— resultó mejor que una base, porque trae historial y
control de concurrencia gratis.

## Sólo se guardan padres y parejas

Todo lo demás se deriva. Es lo que hace imposible una relación cargada a medias.
Agregar un campo `hermanos` o `hijos` rompería la invariante.

## Nadie borra

Un dato mal cargado se corrige; uno borrado no vuelve. Con la familia entrando
sin contraseña, eliminar es el único daño irreversible. El default sin
`ADMIN_CLAVE` es «bloqueado para todos», incluido el dueño.

## No se avisa por datos que faltan

Que a alguien le falte el padre, la madre o una fecha **no es un error**: puede
que no se sepa, o que no se quiera cargar. La Revisión sólo señala lo que no
puede ser cierto o quedó a medias. Un sistema que insiste con datos íntimos
molesta y se ignora.

## El género no se pregunta

Sólo servía para nombrar bien los parentescos. En una familia puede incomodar y
no vale la molestia por una etiqueta. Se cargó una vez para las fichas históricas
a partir del nombre; sin dato va la forma neutra.

## El árbol se dibuja completo

Recortarlo alrededor del foco parecía más prolijo y era peor: escondía ramas
enteras y daba la impresión de que el foco saltaba de persona.

## El candado se enciende solo cuando puede funcionar

Si falta el secreto o el SMTP, el acceso por enlace queda apagado y el sitio
abierto. Un deploy a medio configurar no puede dejar a la familia —ni a Ariel—
afuera de su propio árbol.

## El espejo local no se edita

Editar en los dos lados haría divergir los árboles en silencio hasta que una
sincronización se llevara puesto el trabajo de alguien. El espejo siempre cede.

## La presencia no se guarda

Se vence sola y no merece historial. Anotarla en el árbol sería un commit cada
veinte segundos por persona.

## Los vínculos que no se guardan igual se piden

Sólo existen `padres` y `parejas`, pero el formulario tiene una sección por cada
tipo de vínculo —ascendentes, hijos, hermanos, pareja— y las cuatro funcionan
igual: elegir de la lista o crear la ficha nueva ahí mismo. Lo que el usuario
elige se traduce a los dos campos que sí existen.

Tenerlo prolijo por dentro no puede costarle a quien carga: nadie tiene por qué
saber que «hijo» se guarda del otro lado.

## Quedarse corto antes que envejecer a alguien

Ante una fecha incompleta, la edad que se muestra es la menor. Es la única
decisión que no molesta a nadie.

## Las herramientas de una pasada se borran

El cruce con el CRM del servidor y la importación de fotos de WhatsApp fueron
dos páginas que corrieron unos días, hicieron su trabajo —26 datos de contacto y
8 fotos— y se apagaron: proceso, regla de ufw y carpeta. Lo que quedó fue el
resultado, no la herramienta.

Cada portal encendido es una puerta más y un proceso que alguien olvida. Si hace
falta volver a cruzar, está anotado cómo.

## En el celular, la lista manda

El árbol se mira; se carga desde la pestaña Personas. En una pantalla de
teléfono acertarle a una tarjeta del lienzo, abrir su ficha y de ahí editar son
tres gestos finos; la lista es un buscador y una fila por persona.

Por eso las secciones pasaron a una barra abajo y la pestaña Personas abre
directamente en el buscador: lo que se usa para trabajar tiene que estar a un
toque, y lo que se usa para mirar —métricas, puntas abiertas— puede esperar más
abajo.

## Se propone, no se importa

Ninguno de esos cruces escribió nada por su cuenta. El CRM tiene homónimos
—tres «Maria Ines Rodriguez»— y WhatsApp da por bueno un número argentino mal
formado como si fuera de otro país. Una máquina puede acercar candidatos; quién
es quién en una familia lo dice una persona.
