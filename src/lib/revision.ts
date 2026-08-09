import { anio, fechaOrdenable, hijosDe, indexar, nombreCompleto } from "./tree";
import type { Persona } from "./types";

/**
 * Revisión del árbol entero: en vez de ir descubriendo problemas de a uno
 * mirando fichas, se listan todos juntos, con el arreglo a un clic cuando el
 * dato alcanza para deducirlo.
 *
 * La casuística no es teórica: sale de los errores que aparecen cargando en
 * serio. El más común y el más dañino es cargar a un hijo desde un solo lado de
 * la pareja — rompe hermanos, nietos, tíos y primos de una sola vez.
 */

export type Gravedad = "error" | "aviso" | "sugerencia";

export interface Hallazgo {
  tipo: string;
  gravedad: Gravedad;
  titulo: string;
  detalle: string;
  /** A quién señala; el primero es el protagonista. */
  personas: string[];
}

const ORDEN: Record<Gravedad, number> = { error: 0, aviso: 1, sugerencia: 2 };

function normalizar(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function revisar(personas: Persona[]): Hallazgo[] {
  const ix = indexar(personas);
  const hallazgos: Hallazgo[] = [];
  const anioActual = new Date().getFullYear();

  for (const p of personas) {
    const nombre = nombreCompleto(p);

    // Que a alguien le falte el padre o la madre NO se avisa: puede ser que no
    // se sepa, o que no se quiera cargar. Se completa desde la ficha cuando y
    // si corresponde; el sistema no tiene por qué insistir con datos íntimos.

    // 3. Fechas que no cierran.
    const nace = anio(p.fechaNacimiento);
    const muere = anio(p.fechaFallecimiento);
    if (nace && nace > anioActual) {
      hallazgos.push({
        tipo: "fecha-futura",
        gravedad: "error",
        titulo: `${nombre} figura con fecha de nacimiento futura`,
        detalle: `Nació en ${nace}, que todavía no llegó.`,
        personas: [p.id],
      });
    }
    if (nace && muere && muere < nace) {
      hallazgos.push({
        tipo: "fechas-invertidas",
        gravedad: "error",
        titulo: `${nombre} figura falleciendo antes de nacer`,
        detalle: `Nacimiento ${nace}, fallecimiento ${muere}.`,
        personas: [p.id],
      });
    }
    if (p.vivo && nace && anioActual - nace > 115) {
      hallazgos.push({
        tipo: "edad-improbable",
        gravedad: "aviso",
        titulo: `${nombre} figura viva con ${anioActual - nace} años`,
        detalle: "O falta marcarla como fallecida, o la fecha de nacimiento tiene un error.",
        personas: [p.id],
      });
    }

    for (const idPadre of p.padres) {
      const padre = ix.get(idPadre);
      if (!padre) continue;
      const nacePadre = anio(padre.fechaNacimiento);
      if (!nace || !nacePadre) continue;
      if (nacePadre >= nace) {
        hallazgos.push({
          tipo: "padre-mas-joven",
          gravedad: "error",
          titulo: `${nombreCompleto(padre)} no puede ser padre o madre de ${nombre}`,
          detalle: `Figura naciendo en ${nacePadre} y ${nombre} en ${nace}.`,
          personas: [p.id, padre.id],
        });
      } else if (nace - nacePadre < 12) {
        hallazgos.push({
          tipo: "diferencia-corta",
          gravedad: "aviso",
          titulo: `Sólo ${nace - nacePadre} años entre ${nombreCompleto(padre)} y ${nombre}`,
          detalle: "Puede ser un año mal tipeado en alguna de las dos fichas.",
          personas: [p.id, padre.id],
        });
      }
    }

    // 4. Vínculos que quedaron a medias (no debería pasar: red de seguridad).
    for (const v of p.parejas) {
      const otro = ix.get(v.personaId);
      if (!otro) {
        hallazgos.push({
          tipo: "pareja-inexistente",
          gravedad: "error",
          titulo: `${nombre} apunta a una pareja que ya no existe`,
          detalle: "Se rompió una referencia; volvé a cargar el vínculo.",
          personas: [p.id],
        });
      } else if (!otro.parejas.some((w) => w.personaId === p.id)) {
        hallazgos.push({
          tipo: "pareja-no-reciproca",
          gravedad: "error",
          titulo: `El vínculo entre ${nombre} y ${nombreCompleto(otro)} está cargado de un solo lado`,
          detalle: "Editá y volvé a guardar cualquiera de las dos fichas para emparejarlo.",
          personas: [p.id, otro.id],
        });
      }
    }

    // 5. Personas que no cuelgan de nadie.
    const sinVinculos =
      !p.padres.length && !p.parejas.length && hijosDe(p.id, personas).length === 0;
    if (sinVinculos && personas.length > 1) {
      hallazgos.push({
        tipo: "suelta",
        gravedad: "aviso",
        titulo: `${nombre} está suelta en el árbol`,
        detalle: "No tiene padres, ni pareja, ni hijos cargados: no aparece conectada con nadie.",
        personas: [p.id],
      });
    }

    if (!p.fechaNacimiento) {
      hallazgos.push({
        tipo: "sin-fecha",
        gravedad: "sugerencia",
        titulo: `${nombre} no tiene fecha de nacimiento`,
        detalle: "Con el año alcanza: ordena el árbol y ubica a la persona en su generación.",
        personas: [p.id],
      });
    }
  }

  // 7. Posibles duplicados.
  const porNombre = new Map<string, Persona[]>();
  for (const p of personas) {
    const clave = normalizar(`${p.nombres} ${p.apellidos}`);
    if (!porNombre.has(clave)) porNombre.set(clave, []);
    porNombre.get(clave)!.push(p);
  }
  for (const repetidas of porNombre.values()) {
    if (repetidas.length < 2) continue;
    hallazgos.push({
      tipo: "duplicada",
      gravedad: "aviso",
      titulo: `Hay ${repetidas.length} fichas de ${nombreCompleto(repetidas[0])}`,
      detalle: "Puede ser tocayo o una carga repetida. Si sobra una, conviene pasar los vínculos y borrarla.",
      personas: repetidas.map((p) => p.id),
    });
  }

  return hallazgos.sort(
    (a, b) =>
      ORDEN[a.gravedad] - ORDEN[b.gravedad] ||
      a.tipo.localeCompare(b.tipo) ||
      fechaOrdenable(personas.find((p) => p.id === a.personas[0])?.fechaNacimiento) -
        fechaOrdenable(personas.find((p) => p.id === b.personas[0])?.fechaNacimiento),
  );
}

export function resumen(hallazgos: Hallazgo[]) {
  return {
    /** Lo que hay que mirar sí o sí: errores duros más dudas concretas. */
    pendientes: hallazgos.filter((h) => h.gravedad !== "sugerencia").length,
    errores: hallazgos.filter((h) => h.gravedad === "error").length,
    avisos: hallazgos.filter((h) => h.gravedad === "aviso").length,
    sugerencias: hallazgos.filter((h) => h.gravedad === "sugerencia").length,
  };
}
