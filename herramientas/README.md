# Contactos — cruce del árbol con el CRM del servidor

Página **temporal** para aprovechar los datos que ya tenemos: busca a las
personas del árbol dentro del Padrón CRM (`/home/hpp/padron`, MariaDB local con
629 mil contactos), muestra los candidatos parecidos y deja confirmar a mano
quién es quién y qué dato vale antes de mandarlo al árbol publicado.

    http://192.168.1.71:8098

## Por qué a mano

De las 80 personas del árbol, 47 tienen algún candidato en el CRM y 43 de ellas
hoy no tienen ni celular ni correo cargado: hay bastante para ganar. Pero el
grueso del CRM es el padrón de afiliados de IOMA, con homónimos por todos lados
—hay tres «Maria Ines Rodriguez»—, y un teléfono equivocado en la ficha de un
familiar es peor que no tener el dato.

Por eso el cruce **propone** y una persona **decide**. Nada se escribe en el
árbol hasta apretar «Aplicar al árbol».

## Cómo puntúa

`cotejo.py` no se conforma con el apellido: pide que coincida además un nombre
de pila (tolerando una letra de diferencia, para los «Gabriel/Gabriela» y los
acentos perdidos). El puntaje mezcla cuánto de la persona aparece en el contacto
y cuánto del contacto es la persona, así un «Baudry Juan Sebastian» pesa más que
un «Baudry Juan Martin». Un correo o un teléfono idénticos valen 1.00 directo.

Aun así hay falsos positivos a la vista: «Gabriel Baudry» matchea con «Gabriela
Baudry», y «Maia Baudry» con «Maria Clara Baudry». Se ven y se descartan.

## Fotos de perfil de WhatsApp — `/fotos`

De las personas con celular cargado, **16 tienen foto de perfil visible y 13 de ellas no tenían
ninguna foto en el árbol**. La página las muestra en una grilla, con la foto a la vista, y se
tildan las que se quieran traer.

De dónde salen: la línea **+54 9 11 5523-8822** (el chatbot de MCV, en la VM de Oracle) está
conectada a WhatsApp con Baileys. Se le agregó el endpoint `/foto-perfil`, de **sólo lectura**:
pregunta si un número tiene WhatsApp y devuelve la URL de su avatar — lo mismo que ve cualquiera
que lo tenga agendado. No manda mensajes ni abre conversaciones. Ver el skill `servidor_oracle`.

Las credenciales del panel del bot **no salen de la VM**: el `curl` se arma allá contra su propio
localhost y por acá vuelve sólo el JSON.

### El número hay que armarlo bien

Las fichas tienen el teléfono escrito de seis maneras: `2246485878`, `01151560011`,
`+5492257619896`. Se prueban las variantes (`549…`, `54…`) y gana la que exista.

**El número crudo no se prueba nunca**, aunque sea lo primero que uno haría: WhatsApp lo lee como
internacional y `2246485878` le resulta un número válido de otro país. Contestaba «existe, y con
foto» — la de un desconocido, que habría terminado en la ficha de un familiar. La primera corrida
trajo cuatro casos así.

Quien no aparece con foto casi siempre es por privacidad: WhatsApp muestra el avatar sólo a los
contactos, y la línea del bot no tiene agendada a la familia.

La foto se **suma** a la ficha, nunca pisa las que ya estaban: es la regla del árbol.

## Arrancar y parar

```bash
cd /home/hpp/hastadondellegare/herramientas
/usr/bin/python3 contactos.py          # NO el python de linuxbrew: pymysql está en el del sistema
```

Para pararla: `kill $(ss -ltnp | grep :8098 | grep -oE 'pid=[0-9]+' | cut -d= -f2)`.

No tiene `@reboot`: es temporal. Cuando termine el cruce se apaga, se borra la
regla de ufw (`sudo ufw delete allow 8098/tcp`) y esta carpeta se puede borrar
entera.

## Qué guarda

| Archivo | Qué es |
|---|---|
| `storage/cotejo.json` | El cruce calculado. Tarda ~25 s, por eso queda en caché; «Recalcular» lo rehace |
| `storage/decisiones.json` | Qué contactos confirmaste y qué valor elegiste para cada campo. Se guarda a cada clic |
| `storage/whatsapp.json` | El resultado de la última búsqueda de avatares. Las URLs de WhatsApp vencen en unas horas: si las fotos dejan de verse, «Buscar en WhatsApp» de nuevo |

## Variables

| Variable | Para qué | Default |
|---|---|---|
| `ARBOL_URL` | Contra qué árbol trabaja | `https://hastadondellegare.vercel.app` |
| `ARBOL_AUTOR` | Con qué nombre firma los cambios | `Ariel Osvaldo Baudry` |
| `CONTACTOS_PUERTO` | Puerto | `8098` |
| `CONTACTOS_DIR` | Dónde guarda caché y decisiones | `./storage` |

Para probar sin tocar el árbol real, se levanta una copia del árbol aparte y se
apunta ahí:

```bash
ARBOL_DIR=/tmp/prueba npx next start -p 8097          # en /home/hpp/hastadondellegare
ARBOL_URL=http://localhost:8097 CONTACTOS_DIR=/tmp/contactos-prueba \
  CONTACTOS_PUERTO=8099 /usr/bin/python3 contactos.py
```

## El árbol que manda sigue siendo el de Vercel

Esta página lee el árbol publicado y le escribe por su API (`PATCH
/api/personas/:id`), una ficha por vez. No toca el espejo local de `:8096` ni el
JSON del repositorio: los cambios entran por la misma puerta que si los cargara
alguien desde el navegador, y quedan firmados con `ARBOL_AUTOR`.
