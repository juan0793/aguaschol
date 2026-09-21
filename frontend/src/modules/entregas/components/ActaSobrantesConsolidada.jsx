import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import SobrantesConsolidadoPrint from "../print/SobrantesConsolidadoPrint";
import { groupSobrantesByLote } from "../selectors/entregasSelectors";

// El listado pagina de a 100. Un rango largo puede tener mas sobrantes que eso,
// asi que el acta pide pagina por pagina hasta completar el total que reporta
// el backend. El tope evita que un filtro demasiado amplio dispare cientos de
// llamadas: si se alcanza, se avisa en vez de imprimir un acta incompleta en
// silencio.
const POR_PAGINA = 100;
const MAXIMO_PAGINAS = 20;

const cargarSobrantes = async (api, filtros) => {
  const base = { ...filtros, solo_lotes_cerrados: "1", limit: POR_PAGINA };
  const filas = [];
  let pagina = 1;
  let total = 0;
  do {
    const data = await api.noEntregadas({ ...base, page: pagina });
    const items = Array.isArray(data?.items) ? data.items : [];
    total = Number(data?.total ?? items.length);
    filas.push(...items);
    if (!items.length) break;
    pagina += 1;
  } while (filas.length < total && pagina <= MAXIMO_PAGINAS);
  return { filas, total, completo: filas.length >= total };
};

// Un acta con todas las personas que quedaron sin su documento en los lotes ya
// cerrados del rango que se esta mirando, agrupada por recorrido.
export default function ActaSobrantesConsolidada({ api, filtros = {}, motivos = [], notify }) {
  const [grupos, setGrupos] = useState([]);
  const [rango, setRango] = useState(null);
  const [impresion, setImpresion] = useState({ en: "", intento: 0 });
  const [cargando, setCargando] = useState(false);

  useEffect(() => {
    if (!impresion.intento || !grupos.length) return undefined;
    const temporizador = setTimeout(() => window.print(), 60);
    return () => clearTimeout(temporizador);
  }, [grupos.length, impresion]);

  useEffect(() => {
    if (!grupos.length) return undefined;
    const marcar = () => document.body.classList.add("ent-imprimiendo-acta");
    const limpiar = () => document.body.classList.remove("ent-imprimiendo-acta");
    window.addEventListener("beforeprint", marcar);
    window.addEventListener("afterprint", limpiar);
    return () => {
      window.removeEventListener("beforeprint", marcar);
      window.removeEventListener("afterprint", limpiar);
      limpiar();
    };
  }, [grupos.length]);

  const imprimir = async () => {
    setCargando(true);
    try {
      const { filas, total, completo } = await cargarSobrantes(api, {
        fecha_desde: filtros.fecha_desde || "",
        fecha_hasta: filtros.fecha_hasta || "",
        barrio_codigo: filtros.barrio_codigo || "",
        responsable_id: filtros.responsable_id || "",
        tipo_documento: filtros.tipo_documento || ""
      });
      if (!filas.length) {
        notify?.("Los lotes cerrados de este rango no dejaron documentos sobrantes.");
        return;
      }
      if (!completo) {
        notify?.(`El rango tiene ${total} sobrantes y el acta solo alcanza a traer ${filas.length}. Acotá las fechas para imprimirlos todos.`);
        return;
      }
      setGrupos(groupSobrantesByLote(filas));
      setRango({ fecha_desde: filtros.fecha_desde || "", fecha_hasta: filtros.fecha_hasta || "" });
      document.body.classList.add("ent-imprimiendo-acta");
      setImpresion((actual) => ({ en: new Date().toISOString(), intento: actual.intento + 1 }));
    } catch (error) {
      notify?.(error.message || "No se pudo armar el acta de sobrantes.");
    } finally {
      setCargando(false);
    }
  };

  return (
    <>
      <button type="button" className="cl-secondary" onClick={imprimir} disabled={cargando}>
        {cargando ? "Armando acta…" : "Imprimir acta de sobrantes"}
      </button>
      {grupos.length
        ? createPortal(
            <div className="ent-acta-portal">
              <SobrantesConsolidadoPrint grupos={grupos} rango={rango} motivos={motivos} generadoEn={impresion.en} />
            </div>,
            document.body
          )
        : null}
    </>
  );
}
