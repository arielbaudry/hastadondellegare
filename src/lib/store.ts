import { promises as fs } from "node:fs";
import path from "node:path";
import { ARBOL_VACIO, type Arbol, type Movimiento, type Persona } from "./types";
import { nombreCanonico } from "./coincidencias";
import {
  ConflictoDeVersion,
  escribirArchivo,
  githubConfigurado,
  leerArchivo,
  leerVersionAnterior,
} from "./github";

/**
 * Almacenamiento del árbol. **Acá no hay base de datos**: el árbol entero es un
 * único documento JSON. Lo único que cambia es dónde se guarda ese archivo:
 *
 *  - `github`: un JSON en un repositorio privado. Trae historial de cada cambio
 *              y control de concurrencia real (ver `github.ts`).
 *  - `redis` : Upstash por REST, si se prefiere.
 *  - `fs`    : disco, en desarrollo local -> storage/tree.json (+ .bak.json)
 *
 * Se elige solo, en ese orden. En Vercel hace falta uno de los dos primeros
 * porque su disco es de sólo lectura; el arranque avisa si no hay ninguno.
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

export type Driver = "fs" | "redis" | "github";
export const driver: Driver = githubConfigurado()
  ? "github"
  : UPSTASH_URL && UPSTASH_TOKEN
    ? "redis"
    : "fs";

const NOMBRES: Record<Driver, string> = {
  github: "archivo JSON en GitHub",
  redis: "Redis (Upstash)",
  fs: "disco local",
};
export const nombreDriver = NOMBRES[driver];

export function puedeGuardar(): boolean {
  return driver !== "fs" || process.env.VERCEL !== "1";
}

export function estadoAlmacenamiento() {
  return {
    driver: nombreDriver,
    persistente: puedeGuardar(),
    advertencia:
      driver === "fs" && process.env.VERCEL === "1"
        ? "En Vercel el disco es de sólo lectura, así que no se puede guardar nada. Configurá GITHUB_REPO y GITHUB_TOKEN para que el árbol viva como un JSON en un repositorio privado, o UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN."
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

// ------------------------------------------------------------ driver: github

const RUTA_ARBOL = process.env.GITHUB_ARCHIVO ?? "arbol.json";
/** sha de la versión leída, para que GitHub detecte escrituras pisadas. */
let shaArbol: string | null = null;

async function leerGithub(): Promise<Arbol> {
  const archivo = await leerArchivo(RUTA_ARBOL);
  if (!archivo) {
    shaArbol = null;
    return { ...ARBOL_VACIO };
  }
  shaArbol = archivo.sha;
  return JSON.parse(archivo.bytes.toString("utf8")) as Arbol;
}

async function escribirGithub(arbol: Arbol, resumen: string): Promise<void> {
  shaArbol = await escribirArchivo(
    RUTA_ARBOL,
    Buffer.from(JSON.stringify(arbol, null, 2), "utf8"),
    resumen,
    shaArbol,
  );
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
const MAX_BITACORA = 300;

/** Cuántos movimientos firmó cada nombre. Sirve para desempatar homónimos. */
function actividadEn(arbol: Arbol): Map<string, number> {
  const cuenta = new Map<string, number>();
  for (const m of arbol.bitacora ?? []) cuenta.set(m.quien, (cuenta.get(m.quien) ?? 0) + 1);
  return cuenta;
}

/** Suma un movimiento a la bitácora del árbol, podando lo más viejo. */
export function anotar(arbol: Arbol, m: Omit<Movimiento, "cuando">): void {
  if (!Array.isArray(arbol.bitacora)) arbol.bitacora = [];
  arbol.bitacora.unshift({
    cuando: new Date().toISOString(),
    ...m,
    quien: nombreCanonico(m.quien, arbol.personas, actividadEn(arbol)),
  });
  arbol.bitacora = arbol.bitacora.slice(0, MAX_BITACORA);
}

function migrar(arbol: Arbol): void {
  if (!Array.isArray(arbol.bitacora)) arbol.bitacora = [];
  // Movimientos viejos firmados de distintas maneras por la misma persona. Se
  // resuelve una vez por nombre distinto —son un puñado— y no 300 veces.
  //
  // Dos pasadas: la primera resuelve los nombres que no dejan dudas y así se
  // sabe quiénes editan de verdad; con eso, la segunda puede desempatar los
  // ambiguos ("Ariel", habiendo dos Arieles en la familia).
  const distintos = new Map<string, number>();
  for (const m of arbol.bitacora) distintos.set(m.quien, (distintos.get(m.quien) ?? 0) + 1);

  const actividad = new Map<string, number>();
  for (const [nombre, cuantos] of distintos) {
    const bueno = nombreCanonico(nombre, arbol.personas);
    actividad.set(bueno, (actividad.get(bueno) ?? 0) + cuantos);
  }

  const resueltos = new Map<string, string>();
  for (const nombre of distintos.keys()) {
    resueltos.set(nombre, nombreCanonico(nombre, arbol.personas, actividad));
  }
  for (const m of arbol.bitacora) m.quien = resueltos.get(m.quien) ?? m.quien;
  for (const p of arbol.personas as (Persona & { fotoUrl?: string })[]) {
    if (!Array.isArray(p.fotos)) p.fotos = p.fotoUrl ? [p.fotoUrl] : [];
    delete p.fotoUrl;
  }
}

export async function leerArbol(): Promise<Arbol> {
  const arbol =
    driver === "github" ? await leerGithub() : driver === "redis" ? await leerRedis() : await leerFs();
  migrar(arbol);
  return arbol;
}

/** Lee, aplica `cambio`, incrementa `rev` y guarda. Devuelve el árbol nuevo. */
export async function mutarArbol(
  cambio: (arbol: Arbol) => void | Promise<void>,
  resumen = "Actualiza el árbol",
): Promise<Arbol> {
  const paso = cola.then(async () => {
    // Con GitHub la escritura puede rebotar si otro guardó en el medio: se
    // vuelve a leer y se aplica el cambio sobre la versión nueva. Es el mismo
    // reintento de siempre, pero acá el conflicto se detecta de verdad en vez
    // de que gane el último que escribe.
    for (let intento = 0; ; intento++) {
      const arbol = await leerArbol();
      const antes = JSON.parse(JSON.stringify(arbol)) as Arbol;
      await cambio(arbol);
      arbol.rev += 1;
      arbol.actualizadoEn = new Date().toISOString();

      try {
        if (driver === "github") await escribirGithub(arbol, resumen);
        else if (driver === "redis") {
          await respaldarRedis(antes);
          await escribirRedis(arbol);
        } else await escribirFs(arbol);
        return arbol;
      } catch (err) {
        if (!(err instanceof ConflictoDeVersion) || intento >= 3) throw err;
        shaArbol = null; // fuerza releer la versión buena
      }
    }
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
    if (driver === "github") {
      // La copia anterior es el commit anterior: no hace falta guardar nada.
      const bytes = await leerVersionAnterior(RUTA_ARBOL);
      previo = bytes ? (JSON.parse(bytes.toString("utf8")) as Arbol) : null;
    } else if (driver === "redis") {
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
    if (driver === "github") {
      await escribirGithub(restaurado, "Deshace el último cambio");
    } else if (driver === "redis") {
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
