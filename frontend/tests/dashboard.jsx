import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import Dashboard from '../src/modules/dashboard/DashboardWorkspace.jsx';
import Sidebar from '../src/components/sidebar/AppSidebar.jsx';
import {buildSidebarSections} from '../src/components/sidebar/sidebarConfig.js';
import {NotificationCenter} from '../src/components/NotificationCenter.jsx';
import logo from '../src/assets/logo-aguas-choluteca.png';
import '../src/styles.css';
import '../src/components/sidebar/sidebar.css';
// Datos ficticios, exclusivos de esta página de QA; nunca se envían al servidor.
const barrios = [
  ['BARRIO DE PRUEBA CON NOMBRE EXTENSO PARA VERIFICAR LA LECTURA', 13250000, 1500, 1325],
  ['BARRIO DE PRUEBA B', 10170000, 1200, 1017],
  ['BARRIO DE PRUEBA C', 5620000, 1000, 562],
  ['BARRIO DE PRUEBA D', 5380000, 800, 538],
  ['BARRIO DE PRUEBA E', 4260000, 700, 426],
  ['BARRIO DE PRUEBA F', 1000000, 2000, 1800],
].map(([barrio_colonia, total, deudores, criticos]) => ({
  barrio_colonia, deuda: {total, capital: total * .7, intereses: total * .3, deudores, criticos},
  servicios: [['agua','Agua potable'],['alcantarillado','Alcantarillado'],['barrido','Barrido'],['recoleccion','Recolección'],['desechos_peligrosos','Desechos peligrosos']].map(([field,label], i) => ({field,label,active:deudores,inactive:0,deuda:{total: total / (i + 1)}}))
}));
const empty = new URLSearchParams(location.search).has('empty');
const debtBarrios = empty ? [] : barrios;
const debtSummary = debtBarrios.reduce((sum, row) => Object.fromEntries(Object.keys(sum).map(key => [key, sum[key] + row.deuda[key]])), {total:0,capital:0,intereses:0,deudores:0,criticos:0});
const session={user:{id:1}};
const apiFetch=async()=>({ok:true,json:async()=>({messages:[{id:1,recipient_user_id:1,sender_user_id:2,sender_name:'Prueba local',body:'Mensaje de prueba para verificar la campanita.',created_at:new Date().toISOString()}]})});
const sections=buildSidebarSections(['profile','inspecciones','entregas','lookup','sigTerritorial','records','map','requests','padron','importacion','logs'].map((key)=>({key,label:({profile:'Mi perfil',lookup:'Buscar clave',map:'Mapa',padron:'Padrón',importacion:'Importación'})[key]||key,icon:'records',helper:'Vista de prueba'})),{key:'dashboard',label:'Tablero',helper:'Control',icon:'dashboard'});
function QA(){const [collapsed,setCollapsed]=useState(false),[mobile,setMobile]=useState(false),[active,setActive]=useState('dashboard'),[count,setCount]=useState(1),[status,setStatus]=useState('Datos de prueba — sin conexión al servidor'); return <div className={`page-shell dashboard-refactor-mode ${collapsed?'sidebar-collapsed':''}`}><Sidebar sections={sections} activeKey={active} collapsed={collapsed} mobileOpen={mobile} logo={logo} userName="QA local" userRole="Vista de prueba" onToggleCollapsed={()=>setCollapsed(!collapsed)} onNavigate={setActive} onCloseMobile={()=>setMobile(false)} onLogout={()=>setStatus('Cerrar sesión: prueba')} /><header className="hero app-chrome no-print"><div className="app-topbar"><button onClick={()=>setMobile(!mobile)} aria-label="Abrir menú">☰</button><div className="app-topbar-brand"><img src={logo} className="app-topbar-logo"/><strong>Aguas de Choluteca</strong></div><div className="app-topbar-kpis">QA · Datos de prueba</div><div className="app-topbar-session"><NotificationCenter apiFetch={apiFetch} session={session} unreadCount={count} onUnreadCountChange={setCount} onNotificationSelect={()=>setStatus('Conversación abierta')} /><button className="app-user-chip">QA local</button></div></div></header><p role="status">{status} · {active}</p><Dashboard model={{refresh:()=>setStatus('Actualización solicitada'),syncLabel:'Vista de prueba',padronTotals:{records:0,barrios:0},onlineUsers:[],metrics:['records','gps','online','alerts'].map((key,i)=>({key,label:['Fichas activas','Puntos GPS','Usuarios en línea','Alertas'][i],icon:['records','map','users','warning'][i],value:0,helper:'Sin conexión al servidor',tone:['is-info','is-map','is-live','is-critical'][i]})),debtBarrios,debtSummary,attention:[{title:'Prioridad de prueba',detail:'Comprobar filtros y navegación.',level:'Crítico',tone:'is-critical',icon:'warning',actionView:'records'}],feed:[],navigate:setActive}}/></div>}
createRoot(document.getElementById('root')).render(<QA/>);

// Prueba de regresión ejecutable: solo usa componentes locales y una API simulada.
const check = async () => {
  const wait = () => new Promise(resolve => setTimeout(resolve, 300));
  if (!new URLSearchParams(location.search).has('charts')) {
  const bell = document.querySelector('.notification-bell');
  bell.click(); await wait();
  const panel = document.querySelector('.notification-dropdown');
  if (!panel || bell.getAttribute('aria-expanded') !== 'true') throw Error('La campanita no abre');
  const r = panel.getBoundingClientRect();
  if (r.left < 0 || r.right > innerWidth) throw Error('Panel fuera de pantalla');
  if (!panel.contains(document.elementFromPoint(r.left + 20, r.top + 25))) throw Error('Panel recortado u oculto');
  document.dispatchEvent(new KeyboardEvent('keydown', {key:'Escape',bubbles:true})); await wait();
  if (bell.getAttribute('aria-expanded') !== 'false') throw Error('Escape no cierra');
  document.querySelectorAll('.dw-filters button')[2].click(); await wait();
  if (!document.querySelector('.dw-attention').textContent.includes('No hay prioridades')) throw Error('Filtro vacío incorrecto');
  document.querySelectorAll('.dw-filters button')[0].click();
  }
  if (empty) {
    if (document.querySelector('.dw-ranking') || !document.querySelector('.dw-mora .dw-button-secondary').disabled) throw Error('Estado vacío incorrecto');
  } else {
    const rows = () => [...document.querySelectorAll('.dw-ranking-row > button:first-child')];
    const metrics = [...document.querySelectorAll('.dw-metric-switch button')];
    document.querySelector('.dw-ranking-more[aria-expanded="true"]')?.click();
    document.querySelector('.dw-selection header .dw-link')?.click();
    await wait();
    metrics[0].click(); await wait();
    if (rows().length !== 5 || !document.querySelector('.dw-ranking-summary').textContent.includes('97.5%')) throw Error('Concentración o top 5 incorrecto');
    rows()[0].click(); rows()[4].click(); await wait();
    if (document.querySelectorAll('.dw-selection-chips li').length !== 2) throw Error('Selección múltiple incorrecta');
    metrics[2].click(); await wait();
    if (!rows()[0].textContent.includes('PRUEBA F') || document.querySelectorAll('.dw-selection-chips li').length !== 2) throw Error('Ranking crítico o persistencia incorrecta');
    metrics[1].click(); await wait();
    if (!rows()[0].textContent.includes('PRUEBA F') || !document.querySelector('.dw-ranking-value').textContent.includes('abonados con mora')) throw Error('Ranking de abonados incorrecto');
    document.querySelector('.dw-ranking-more').click(); await wait();
    if (!document.querySelector('.dw-ranking-detail')) throw Error('No abre desglose');
    document.querySelector('.dw-disclosure').click(); await wait();
    if (!document.querySelector('.dw-services')) throw Error('No abre servicios consolidados');
    document.querySelector('.dw-selection header .dw-link').click(); await wait();
    if (document.querySelector('.dw-selection')) throw Error('No limpia selección');
    document.querySelector('.dw-ranking-more[aria-expanded="true"]')?.click();
    metrics[0].click(); await wait();
    const tracks = [...document.querySelectorAll('.dw-ranking-track')].map(el => el.getBoundingClientRect().width);
    if (Math.max(...tracks) - Math.min(...tracks) > 1) throw Error('Barras con escalas visuales distintas');
    if (document.documentElement.scrollWidth > innerWidth) throw Error('Desbordamiento horizontal');
  }
  console.info('QA OK: filtros, rankings, porcentajes, selección, desglose, servicios y escala común');
};
const run = document.createElement('button');
run.textContent='Ejecutar comprobación UI';
run.style.cssText='position:fixed;bottom:12px;right:12px;z-index:2000';
run.onclick=()=>check().then(()=>{run.textContent='QA OK';}).catch(error=>{run.textContent=error.message;console.error(error);});
document.body.append(run);
