const RAILWAY_API_URL = "https://backboard.railway.com/graphql/v2";
const DAY_MS = 24 * 60 * 60 * 1000;
const MINUTES_IN_MONTH = 43_200;
const RESOURCE_PRICES = {
  CPU_USAGE: 20 / MINUTES_IN_MONTH,
  MEMORY_USAGE_GB: 10 / MINUTES_IN_MONTH,
  NETWORK_TX_GB: 0.05,
  DISK_USAGE_GB: 0.15 / MINUTES_IN_MONTH,
  BACKUP_USAGE_GB: 0.15 / MINUTES_IN_MONTH
};

const projectQuery = `query RailwayProject($projectId: String!) {
  project(id: $projectId) {
    workspaceId
    services { edges { node { id name } } }
  }
}`;

const workspaceQuery = `query RailwayWorkspace($workspaceId: String!) {
  workspace(workspaceId: $workspaceId) {
    customer { billingPeriod { start end } }
  }
}`;

const projectUsageQuery = `query RailwayProjectUsage(
  $workspaceId: String!
  $startDate: DateTime!
  $endDate: DateTime!
  $measurements: [MetricMeasurement!]!
) {
  usage(
    workspaceId: $workspaceId
    startDate: $startDate
    endDate: $endDate
    measurements: $measurements
    groupBy: [PROJECT_ID, SERVICE_ID]
    includeDeleted: true
  ) {
    measurement
    value
    tags { projectId serviceId }
  }
}`;

const estimatedUsageQuery = `query RailwayEstimatedUsage(
  $workspaceId: String!
  $measurements: [MetricMeasurement!]!
) {
  estimatedUsage(workspaceId: $workspaceId, measurements: $measurements, includeDeleted: true) {
    measurement
    estimatedValue
    projectId
  }
}`;

const BILLABLE_MEASUREMENTS = Object.keys(RESOURCE_PRICES);

const usageQuery = `query RailwayUsage(
  $projectId: String!
  $environmentId: String!
  $startDate: DateTime!
  $endDate: DateTime!
  $metricMeasurements: [MetricMeasurement!]!
) {
  metrics(
    projectId: $projectId
    environmentId: $environmentId
    startDate: $startDate
    endDate: $endDate
    sampleRateSeconds: 3600
    groupBy: [SERVICE_ID]
    measurements: $metricMeasurements
  ) {
    measurement
    tags { serviceId }
    values { ts value }
  }
}`;

const requiredSettings = ["RAILWAY_API_TOKEN", "RAILWAY_PROJECT_ID", "RAILWAY_ENVIRONMENT_ID"];

const railwayGraphql = async (query, variables) => {
  const response = await fetch(RAILWAY_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RAILWAY_API_TOKEN}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(12_000)
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || payload.errors?.length) {
    const detail = payload.errors?.[0]?.message;
    const error = new Error(detail || "Railway no pudo devolver las métricas solicitadas.");
    error.status = response.status === 401 || response.status === 403 ? 502 : 503;
    throw error;
  }
  return payload.data;
};

export const getRailwayUsage = async () => {
  const missing = requiredSettings.filter((key) => !process.env[key]?.trim());
  if (missing.length) {
    const error = new Error("Falta configurar la conexión de Railway en el backend.");
    error.status = 503;
    throw error;
  }

  const projectId = process.env.RAILWAY_PROJECT_ID;
  const environmentId = process.env.RAILWAY_ENVIRONMENT_ID;
  const projectData = await railwayGraphql(projectQuery, { projectId });
  const workspaceId = projectData.project?.workspaceId;
  if (!workspaceId) {
    const error = new Error("No se encontró el espacio de trabajo de Railway para este proyecto.");
    error.status = 502;
    throw error;
  }
  const workspaceData = await railwayGraphql(workspaceQuery, { workspaceId });
  const billingPeriod = workspaceData.workspace?.customer?.billingPeriod;
  if (!billingPeriod?.start || !billingPeriod?.end) {
    const error = new Error("Railway no devolvió el ciclo de facturación actual.");
    error.status = 502;
    throw error;
  }
  const start = new Date(billingPeriod.start);
  const end = new Date(billingPeriod.end);
  const now = new Date();
  const [usageData, estimatedData, metricData] = await Promise.all([
    railwayGraphql(projectUsageQuery, {
      workspaceId,
      startDate: start.toISOString(),
      endDate: now < end ? now.toISOString() : end.toISOString(),
      measurements: BILLABLE_MEASUREMENTS
    }),
    railwayGraphql(estimatedUsageQuery, {
      workspaceId,
      measurements: BILLABLE_MEASUREMENTS
    }),
    railwayGraphql(usageQuery, {
      projectId,
      environmentId,
      startDate: new Date(now.getTime() - 30 * DAY_MS).toISOString(),
      endDate: now.toISOString(),
      metricMeasurements: ["CPU_USAGE", "MEMORY_USAGE_GB"]
    })
  ]);
  const serviceNames = Object.fromEntries(
    (projectData.project.services?.edges ?? []).map(({ node }) => [node.id, node.name])
  );
  const usage = (usageData.usage ?? []).filter(
    (row) => row.tags?.projectId === process.env.RAILWAY_PROJECT_ID
  );
  const estimatedUsage = (estimatedData.estimatedUsage ?? []).filter(
    (row) => row.projectId === projectId
  );
  const quantity = (rows, measurement, valueKey) => rows
    .filter((row) => row.measurement === measurement)
    .reduce((total, row) => total + Number(row[valueKey] || 0), 0);
  const resourceUsage = Object.fromEntries(BILLABLE_MEASUREMENTS.map((measurement) => [
    measurement,
    quantity(usage, measurement, "value") * RESOURCE_PRICES[measurement]
  ]));
  const estimatedCost = estimatedUsage.reduce((total, row) => (
    total + Number(row.estimatedValue || 0) * (RESOURCE_PRICES[row.measurement] || 0)
  ), 0);
  const metrics = metricData.metrics ?? [];
  const peaks = Object.fromEntries(["CPU_USAGE", "MEMORY_USAGE_GB"].map((measurement) => {
    const samples = metrics
      .filter((series) => series.measurement === measurement)
      .flatMap((series) => (series.values ?? []).map((sample) => ({
        serviceId: series.tags?.serviceId,
        service: serviceNames[series.tags?.serviceId] || "Servicio",
        value: Number(sample.value),
        timestamp: new Date(Number(sample.ts) * 1000).toISOString()
      })))
      .filter((sample) => Number.isFinite(sample.value));
    samples.sort((a, b) => b.value - a.value);
    return [measurement, samples.slice(0, 5)];
  }));

  return {
    period: { start: start.toISOString(), end: end.toISOString(), updatedAt: now.toISOString() },
    currentUsage: Object.values(resourceUsage).reduce((total, value) => total + value, 0),
    estimatedUsage: estimatedCost,
    resourceUsage,
    peaks
  };
};
