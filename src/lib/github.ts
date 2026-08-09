/**
 * Guardar el árbol como un archivo JSON en un repositorio de GitHub.
 *
 * No hay base de datos en este proyecto: el árbol entero es **un documento
 * JSON**. Lo único que hace falta es un lugar donde poder escribirlo, porque el
 * disco de Vercel es de sólo lectura. Un repo de GitHub es exactamente eso —
 * un lugar donde guardar archivos— y trae dos cosas de regalo:
 *
 *  - **historial completo**: cada cambio queda como un commit, con qué cambió y
 *    cuándo. Para un árbol que editan veinte parientes vale más que cualquier
 *    respaldo manual;
 *  - **control de concurrencia de verdad**: GitHub exige mandar el `sha` de la
 *    versión que uno leyó y rechaza la escritura si cambió mientras tanto. Dos
 *    personas guardando al mismo tiempo no se pisan; se reintenta.
 *
 * El repositorio de los datos tiene que ser **privado**: ahí van teléfonos y
 * direcciones de la familia. Conviene que sea uno aparte del código.
 */

/** Se puede apuntar a otro lado para probar el driver sin tocar GitHub. */
const API = process.env.GITHUB_API ?? "https://api.github.com";

export const GH_REPO = process.env.GITHUB_REPO ?? "";
const GH_TOKEN = process.env.GITHUB_TOKEN ?? "";
const GH_RAMA = process.env.GITHUB_RAMA ?? "main";

export function githubConfigurado(): boolean {
  return Boolean(GH_REPO && GH_TOKEN);
}

function cabeceras(): HeadersInit {
  return {
    Authorization: `Bearer ${GH_TOKEN}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export class ConflictoDeVersion extends Error {}

/** Contenido de un archivo del repo, o null si todavía no existe. */
export async function leerArchivo(
  ruta: string,
): Promise<{ bytes: Buffer; sha: string } | null> {
  const res = await fetch(
    `${API}/repos/${GH_REPO}/contents/${encodeURI(ruta)}?ref=${encodeURIComponent(GH_RAMA)}`,
    { headers: cabeceras(), cache: "no-store" },
  );

  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub ${res.status} leyendo ${ruta}: ${await res.text()}`);

  const datos = (await res.json()) as { content?: string; sha: string; size: number };
  // Los archivos de más de 1 MB vienen sin contenido y hay que pedir el blob.
  if (!datos.content) {
    const blob = await fetch(`${API}/repos/${GH_REPO}/git/blobs/${datos.sha}`, {
      headers: cabeceras(),
      cache: "no-store",
    });
    if (!blob.ok) throw new Error(`GitHub ${blob.status} leyendo el blob de ${ruta}`);
    const b = (await blob.json()) as { content: string };
    return { bytes: Buffer.from(b.content, "base64"), sha: datos.sha };
  }
  return { bytes: Buffer.from(datos.content, "base64"), sha: datos.sha };
}

/**
 * Escribe (o crea) un archivo. `sha` es el de la versión que se leyó; si en el
 * medio cambió, GitHub responde 409 y se avisa para reintentar.
 */
export async function escribirArchivo(
  ruta: string,
  bytes: Buffer,
  mensaje: string,
  sha: string | null,
): Promise<string> {
  const res = await fetch(`${API}/repos/${GH_REPO}/contents/${encodeURI(ruta)}`, {
    method: "PUT",
    headers: { ...cabeceras(), "Content-Type": "application/json" },
    body: JSON.stringify({
      message: mensaje,
      content: bytes.toString("base64"),
      branch: GH_RAMA,
      ...(sha ? { sha } : {}),
    }),
  });

  if (res.status === 409 || res.status === 422) {
    throw new ConflictoDeVersion("El archivo cambió mientras tanto.");
  }
  if (!res.ok) throw new Error(`GitHub ${res.status} escribiendo ${ruta}: ${await res.text()}`);

  const datos = (await res.json()) as { content: { sha: string } };
  return datos.content.sha;
}

/**
 * Contenido que tenía un archivo **antes** del último cambio, leyendo el
 * historial del propio repositorio. Es lo que hace posible "deshacer" sin
 * guardar copias aparte: la copia es el commit anterior.
 */
export async function leerVersionAnterior(ruta: string): Promise<Buffer | null> {
  const res = await fetch(
    `${API}/repos/${GH_REPO}/commits?path=${encodeURIComponent(ruta)}&sha=${encodeURIComponent(GH_RAMA)}&per_page=2`,
    { headers: cabeceras(), cache: "no-store" },
  );
  if (!res.ok) return null;

  const commits = (await res.json()) as { sha: string }[];
  if (commits.length < 2) return null;

  const previo = await fetch(
    `${API}/repos/${GH_REPO}/contents/${encodeURI(ruta)}?ref=${commits[1].sha}`,
    { headers: cabeceras(), cache: "no-store" },
  );
  if (!previo.ok) return null;

  const datos = (await previo.json()) as { content: string };
  return Buffer.from(datos.content, "base64");
}
