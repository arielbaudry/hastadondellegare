#!/usr/bin/env node
/**
 * Vacía storage/tree.json sin levantar el servidor:  npm run reset
 *
 * Sembrar el ejemplo NO se hace desde acá: el árbol se siembra solo la primera
 * vez que se pide /api/arbol estando vacío, y se puede recargar desde
 * Ajustes → «Recargar familia de ejemplo».
 *
 * Sólo aplica al driver de disco (desarrollo local). En producción los datos
 * viven en Redis y se manejan desde Ajustes.
 */
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const destino = join(raiz, "storage", "tree.json");

await mkdir(dirname(destino), { recursive: true });
await writeFile(
  destino,
  JSON.stringify(
    { rev: 1, esEjemplo: false, actualizadoEn: new Date().toISOString(), personas: [] },
    null,
    2,
  ),
);
console.log(`Árbol vaciado: ${destino}`);
