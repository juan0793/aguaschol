import assert from "node:assert/strict";
import { debtRanking, sumSelectedDebt, sumSelectedServices } from "./dashboardSelectors.js";
assert.deepEqual(debtRanking([{ barrio: "A", deuda: { total: 2 } }, { barrio: "B", deuda: { total: 5 } }]).map((x) => x.name), ["B", "A"]);
assert.deepEqual(debtRanking([{ barrio_colonia: "Centro", deuda: { criticos: 3 } }], "critical").map(({ name, value }) => ({ name, value })), [{ name: "Centro", value: 3 }]);
assert.deepEqual(sumSelectedDebt([{ name: "A", debt: { total: 5, capital: 3 } }, { name: "B", debt: { total: 7, capital: 4 } }], ["A", "B"]), { capital: 7, intereses: 0, total: 12, deudores: 0, criticos: 0 });
assert.deepEqual(sumSelectedServices([{ name: "A", services: [{ field: "agua", label: "Agua", active: 2, inactive: 1, deuda: { total: 5 } }] }, { name: "B", services: [{ field: "agua", label: "Agua", active: 3, unknown: 1, deuda: { total: 7 } }] }], ["A", "B"]), [{ field: "agua", label: "Agua", active: 5, inactive: 1, unknown: 1, debt: 12 }]);
