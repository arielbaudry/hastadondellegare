import nodemailer from "nodemailer";

/**
 * Envío por SMTP de DAS Latam (Ferozo). Las credenciales van por variables de
 * entorno; nunca en el repositorio.
 */

const HOST = process.env.SMTP_HOST ?? "";
const PUERTO = Number(process.env.SMTP_PORT ?? 465);
const USUARIO = process.env.SMTP_USER ?? "";
const CLAVE = process.env.SMTP_PASS ?? "";
const DESDE = process.env.SMTP_DESDE ?? USUARIO;
const CONTACTO_MAIL = process.env.CONTACTO_EMAIL ?? "ariel@baudry.com.ar";

let transporte: nodemailer.Transporter | null = null;

function obtenerTransporte(): nodemailer.Transporter {
  if (!transporte) {
    transporte = nodemailer.createTransport({
      host: HOST,
      port: PUERTO,
      secure: PUERTO === 465, // 465 es SSL directo; 587 usa STARTTLS
      auth: { user: USUARIO, pass: CLAVE },
    });
  }
  return transporte;
}

const ESTILO_BOTON =
  "display:inline-block;padding:12px 22px;background:#4f46e5;color:#ffffff;" +
  "text-decoration:none;border-radius:10px;font-weight:600;font-size:15px";

export async function enviarEnlaceDeAcceso(
  para: string,
  nombre: string,
  enlace: string,
): Promise<void> {
  const texto = [
    `Hola ${nombre},`,
    "",
    "Entrá al árbol de la familia con este enlace:",
    enlace,
    "",
    "Vale por media hora y es de un solo uso por navegador.",
    "Si no lo pediste vos, ignoralo: sin abrirlo no pasa nada.",
    "",
    "— Hasta dónde llegaré",
  ].join("\n");

  await obtenerTransporte().sendMail({
    from: `"Hasta dónde llegaré" <${DESDE}>`,
    to: para,
    replyTo: CONTACTO_MAIL,
    subject: "Tu acceso al árbol de la familia",
    text: texto,
    html: `
      <div style="font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;
                  max-width:520px;margin:0 auto;color:#0f1219;line-height:1.6">
        <h1 style="font-size:20px;letter-spacing:-0.02em">Hasta dónde llegaré</h1>
        <p>Hola ${nombre}:</p>
        <p>Entrá al árbol de la familia desde acá:</p>
        <p style="margin:26px 0"><a href="${enlace}" style="${ESTILO_BOTON}">Entrar al árbol</a></p>
        <p style="color:#545b6b;font-size:14px">
          El enlace vale por media hora. Si no lo pediste vos, ignoralo — sin abrirlo no
          pasa nada.
        </p>
        <p style="color:#858d9e;font-size:12px;margin-top:32px">
          Si el botón no anda, copiá esta dirección en el navegador:<br />
          <span style="word-break:break-all">${enlace}</span>
        </p>
      </div>`,
  });
}
