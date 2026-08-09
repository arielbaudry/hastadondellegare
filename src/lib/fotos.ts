import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { escribirArchivo, githubConfigurado, leerArchivo } from "./github";

/**
 * Guardado de fotos. Las imágenes ya vienen redimensionadas desde el navegador
 * (ver `redimensionar()` en components/FotosInput.tsx), así que acá no hay
 * procesamiento: sólo se persisten.
 *
 * Tres destinos, en este orden:
 *
 *  1. **Vercel Blob**, si está su token. Es lo ideal para muchas fotos.
 *  2. **El repositorio de GitHub**, al lado del JSON del árbol.
 *  3. **Upstash Redis**, si es lo que está configurado.
 *  4. **Disco**, en desarrollo local.
 *
 * La idea es que alcance con configurar UNA sola cosa: donde vaya el árbol, van
 * las fotos.
 *
 * En los tres casos la URL que se guarda es la misma, `/api/fotos/<archivo>`,
 * así el árbol se puede mover de un lado a otro sin reescribir nada.
 */

const DIR_UPLOADS = path.join(
  process.env.ARBOL_DIR ?? path.join(process.cwd(), "storage"),
  "uploads",
);

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const UPSTASH_TOKEN =
  process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

type Destino = "blob" | "github" | "redis" | "disco";

const destino: Destino = process.env.BLOB_READ_WRITE_TOKEN
  ? "blob"
  : githubConfigurado()
    ? "github"
    : UPSTASH_URL && UPSTASH_TOKEN
      ? "redis"
      : "disco";

/** Carpeta de las fotos dentro del repo, al lado del JSON del árbol. */
const CARPETA_GH = process.env.GITHUB_CARPETA_FOTOS ?? "fotos";

const EXTENSIONES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const MAX_BYTES = 3 * 1024 * 1024;

export function tipoAceptado(tipo: string): boolean {
  return tipo in EXTENSIONES;
}

function tipoDe(nombre: string): string {
  const ext = nombre.split(".").pop()?.toLowerCase();
  return ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
}

async function upstash(comando: string, body?: string): Promise<unknown> {
  const res = await fetch(`${UPSTASH_URL}/${comando}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    body,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Upstash ${comando}: ${res.status}`);
  return (await res.json()).result;
}

export async function guardarFoto(archivo: File): Promise<string> {
  const ext = EXTENSIONES[archivo.type] ?? "jpg";
  const nombre = `${randomUUID()}.${ext}`;
  const bytes = Buffer.from(await archivo.arrayBuffer());

  if (destino === "blob") {
    const { put } = await import("@vercel/blob");
    const { url } = await put(`fotos/${nombre}`, bytes, {
      access: "public",
      contentType: archivo.type,
      addRandomSuffix: false,
    });
    return url;
  }

  if (destino === "github") {
    await escribirArchivo(`${CARPETA_GH}/${nombre}`, bytes, `Agrega una foto`, null);
    return `/api/fotos/${nombre}`;
  }

  if (destino === "redis") {
    await upstash(`set/${encodeURIComponent(`hdll:foto:${nombre}`)}`, bytes.toString("base64"));
    return `/api/fotos/${nombre}`;
  }

  await fs.mkdir(DIR_UPLOADS, { recursive: true });
  await fs.writeFile(path.join(DIR_UPLOADS, nombre), bytes);
  return `/api/fotos/${nombre}`;
}

/** Lee una foto propia. Devuelve null si no existe o si el nombre es sospechoso. */
export async function leerFoto(nombre: string): Promise<{ bytes: Buffer; tipo: string } | null> {
  // Sin subcarpetas ni "..": el nombre tiene que ser exactamente <uuid>.<ext>.
  if (!/^[a-f0-9-]{36}\.(jpg|png|webp)$/i.test(nombre)) return null;

  if (destino === "github") {
    const archivo = await leerArchivo(`${CARPETA_GH}/${nombre}`);
    return archivo ? { bytes: archivo.bytes, tipo: tipoDe(nombre) } : null;
  }

  if (destino === "redis") {
    const crudo = (await upstash(`get/${encodeURIComponent(`hdll:foto:${nombre}`)}`)) as
      | string
      | null;
    return crudo ? { bytes: Buffer.from(crudo, "base64"), tipo: tipoDe(nombre) } : null;
  }

  try {
    return { bytes: await fs.readFile(path.join(DIR_UPLOADS, nombre)), tipo: tipoDe(nombre) };
  } catch {
    return null;
  }
}
