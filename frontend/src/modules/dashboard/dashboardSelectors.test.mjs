import assert from "node:assert/strict";
import { activitySeries, debtRanking } from "./dashboardSelectors.js";
assert.deepEqual(activitySeries([{ key: "b", total: 2 }, { key: "a", total: 1 }], 2).map((x) => x.key), ["a", "b"]);
assert.deepEqual(debtRanking([{ barrio: "A", deuda: { total: 2 } }, { barrio: "B", deuda: { total: 5 } }]).map((x) => x.name), ["B", "A"]);
