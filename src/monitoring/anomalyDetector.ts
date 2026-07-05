import { config } from "../config.js";
import { getHistory } from "./metricsStore.js";
import type { Anomaly, FlowRunMetric } from "./types.js";

function mean(values: number[]): number {
  return values.reduce((sum, v) => sum + v, 0) / values.length;
}

function stddev(values: number[], avg: number): number {
  const variance = mean(values.map((v) => (v - avg) ** 2));
  return Math.sqrt(variance);
}

function errorRateOf(m: FlowRunMetric): number {
  return m.received === 0 ? 0 : m.failed / m.received;
}

function checkMetric(
  flowId: string,
  metricName: Anomaly["metric"],
  baseline: number[],
  latestValue: number,
): Anomaly | null {
  if (baseline.length < config.anomalyMinSamples - 1) return null;
  const avg = mean(baseline);
  const sd = stddev(baseline, avg);
  if (sd === 0) {
    if (latestValue === avg) return null;
    // 표준편차가 0(항상 동일)인데 값이 달라졌다면 그 자체로 이상치
    return {
      flowId,
      metric: metricName,
      latestValue,
      mean: avg,
      stddev: sd,
      zScore: Infinity,
      detectedAt: new Date().toISOString(),
    };
  }
  const zScore = (latestValue - avg) / sd;
  if (Math.abs(zScore) < config.anomalyZScoreThreshold) return null;
  return {
    flowId,
    metric: metricName,
    latestValue,
    mean: avg,
    stddev: sd,
    zScore,
    detectedAt: new Date().toISOString(),
  };
}

export async function detectAnomalies(flowId: string): Promise<Anomaly[]> {
  const history = await getHistory(flowId);
  if (history.length < config.anomalyMinSamples) return [];

  const baseline = history.slice(0, -1);
  const latest = history[history.length - 1];

  const anomalies: Anomaly[] = [];
  const durationAnomaly = checkMetric(
    flowId,
    "durationMs",
    baseline.map((m) => m.durationMs),
    latest.durationMs,
  );
  if (durationAnomaly) anomalies.push(durationAnomaly);

  const errorRateAnomaly = checkMetric(
    flowId,
    "errorRate",
    baseline.map(errorRateOf),
    errorRateOf(latest),
  );
  if (errorRateAnomaly) anomalies.push(errorRateAnomaly);

  return anomalies;
}
