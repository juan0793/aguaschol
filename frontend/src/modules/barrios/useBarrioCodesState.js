import { useState } from "react";
import { emptyBarrioForm } from "../../components/BarrioCodesWorkspace";

export function useBarrioCodesState() {
  const [barrioCodes, setBarrioCodes] = useState([]);
  const [barrioCodeForm, setBarrioCodeForm] = useState(emptyBarrioForm);
  const [loadingBarrioCodes, setLoadingBarrioCodes] = useState(false);
  const [savingBarrioCode, setSavingBarrioCode] = useState(false);

  return {
    barrioCodes,
    setBarrioCodes,
    barrioCodeForm,
    setBarrioCodeForm,
    loadingBarrioCodes,
    setLoadingBarrioCodes,
    savingBarrioCode,
    setSavingBarrioCode
  };
}
