const formatSpanishDate = (value) => {
  let date;

  if (!value) {
    date = new Date();
  } else if (value instanceof Date) {
    date = value;
  } else {
    const normalized = String(value).slice(0, 10);
    date = /^\d{4}-\d{2}-\d{2}$/.test(normalized)
      ? new Date(`${normalized}T00:00:00`)
      : new Date(value);
  }

  if (Number.isNaN(date.getTime())) {
    date = new Date();
  }

  return new Intl.DateTimeFormat("es-HN", {
    day: "numeric",
    month: "long",
    year: "numeric"
  }).format(date);
};

export const buildAvisoHtml = (inmueble) => {
  const fecha = formatSpanishDate(inmueble.fecha_aviso);
  const ubicacion = inmueble.barrio_colonia || "__________";
  const clave = inmueble.clave_catastral || "__________";
  const firmante = inmueble.firmante_aviso || "Jefatura de Comercializacion";
  const cargo = inmueble.cargo_firmante || "Aguas de Choluteca";

  return `
    <section class="aviso">
      <div class="aviso-header">
        <p><strong>AGUAS DE CHOLUTECA</strong></p>
        <p>Departamento de Comercializacion</p>
      </div>
      <h2 class="aviso-title">AVISO IMPORTANTE AL ABONADO</h2>
      <p class="aviso-date">Fecha: Choluteca, ${fecha}</p>
      <p class="aviso-saludo">Estimado(a) Senor(a):</p>
      <p class="aviso-body">
        Por medio de la presente, se le informa que, como resultado del reciente
        levantamiento de informacion realizado por la Unidad Tecnica de Catastro,
        se ha identificado que el inmueble ubicado en ${ubicacion}, con Clave
        Catastral ${clave}, no se encuentra registrado en la base de datos de la
        empresa, pese a contar con servicios activos.
      </p>
      <p class="aviso-body">
        Con el proposito de regularizar su situacion, evitar circunstancias
        legales y establecer un acuerdo acorde al caso, se le solicita presentarse
        al Departamento de Comercializacion de Aguas de Choluteca, en un plazo
        maximo de siete (7) dias calendario a partir de la recepcion del presente
        aviso, debiendo presentar la siguiente documentacion:
      </p>
      <ul class="aviso-list">
        <li>Copia de Escritura publica del Inmueble.</li>
        <li>Copia de Constancia Catastral vigente.</li>
        <li>Copia de Documento Nacional de Identificacion (DNI).</li>
        <li>Copia de Permiso de Construccion.</li>
      </ul>
      <p class="aviso-body">
        En caso de no presentarse dentro del plazo indicado, la empresa procedera
        conforme a los lineamientos administrativos establecidos por la ley que
        implican recargos y multas.
      </p>
      <p class="aviso-body">Sin otro particular, agradecemos su pronta colaboracion.</p>
      <p class="aviso-body">Atentamente,</p>
      <div class="aviso-signature">
        <p><strong>${firmante}</strong></p>
        <p>${cargo}</p>
        <p>Aguas de Choluteca</p>
      </div>
      <p class="aviso-copy">C.c. Archivo</p>
    </section>
  `;
};
