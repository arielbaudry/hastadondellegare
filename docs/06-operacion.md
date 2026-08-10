# Operación

## Rutinas automáticas

| Cuándo | Qué |
|---|---|
| cada 10 min | `scripts/sincronizar.sh`: pinguea producción, actualiza el espejo local y deja registro |
| una vez por día | dentro de esa misma corrida, guarda el respaldo en `storage/respaldos/` |
| al reiniciar | `scripts/start_local.sh` levanta el espejo en el 8096 |

El registro vive en `storage/vigilancia.log`, una línea por corrida:

```
2026-08-09 22:51 OK 557ms personas=72
```

Si el sitio no responde, la línea dice `CAIDO` con el código.

> **Sobre «mantener despierto» Vercel:** no hay un servidor que se duerma, como
> en otros hostings. Lo que pasa si nadie entra en un rato es que la primera
> visita arranca en frío y tarda un segundo más. El ping lo evita, pero su valor
> real es otro: avisar si el sitio se cayó y traer el respaldo.

## Comandos

```bash
npm run dev          # desarrollo con recarga en caliente
npm run build        # compilar
npm run respaldar    # bajar una copia de producción con fecha
npm run publicar     # ⚠ PISA producción con la copia local — pide confirmación
```

`publicar` se usó una sola vez, para la mudanza inicial. **No se vuelve a
correr**: la copia local está siempre atrás de lo que carga la familia. Por eso
exige `CONFIRMO=pisar-produccion`.

## Probar sin romper nada

`ARBOL_DIR` apunta el almacenamiento a otra carpeta, así se puede levantar una
segunda instancia sobre una copia:

```bash
mkdir -p /tmp/prueba/storage && cp storage/tree.json /tmp/prueba/storage/
ARBOL_DIR=/tmp/prueba/storage npx next start -p 8097
```

Vale la molestia: un script de reproducción que escriba sobre el árbol de verdad
borra datos de la familia. Ya pasó una vez.

## Si algo falla

**El sitio no carga y dice que falta configurar.** Faltan `GITHUB_REPO` y
`GITHUB_TOKEN` en Vercel. Sin eso no hay dónde escribir y el árbol abre vacío.

**Vercel no despliega un commit.** Pasó una vez: el push llegó a GitHub pero el
webhook no disparó el build. Se destraba empujando cualquier cambio nuevo o con
*Redeploy* en el panel. Para distinguirlo de un error de compilación, clonar
limpio y correr `npm ci && npm run build`.

**Alguien pisó datos.** Ajustes → *Deshacer el último cambio* vuelve a la versión
anterior, y se puede deshacer el deshacer. Si hace falta ir más atrás, están los
respaldos diarios y el historial de commits del repositorio de datos.

**El espejo local muestra otra cosa que producción.** Correr
`scripts/sincronizar.sh` a mano; el espejo es siempre el que cede.
