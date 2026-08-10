#!/usr/bin/env node
/**
 * Baja una copia del árbol **de producción** y la guarda con fecha.
 *
 *   SITIO=https://hastadondellegare.vercel.app npm run respaldar
 *
 * Esta es la dirección que corresponde: el árbol que vale es el publicado, el
 * que carga la familia. Este servidor sólo guarda copias.
 */
import { mkdir, writeFile, readdir, unlink } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITIO = (process.env.SITIO ?? "https://hastadondellegare.vercel.app").replace(/\/$/, "");
const CARPETA = join(raiz, "storage", "respaldos");
const CUANTOS = 60; // se conservan los últimos dos meses

const res = await fetch(`${SITIO}/api/arbol`, { cache: "no-store" });
if (!res.ok) {
  console.error(`No se pudo leer ${SITIO}: HTTP ${res.status}`);
  process.exit(1);
}
const arbol = await res.json();
if (!Array.isArray(arbol.personas) || arbol.personas.length === 0) {
  console.error("La respuesta no trae personas: no se guarda un respaldo vacío.");
  process.exit(1);
}

await mkdir(CARPETA, { recursive: true });
const nombre = `arbol-${new Date().toISOString().slice(0, 10)}.json`;
await writeFile(
  join(CARPETA, nombre),
  JSON.stringify({ rev: arbol.rev, bajado: new Date().toISOString(), personas: arbol.personas }, null, 2),
);

const viejos = (await readdir(CARPETA)).filter((f) => f.endsWith(".json")).sort();
for (const f of viejos.slice(0, Math.max(0, viejos.length - CUANTOS))) {
  await unlink(join(CARPETA, f));
}

console.log(`${nombre}: ${arbol.personas.length} personas (rev ${arbol.rev}) desde ${SITIO}`);
