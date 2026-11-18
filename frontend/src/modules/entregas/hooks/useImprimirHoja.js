import { useEffect, useState } from "react";

// Hoja que espera en un portal (.ent-acta-portal) fuera de la vista: cuando sus
// imágenes ya cargaron, pone el modo de impresión y abre el diálogo del sistema; al
// cerrarlo la quita. Es el mismo flujo del Avance del mes y de Descartes.
export const useImprimirHoja = () => {
  const [hoja, setHoja] = useState(null);

  useEffect(() => {
    if (!hoja) return undefined;
    let vivo = true;
    const limpiar = () => {
      document.body.classList.remove("ent-imprimiendo-acta");
      if (vivo) setHoja(null);
    };
    const modoImpresion = window.matchMedia?.("print");
    const alSalir = (evento) => { if (!evento.matches) limpiar(); };
    const imagenes = [...document.querySelectorAll(".ent-acta-portal img")];
    Promise.all(imagenes.map((imagen) => imagen.decode?.().catch(() => {}))).then(() => {
      if (!vivo) return;
      document.body.classList.add("ent-imprimiendo-acta");
      window.addEventListener("afterprint", limpiar, { once: true });
      modoImpresion?.addEventListener?.("change", alSalir);
      window.print();
    });
    return () => {
      vivo = false;
      window.removeEventListener("afterprint", limpiar);
      modoImpresion?.removeEventListener?.("change", alSalir);
      document.body.classList.remove("ent-imprimiendo-acta");
    };
  }, [hoja]);

  return [hoja, setHoja];
};
