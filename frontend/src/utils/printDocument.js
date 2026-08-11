export const pause = (ms) => new Promise((resolve) => window.setTimeout(resolve, ms));

const escapeTitle = (value) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const buildPrintHtml = (title, bodyMarkup, options) => {
  const {
    pageSize = "Letter portrait",
    pageMargin = "10mm",
    bodyClassName = "",
    showPageFooter = false
  } = options;

  return `
    <html lang="es">
      <head>
        <title>${escapeTitle(title)}</title>
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
          .field-report-notes {
            border: 1px solid #d2e4f3;
            background: #ffffff;
            border-radius: 12px;
            padding: 8px 10px;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .field-report-notes strong {
            display: block;
            color: #16324a;
            margin-bottom: 3px;
            font-size: 10px;
            text-transform: uppercase;
          }
          .field-report-notes p {
            margin: 0;
            font-size: 10px;
            color: #45607a;
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
            object-fit: contain;
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
            grid-template-columns: repeat(3, minmax(0, 1fr));
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
          .census-report-header {
            border-color: #b9d7ec;
          }
          .census-report-map {
            border: 1px solid #c7dcef;
            border-radius: 14px;
            background: #ffffff;
            padding: 8px;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .census-report-map .field-report-map-image {
            max-height: 260px;
          }
          .census-report-zone-head {
            border-bottom: 1px solid #d8e7f4;
            padding-bottom: 6px;
          }
          .census-report-table th,
          .census-report-table td {
            font-size: 9px;
          }
          .census-report-table th:nth-child(1),
          .census-report-table td:nth-child(1) { width: 24px; text-align: center; }
          .census-report-table th:nth-child(3),
          .census-report-table td:nth-child(3) { width: 84px; }
          .census-report-table th:nth-child(4),
          .census-report-table td:nth-child(4) { width: 120px; }
          .census-report-table th:nth-child(7),
          .census-report-table td:nth-child(7) { width: 26%; }
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
          .field-report-table tr.is-red-report-point td {
            background: #fef2f2;
            border-color: #fca5a5;
            color: #b91c1c;
            font-weight: 700;
          }
          .field-report-table tr.is-alert-report-point td {
            background: #fffbeb;
            border-color: #f59e0b;
            color: #92400e;
            font-weight: 700;
          }
          .field-debt-print-shell {
            gap: 6px;
          }
          .field-debt-print-shell .field-report-header {
            padding: 7px 9px;
            border-left: 5px solid #0d4d86;
          }
          .field-debt-print-shell .field-report-brand {
            grid-template-columns: 54px minmax(0, 1fr);
          }
          .field-debt-print-shell .print-logo {
            width: 46px;
            height: 46px;
          }
          .field-debt-print-shell .field-report-header h1 {
            font-size: 16px;
          }
          .field-debt-print-shell .field-report-meta {
            gap: 5px;
            margin-top: 6px;
          }
          .field-debt-print-shell .field-report-meta span {
            padding: 3px 7px;
            font-size: 9.5px;
          }
          .field-debt-meta-money {
            border-color: #f4c36b !important;
            background: #fff7df !important;
            color: #7a3f00 !important;
            font-weight: 800;
          }
          .field-debt-summary-panel {
            border: 1px solid #b9d8ef;
            border-radius: 10px;
            background: linear-gradient(135deg, #ffffff 0%, #eef7ff 100%);
            padding: 7px 9px;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .field-debt-summary-panel h2 {
            margin-bottom: 6px;
            font-size: 14px;
            color: #0d3f6a;
          }
          .field-debt-metrics {
            display: grid;
            grid-template-columns: 0.85fr 0.9fr 1.3fr;
            gap: 7px;
          }
          .field-debt-metrics div {
            border: 1px solid #d2e4f3;
            border-radius: 9px;
            background: #ffffff;
            padding: 6px 8px;
          }
          .field-debt-metrics strong {
            display: block;
            color: #315b7d;
            font-size: 8px;
            text-transform: uppercase;
            margin-bottom: 2px;
          }
          .field-debt-metrics span {
            display: block;
            color: #102f49;
            font-size: 13px;
            font-weight: 800;
          }
          .field-debt-metrics .is-money {
            border-color: #f4c36b;
            background: #fff8e7;
          }
          .field-debt-metrics .is-money span,
          .field-debt-money-cell.is-total {
            color: #8a3d00;
            font-weight: 900;
          }
          .field-debt-chart-print-shell {
            gap: 8px;
          }
          .field-debt-chart-kpis {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 7px;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .field-debt-chart-kpis div,
          .field-debt-chart-card {
            border: 1px solid #d2e4f3;
            border-radius: 9px;
            background: #ffffff;
            padding: 7px 8px;
          }
          .field-debt-chart-kpis span {
            display: block;
            color: #315b7d;
            font-size: 8px;
            font-weight: 800;
            text-transform: uppercase;
          }
          .field-debt-chart-kpis strong {
            display: block;
            color: #102f49;
            font-size: 16px;
            font-weight: 900;
            margin-top: 2px;
          }
          .field-debt-chart-print-grid {
            display: grid;
            grid-template-columns: 1.05fr 0.95fr;
            gap: 8px;
            align-items: start;
          }
          .field-debt-chart-card {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .field-debt-chart-card h2 {
            color: #0d3f6a;
            font-size: 13px;
            margin-bottom: 7px;
          }
          .field-debt-chart-bars {
            display: grid;
            gap: 6px;
          }
          .field-debt-chart-bar {
            display: grid;
            grid-template-columns: minmax(0, 1fr) auto;
            gap: 5px 8px;
            padding: 6px;
            border: 1px solid #dceaf5;
            border-radius: 8px;
            background: #fbfdff;
          }
          .field-debt-chart-bar strong {
            color: #123b5d;
            font-size: 12px;
          }
          .field-debt-chart-bar span {
            display: block;
            color: #5c7390;
            font-size: 8.5px;
            font-weight: 700;
          }
          .field-debt-chart-bar b {
            color: #9b202d;
            font-size: 11px;
            white-space: nowrap;
          }
          .field-debt-chart-svg {
            grid-column: 1 / -1;
            display: block;
            width: 100%;
            height: 9px;
            print-color-adjust: exact;
            -webkit-print-color-adjust: exact;
          }
          .field-debt-chart-table th,
          .field-debt-chart-table td {
            font-size: 8px;
            padding: 4px;
          }
          .field-debt-chart-table td:nth-child(5),
          .field-debt-chart-table td:nth-child(6),
          .field-debt-chart-table td:nth-child(7) {
            text-align: right;
            white-space: nowrap;
          }
          .field-debt-results-section {
            padding: 7px;
            break-inside: auto;
            page-break-inside: auto;
          }
          .field-debt-results-section .field-report-zone-head {
            margin-bottom: 5px;
            break-after: avoid;
            page-break-after: avoid;
          }
          .field-debt-results-section .field-report-table {
            break-inside: auto;
            page-break-inside: auto;
          }
          .field-debt-results-section tr {
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .field-debt-print-table {
            table-layout: fixed;
          }
          .field-debt-print-table th,
          .field-debt-print-table td {
            padding: 3.5px 5px;
            font-size: 8.2px;
            line-height: 1.2;
          }
          .field-debt-print-table th:nth-child(1),
          .field-debt-print-table td:nth-child(1) {
            width: 44px;
          }
          .field-debt-print-table th:nth-child(2),
          .field-debt-print-table td:nth-child(2) {
            width: 34px;
            text-align: center;
          }
          .field-debt-print-table th:nth-child(3),
          .field-debt-print-table td:nth-child(3) {
            width: 40px;
          }
          .field-debt-print-table th:nth-child(4),
          .field-debt-print-table td:nth-child(4) {
            width: 112px;
          }
          .field-debt-print-table th:nth-child(5),
          .field-debt-print-table td:nth-child(5) {
            width: 72px;
          }
          .field-debt-print-table th:nth-child(6),
          .field-debt-print-table td:nth-child(6),
          .field-debt-print-table th:nth-child(7),
          .field-debt-print-table td:nth-child(7),
          .field-debt-print-table th:nth-child(8),
          .field-debt-print-table td:nth-child(8) {
            width: 58px;
            text-align: right;
          }
          .field-debt-print-table th:nth-child(9),
          .field-debt-print-table td:nth-child(9) {
            width: 142px;
          }
          .field-debt-key-cell,
          .field-debt-account-cell {
            font-weight: 800;
            color: #0d3f6a;
            white-space: nowrap;
          }
          .field-debt-money-cell {
            white-space: nowrap;
            font-weight: 700;
          }
          .field-debt-services-cell {
            line-height: 1.35;
          }
          .field-debt-service-mark {
            display: inline-flex;
            align-items: center;
            gap: 2px;
            margin: 0 2px 2px 0;
            border-radius: 999px;
            border: 1px solid #d8e7f4;
            padding: 1px 4px;
            font-size: 7.4px;
            font-weight: 800;
            background: #f7fbff;
          }
          .field-debt-service-mark b {
            font-size: 8px;
            line-height: 1;
          }
          .field-debt-service-mark.is-on {
            border-color: #a7e1bf;
            background: #ecfdf3;
            color: #0a6b3a;
          }
          .field-debt-service-mark.is-off {
            border-color: #f4b4b4;
            background: #fff1f2;
            color: #a21d2a;
          }
          .field-debt-signature {
            display: grid;
            grid-template-columns: minmax(0, 1fr) 260px;
            gap: 18px;
            align-items: end;
            border: 1px solid #d2e4f3;
            border-radius: 10px;
            background: #ffffff;
            padding: 16px 18px 14px;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .field-debt-signature strong,
          .field-debt-signature span {
            display: block;
          }
          .field-debt-signature strong {
            color: #0d3f6a;
            font-size: 11px;
            margin-bottom: 3px;
          }
          .field-debt-signature span {
            color: #315b7d;
            font-size: 9px;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          .field-debt-stamp-space {
            display: flex;
            flex-direction: column;
            justify-content: flex-end;
            gap: 7px;
            border-top: 0;
            min-height: 76px;
            color: #45607a;
            font-size: 9px;
            text-align: center;
            text-transform: uppercase;
          }
          .field-debt-stamp-space::before {
            content: "";
            display: block;
            width: 100%;
            border-top: 1px solid #7897b2;
          }
          .map-brief-report-shell {
            gap: 8px;
          }
          .map-brief-report-header {
            padding: 9px 11px;
            border-left: 5px solid #0d4d86;
          }
          .map-brief-report-header .field-report-brand {
            grid-template-columns: 56px minmax(0, 1fr);
          }
          .map-brief-report-header .print-logo {
            width: 48px;
            height: 48px;
          }
          .map-brief-report-header h1 {
            font-size: 16px;
          }
          .map-brief-report-metrics {
            display: grid;
            grid-template-columns: repeat(3, minmax(0, 1fr));
            gap: 7px;
          }
          .map-brief-report-metrics div,
          .map-brief-report-top {
            border: 1px solid #c7dcef;
            background: #ffffff;
            border-radius: 10px;
            padding: 8px 10px;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .map-brief-report-metrics strong {
            display: block;
            color: #315b7d;
            font-size: 9px;
            text-transform: uppercase;
            margin-bottom: 2px;
          }
          .map-brief-report-metrics span {
            display: block;
            color: #102f49;
            font-size: 19px;
            font-weight: 900;
          }
          .map-brief-report-types .field-report-total-chip {
            border-radius: 10px;
            font-size: 9px;
          }
          .map-report-chart {
            border: 1px solid rgba(178, 207, 230, 0.82);
            border-radius: 12px;
            padding: 8px 10px;
            background: linear-gradient(135deg, rgba(255,255,255,.94), rgba(225,241,252,.86));
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .map-report-chart h2 { margin: 0 0 6px; font-size: 11px; color: #0d3f6a; }
          .map-report-chart > div { display: grid; grid-template-columns: 120px 1fr 28px; gap: 7px; align-items: center; margin-top: 4px; font-size: 8.5px; }
          .map-report-chart i { height: 6px; overflow: hidden; border-radius: 999px; background: #dcebf6; }
          .map-report-chart i b { display: block; height: 100%; border-radius: inherit; background: linear-gradient(90deg, #0d6fb8, #52b7e8); }
          .map-report-chart strong { text-align: right; color: #0d4d86; }
          .map-brief-report-top h2 {
            margin: 0 0 6px;
            font-size: 12px;
            color: #0d3f6a;
          }
          .map-brief-report-top > div {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 5px;
          }
          .map-brief-report-top > div > div {
            border: 1px solid #d8e7f4;
            border-radius: 8px;
            padding: 5px 7px;
            background: #f8fbff;
          }
          .map-brief-report-top strong,
          .map-brief-report-top span {
            display: block;
          }
          .map-brief-report-top strong {
            font-size: 9.2px;
            color: #16324a;
          }
          .map-brief-report-top span {
            margin-top: 1px;
            font-size: 8.4px;
            color: #45607a;
          }
          .map-brief-report-table-section {
            padding: 8px;
            break-inside: auto;
            page-break-inside: auto;
          }
          .map-brief-report-table th,
          .map-brief-report-table td {
            padding: 3.5px 4px;
            font-size: 8.2px;
            line-height: 1.2;
          }
          .map-brief-report-table th:nth-child(1),
          .map-brief-report-table td:nth-child(1) {
            width: 24px;
            text-align: center;
          }
          .map-brief-report-table th:nth-child(3),
          .map-brief-report-table td:nth-child(3) {
            width: 42px;
            text-align: center;
            font-weight: 800;
          }
          .map-brief-report-table th:nth-child(6),
          .map-brief-report-table td:nth-child(6) {
            width: 30%;
          }
          .map-brief-report-table th:nth-child(7),
          .map-brief-report-table td:nth-child(7) {
            width: 94px;
            font-weight: 800;
          }
          .map-brief-service-cell {
            color: #075985;
            background: #f0f9ff;
          }
          .map-brief-shared-keys {
            border: 1px solid #b9d7ec;
            border-radius: 12px;
            padding: 9px 10px;
            background: linear-gradient(135deg, #ffffff, #edf7fd);
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .map-brief-shared-keys h3 { margin: 3px 0; font-size: 12px; color: #0d3f6a; }
          .map-brief-shared-keys p { margin: 3px 0 0; font-size: 9px; color: #45607a; }
          .map-brief-shared-keys table { width: 100%; margin-top: 7px; border-collapse: collapse; font-size: 8.5px; }
          .map-brief-shared-keys th,
          .map-brief-shared-keys td { padding: 4px 6px; border: 1px solid #d8e7f4; text-align: left; }
          .map-brief-shared-keys th { color: #ffffff; background: #0d4d86; }
          .map-brief-shared-keys th:last-child,
          .map-brief-shared-keys td:last-child { width: 44px; text-align: center; font-weight: 800; }
          .map-brief-debt-summary {
            border: 1px solid #b9d7ec;
            border-radius: 12px;
            padding: 9px 10px;
            background: linear-gradient(135deg, #ffffff, #edf7fd);
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .map-brief-debt-summary header { display: flex; justify-content: space-between; gap: 12px; align-items: center; }
          .map-brief-debt-summary h3 { margin: 3px 0 0; font-size: 12px; color: #0d3f6a; }
          .map-brief-debt-summary header > strong { font-size: 15px; color: #0d4d86; }
          .map-brief-debt-summary p { margin: 6px 0 0; font-size: 9px; color: #45607a; }
          .map-brief-debt-summary table { width: 100%; margin-top: 7px; border-collapse: collapse; font-size: 8.2px; }
          .map-brief-debt-summary th,
          .map-brief-debt-summary td { padding: 3px 5px; border: 1px solid #d8e7f4; text-align: left; }
          .map-brief-debt-summary th { color: #ffffff; background: #0d4d86; }
          .map-brief-debt-summary th:last-child,
          .map-brief-debt-summary td:last-child { width: 72px; text-align: right; font-weight: 800; }
          .field-report-color-chip {
            display: inline-block;
            width: 8px;
            height: 8px;
            margin-right: 4px;
            border-radius: 999px;
            background: var(--point-color, #1576d1);
            border: 1px solid #ffffff;
            box-shadow: 0 0 0 1px rgba(22, 50, 74, 0.14);
            vertical-align: middle;
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
          .lookup-chat-print-body {
            padding: 5mm 0;
            background: #eef3f8;
            color: #17344d;
          }
          .lookup-chat-print-card {
            width: min(180mm, 100%);
            margin: 0 auto;
            overflow: hidden;
            border: 1px solid #cadbea;
            border-top: 5px solid #0d4d86;
            border-radius: 16px;
            background: #ffffff;
            box-shadow: 0 14px 36px rgba(13, 53, 88, 0.13);
          }
          .lookup-chat-print-header {
            padding: 16px 18px 13px;
            border-bottom: 1px solid #dbe7f1;
            background: linear-gradient(145deg, #f9fcff, #edf6fd);
          }
          .lookup-chat-print-brand {
            display: grid;
            grid-template-columns: auto minmax(0, 1fr) auto;
            align-items: center;
            gap: 9px;
            margin-bottom: 12px;
          }
          .lookup-chat-print-monogram {
            display: grid;
            place-items: center;
            width: 32px;
            height: 32px;
            border-radius: 10px;
            background: #0d4d86;
            color: #ffffff;
            font-size: 10px;
            font-weight: 800;
          }
          .lookup-chat-print-brand strong,
          .lookup-chat-print-brand small { display: block; }
          .lookup-chat-print-brand strong { color: #123b5d; font-size: 11px; }
          .lookup-chat-print-brand small { margin-top: 2px; color: #6a8296; font-size: 8px; }
          .lookup-chat-print-brand b {
            padding: 4px 8px;
            border: 1px solid #c9dff1;
            border-radius: 999px;
            background: #ffffff;
            color: #0d4d86;
            font-size: 8px;
          }
          .lookup-chat-print-header h1 {
            margin: 0 0 4px;
            color: #103a5d;
            font-size: 19px;
            line-height: 1.15;
          }
          .lookup-chat-print-header > p {
            margin: 0;
            color: #4d687f;
            font-size: 9px;
            line-height: 1.4;
          }
          .lookup-chat-print-results { display: grid; gap: 9px; padding: 12px 14px; }
          .lookup-chat-print-result {
            overflow: hidden;
            border: 1px solid #d4e2ed;
            border-radius: 12px;
            break-inside: avoid;
            page-break-inside: avoid;
          }
          .lookup-chat-print-result-head {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 8px;
            padding: 7px 9px;
            border-bottom: 1px solid #dce8f1;
            background: #f1f7fc;
          }
          .lookup-chat-print-result-head span {
            color: #0d4d86;
            font-size: 9px;
            font-weight: 800;
            letter-spacing: 0.04em;
            text-transform: uppercase;
          }
          .lookup-chat-print-result-head small { color: #70869a; font-size: 8px; }
          .lookup-chat-print-fields {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 6px;
            padding: 8px;
          }
          .lookup-chat-print-fields div {
            min-width: 0;
            padding: 7px 8px;
            border-radius: 8px;
            background: #f7fafc;
          }
          .lookup-chat-print-fields strong,
          .lookup-chat-print-fields span { display: block; }
          .lookup-chat-print-fields strong {
            margin-bottom: 3px;
            color: #6a8195;
            font-size: 7px;
            letter-spacing: 0.03em;
            text-transform: uppercase;
          }
          .lookup-chat-print-fields span {
            overflow-wrap: anywhere;
            color: #113b5d;
            font-size: 10px;
            font-weight: 700;
            line-height: 1.25;
          }
          .lookup-chat-print-card > footer {
            padding: 8px 14px;
            border-top: 1px solid #e0e9f0;
            color: #75899a;
            font-size: 7px;
            text-align: center;
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
            .lookup-chat-print-body { padding: 0; background: #ffffff; }
            .lookup-chat-print-card { box-shadow: none; }
          }
        </style>
      </head>
      <body class="${bodyClassName}">${bodyMarkup}${showPageFooter ? '<div class="field-report-page"></div>' : ""}</body>
    </html>
  `;
};

const waitForPrintDocument = async (documentRef) => {
  const images = Array.from(documentRef.images);
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

  await documentRef.fonts?.ready;
  await pause(250);
};

export const printDocument = async (title, bodyMarkup, options = {}) => {
  const printHtml = buildPrintHtml(title, bodyMarkup, options);
  const previousOverflow = window.document.body.style.overflow;
  const previewModal = window.document.createElement("div");
  previewModal.setAttribute("role", "dialog");
  previewModal.setAttribute("aria-modal", "true");
  previewModal.setAttribute("aria-label", `Vista previa de ${title}`);
  previewModal.style.position = "fixed";
  previewModal.style.inset = "0";
  previewModal.style.zIndex = "9999";
  previewModal.style.display = "grid";
  previewModal.style.gridTemplateRows = "auto minmax(0, 1fr)";
  previewModal.style.background = "rgba(8, 20, 34, 0.68)";
  previewModal.style.backdropFilter = "blur(5px)";
  previewModal.style.padding = "14px";

  const toolbar = window.document.createElement("div");
  toolbar.style.display = "flex";
  toolbar.style.alignItems = "center";
  toolbar.style.justifyContent = "space-between";
  toolbar.style.gap = "12px";
  toolbar.style.width = "min(1500px, 100%)";
  toolbar.style.margin = "0 auto 10px";
  toolbar.style.padding = "10px 12px";
  toolbar.style.border = "1px solid rgba(205, 225, 241, 0.72)";
  toolbar.style.borderRadius = "16px";
  toolbar.style.background = "#ffffff";
  toolbar.style.boxShadow = "0 18px 48px rgba(10, 30, 52, 0.28)";

  const heading = window.document.createElement("div");
  heading.style.minWidth = "0";
  heading.innerHTML = `
    <strong style="display:block;color:#123b5d;font-size:15px;line-height:1.2;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">Vista previa de impresión</strong>
    <span style="display:block;color:#557089;font-size:12px;line-height:1.35;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeTitle(title)} · Revisa la ficha antes de enviarla a la impresora.</span>
  `;

  const actions = window.document.createElement("div");
  actions.style.display = "flex";
  actions.style.flexWrap = "wrap";
  actions.style.justifyContent = "flex-end";
  actions.style.gap = "8px";

  const closeButton = window.document.createElement("button");
  closeButton.type = "button";
  closeButton.textContent = "Cerrar";
  closeButton.style.minHeight = "38px";
  closeButton.style.border = "1px solid #cbdce9";
  closeButton.style.borderRadius = "10px";
  closeButton.style.background = "#f7fbff";
  closeButton.style.color = "#123b5d";
  closeButton.style.fontWeight = "700";
  closeButton.style.padding = "0 14px";
  closeButton.style.cursor = "pointer";

  const printButton = window.document.createElement("button");
  printButton.type = "button";
  printButton.textContent = "Imprimir ahora";
  printButton.style.minHeight = "38px";
  printButton.style.border = "1px solid #0d4d86";
  printButton.style.borderRadius = "10px";
  printButton.style.background = "#0d4d86";
  printButton.style.color = "#ffffff";
  printButton.style.fontWeight = "800";
  printButton.style.padding = "0 16px";
  printButton.style.cursor = "pointer";

  actions.append(closeButton, printButton);
  toolbar.append(heading, actions);

  const frameShell = window.document.createElement("div");
  frameShell.style.width = "min(1500px, 100%)";
  frameShell.style.minHeight = "0";
  frameShell.style.margin = "0 auto";
  frameShell.style.border = "1px solid rgba(205, 225, 241, 0.62)";
  frameShell.style.borderRadius = "18px";
  frameShell.style.background = "#e8eef4";
  frameShell.style.boxShadow = "0 24px 70px rgba(5, 18, 34, 0.32)";
  frameShell.style.overflow = "hidden";

  const printFrame = window.document.createElement("iframe");
  printFrame.title = title;
  printFrame.style.display = "block";
  printFrame.style.width = "100%";
  printFrame.style.height = "100%";
  printFrame.style.minHeight = "calc(100vh - 108px)";
  printFrame.style.border = "0";
  printFrame.style.background = "#ffffff";

  frameShell.appendChild(printFrame);
  previewModal.append(toolbar, frameShell);
  window.document.body.appendChild(previewModal);
  window.document.body.style.overflow = "hidden";

  const cleanup = () => {
    window.document.body.style.overflow = previousOverflow;
    window.removeEventListener("keydown", handleKeydown);
    previewModal.remove();
  };

  const finish = () =>
    new Promise((resolve) => {
      closeButton.onclick = () => {
        cleanup();
        resolve({ printed: false });
      };

      const printWindow = printFrame.contentWindow;
      const printDocumentRef = printFrame.contentDocument || printWindow?.document;

      if (!printWindow || !printDocumentRef) {
        cleanup();
        window.alert("No fue posible preparar la impresion.");
        resolve({ printed: false });
        return;
      }

      printButton.onclick = async () => {
        printButton.disabled = true;
        printButton.textContent = "Preparando...";
        await waitForPrintDocument(printDocumentRef);
        printWindow.focus();
        printWindow.print();
        cleanup();
        resolve({ printed: true });
      };
    });

  function handleKeydown(event) {
    if (event.key === "Escape") {
      closeButton.click();
    }
  }

  window.addEventListener("keydown", handleKeydown);

  const completion = finish();

  const printWindow = printFrame.contentWindow;
  const printDocumentRef = printFrame.contentDocument || printWindow?.document;

  if (!printWindow || !printDocumentRef) {
    cleanup();
    window.alert("No fue posible preparar la impresion.");
    return;
  }

  printDocumentRef.open();
  printDocumentRef.write(printHtml);
  printDocumentRef.close();

  printButton.disabled = true;
  printButton.textContent = "Cargando vista...";

  await waitForPrintDocument(printDocumentRef);

  printButton.disabled = false;
  printButton.textContent = "Imprimir ahora";
  printButton.focus();

  return completion;
};
