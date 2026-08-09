"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  diagramar,
  fotoPrincipal,
  lineaVida,
  NODO_ALTO,
  NODO_ANCHO,
  rolesRespectoA,
  type NodoUbicado,
} from "@/lib/tree";
import { iniciales } from "@/components/Retrato";
import type { Persona } from "@/lib/types";

interface Props {
  personas: Persona[];
  focoId: string;
  onFoco: (id: string) => void;
  onEditar: (id: string) => void;
}

interface Camara {
  x: number;
  y: number;
  k: number;
}

const ESCALA_MIN = 0.2;
const ESCALA_MAX = 2.2;
/** Por debajo de esto los nombres no se leen: antes que encoger, conviene centrar y dejar arrastrar. */
const ESCALA_LEGIBLE = 0.45;
/** Debajo de esto, encuadrar a toda la familia deja las fichas ilegibles. */
const CERCA_MINIMA = 0.7;
/** Zoom cómodo para mirar a alguien de cerca. */
const CERCA_COMODA = 0.9;

/**
 * En SVG no hay `text-overflow`, así que el ajuste se hace a mano: primero se
 * achica la tipografía hasta un piso legible y recién después se recorta. Así
 * un nombre largo como "Florencia Ailem" entra entero en vez de aparecer
 * cortado, que es lo que pasaba antes.
 */
const ANCHO_POR_LETRA = 0.53; // proporción del cuerpo, para esta familia tipográfica

function ajustar(
  texto: string,
  ancho: number,
  cuerpo: number,
  minimo = cuerpo - 2.5,
): { texto: string; cuerpo: number } {
  let tam = cuerpo;
  while (tam > minimo && texto.length * tam * ANCHO_POR_LETRA > ancho) tam -= 0.5;
  const caben = Math.floor(ancho / (tam * ANCHO_POR_LETRA));
  return {
    texto: texto.length > caben ? `${texto.slice(0, Math.max(1, caben - 1))}…` : texto,
    cuerpo: tam,
  };
}

// Geometría interna de la tarjeta.
const FOTO = { x: 14, y: 15, lado: 46 };
const TEXTO_X = FOTO.x + FOTO.lado + 12;
const TEXTO_ANCHO = NODO_ANCHO - TEXTO_X - 14;
const PIE_ANCHO = NODO_ANCHO - 30;


/** Codo redondeado desde el punto de unión de los padres hasta el hijo. */
function caminoFiliacion(x1: number, y1: number, x2: number, y2: number): string {
  if (y2 <= y1) return `M${x1},${y1} L${x2},${y2}`;

  const ym = (y1 + y2) / 2;
  const dx = x2 - x1;
  if (Math.abs(dx) < 1) return `M${x1},${y1} L${x2},${y2}`;

  const dir = Math.sign(dx);
  const r = Math.min(14, Math.abs(dx) / 2, (y2 - y1) / 2);
  return [
    `M${x1},${y1}`,
    `L${x1},${ym - r}`,
    `Q${x1},${ym} ${x1 + dir * r},${ym}`,
    `L${x2 - dir * r},${ym}`,
    `Q${x2},${ym} ${x2},${ym + r}`,
    `L${x2},${y2}`,
  ].join(" ");
}

export default function ArbolVista({
  personas,
  focoId,
  onFoco,
  onEditar,
}: Props) {
  const contenedor = useRef<HTMLDivElement>(null);
  const [camara, setCamara] = useState<Camara>({ x: 0, y: 0, k: 1 });
  const [arrastrando, setArrastrando] = useState(false);
  const ultimo = useRef<{ x: number; y: number } | null>(null);
  const ultimoClic = useRef<{ id: string; cuando: number } | null>(null);
  /** Hubo arrastre en este gesto: el clic final no debe contar como selección. */
  const arrastro = useRef(false);
  /**
   * ¿El usuario ya movió la cámara? Mientras no la haya tocado, el árbol se
   * reencuadra solo —hace falta: los carteles de arriba aparecen y se cierran
   * después del primer render y cambian el alto del lienzo—. En cuanto arrastra,
   * hace zoom o elige a alguien, la cámara pasa a ser suya y no se toca más.
   */
  const camaraTocada = useRef(false);

  // El dibujo ya no depende del foco: cambiar de persona no rearma el árbol ni
  // mueve la cámara, sólo cambia a quién se resalta.
  const diagrama = useMemo(() => diagramar(personas), [personas]);
  const roles = useMemo(() => rolesRespectoA(personas, focoId), [personas, focoId]);

  const porId = useMemo(
    () => new Map(diagrama.nodos.map((n) => [n.id, n])),
    [diagrama],
  );

  // El foco se lee por referencia: encuadrar() no puede depender de él, si no
  // la cámara volvería al encuadre general cada vez que se elige a alguien.
  const focoRef = useRef(focoId);
  useEffect(() => {
    focoRef.current = focoId;
  }, [focoId]);

  /**
   * Encuadra el árbol entero. Si para que entre habría que achicarlo tanto que
   * no se lean los nombres (pasa siempre en el celular), no se achica: se centra
   * en el foco a una escala legible y se navega arrastrando.
   */
  const encuadrar = useCallback(() => {
    const caja = contenedor.current?.getBoundingClientRect();
    if (!caja || !caja.height || !diagrama.nodos.length) return;

    const k = Math.min(1, (caja.width - 32) / diagrama.ancho, (caja.height - 32) / diagrama.alto);

    if (k >= ESCALA_LEGIBLE) {
      setCamara({
        k,
        x: (caja.width - diagrama.ancho * k) / 2,
        y: (caja.height - diagrama.alto * k) / 2,
      });
      return;
    }

    // No entra legible: se centra en el foco. Pero si el alto sí entra —el caso
    // típico del celular, donde sobra sólo el ancho— se centra el árbol entero
    // en vertical, si no queda media pantalla en blanco arriba.
    const legible = caja.width < 720 ? 0.55 : ESCALA_LEGIBLE;
    const foco = focoRef.current ? porId.get(focoRef.current) : undefined;
    const altoEscalado = diagrama.alto * legible;
    setCamara({
      k: legible,
      x: caja.width / 2 - ((foco?.x ?? 0) + NODO_ANCHO / 2) * legible,
      y:
        altoEscalado <= caja.height - 24
          ? (caja.height - altoEscalado) / 2
          : caja.height / 2 - ((foco?.y ?? 0) + NODO_ALTO / 2) * legible,
    });
  }, [diagrama, porId]);

  /**
   * Encuadra a la persona en foco **con su entorno**: padres, pareja, hermanos
   * e hijos. Centrar sólo en la caja deja a la persona flotando en el medio de
   * la nada; lo que uno quiere ver al elegirse a sí mismo es su familia cerca.
   */
  const centrarEnFoco = useCallback(() => {
    const caja = contenedor.current?.getBoundingClientRect();
    const nodo = porId.get(focoId);
    if (!caja || !caja.height || !nodo) return;

    // Sólo la línea directa: padres, pareja e hijos. Los hermanos quedan
    // afuera del cálculo a propósito — sus propias ramas los empujan lejos y
    // meterlos en la caja obligaría a alejar el zoom hasta no leer nada.
    const cerca = new Set<string>([focoId]);
    const persona = personas.find((p) => p.id === focoId);
    if (persona) {
      for (const id of persona.padres) cerca.add(id);
      for (const v of persona.parejas) cerca.add(v.personaId);
      for (const otro of personas) if (otro.padres.includes(focoId)) cerca.add(otro.id);
    }

    const cajas = [...cerca].map((id) => porId.get(id)).filter((n): n is NodoUbicado => !!n);
    const x1 = Math.min(...cajas.map((n) => n.x));
    const x2 = Math.max(...cajas.map((n) => n.x + NODO_ANCHO));
    const y1 = Math.min(...cajas.map((n) => n.y));
    const y2 = Math.max(...cajas.map((n) => n.y + NODO_ALTO));

    const margen = 64;
    const entra = Math.min(
      1,
      (caja.width - margen * 2) / (x2 - x1),
      (caja.height - margen * 2) / (y2 - y1),
    );

    // Si para que entre la familia entera habría que alejarse tanto que no se
    // lea nada —pasa con quien tuvo muchos hijos, repartidos a lo ancho de toda
    // una generación— se prioriza la legibilidad: zoom cómodo, la persona en el
    // centro, y el resto a un arrastre de distancia.
    if (entra < CERCA_MINIMA) {
      const k = CERCA_COMODA;
      setCamara({
        k,
        x: caja.width / 2 - (nodo.x + NODO_ANCHO / 2) * k,
        y: caja.height / 2 - (nodo.y + NODO_ALTO / 2) * k,
      });
      return;
    }

    // El centro tira hacia la persona elegida, no al medio geométrico de su
    // familia: uno se busca para verse a sí mismo, con los suyos alrededor.
    const centroX = ((x1 + x2) / 2 + (nodo.x + NODO_ANCHO / 2)) / 2;
    setCamara({
      k: entra,
      x: caja.width / 2 - centroX * entra,
      y: caja.height / 2 - ((y1 + y2) / 2) * entra,
    });
  }, [focoId, porId, personas]);

  useEffect(() => {
    if (!camaraTocada.current) encuadrar();
  }, [encuadrar, diagrama]);

  /**
   * Al elegir a alguien, el árbol se acomoda para mostrarla con su entorno. Es
   * lo que uno espera al buscarse: verse a uno y a los suyos, no quedar parado
   * en el medio de un dibujo enorme.
   */
  const primerEncuadre = useRef(true);
  useEffect(() => {
    if (primerEncuadre.current) {
      primerEncuadre.current = false;
      return;
    }
    camaraTocada.current = true;
    centrarEnFoco();
    // Sólo al cambiar de persona: recalcular el diagrama no debe mover la cámara.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focoId]);

  // El zoom con rueda se registra a mano: React marca onWheel como pasivo y
  // preventDefault() no tendría efecto (la página haría scroll además de zoom).
  useEffect(() => {
    const el = contenedor.current;
    if (!el) return;
    const alGirar = (e: WheelEvent) => {
      e.preventDefault();
      camaraTocada.current = true;
      const caja = el.getBoundingClientRect();
      const mx = e.clientX - caja.left;
      const my = e.clientY - caja.top;
      setCamara((c) => {
        const k = Math.max(ESCALA_MIN, Math.min(ESCALA_MAX, c.k * Math.exp(-e.deltaY * 0.0015)));
        const razon = k / c.k;
        return { k, x: mx - (mx - c.x) * razon, y: my - (my - c.y) * razon };
      });
    };
    el.addEventListener("wheel", alGirar, { passive: false });
    return () => el.removeEventListener("wheel", alGirar);
  }, []);

  function zoom(factor: number) {
    const caja = contenedor.current?.getBoundingClientRect();
    if (!caja) return;
    camaraTocada.current = true;
    const mx = caja.width / 2;
    const my = caja.height / 2;
    setCamara((c) => {
      const k = Math.max(ESCALA_MIN, Math.min(ESCALA_MAX, c.k * factor));
      const razon = k / c.k;
      return { k, x: mx - (mx - c.x) * razon, y: my - (my - c.y) * razon };
    });
  }

  if (!diagrama.nodos.length) {
    return (
      <div className="lienzo">
        <div className="vacio">Elegí a alguien de la lista para dibujar su árbol.</div>
      </div>
    );
  }

  return (
    <div
      ref={contenedor}
      className={`lienzo${arrastrando ? " arrastrando" : ""}`}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        arrastro.current = false;
        ultimo.current = { x: e.clientX, y: e.clientY };
        // Ojo: la captura del puntero NO se toma acá. Si se toma en el
        // pointerdown, los clics se despachan al contenedor en vez de a la
        // caja de la persona y el doble clic nunca llega al nodo. Se toma
        // recién cuando el gesto se confirma como arrastre.
      }}
      onPointerMove={(e) => {
        if (!ultimo.current) return;
        const dx = e.clientX - ultimo.current.x;
        const dy = e.clientY - ultimo.current.y;
        if (!arrastrando) {
          if (Math.abs(dx) + Math.abs(dy) < 4) return; // todavía puede ser un clic
          arrastro.current = true;
          camaraTocada.current = true;
          setArrastrando(true);
          e.currentTarget.setPointerCapture(e.pointerId);
        }
        ultimo.current = { x: e.clientX, y: e.clientY };
        setCamara((c) => ({ ...c, x: c.x + dx, y: c.y + dy }));
      }}
      onPointerUp={() => {
        ultimo.current = null;
        setArrastrando(false);
      }}
      onPointerCancel={() => {
        ultimo.current = null;
        setArrastrando(false);
      }}
    >
      <svg width="100%" height="100%" role="img" aria-label="Árbol genealógico">
        <g transform={`translate(${camara.x},${camara.y}) scale(${camara.k})`}>
          {diagrama.uniones.map((u) => {
            const enPareja = u.personas.length > 1;
            // Se resalta tanto la unión de la que el foco es parte como aquella
            // de la que proviene: son sus dos vínculos más directos.
            const destacada =
              u.personas.includes(focoId) || u.hijos.includes(focoId);
            return (
              <g key={u.clave} className={`union${destacada ? " destacada" : ""}`}>
                {/* Barra que une a la pareja, con un nudo en el medio. */}
                {enPareja && (
                  <>
                    <path
                      className="enlace pareja"
                      d={`M${u.izquierda},${u.alturaBarra} L${u.derecha},${u.alturaBarra}`}
                    />
                    {u.hijos.length > 0 && (
                      <path
                        className="enlace tronco"
                        d={`M${u.x},${u.alturaBarra} L${u.x},${u.y}`}
                      />
                    )}
                    <circle className="nudo" cx={u.x} cy={u.alturaBarra} r={3.5} />
                  </>
                )}
                {/* Una línea por hijo, saliendo del punto de unión de SUS padres. */}
                {u.hijos.map((idHijo) => {
                  const hijo = porId.get(idHijo);
                  if (!hijo) return null;
                  return (
                    <path
                      key={idHijo}
                      className="enlace filiacion"
                      d={caminoFiliacion(u.x, u.y, hijo.x + NODO_ANCHO / 2, hijo.y)}
                    />
                  );
                })}
              </g>
            );
          })}

          {diagrama.nodos.map((n) => {
            const p = n.persona;
            const linea = lineaVida(p);
            const nombre = ajustar(p.nombres, TEXTO_ANCHO, 14);
            const apellido = ajustar(p.apellidos, TEXTO_ANCHO, 12);
            const pie = ajustar(
              [linea, p.lugarNacimiento].filter(Boolean).join(" · "),
              PIE_ANCHO,
              11.5,
              10,
            );
            const rol = roles.get(n.id) ?? "otro";
            const foto = fotoPrincipal(p);
            return (
              <g
                key={n.id}
                className={`nodo rol-${rol}${p.vivo ? "" : " difunto"}`}
                transform={`translate(${n.x},${n.y})`}
                // El doble clic se detecta a mano en vez de con onDoubleClick:
                // entre medio hay arrastre y captura de puntero, y el evento
                // nativo se pierde según dónde termine el gesto.
                onClick={() => {
                  // Soltar el arrastre encima de una tarjeta no es elegirla:
                  // eso hacía perder el zoom cada vez que uno movía el árbol.
                  if (arrastro.current) return;
                  const ahora = Date.now();
                  const previo = ultimoClic.current;
                  ultimoClic.current = { id: n.id, cuando: ahora };
                  if (previo && previo.id === n.id && ahora - previo.cuando < 400) {
                    ultimoClic.current = null;
                    onEditar(n.id);
                  } else {
                    onFoco(n.id);
                  }
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === "Enter") onEditar(n.id);
                  else if (e.key === " ") {
                    e.preventDefault();
                    onFoco(n.id);
                  }
                }}
              >
                <title>
                  {`${p.nombres} ${p.apellidos}${linea ? ` · ${linea}` : ""} — clic para verla, doble clic para editar`}
                </title>
                <rect className="caja" width={NODO_ANCHO} height={NODO_ALTO} rx={14} />

                {foto ? (
                  <>
                    <clipPath id={`recorte-${n.id}`}>
                      <rect x={FOTO.x} y={FOTO.y} width={FOTO.lado} height={FOTO.lado} rx={FOTO.lado / 2} />
                    </clipPath>
                    <image
                      href={foto}
                      x={FOTO.x}
                      y={FOTO.y}
                      width={FOTO.lado}
                      height={FOTO.lado}
                      preserveAspectRatio="xMidYMid slice"
                      clipPath={`url(#recorte-${n.id})`}
                    />
                  </>
                ) : (
                  <>
                    <circle
                      className="marco-foto"
                      cx={FOTO.x + FOTO.lado / 2}
                      cy={FOTO.y + FOTO.lado / 2}
                      r={FOTO.lado / 2}
                    />
                    <text
                      className="inicial"
                      x={FOTO.x + FOTO.lado / 2}
                      y={FOTO.y + FOTO.lado / 2 + 5}
                      textAnchor="middle"
                    >
                      {iniciales(p)}
                    </text>
                  </>
                )}

                <text className="nombre" x={TEXTO_X} y={36} fontSize={nombre.cuerpo}>
                  {nombre.texto}
                </text>
                <text className="detalle" x={TEXTO_X} y={53} fontSize={apellido.cuerpo}>
                  {apellido.texto}
                </text>

                {pie.texto && (
                  <text className="pie" x={15} y={90} fontSize={pie.cuerpo}>
                    {pie.texto}
                  </text>
                )}

              </g>
            );
          })}
        </g>
      </svg>

      <div className="pista">
        <span>
          <b>Un clic</b> abre la ficha al costado · <b>doble clic</b> la edita
        </span>
        <span>arrastrá para mover · rueda para acercar</span>
        <span>borde punteado = falleció</span>
      </div>

      <div className="controles-lienzo">
        <button className="btn chico" onClick={() => zoom(1.25)} aria-label="Acercar">+</button>
        <button className="btn chico" onClick={() => zoom(0.8)} aria-label="Alejar">−</button>
        <button className="btn chico" onClick={centrarEnFoco}>Mi entorno</button>
        <button
          className="btn chico"
          onClick={() => {
            camaraTocada.current = false;
            encuadrar();
          }}
        >
          Ver todo
        </button>
      </div>
    </div>
  );
}
