export type InterfaceResult = "SUCCESS" | "PARTIAL" | "FAILED";

export interface RunRecord {
  id: string;
  payload: unknown;
  status: "SUCCESS" | "FAILED";
  error?: string;
}

export interface InterfaceRunSummary {
  transactionId: string;
  interfaceId: string;
  interfaceName: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  recordCount: number;
  failedCount: number;
  result: InterfaceResult;
  errorDetail: string | null;
}

export interface InterfaceRunDetail extends InterfaceRunSummary {
  records: RunRecord[];
}

export interface InterfaceErrorSummary {
  interfaceId: string;
  interfaceName: string;
  runs: number;
  recordCount: number;
  successRuns: number;
  partialRuns: number;
  failedRuns: number;
  sampleErrors: string[];
}
