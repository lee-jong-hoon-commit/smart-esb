export interface FlowRunMetric {
  flowId: string;
  timestamp: string;
  durationMs: number;
  received: number;
  success: number;
  failed: number;
  filtered?: number;
}

export interface Anomaly {
  flowId: string;
  metric: "errorRate" | "durationMs";
  latestValue: number;
  mean: number;
  stddev: number;
  zScore: number;
  detectedAt: string;
}
