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
