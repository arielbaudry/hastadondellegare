#!/usr/bin/env node
/**
 * Publica el árbol local en producción, de una.
 *
 *   1. Lee storage/tree.json.
 *   2. Sube las fotos de storage/uploads/ al sitio publicado y reescribe las
 *      URLs. Sin esto quedarían rotas: apuntan a archivos del disco de este
 *      servidor, que producción no puede alcanzar.
 *   3. Manda el árbol entero a /api/importar.
 *
 * Uso (una sola vez):
 *
 *   SITIO=https://hastadondellegare.vercel.app ADMIN_CLAVE=... npm run publicar
 *
 * `ADMIN_CLAVE` es la que hayas puesto en Vercel. No hace falta ningún token
 * más: las fotos viajan por la propia API del sitio.
 */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITIO = process.env.SITIO?.replace(/\/$/, "");
const CLAVE = process.env.ADMIN_CLAVE;

if (!SITIO || !CLAVE) {
  console.error("Faltan SITIO y/o ADMIN_CLAVE. Ver el encabezado de este archivo.");
  process.exit(1);
}

const arbol = JSON.parse(await readFile(join(raiz, "storage", "tree.json"), "utf8"));
console.log(`Árbol local: ${arbol.personas.length} personas.`);

// ---------------------------------------------------------------- fotos
const subidas = new Map();

async function subir(url) {
  if (!url.startsWith("/api/fotos/")) return url; // ya es absoluta: no se toca
  if (subidas.has(url)) return subidas.get(url);

  const archivo = url.slice("/api/fotos/".length);
  const bytes = await readFile(join(raiz, "storage", "uploads", archivo));
  const tipo = archivo.endsWith(".png")
    ? "image/png"
    : archivo.endsWith(".webp")
      ? "image/webp"
      : "image/jpeg";

  const form = new FormData();
  form.append("foto", new Blob([bytes], { type: tipo }), archivo);
  const res = await fetch(`${SITIO}/api/fotos`, {
    method: "POST",
    headers: { "x-clave-admin": CLAVE },
    body: form,
  });
  const datos = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`subiendo ${archivo}: ${datos.error ?? res.status}`);

  subidas.set(url, datos.url);
  process.stdout.write(".");
  return datos.url;
}

const conFotos = arbol.personas.filter((p) => p.fotos?.length);
if (conFotos.length) {
  process.stdout.write("Subiendo fotos ");
  for (const p of arbol.personas) {
    if (!p.fotos?.length) continue;
    const nuevas = [];
    for (const f of p.fotos) nuevas.push(await subir(f));
    p.fotos = nuevas;
  }
  console.log(` ${subidas.size} subidas.`);
}

// ------------------------------------------------------------- importar
const res = await fetch(`${SITIO}/api/importar`, {
  method: "POST",
  headers: { "Content-Type": "application/json", "x-clave-admin": CLAVE },
  body: JSON.stringify({ personas: arbol.personas, autor: "publicación inicial" }),
});
const datos = await res.json().catch(() => ({}));

if (!res.ok) {
  console.error(`\n✗ No se pudo importar (HTTP ${res.status}): ${datos.error ?? "sin detalle"}`);
  process.exit(1);
}
console.log(`\n✓ Listo: ${datos.personas.length} personas publicadas en ${SITIO}`);
