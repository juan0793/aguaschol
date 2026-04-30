export const pause = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

export const printDocument = async (title, bodyMarkup, options = {}) => {
  const {
    pageSize = "Letter portrait",
    pageMargin = "10mm",
    windowFeatures = "width=980,height=1200",
    bodyClassName = ""
  } = options;
  const printWindow = window.open("", "_blank", windowFeatures);

  if (!printWindow) {
    window.alert("No fue posible abrir la ventana de impresion.");
    return;
  }

  printWindow.document.write(`
    <html lang="es">
      <head>
        <title>${title}</title>
        <style>
          @page {
            size: ${pageSize};
            margin: ${pageMargin};
          }
          body {
            font-family: Arial, sans-serif;
            margin: 0;
            color: #111;
            line-height: 1.2;
            font-size: 11px;
          }
          h1, h2, h3, p { margin: 0 0 6px; }
          .print-header { text-align: center; margin-bottom: 8px; }
          .print-logo {
            width: 62px;
            height: 62px;
            object-fit: contain;
            display: block;
            margin: 0 auto 6px;
          }
          .print-title { text-transform: uppercase; font-weight: 700; font-size: 14px; margin-bottom: 4px; }
          .print-key {
            display: inline-block;
            border: 1px solid #666;
            padding: 4px 10px;
            margin-top: 4px;
            font-weight: 700;
          }
          .print-key-grid {
            display: inline-grid;
            grid-template-columns: repeat(2, minmax(170px, 1fr));
            gap: 6px;
            margin-top: 4px;
          }
          .print-key-grid .print-key {
            display: grid;
            gap: 2px;
            margin-top: 0;
            text-align: left;
          }
          .print-key-grid .print-key strong {
            display: block;
            font-size: 8px;
            text-transform: uppercase;
          }
          .print-key-grid .print-key span {
            display: block;
            font-size: 11px;
          }
          .print-section {
            border: 1px solid #777;
            padding: 7px;
            margin-bottom: 7px;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .print-batch-page {
            break-after: page;
            page-break-after: always;
          }
          .print-batch-page:last-child {
            break-after: auto;
            page-break-after: auto;
          }
          .print-section h3 {
            font-size: 11px;
            margin-bottom: 5px;
            text-transform: uppercase;
          }
          .print-grid {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 6px;
          }
          .print-field {
            border-bottom: 1px solid #bbb;
            padding-bottom: 3px;
            min-height: 24px;
          }
          .print-field strong {
            display: block;
            font-size: 9px;
            text-transform: uppercase;
            margin-bottom: 2px;
          }
          .print-photo {
            margin-top: 8px;
            width: 100%;
            max-height: 190px;
            object-fit: contain;
            object-position: center;
            border: 1px solid #999;
            border-radius: 8px;
            background: #fff;
          }
          .print-roles {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 16px;
            margin-top: 28px;
            text-align: center;
          }
          .print-signature-line {
            border-top: 1px solid #444;
            padding-top: 14px;
            min-height: 72px;
          }
          .print-signature-line strong {
            font-size: 10px;
            display: block;
            margin-bottom: 10px;
          }
          .print-ficha {
            max-width: 100%;
            padding-left: 0;
            color: #142b3d;
            font-size: 9.5px;
          }
          .print-ficha p {
            margin-bottom: 3px;
          }
          .print-ficha .print-header {
            margin-bottom: 6px;
          }
          .print-ficha .print-ficha-compact-header {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(330px, 0.76fr);
            gap: 7px;
            align-items: center;
            border: 1px solid #a9c3d7;
            border-left: 6px solid #0d4d86;
            border-radius: 8px;
            background: linear-gradient(180deg, #f8fcff 0%, #eef6fb 100%);
            padding: 6px 8px;
            margin-bottom: 6px;
          }
          .print-ficha .print-ficha-brand {
            display: grid;
            grid-template-columns: 46px minmax(0, 1fr);
            gap: 7px;
            align-items: center;
          }
          .print-ficha .print-ficha-brand p,
          .print-ficha .print-ficha-brand span {
            margin: 0;
          }
          .print-ficha .print-ficha-brand span {
            color: #36556f;
            font-size: 9px;
          }
          .print-ficha .print-logo {
            width: 44px;
            height: 44px;
            margin-bottom: 0;
          }
          .print-ficha .print-title {
            font-size: 12.5px;
            margin-bottom: 2px;
            color: #0d3f6a;
          }
          .print-ficha .print-key {
            padding: 4px 7px;
            margin-top: 0;
            font-size: 9.5px;
            border: 1px solid #b8ccda;
            border-radius: 6px;
            background: #fff;
          }
          .print-ficha .print-key-grid {
            margin-top: 3px;
            gap: 5px;
          }
          .print-ficha .print-clandestine-band {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 7px;
            border: 1px solid #c8d5df;
            border-radius: 7px;
            background: #f7fbff;
            padding: 5px 7px;
            margin-bottom: 6px;
          }
          .print-ficha .print-clandestine-band.is-clandestine {
            border-color: #9b202d;
            background: #fff1f2;
          }
          .print-ficha .print-clandestine-band.is-matched {
            border-color: #9bc9ad;
            background: #f0fbf5;
          }
          .print-ficha .print-clandestine-band strong,
          .print-ficha .print-clandestine-band span {
            display: block;
          }
          .print-ficha .print-clandestine-band strong {
            font-size: 10px;
            text-transform: uppercase;
          }
          .print-ficha .print-clandestine-band span {
            font-size: 9px;
            color: #4b647a;
          }
          .print-ficha .print-section {
            padding: 5px 6px;
            margin-bottom: 5px;
            border-color: #bacbd8;
            border-radius: 7px;
            background: #fff;
          }
          .print-ficha .print-layout {
            display: grid;
            gap: 6px;
          }
          .print-ficha .print-top-layout {
            display: grid;
            grid-template-columns: minmax(0, 1.7fr) minmax(220px, 0.55fr);
            gap: 6px;
            align-items: start;
          }
          .print-ficha .print-main-column,
          .print-ficha .print-side-column {
            display: grid;
            gap: 5px;
          }
          .print-ficha .print-section h3 {
            font-size: 8px;
            margin-bottom: 4px;
            color: #0d4d86;
            letter-spacing: 0.06em;
            border-bottom: 1px solid #d8e6f0;
            padding-bottom: 2px;
          }
          .print-ficha .print-section-feature {
            background: #f8fbff;
          }
          .print-ficha .print-grid {
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 4px 8px;
          }
          .print-ficha .print-summary-grid,
          .print-ficha .print-data-grid,
          .print-ficha .print-service-row {
            display: grid;
            gap: 4px;
          }
          .print-ficha .print-summary-grid,
          .print-ficha .print-data-grid {
            grid-template-columns: repeat(3, minmax(0, 1fr));
          }
          .print-ficha .print-data-grid.is-four {
            grid-template-columns: repeat(4, minmax(0, 1fr));
          }
          .print-ficha .print-service-row {
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 5px;
          }
          .print-ficha .print-summary-grid div,
          .print-ficha .print-data-grid div,
          .print-ficha .print-service-row div,
          .print-ficha .print-note {
            border: 1px solid #d5e2ec;
            border-radius: 6px;
            background: #fff;
          }
          .print-ficha .print-summary-grid div,
          .print-ficha .print-data-grid div,
          .print-ficha .print-service-row div {
            min-height: 24px;
            padding: 4px 5px;
          }
          .print-ficha .print-summary-grid strong,
          .print-ficha .print-data-grid strong,
          .print-ficha .print-service-row strong {
            display: block;
            margin-bottom: 2px;
            color: #506a80;
            font-size: 7px;
            line-height: 1.1;
            text-transform: uppercase;
          }
          .print-ficha .print-summary-grid span,
          .print-ficha .print-data-grid span,
          .print-ficha .print-service-row span {
            display: block;
            color: #142f45;
            font-size: 9.5px;
            font-weight: 700;
            line-height: 1.2;
          }
          .print-ficha .print-data-grid .is-wide {
            grid-column: span 3;
          }
          .print-ficha .print-note {
            min-height: 30px;
            margin: 0;
            padding: 5px 6px;
            line-height: 1.25;
          }
          .print-ficha .print-field {
            min-height: 18px;
            padding-bottom: 2px;
            font-size: 10px;
          }
          .print-ficha .print-field strong {
            font-size: 8px;
            margin-bottom: 1px;
          }
          .print-ficha .print-photo {
            margin-top: 0;
            height: 170px;
            max-height: 170px;
            border-radius: 6px;
          }
          .print-ficha .print-photo-panel {
            display: grid;
            gap: 5px;
          }
          .print-ficha .print-photo-label {
            font-size: 10px;
            font-weight: 700;
            text-transform: uppercase;
            margin-bottom: 0;
          }
          .print-ficha .print-roles {
            gap: 14px;
            margin-top: 4px;
          }
          .print-ficha .print-signature-line {
            min-height: 52px;
            padding-top: 10px;
          }
          .print-ficha .print-signature-line strong {
            margin-bottom: 7px;
            line-height: 1.25;
          }
          .aviso {
            max-width: 184mm;
            margin: 0 auto;
            padding: 6mm 4mm 0;
            font-family: Arial, Helvetica, sans-serif;
            font-size: 12.4px;
            line-height: 1.55;
            color: #101827;
          }
          .aviso-header, .aviso-title, .aviso-signature, .aviso-copy {
            text-align: center;
          }
          .aviso-header p, .aviso-title, .aviso-copy {
            margin-bottom: 10px;
          }
          .aviso-header p {
            font-size: 12px;
            line-height: 1.35;
          }
          .aviso-header strong {
            font-size: 15px;
            letter-spacing: 0.02em;
          }
          .aviso-title {
            margin-top: 10px;
            margin-bottom: 18px;
            font-size: 22px;
            line-height: 1.18;
            letter-spacing: 0;
          }
          .aviso-date, .aviso-saludo {
            text-align: left;
            margin-bottom: 16px;
          }
          .aviso-body, .aviso-list li {
            text-align: justify;
            line-height: 1.58;
            font-size: 12.4px;
          }
          .aviso-list {
            margin: 10px 0 20px 34px;
            padding-left: 12px;
          }
          .aviso-list li {
            margin-bottom: 8px;
          }
          .aviso-signature {
            margin-top: 48px;
          }
          .aviso-signature p {
            margin-bottom: 9px;
          }
          .field-report-body {
            background: #f7fbff;
            color: #16324a;
          }
          .field-report-shell {
            display: grid;
            gap: 10px;
          }
          .field-report-header {
            border: 1px solid #c7dcef;
            background: linear-gradient(180deg, #ffffff, #eef6fc);
            border-radius: 14px;
            padding: 10px 12px;
          }
          .field-report-brand {
            display: grid;
            grid-template-columns: 72px minmax(0, 1fr);
            gap: 10px;
            align-items: center;
          }
          .field-report-kicker,
          .field-report-zone-kicker {
            text-transform: uppercase;
            letter-spacing: 0.08em;
            font-size: 9px;
            font-weight: 700;
            color: #315b7d;
          }
          .field-report-header h1 {
            font-size: 18px;
            margin-bottom: 4px;
          }
          .field-report-meta {
            margin-top: 8px;
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
          }
          .field-report-meta span,
          .field-report-total-chip {
            border: 1px solid #d2e4f3;
            background: #ffffff;
            border-radius: 999px;
            padding: 4px 8px;
          }
          .field-report-summary {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
          }
          .field-report-cover {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(300px, 380px);
            gap: 12px;
            border: 1px solid #c7dcef;
            border-radius: 16px;
            background: linear-gradient(180deg, #ffffff, #eef6fc);
            padding: 12px;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .field-report-cover-copy h2 {
            font-size: 16px;
            margin-bottom: 5px;
          }
          .field-report-cover-copy p {
            margin-bottom: 8px;
          }
          .field-report-cover-metrics {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 8px;
            margin: 10px 0;
          }
          .field-report-cover-metrics div {
            border: 1px solid #d2e4f3;
            background: #ffffff;
            border-radius: 12px;
            padding: 7px 8px;
          }
          .field-report-cover-metrics strong {
            display: block;
            font-size: 9px;
            text-transform: uppercase;
            color: #315b7d;
            margin-bottom: 3px;
          }
          .field-report-cover-metrics span {
            display: block;
            font-size: 14px;
            font-weight: 700;
            color: #16324a;
          }
          .field-report-cover-map {
            display: grid;
            align-items: stretch;
          }
          .field-report-map-image,
          .field-report-map-fallback {
            width: 100%;
            min-height: 220px;
            height: 100%;
            border: 1px solid #d2e4f3;
            border-radius: 14px;
            background: #edf3f9;
          }
          .field-report-map-image {
            object-fit: cover;
          }
          .field-report-map-fallback {
            display: grid;
            place-items: center;
            text-align: center;
            padding: 12px;
            font-size: 10px;
            color: #45607a;
          }
          .field-report-staff {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
            margin-top: 10px;
          }
          .field-report-staff div {
            border: 1px solid #d2e4f3;
            background: #ffffff;
            border-radius: 12px;
            padding: 7px 9px;
          }
          .field-report-staff strong {
            display: block;
            margin-bottom: 3px;
            font-size: 9px;
            text-transform: uppercase;
            color: #315b7d;
          }
          .field-report-staff span {
            display: block;
            font-size: 10px;
          }
          .field-report-total-chip strong {
            margin-right: 6px;
          }
          .field-report-zone {
            border: 1px solid #c7dcef;
            border-radius: 14px;
            background: #ffffff;
            padding: 10px;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .field-report-zone-head {
            display: flex;
            justify-content: space-between;
            gap: 10px;
            margin-bottom: 8px;
            align-items: flex-start;
          }
          .field-report-zone-head h3 {
            font-size: 13px;
            margin-bottom: 2px;
          }
          .field-report-zone-meta {
            display: grid;
            gap: 4px;
            text-align: right;
            font-size: 10px;
          }
          .field-report-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }
          .field-report-table th,
          .field-report-table td {
            border: 1px solid #d8e7f4;
            padding: 5px 6px;
            text-align: left;
            vertical-align: top;
            word-break: break-word;
          }
          .field-report-table th {
            background: #edf5fc;
            font-size: 9px;
            text-transform: uppercase;
          }
          .field-report-table td {
            font-size: 9.5px;
          }
          .field-report-empty {
            border: 1px dashed #c7dcef;
            border-radius: 14px;
            padding: 16px;
            background: #fff;
          }
          .field-report-page {
            position: fixed;
            right: 0;
            bottom: 0;
            left: 0;
            text-align: right;
            padding: 0 8mm 2mm;
            font-size: 10px;
            color: #45607a;
          }
          .field-report-page::after {
            content: "Pagina " counter(page);
          }
          .request-report-shell {
            display: grid;
            gap: 10px;
          }
          .request-report-header {
            border: 1px solid #cfe1f1;
            border-radius: 12px;
            padding: 10px;
            background: linear-gradient(180deg, #f8fcff 0%, #eef6fd 100%);
          }
          .request-report-brand {
            display: flex;
            align-items: center;
            gap: 10px;
          }
          .request-report-brand h1 {
            margin: 0 0 4px;
            font-size: 16px;
          }
          .request-report-brand p {
            margin: 0;
            color: #4a657d;
          }
          .request-report-summary {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 8px;
            margin-top: 10px;
          }
          .request-report-summary div {
            border: 1px solid #d6e5f2;
            border-radius: 10px;
            padding: 8px;
            background: rgba(255,255,255,0.85);
          }
          .request-report-summary strong {
            display: block;
            margin-bottom: 4px;
            font-size: 9px;
            text-transform: uppercase;
            color: #5a748b;
          }
          .request-report-summary span {
            font-size: 12px;
            font-weight: 700;
            color: #123b5d;
          }
          .request-report-keywords {
            margin-top: 8px;
            color: #30506c;
          }
          .request-report-zone {
            border: 1px solid #d5e4f1;
            border-radius: 12px;
            padding: 8px;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .request-report-zone-head {
            display: flex;
            align-items: flex-start;
            justify-content: space-between;
            gap: 10px;
            margin-bottom: 6px;
          }
          .request-report-zone-meta {
            display: flex;
            flex-wrap: wrap;
            gap: 6px;
            justify-content: flex-end;
          }
          .request-report-zone-meta span {
            border-radius: 999px;
            padding: 4px 8px;
            background: #edf6ff;
            border: 1px solid #d4e4f1;
            color: #1f4e79;
            font-weight: 700;
          }
          .request-report-table {
            width: 100%;
            border-collapse: collapse;
            table-layout: fixed;
          }
          .request-report-table th,
          .request-report-table td {
            border: 1px solid #dbe5ee;
            padding: 6px;
            vertical-align: top;
            word-break: break-word;
          }
          .request-report-table th {
            background: #edf6ff;
            font-size: 9px;
            text-transform: uppercase;
            color: #33597a;
          }
          .request-report-empty {
            border: 1px dashed #c5d7e6;
            border-radius: 12px;
            padding: 14px;
            text-align: center;
            color: #557089;
          }
          .lookup-report-body {
            background: #f7fbff;
            color: #16324a;
          }
          .lookup-report-shell {
            display: grid;
            gap: 12px;
          }
          .lookup-report-header {
            border: 1px solid #d1e2f0;
            border-radius: 14px;
            padding: 12px;
            background: linear-gradient(180deg, #f8fcff 0%, #eef6fd 100%);
          }
          .lookup-report-brand {
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .lookup-report-brand h1 {
            margin: 0 0 4px;
            font-size: 17px;
          }
          .lookup-report-brand p {
            margin: 0;
            color: #4a657d;
          }
          .lookup-report-key {
            margin-top: 10px;
            display: inline-flex;
            align-items: center;
            min-height: 32px;
            padding: 4px 10px;
            border-radius: 999px;
            border: 1px solid #d2e4f3;
            background: #ffffff;
            font-weight: 700;
            color: #123b5d;
          }
          .lookup-report-section {
            border: 1px solid #d5e4f1;
            border-radius: 14px;
            padding: 10px;
            background: #ffffff;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .lookup-report-section h2 {
            margin: 0 0 8px;
            font-size: 12px;
            text-transform: uppercase;
            color: #315b7d;
            letter-spacing: 0.06em;
          }
          .lookup-report-grid,
          .lookup-report-balance-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
          }
          .lookup-report-grid div,
          .lookup-report-balance-grid div {
            border: 1px solid #d8e7f4;
            border-radius: 12px;
            padding: 8px 9px;
            background: #f8fbff;
          }
          .lookup-report-grid strong,
          .lookup-report-balance-grid strong,
          .lookup-report-service strong,
          .lookup-report-formula strong {
            display: block;
            margin-bottom: 3px;
            font-size: 9px;
            text-transform: uppercase;
            color: #5a748b;
          }
          .lookup-report-grid span,
          .lookup-report-balance-grid span,
          .lookup-report-service span,
          .lookup-report-formula span {
            display: block;
            font-size: 12px;
            font-weight: 700;
            color: #123b5d;
          }
          .lookup-report-balance-grid .is-total {
            background: #edf6ff;
            border-color: #c8ddf0;
          }
          .lookup-report-balance-grid .is-total span {
            color: #9b202d;
          }
          .lookup-report-formula {
            margin-top: 8px;
            border: 1px solid #d8e7f4;
            border-radius: 12px;
            padding: 8px 9px;
            background: #f5f9fd;
          }
          .lookup-report-service-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
          }
          .lookup-report-service {
            border: 1px solid #d8e7f4;
            border-radius: 12px;
            padding: 8px 9px;
            background: #f8fbff;
          }
          .lookup-report-service.is-yes {
            background: #edf8f3;
            border-color: #cbe9d8;
          }
          .lookup-report-service.is-no {
            background: #f4f7fb;
            border-color: #d8e3ed;
          }
          .lookup-report-service.is-unknown {
            background: #fff9e9;
            border-color: #f0dfaa;
          }
          ul { margin-top: 0; }
          @media print {
            body { margin: 0; }
          }
        </style>
      </head>
      <body class="${bodyClassName}">${bodyMarkup}<div class="field-report-page"></div></body>
    </html>
      `);
  printWindow.document.close();

  const images = Array.from(printWindow.document.images);
  await Promise.all(
    images.map(
      (image) =>
        new Promise((resolve) => {
          if (image.complete) {
            resolve();
            return;
          }

          image.onload = () => resolve();
          image.onerror = () => resolve();
        })
    )
  );

  printWindow.focus();
  printWindow.print();
};
