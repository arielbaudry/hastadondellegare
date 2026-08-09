import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";

/**
 * Guardado de fotos. Las imágenes ya vienen redimensionadas desde el navegador
 * (ver `redimensionar()` en components/FotoInput.tsx), así que acá no hay
 * procesamiento: sólo se persisten.
 *
 *  - local    -> storage/uploads/<uuid>.<ext>, servidas por /api/fotos/<archivo>
 *  - Vercel   -> Vercel Blob, servidas por su CDN (URL absoluta)
 */

const DIR_UPLOADS = path.join(
  process.env.ARBOL_DIR ?? path.join(process.cwd(), "storage"),
  "uploads",
);
const usaBlob = Boolean(process.env.BLOB_READ_WRITE_TOKEN);

const EXTENSIONES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

export const MAX_BYTES = 3 * 1024 * 1024;

export function tipoAceptado(tipo: string): boolean {
  return tipo in EXTENSIONES;
}

export async function guardarFoto(archivo: File): Promise<string> {
  const ext = EXTENSIONES[archivo.type] ?? "jpg";
  const nombre = `${randomUUID()}.${ext}`;

  if (usaBlob) {
    const { put } = await import("@vercel/blob");
    const { url } = await put(`fotos/${nombre}`, archivo, {
      access: "public",
      contentType: archivo.type,
      addRandomSuffix: false,
    });
    return url;
  }

  await fs.mkdir(DIR_UPLOADS, { recursive: true });
  const bytes = Buffer.from(await archivo.arrayBuffer());
  await fs.writeFile(path.join(DIR_UPLOADS, nombre), bytes);
  return `/api/fotos/${nombre}`;
}

/** Lee una foto local. Devuelve null si no existe o si el nombre es sospechoso. */
export async function leerFotoLocal(
  nombre: string,
): Promise<{ bytes: Buffer; tipo: string } | null> {
  // Sin subcarpetas ni "..": el nombre tiene que ser exactamente <uuid>.<ext>.
  if (!/^[a-f0-9-]{36}\.(jpg|png|webp)$/i.test(nombre)) return null;
  try {
    const bytes = await fs.readFile(path.join(DIR_UPLOADS, nombre));
    const ext = nombre.split(".").pop()!.toLowerCase();
    const tipo = ext === "png" ? "image/png" : ext === "webp" ? "image/webp" : "image/jpeg";
    return { bytes, tipo };
  } catch {
    return null;
  }
}
