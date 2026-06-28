/**
 * Genera capturas para docs/ y el manual PDF.
 * Uso: npm run build && node scripts/capture-docs-screenshots.mjs
 */
import { mkdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const OUT = join(process.cwd(), "docs/images");
const BASE = process.env.DOCS_SCREENSHOT_BASE ?? "http://localhost:3000";

const MOCKS = [
  {
    file: "01-dashboard.png",
    title: "Panel de inicio",
    body: `
      <div class="kpis">
        <div class="kpi"><span>Activos</span><strong>142</strong></div>
        <div class="kpi"><span>Próximos</span><strong>8</strong></div>
        <div class="kpi"><span>Sin cubrir</span><strong>23</strong></div>
        <div class="kpi"><span>Cobertura</span><strong>87%</strong></div>
      </div>
      <div class="panel"><h3>Salud operativa</h3><div class="bar"><div style="width:82%"></div></div><p>82/100 — estable</p></div>
      <div class="panel"><h3>Próximos campeonatos</h3><ul><li>Open Cantabria · 12 abr · 6 huecos</li><li>Copa Madrid · 19 abr · aprobada</li></ul></div>
    `,
  },
  {
    file: "02-campeonatos.png",
    title: "Campeonatos",
    body: `
      <div class="panel"><h3>Tarimas abiertas</h3><div class="cards"><div class="card">Open Cantabria<br><small>72% cobertura</small></div><div class="card">AEP-3 Valencia<br><small>91%</small></div></div></div>
      <table><tr><th>Nombre</th><th>Fecha</th><th>Zona</th><th>Estado</th></tr>
      <tr><td>Open Cantabria</td><td>2026-04-12</td><td>Norte</td><td>En curso</td></tr>
      <tr><td>Copa Madrid</td><td>2026-04-19</td><td>Centro</td><td>Aprobada</td></tr></table>
    `,
  },
  {
    file: "03-tarima-vacia.png",
    title: "Tarima — plantilla",
    body: `<div class="steps"><div class="step active">1 Plantilla</div><div class="step">2 Asignación</div><div class="step">3 Revisión</div></div>
      <div class="panel center"><p>Importa el horario PDF AEP o crea la plantilla manualmente.</p><button>Importar horario</button></div>`,
  },
  {
    file: "04-tarima-montada.png",
    title: "Tarima — asignación",
    body: `<div class="split"><div class="panel"><h4>Jueces</h4><ul><li>Ana Roa · Nacional</li><li>Javier Ruiz · IPF C2</li></ul></div>
      <div class="panel"><h4>S1 · 10:00</h4><div class="slot filled">Central — Javier</div><div class="slot">Lateral —</div></div></div>`,
  },
  {
    file: "05-directorio.png",
    title: "Directorio de jueces",
    body: `<table><tr><th>Nombre</th><th>Zona</th><th>Nivel</th></tr>
      <tr><td>Ana Roa Sales</td><td>Levante</td><td>Nacional</td></tr>
      <tr><td>Javier Ruiz</td><td>Norte</td><td>IPF Cat. 2</td></tr></table>
      <div class="panel"><label>Domicilio (Google Maps)</label><input value="C/ Mayor 1, Murcia" /><small>Autocomplete activo</small></div>`,
  },
  {
    file: "06-cambiar-password.png",
    title: "Cambiar contraseña",
    body: `<form class="panel narrow"><label>Contraseña actual</label><input type="password" />
      <label>Nueva contraseña</label><input type="password" /><button>Guardar</button></form>`,
  },
  {
    file: "07-estadisticas.png",
    title: "Estadísticas",
    body: `<div class="kpis"><div class="kpi"><span>2026</span><strong>24</strong> campeonatos</div>
      <div class="kpi"><span>Cobertura</span><strong>89%</strong></div></div>
      <div class="panel"><h3>Por zona</h3><div class="bar"><div style="width:92%"></div></div><p>Norte 92%</p></div>`,
  },
  {
    file: "08-usuarios.png",
    title: "Usuarios",
    body: `<table><tr><th>Email</th><th>Rol</th><th>Acciones</th></tr>
      <tr><td>delegado@aep.es</td><td>Comité Jueces</td><td>🔑 ✎</td></tr></table>`,
  },
  {
    file: "09-cuadrante-export.png",
    title: "Cuadrante PDF",
    body: `<div class="panel center"><p>Vista previa cuadrante AEP — colores por rol, sesiones en columnas.</p>
      <div class="grid-mock"><div class="cell c">Central</div><div class="cell">Lateral</div><div class="cell p">Pesaje</div></div></div>`,
  },
  {
    file: "10-compensacion.png",
    title: "Compensación",
    body: `<div class="panel"><label>Sede (Google Autocomplete)</label><input value="Polideportivo Santander" />
      <small>Coordenadas OK</small></div>
      <table><tr><th>Juez</th><th>Funciones</th><th>Km</th><th>Total</th></tr>
      <tr><td>Javier Ruiz</td><td>S1(O+P) · S2</td><td>200</td><td>96€</td></tr></table>
      <div class="breakdown"><strong>S1</strong> Ordenador 30€ · Pesaje 15€</div>`,
  },
];

function mockHtml(title, body) {
  return `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8" />
  <style>
    *{box-sizing:border-box;font-family:system-ui,sans-serif}
    body{margin:0;background:#0f1419;color:#e8eaed;padding:24px}
    .shell{max-width:1100px;margin:0 auto;background:#161b22;border:1px solid #30363d;border-radius:16px;padding:20px}
    h2{margin:0 0 16px;font-size:18px;color:#f0f3f6}
    .kpis{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:16px}
    .kpi{background:#1c2128;border:1px solid #30363d;border-radius:12px;padding:12px}
    .kpi span{display:block;font-size:11px;color:#8b949e;text-transform:uppercase}
    .kpi strong{font-size:22px;color:#58a6ff}
    .panel{background:#1c2128;border:1px solid #30363d;border-radius:12px;padding:14px;margin-bottom:12px}
    .panel h3,.panel h4{margin:0 0 8px;font-size:13px}
    .bar{height:8px;background:#30363d;border-radius:4px;overflow:hidden}
    .bar div{height:100%;background:#3fb950}
    table{width:100%;border-collapse:collapse;font-size:13px}
    th,td{border-bottom:1px solid #30363d;padding:8px;text-align:left}
    th{color:#8b949e;font-size:11px;text-transform:uppercase}
    .cards{display:flex;gap:10px}
    .card{flex:1;background:#0d1117;border:1px solid #30363d;border-radius:10px;padding:12px}
    .steps{display:flex;gap:8px;margin-bottom:16px}
    .step{flex:1;text-align:center;padding:8px;border-radius:8px;background:#1c2128;border:1px solid #30363d;font-size:12px}
    .step.active{border-color:#58a6ff;color:#58a6ff}
    .center{text-align:center;padding:32px}
    button{background:#238636;color:#fff;border:0;border-radius:8px;padding:8px 14px}
    .split{display:grid;grid-template-columns:1fr 1fr;gap:12px}
    .slot{background:#0d1117;border:1px dashed #484f58;border-radius:8px;padding:8px;margin:6px 0;font-size:12px}
    .slot.filled{border-style:solid;border-color:#3fb950}
    input{width:100%;padding:8px;border-radius:8px;border:1px solid #30363d;background:#0d1117;color:#e8eaed}
    label{display:block;font-size:11px;color:#8b949e;margin-bottom:4px}
    small{color:#3fb950;font-size:11px}
    .narrow{max-width:360px;margin:0 auto}
    .grid-mock{display:grid;grid-template-columns:repeat(3,1fr);gap:6px;margin-top:12px}
    .cell{background:#21262d;padding:16px;border-radius:8px;font-size:12px;text-align:center}
    .cell.c{background:#1f3d2a}.cell.p{background:#3d2a1f}
    .breakdown{margin-top:10px;padding:10px;background:#0d1117;border-radius:8px;font-size:12px}
    ul{padding-left:18px;margin:8px 0}
  </style></head><body><div class="shell"><h2>${title}</h2>${body}</div></body></html>`;
}

async function main() {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();

  for (const mock of MOCKS) {
    const page = await browser.newPage({ viewport: { width: 1200, height: 720 } });
    await page.setContent(mockHtml(mock.title, mock.body), { waitUntil: "networkidle" });
    await page.screenshot({ path: join(OUT, mock.file), fullPage: false });
    await page.close();
    console.log("mock", mock.file);
  }

  const live = [
    { url: "/sign-in", file: "00-sign-in.png" },
    { url: "/docs", file: "00-docs.png" },
  ];

  for (const shot of live) {
    const page = await browser.newPage({ viewport: { width: 1200, height: 720 } });
    try {
      await page.goto(`${BASE}${shot.url}`, { waitUntil: "networkidle", timeout: 15000 });
      await page.screenshot({ path: join(OUT, shot.file), fullPage: false });
      console.log("live", shot.file);
    } catch (err) {
      console.warn("skip live", shot.file, err.message);
    }
    await page.close();
  }

  await browser.close();
  console.log(`Capturas en ${OUT}`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
