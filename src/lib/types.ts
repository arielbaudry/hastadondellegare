/**
 * Modelo de datos de "Hasta dónde llegaré".
 *
 * Regla de oro: sólo se guardan DOS tipos de vínculo, `padres` y `parejas`.
 * Todo lo demás (hijos, nietos, hermanos, tíos, primos, sobrinos) se deriva en
 * `tree.ts`. Así es imposible que quede una relación a medias, del estilo
 * "A dice ser hijo de B, pero B no lista a A".
 */

/** Fecha parcial: "1948", "1948-03" o "1948-03-27". Mucha data vieja es incompleta. */
export type FechaParcial = string;

export type TipoPareja = "casado" | "pareja" | "separado" | "viudo";

export interface Pareja {
  personaId: string;
  tipo: TipoPareja;
  desde?: FechaParcial;
  hasta?: FechaParcial;
}

export interface Persona {
  id: string;

  // Identidad
  nombres: string;
  apellidos: string;
  apodo?: string;
  /**
   * Sólo sirve para nombrar bien los parentescos ("tía abuela" y no "tío/a
   * abuelo/a"), y **no se pregunta en el formulario**: en una familia puede
   * incomodar, y no vale la molestia por una etiqueta. Se cargó una vez para
   * las fichas históricas y quien quiera puede corregirlo por la API. Sin dato,
   * el parentesco se muestra en forma neutra y no pasa nada.
   */
  genero?: "F" | "M";
  /** Apellido de soltera / de nacimiento, si cambió. Clave para rastrear ramas. */
  apellidoNacimiento?: string;
  /**
   * Todas las fotos de la persona; la primera es la que se usa de retrato.
   * Es una lista y no un campo único a propósito: cada pariente sube la que
   * tiene, y ninguna pisa a la anterior.
   */
  fotos: string[];

  // Vida
  fechaNacimiento?: FechaParcial;
  lugarNacimiento?: string;
  vivo: boolean;
  fechaFallecimiento?: FechaParcial;

  // Contacto (opcional, sólo si corresponde)
  celular?: string;
  email?: string;
  direccion?: string;

  notas?: string;

  // Vínculos guardados
  padres: string[];
  parejas: Pareja[];

  // Trazabilidad (sin login: es el nombre que la persona declara al editar)
  creadoPor?: string;
  actualizadoPor?: string;
  creadoEn: string;
  actualizadoEn: string;
}

/** Una línea de la bitácora: quién hizo qué y cuándo. */
export interface Movimiento {
  cuando: string;
  quien: string;
  accion: "entro" | "alta" | "edicion" | "baja" | "deshacer" | "importar";
  detalle?: string;
}

export interface Arbol {
  /** Se incrementa en cada escritura. Sirve para detectar ediciones pisadas. */
  rev: number;
  /** true mientras el contenido sea el del sembrado de ejemplo. */
  esEjemplo: boolean;
  actualizadoEn: string;
  personas: Persona[];
  /**
   * Últimos movimientos, para que se pueda ver quién entró y quién cambió qué.
   * Va dentro del documento del árbol —y no en un archivo aparte— porque viaja
   * con él a donde sea que esté guardado, y se poda para que no crezca sin fin.
   */
  bitacora?: Movimiento[];
}

export const ARBOL_VACIO: Arbol = {
  rev: 0,
  esEjemplo: false,
  actualizadoEn: new Date(0).toISOString(),
  personas: [],
  bitacora: [],
};

/**
 * Campos que el cliente puede mandar al crear o editar.
 *
 * `actualizadoEn` viaja a propósito: es la versión que la persona tenía a la
 * vista, y el servidor la usa para detectar que otro guardó esa misma ficha
 * mientras tanto.
 */
export type PersonaEntrada = Omit<
  Persona,
  "id" | "creadoEn" | "actualizadoEn" | "creadoPor" | "actualizadoPor"
> & {
  id?: string;
  actualizadoEn?: string;
  /**
   * No se guarda: es una instrucción del formulario. Al guardar, esta ficha y
   * esas personas quedan con los mismos padres, que es lo que las vuelve
   * hermanas. Si alguna ya tiene otros cargados, se respetan los suyos.
   */
  hermanosDe?: string[];
  /**
   * Tampoco se guarda acá: los hijos viven en el campo `padres` de cada hijo.
   * Es la lista completa deseada, y al guardar se agrega o se quita esta
   * persona de los padres de cada uno para que quede así.
   */
  hijos?: string[];
};
