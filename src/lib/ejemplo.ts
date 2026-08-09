import type { Arbol, Persona } from "./types";

/**
 * Familia de ejemplo — personas inventadas, ningún dato real.
 *
 * Existe para que el micrositio se vea funcionando apenas se levanta: tres
 * generaciones hacia arriba, dos hacia abajo, hermanos, tíos y una pareja.
 * Se borra entero desde Ajustes con "Vaciar y empezar de cero".
 */

// Mediodía UTC: así la fecha que se muestra es la misma en cualquier huso.
const SELLO = "2026-01-01T12:00:00.000Z";

type Base = Omit<Persona, "creadoEn" | "actualizadoEn" | "creadoPor" | "parejas" | "fotos"> & {
  parejas?: Persona["parejas"];
  fotos?: string[];
};

function persona(base: Base): Persona {
  return {
    ...base,
    parejas: base.parejas ?? [],
    fotos: base.fotos ?? [],
    creadoPor: "ejemplo",
    creadoEn: SELLO,
    actualizadoEn: SELLO,
  };
}

// ids fijos y legibles: así el sembrado es reproducible y fácil de leer en el JSON
const ID = {
  vicente: "ej-vicente", rosa: "ej-rosa",
  julio: "ej-julio", amanda: "ej-amanda",
  hector: "ej-hector", nelida: "ej-nelida",
  alberto: "ej-alberto", silvia: "ej-silvia", monica: "ej-monica",
  marina: "ej-marina", diego: "ej-diego", pablo: "ej-pablo", laura: "ej-laura",
  tomas: "ej-tomas", julia: "ej-julia",
} as const;

const PERSONAS: Persona[] = [
  // Bisabuelos
  persona({
    id: ID.vicente, nombres: "Vicente", apellidos: "Aguirre",
    fechaNacimiento: "1898-04-12", lugarNacimiento: "Navarra, España",
    vivo: false, fechaFallecimiento: "1971-09-03", padres: [],
    notas: "Llegó a Buenos Aires en 1919. Es la punta más antigua del árbol: de sus padres no sabemos nada todavía.",
    parejas: [{ personaId: ID.rosa, tipo: "casado", desde: "1925" }],
  }),
  persona({
    id: ID.rosa, nombres: "Rosa", apellidos: "Aguirre", apellidoNacimiento: "Etchegaray",
    fechaNacimiento: "1902-11-30", lugarNacimiento: "Tandil, Buenos Aires",
    vivo: false, fechaFallecimiento: "1984-02-17", padres: [],
  }),
  persona({
    id: ID.julio, nombres: "Julio César", apellidos: "Ferrari",
    fechaNacimiento: "1930-01-22", lugarNacimiento: "Rosario, Santa Fe",
    vivo: false, fechaFallecimiento: "1998-06-11", padres: [],
    parejas: [{ personaId: ID.amanda, tipo: "casado", desde: "1956" }],
  }),
  persona({
    id: ID.amanda, nombres: "Amanda", apellidos: "Ferrari", apellidoNacimiento: "Ríos",
    fechaNacimiento: "1934-07-08", lugarNacimiento: "Rosario, Santa Fe",
    vivo: true, padres: [], celular: "+54 9 341 555-0134",
  }),

  // Abuelos
  persona({
    id: ID.hector, nombres: "Héctor Vicente", apellidos: "Aguirre",
    fechaNacimiento: "1928-03-05", lugarNacimiento: "Buenos Aires",
    vivo: false, fechaFallecimiento: "2004-12-28", padres: [ID.vicente, ID.rosa],
    parejas: [{ personaId: ID.nelida, tipo: "casado", desde: "1953" }],
  }),
  persona({
    id: ID.nelida, nombres: "Nélida", apellidos: "Aguirre", apellidoNacimiento: "Sosa",
    fechaNacimiento: "1931-08-19", lugarNacimiento: "Chivilcoy, Buenos Aires",
    vivo: false, fechaFallecimiento: "2010-05-02", padres: [],
  }),

  // Padres y tía
  persona({
    id: ID.alberto, nombres: "Alberto", apellidos: "Aguirre",
    fechaNacimiento: "1955-06-14", lugarNacimiento: "Buenos Aires",
    vivo: true, padres: [ID.hector, ID.nelida],
    celular: "+54 9 11 5555-0102", email: "alberto@ejemplo.test",
    direccion: "Av. Rivadavia 4500, CABA",
    parejas: [{ personaId: ID.silvia, tipo: "casado", desde: "1980-11-15" }],
  }),
  persona({
    id: ID.silvia, nombres: "Silvia Beatriz", apellidos: "Ferrari",
    fechaNacimiento: "1958-02-09", lugarNacimiento: "Rosario, Santa Fe",
    vivo: true, padres: [ID.julio, ID.amanda], email: "silvia@ejemplo.test",
  }),
  persona({
    id: ID.monica, nombres: "Mónica", apellidos: "Aguirre",
    fechaNacimiento: "1959-10-01", lugarNacimiento: "Buenos Aires",
    vivo: true, padres: [ID.hector, ID.nelida],
    notas: "Vive en Córdoba desde 1985.",
  }),

  // Generación del foco
  persona({
    id: ID.marina, nombres: "Marina", apellidos: "Aguirre",
    fechaNacimiento: "1983-05-21", lugarNacimiento: "Buenos Aires",
    vivo: true, padres: [ID.alberto, ID.silvia],
    celular: "+54 9 11 5555-0110", email: "marina@ejemplo.test",
    parejas: [{ personaId: ID.diego, tipo: "casado", desde: "2010-03-20" }],
    notas: "Es el punto de partida del ejemplo: el árbol se dibuja centrado en ella.",
  }),
  persona({
    id: ID.diego, nombres: "Diego", apellidos: "Paz",
    fechaNacimiento: "1981-09-12", lugarNacimiento: "La Plata, Buenos Aires",
    vivo: true, padres: [],
  }),
  persona({
    id: ID.pablo, nombres: "Pablo", apellidos: "Aguirre",
    fechaNacimiento: "1986-01-30", lugarNacimiento: "Buenos Aires",
    vivo: true, padres: [ID.alberto, ID.silvia],
  }),
  persona({
    id: ID.laura, nombres: "Laura", apellidos: "Aguirre",
    fechaNacimiento: "1990-12-04", lugarNacimiento: "Buenos Aires",
    vivo: true, padres: [ID.alberto, ID.silvia],
  }),

  // Nietos
  persona({
    id: ID.tomas, nombres: "Tomás", apellidos: "Paz Aguirre",
    fechaNacimiento: "2012-07-03", lugarNacimiento: "Buenos Aires",
    vivo: true, padres: [ID.marina, ID.diego],
  }),
  persona({
    id: ID.julia, nombres: "Julia", apellidos: "Paz Aguirre",
    fechaNacimiento: "2016-04-26", lugarNacimiento: "Buenos Aires",
    vivo: true, padres: [ID.marina, ID.diego],
  }),
];

export const FOCO_EJEMPLO = ID.marina;

export function arbolDeEjemplo(): Arbol {
  return {
    rev: 0,
    esEjemplo: true,
    actualizadoEn: new Date().toISOString(),
    // copia profunda: el sembrado se puede pedir más de una vez
    personas: JSON.parse(JSON.stringify(PERSONAS)) as Persona[],
  };
}
