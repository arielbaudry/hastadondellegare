import { promises as fs } from "node:fs";
import path from "node:path";
import { ARBOL_VACIO, type Arbol, type Persona } from "./types";

/**
 * Almacenamiento del árbol. Un solo documento JSON, dos drivers:
 *
 *  - `fs`    : desarrollo local -> storage/tree.json (+ backup .bak.json)
 *  - `redis` : producción en Vercel -> Upstash Redis por REST (sin dependencias)
 *
 * Se elige solo: si están las variables de Upstash, usa Redis; si no, disco.
 * El filesystem de Vercel es efímero, así que en producción el driver `fs`
 * perdería todo en cada deploy: por eso el arranque avisa si falta la config.
 */

const CLAVE = process.env.ARBOL_KEY ?? "hastadondellegare:arbol";
/**
 * `ARBOL_DIR` permite levantar una segunda instancia contra otros datos — por
 * ejemplo para probar cambios sobre una copia del árbol real sin tocarlo.
 */
const DIR_STORAGE = process.env.ARBOL_DIR ?? path.join(process.cwd(), "storage");
const ARCHIVO = path.join(DIR_STORAGE, "tree.json");
const BACKUP = path.join(DIR_STORAGE, "tree.bak.json");
const LOG = path.join(DIR_STORAGE, "log.jsonl");

const UPSTASH_URL = process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL;
const UPSTASH_TOKEN =
  process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;

export type Driver = "fs" | "redis";
export const driver: Driver = UPSTASH_URL && UPSTASH_TOKEN ? "redis" : "fs";

export function puedeGuardar(): boolean {
  return driver === "redis" || process.env.VERCEL !== "1";
}

export function estadoAlmacenamiento() {
  return {
    driver,
    persistente: puedeGuardar(),
    advertencia:
      driver === "fs" && process.env.VERCEL === "1"
        ? "Estás en Vercel sin Upstash configurado: el disco es efímero y los datos se pierden en cada deploy. Configurá UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN."
        : null,
  };
}

// ---------------------------------------------------------------- driver: fs

async function leerFs(): Promise<Arbol> {
  try {
    return JSON.parse(await fs.readFile(ARCHIVO, "utf8")) as Arbol;
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code === "ENOENT") return { ...ARBOL_VACIO };
    throw err;
  }
}

/** Error de configuración, no de programa: se muestra tal cual al usuario. */
export class SinPersistencia extends Error {}

async function escribirFs(arbol: Arbol): Promise<void> {
  // El disco de Vercel es de sólo lectura. Antes esto reventaba con un 500 sin
  // cuerpo y el navegador mostraba "Unexpected end of JSON input", que no dice
  // nada. Ahora falla con el motivo y con la instrucción para resolverlo.
  if (process.env.VERCEL === "1") {
    throw new SinPersistencia(
      "Falta configurar Upstash Redis. En Vercel el disco es de sólo lectura, " +
        "así que sin UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN no se puede guardar nada.",
    );
  }
  await fs.mkdir(DIR_STORAGE, { recursive: true });
  // Copia de seguridad de la versión anterior antes de pisarla.
  await fs.copyFile(ARCHIVO, BACKUP).catch(() => {});
  // Escritura atómica: si el proceso muere a mitad, tree.json queda entero.
  const tmp = `${ARCHIVO}.${process.pid}.tmp`;
  await fs.writeFile(tmp, JSON.stringify(arbol, null, 2), "utf8");
  await fs.rename(tmp, ARCHIVO);
}

// ------------------------------------------------------------- driver: redis

async function upstash(comando: string, body?: string): Promise<unknown> {
  const res = await fetch(`${UPSTASH_URL}/${comando}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { Authorization: `Bearer ${UPSTASH_TOKEN}` },
    body,
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Upstash ${comando}: ${res.status} ${await res.text()}`);
  return (await res.json()).result;
}

async function leerRedis(): Promise<Arbol> {
  const crudo = (await upstash(`get/${encodeURIComponent(CLAVE)}`)) as string | null;
  return crudo ? (JSON.parse(crudo) as Arbol) : { ...ARBOL_VACIO };
}

async function escribirRedis(arbol: Arbol): Promise<void> {
  await upstash(`set/${encodeURIComponent(CLAVE)}`, JSON.stringify(arbol));
}

/** Copia de la versión anterior, para poder deshacer. */
async function respaldarRedis(arbol: Arbol): Promise<void> {
  await upstash(`set/${encodeURIComponent(`${CLAVE}:previo`)}`, JSON.stringify(arbol));
}

// ------------------------------------------------------------- API del store

/**
 * Serializa las escrituras dentro de este proceso. No es un lock distribuido:
 * protege del caso real (dos pestañas guardando a la vez contra el mismo
 * servidor), no de dos lambdas simultáneas. Como cada edición toca una sola
 * persona, dos ediciones distintas nunca se pisan entre sí.
 */
let cola: Promise<unknown> = Promise.resolve();

/**
 * Pone al día la forma de los datos guardados antes de que los vea nadie.
 * Corre en cada lectura y es idempotente: sin esto, un árbol cargado con una
 * versión anterior aparecería sin las fotos hasta volver a guardar cada ficha.
 */
function migrar(arbol: Arbol): void {
  for (const p of arbol.personas as (Persona & { fotoUrl?: string })[]) {
    if (!Array.isArray(p.fotos)) p.fotos = p.fotoUrl ? [p.fotoUrl] : [];
    delete p.fotoUrl;
  }
}

export async function leerArbol(): Promise<Arbol> {
  const arbol = driver === "redis" ? await leerRedis() : await leerFs();
  migrar(arbol);
  return arbol;
}

/** Lee, aplica `cambio`, incrementa `rev` y guarda. Devuelve el árbol nuevo. */
export async function mutarArbol(
  cambio: (arbol: Arbol) => void | Promise<void>,
): Promise<Arbol> {
  const paso = cola.then(async () => {
    const arbol = await leerArbol();
    // Se guarda cómo estaba ANTES de tocar nada, para que "deshacer" funcione.
    const antes = JSON.parse(JSON.stringify(arbol)) as Arbol;
    await cambio(arbol);
    arbol.rev += 1;
    arbol.actualizadoEn = new Date().toISOString();
    if (driver === "redis") {
      await respaldarRedis(antes);
      await escribirRedis(arbol);
    } else {
      await escribirFs(arbol);
    }
    return arbol;
  });
  cola = paso.catch(() => {}); // un fallo no debe trabar la cola
  return paso;
}

/**
 * Vuelve a la versión anterior. Sin login cualquiera puede borrar a cualquiera,
 * y un formulario mal guardado se lleva puestos vínculos: un paso atrás siempre
 * disponible vale más que cualquier confirmación.
 */
export async function deshacer(): Promise<Arbol | null> {
  const paso = cola.then(async () => {
    let previo: Arbol | null = null;
    if (driver === "redis") {
      const crudo = (await upstash(`get/${encodeURIComponent(`${CLAVE}:previo`)}`)) as string | null;
      previo = crudo ? (JSON.parse(crudo) as Arbol) : null;
    } else {
      previo = await fs
        .readFile(BACKUP, "utf8")
        .then((t) => JSON.parse(t) as Arbol)
        .catch(() => null);
    }
    if (!previo) return null;

    const actual = await leerArbol();
    // El estado actual pasa a ser "lo anterior": deshacer se puede deshacer.
    const restaurado: Arbol = {
      ...previo,
      rev: actual.rev + 1,
      actualizadoEn: new Date().toISOString(),
    };
    if (driver === "redis") {
      await upstash(`set/${encodeURIComponent(`${CLAVE}:previo`)}`, JSON.stringify(actual));
      await escribirRedis(restaurado);
    } else {
      await fs.writeFile(BACKUP, JSON.stringify(actual, null, 2), "utf8");
      const tmp = `${ARCHIVO}.${process.pid}.tmp`;
      await fs.writeFile(tmp, JSON.stringify(restaurado, null, 2), "utf8");
      await fs.rename(tmp, ARCHIVO);
    }
    return restaurado;
  });
  cola = paso.catch(() => {});
  return paso;
}

export async function guardarArbol(arbol: Arbol): Promise<Arbol> {
  return mutarArbol((actual) => {
    actual.personas = arbol.personas;
    actual.esEjemplo = arbol.esEjemplo;
  });
}

/** Bitácora de ediciones. Sólo en local; en Vercel iría a los logs de la función. */
export async function registrar(evento: Record<string, unknown>): Promise<void> {
  const linea = JSON.stringify({ cuando: new Date().toISOString(), ...evento });
  if (driver === "fs" && process.env.VERCEL !== "1") {
    await fs.mkdir(DIR_STORAGE, { recursive: true });
    await fs.appendFile(LOG, `${linea}\n`, "utf8").catch(() => {});
  } else {
    console.log(`[arbol] ${linea}`);
  }
}
