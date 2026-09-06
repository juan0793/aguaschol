import React, {useState} from 'react';
import {createRoot} from 'react-dom/client';
import Dashboard from '../src/modules/dashboard/DashboardWorkspace.jsx';
import Sidebar from '../src/components/sidebar/AppSidebar.jsx';
import {buildSidebarSections} from '../src/components/sidebar/sidebarConfig.js';
import {NotificationCenter} from '../src/components/NotificationCenter.jsx';
import logo from '../src/assets/logo-aguas-choluteca.png';
import '../src/styles.css';
import '../src/components/sidebar/sidebar.css';
const session={user:{id:1}};
const apiFetch=async()=>({ok:true,json:async()=>({messages:[{id:1,recipient_user_id:1,sender_user_id:2,sender_name:'Prueba local',body:'Mensaje de prueba para verificar la campanita.',created_at:new Date().toISOString()}]})});
const sections=buildSidebarSections(['profile','inspecciones','entregas','lookup','sigTerritorial','records','map','requests','padron','importacion','logs'].map((key)=>({key,label:({profile:'Mi perfil',lookup:'Buscar clave',map:'Mapa',padron:'Padrón',importacion:'Importación'})[key]||key,icon:'records',helper:'Vista de prueba'})),{key:'dashboard',label:'Tablero',helper:'Control',icon:'dashboard'});
function QA(){const [collapsed,setCollapsed]=useState(false),[mobile,setMobile]=useState(false),[active,setActive]=useState('dashboard'),[count,setCount]=useState(1),[status,setStatus]=useState('Datos de prueba — sin conexión al servidor'); return <div className={`page-shell dashboard-refactor-mode ${collapsed?'sidebar-collapsed':''}`}><Sidebar sections={sections} activeKey={active} collapsed={collapsed} mobileOpen={mobile} logo={logo} userName="QA local" userRole="Vista de prueba" onToggleCollapsed={()=>setCollapsed(!collapsed)} onNavigate={setActive} onCloseMobile={()=>setMobile(false)} onLogout={()=>setStatus('Cerrar sesión: prueba')} /><header className="hero app-chrome no-print"><div className="app-topbar"><button onClick={()=>setMobile(!mobile)} aria-label="Abrir menú">☰</button><div className="app-topbar-brand"><img src={logo} className="app-topbar-logo"/><strong>Aguas de Choluteca</strong></div><div className="app-topbar-kpis">QA · Datos de prueba</div><div className="app-topbar-session"><NotificationCenter apiFetch={apiFetch} session={session} unreadCount={count} onUnreadCountChange={setCount} onNotificationSelect={()=>setStatus('Conversación abierta')} /><button className="app-user-chip">QA local</button></div></div></header><p role="status">{status} · {active}</p><Dashboard model={{refresh:()=>setStatus('Actualización solicitada'),syncLabel:'Vista de prueba',padronTotals:{records:0,barrios:0},onlineUsers:[],metrics:['records','gps','online','alerts'].map((key,i)=>({key,label:['Fichas activas','Puntos GPS','Usuarios en línea','Alertas'][i],icon:['records','map','users','warning'][i],value:0,helper:'Sin conexión al servidor',tone:['is-info','is-map','is-live','is-critical'][i]})),debtBarrios:[],debtSummary:{},attention:[{title:'Prioridad de prueba',detail:'Comprobar filtros y navegación.',level:'Crítico',tone:'is-critical',icon:'warning',actionView:'records'}],feed:[],navigate:setActive}}/></div>}
createRoot(document.getElementById('root')).render(<QA/>);

// Prueba de regresión ejecutable: solo usa componentes locales y una API simulada.
const check = async () => {
  const wait = () => new Promise(resolve => setTimeout(resolve, 300));
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
  console.info('QA OK: campanita visible, Escape y filtros');
};
const run = document.createElement('button');
run.textContent='Ejecutar comprobación UI';
run.style.cssText='position:fixed;bottom:12px;right:12px;z-index:2000';
run.onclick=()=>check().then(()=>{run.textContent='QA OK';}).catch(error=>{run.textContent=error.message;console.error(error);});
document.body.append(run);
