import { z } from "zod";

export const MappingRuleSchema = z.object({
  from: z.string().describe("소스 페이로드에서 값을 읽어올 dot-path (예: user.name)"),
  to: z.string().describe("타겟 페이로드에 값을 쓸 dot-path (예: customer.fullName)"),
  transform: z.string().optional().describe("적용할 내장 변환 함수 이름 (예: uppercase, toNumber)"),
});
export type MappingRule = z.infer<typeof MappingRuleSchema>;

export const ConnectorConfigSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("file"), path: z.string() }),
  z.object({ type: z.literal("memory"), queue: z.string() }),
  z.object({ type: z.literal("http"), url: z.string().url(), method: z.enum(["GET", "POST", "PUT", "PATCH"]).default("POST") }),
]);
export type ConnectorConfig = z.infer<typeof ConnectorConfigSchema>;

export const FlowDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  source: ConnectorConfigSchema,
  destination: ConnectorConfigSchema,
  mapping: z.array(MappingRuleSchema).optional(),
  createdAt: z.string(),
  updatedAt: z.string(),
});
export type FlowDefinition = z.infer<typeof FlowDefinitionSchema>;

export const FlowCreateInputSchema = FlowDefinitionSchema.omit({ id: true, createdAt: true, updatedAt: true });
export type FlowCreateInput = z.infer<typeof FlowCreateInputSchema>;

export interface Message {
  id: string;
  timestamp: string;
  payload: unknown;
  headers?: Record<string, string>;
}

export interface FlowRunResult {
  flowId: string;
  startedAt: string;
  durationMs: number;
  received: number;
  success: number;
  failed: number;
  errors: string[];
}
