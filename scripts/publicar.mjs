#!/usr/bin/env node
/**
 * Publica el árbol local en producción, de una.
 *
 *   1. Lee storage/tree.json.
 *   2. Sube a Vercel Blob las fotos que están en storage/uploads/ y reescribe
 *      las URLs. Sin este paso las fotos quedarían rotas: en el árbol figuran
 *      como /api/fotos/<uuid>.jpg, que son archivos del disco de este servidor
 *      y producción no puede alcanzar.
 *   3. Manda todo a /api/importar del sitio publicado.
 *
 * Uso:
 *
 *   SITIO=https://hastadondellegare.vercel.app \
 *   ADMIN_CLAVE=... \
 *   BLOB_READ_WRITE_TOKEN=vercel_blob_rw_... \
 *   node scripts/publicar.mjs
 *
 * Los dos tokens se copian del panel de Vercel (Settings → Environment
 * Variables). Es una operación de una sola vez: después la familia carga
 * directo en producción.
 */
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { put } from "@vercel/blob";

const raiz = join(dirname(fileURLToPath(import.meta.url)), "..");
const SITIO = process.env.SITIO?.replace(/\/$/, "");
const CLAVE = process.env.ADMIN_CLAVE;
const TOKEN_BLOB = process.env.BLOB_READ_WRITE_TOKEN;

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
  if (!TOKEN_BLOB) return null; // sin token, la foto se descarta

  const archivo = url.slice("/api/fotos/".length);
  const bytes = await readFile(join(raiz, "storage", "uploads", archivo));
  const tipo = archivo.endsWith(".png")
    ? "image/png"
    : archivo.endsWith(".webp")
      ? "image/webp"
      : "image/jpeg";

  const { url: publica } = await put(`fotos/${archivo}`, bytes, {
    access: "public",
    contentType: tipo,
    addRandomSuffix: false,
    token: TOKEN_BLOB,
  });
  subidas.set(url, publica);
  process.stdout.write(".");
  return publica;
}

const conFotos = arbol.personas.filter((p) => p.fotos?.length);
if (conFotos.length && !TOKEN_BLOB) {
  console.warn(
    `\n⚠  ${conFotos.length} personas tienen foto pero no pasaste BLOB_READ_WRITE_TOKEN.\n` +
      "   Se van a publicar sin fotos. Cortá con Ctrl+C si preferís hacerlo bien.",
  );
} else if (conFotos.length) {
  process.stdout.write(`Subiendo fotos `);
  for (const p of arbol.personas) {
    if (!p.fotos?.length) continue;
    const nuevas = [];
    for (const f of p.fotos) {
      const publica = await subir(f);
      if (publica) nuevas.push(publica);
    }
    p.fotos = nuevas;
  }
  console.log(` ${subidas.size} subidas.`);
}
if (!TOKEN_BLOB) for (const p of arbol.personas) p.fotos = [];

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
