import { env } from "../config/env.js";

const buildTemporaryPasswordHtml = ({ fullName, username, email, password, title, intro }) => `
  <div style="font-family: Arial, sans-serif; color: #17324a; line-height: 1.5;">
    <h2>${title}</h2>
    <p>Hola ${fullName},</p>
    <p>${intro}</p>
    <p><strong>Usuario:</strong> ${username}</p>
    <p><strong>Correo:</strong> ${email}</p>
    <p><strong>Contrasena temporal:</strong> ${password}</p>
    <p>Te recomendamos ingresar y cambiar esta contrasena cuanto antes.</p>
    <p>Aguas de Choluteca</p>
  </div>
`;

const sendTemporaryPasswordEmail = async ({ fullName, username, email, password, subject, title, intro }) => {
  if (!env.emailApiKey || !env.emailFrom) {
    return {
      sent: false,
      provider: env.emailProvider,
      skipped: true,
      reason: "Faltan EMAIL_API_KEY o EMAIL_FROM en el entorno."
    };
  }

  if (env.emailProvider !== "brevo") {
    throw new Error(`Proveedor de correo no soportado: ${env.emailProvider}`);
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "api-key": env.emailApiKey,
      ...(env.emailSandbox ? { "X-Sib-Sandbox": "drop" } : {})
    },
    body: JSON.stringify({
      sender: {
        name: env.emailFromName,
        email: env.emailFrom
      },
      to: [
        {
          email,
          name: fullName
        }
      ],
      subject,
      htmlContent: buildTemporaryPasswordHtml({ fullName, username, email, password, title, intro })
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    const error = new Error("No fue posible enviar el correo de bienvenida.");
    error.status = 502;
    error.details = errorText;
    throw error;
  }

  const data = await response.json();
  return {
    sent: true,
    provider: "brevo",
    sandbox: env.emailSandbox,
    messageId: data.messageId ?? null
  };
};

export const sendUserCreatedEmail = async ({ fullName, username, email, password }) =>
  sendTemporaryPasswordEmail({
    fullName,
    username,
    email,
    password,
    subject: "Usuario creado satisfactoriamente",
    title: "Usuario creado satisfactoriamente",
    intro: "Se te ha creado un usuario para acceder al sistema de inmuebles clandestinos."
  });

export const sendPasswordResetEmail = async ({ fullName, username, email, password }) =>
  sendTemporaryPasswordEmail({
    fullName,
    username,
    email,
    password,
    subject: "Contrasena temporal restablecida",
    title: "Contrasena temporal restablecida",
    intro: "Se ha generado una nueva contrasena temporal para tu acceso al sistema de inmuebles clandestinos."
  });
