import { nombreCompleto } from "./tree";
import type { Persona } from "./types";

/**
 * Llevarse la familia al teléfono: la agenda de contactos y los cumpleaños.
 *
 * Los dos formatos son texto plano y viejísimos —vCard e iCalendar—, y por eso
 * mismo los abre cualquier cosa: el teléfono, Google, Outlook, el iPhone. No
 * hace falta servidor: se arman acá y el navegador los baja.
 */

/** Escapa un valor de vCard: el separador es `;` y hay que respetarlo. */
function vEsc(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

/**
 * Las dos especificaciones piden líneas de hasta 75 octetos, partidas con un
 * espacio al principio de la que sigue. Una dirección larga o un nombre con
 * varios apellidos las pasa, y hay clientes que ahí se plantan.
 */
function plegar(linea: string): string {
  if (linea.length <= 73) return linea;
  const partes = [linea.slice(0, 73)];
  let resto = linea.slice(73);
  while (resto.length > 72) {
    partes.push(` ${resto.slice(0, 72)}`);
    resto = resto.slice(72);
  }
  if (resto) partes.push(` ${resto}`);
  return partes.join("\r\n");
}

function armar(lineas: string[]): string {
  return lineas.map(plegar).join("\r\n") + "\r\n";
}

/** ¿Tiene algo que valga la pena tener en la agenda? */
export function tieneContacto(p: Persona): boolean {
  return Boolean(p.celular || p.email || p.direccion);
}

/**
 * Día y mes del cumpleaños. Hace falta la fecha completa: con "1948" o
 * "1948-03" no hay día que agendar. Y sólo de quienes viven — un recordatorio
 * anual del cumpleaños de alguien que falleció no es un servicio, es un golpe.
 */
export function cumpleDe(p: Persona): { anio: number; mes: number; dia: number } | null {
  if (!p.vivo) return null;
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(p.fechaNacimiento ?? "");
  if (!m) return null;
  const [, a, mes, dia] = m;
  return { anio: Number(a), mes: Number(mes), dia: Number(dia) };
}

/** Agenda de contactos en vCard 3.0, que es la que abre todo. */
export function contactosVcf(personas: Persona[]): string {
  const tarjetas: string[] = [];
  for (const p of personas.filter(tieneContacto)) {
    const lineas = [
      "BEGIN:VCARD",
      "VERSION:3.0",
      `N:${vEsc(p.apellidos)};${vEsc(p.nombres)};;;`,
      `FN:${vEsc(nombreCompleto(p))}`,
    ];
    if (p.apodo) lineas.push(`NICKNAME:${vEsc(p.apodo)}`);
    if (p.celular) lineas.push(`TEL;TYPE=CELL:${vEsc(p.celular)}`);
    if (p.email) lineas.push(`EMAIL;TYPE=INTERNET:${vEsc(p.email)}`);
    if (p.direccion) lineas.push(`ADR;TYPE=HOME:;;${vEsc(p.direccion)};;;;`);
    if (/^\d{4}-\d{2}-\d{2}$/.test(p.fechaNacimiento ?? "")) lineas.push(`BDAY:${p.fechaNacimiento}`);
    lineas.push("NOTE:Del árbol de la familia — hastadondellegare.vercel.app");
    lineas.push("END:VCARD");
    tarjetas.push(armar(lineas));
  }
  return tarjetas.join("");
}

/** Escapa un valor de iCalendar. */
function iEsc(v: string): string {
  return v.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\n/g, "\\n");
}

const dosDigitos = (n: number) => String(n).padStart(2, "0");

/**
 * Calendario de cumpleaños: un evento de día entero por persona, que se repite
 * todos los años y avisa a las 9 de la mañana de ese mismo día.
 */
export function cumplesIcs(personas: Persona[], ahora = new Date()): string {
  const sello = `${ahora.toISOString().replace(/[-:]/g, "").slice(0, 15)}Z`;
  const lineas = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Hasta donde llegare//Cumpleanos//ES",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "X-WR-CALNAME:Cumpleaños de la familia",
  ];

  for (const p of personas) {
    const c = cumpleDe(p);
    if (!c) continue;
    const titulo = `Cumple de ${nombreCompleto(p)} (${c.anio})`;
    // El evento arranca el año en que nació: así el calendario puede mostrar
    // "cumple 51" solo, y la repetición anual hace el resto.
    const inicio = `${c.anio}${dosDigitos(c.mes)}${dosDigitos(c.dia)}`;
    const siguiente = new Date(Date.UTC(c.anio, c.mes - 1, c.dia + 1));
    const fin = `${siguiente.getUTCFullYear()}${dosDigitos(siguiente.getUTCMonth() + 1)}${dosDigitos(siguiente.getUTCDate())}`;

    lineas.push(
      "BEGIN:VEVENT",
      `UID:${p.id}@hastadondellegare`,
      `DTSTAMP:${sello}`,
      `DTSTART;VALUE=DATE:${inicio}`,
      `DTEND;VALUE=DATE:${fin}`,
      "RRULE:FREQ=YEARLY",
      `SUMMARY:${iEsc(titulo)}`,
      `DESCRIPTION:${iEsc(`Nació el ${c.dia}/${c.mes}/${c.anio}. Del árbol de la familia.`)}`,
      // No ocupa la agenda: es un aviso, no una reunión.
      "TRANSP:TRANSPARENT",
      "BEGIN:VALARM",
      "ACTION:DISPLAY",
      // Nueve horas después de la medianoche del día del cumpleaños: avisa esa
      // misma mañana, con tiempo para saludar.
      "TRIGGER;RELATED=START:PT9H",
      `DESCRIPTION:${iEsc(titulo)}`,
      "END:VALARM",
      "END:VEVENT",
    );
  }

  lineas.push("END:VCALENDAR");
  return armar(lineas);
}

/** Baja un texto como archivo. */
export function descargarTexto(nombre: string, contenido: string, tipo: string): void {
  const url = URL.createObjectURL(new Blob([contenido], { type: tipo }));
  const a = document.createElement("a");
  a.href = url;
  a.download = nombre;
  a.click();
  URL.revokeObjectURL(url);
}
