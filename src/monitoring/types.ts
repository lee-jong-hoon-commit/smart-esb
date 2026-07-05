export interface FlowRunLog {
  id: number;
  flowId: string;
  flowName: string;
  timestamp: string;
  durationMs: number;
  received: number;
  success: number;
  failed: number;
  errors: string[];
}

export interface FlowErrorSummary {
  flowId: string;
  flowName: string;
  runs: number;
  received: number;
  success: number;
  failed: number;
  sampleErrors: string[];
}
