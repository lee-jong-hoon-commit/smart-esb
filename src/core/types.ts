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

export const RoutingOperatorSchema = z.enum(["eq", "neq", "gt", "gte", "lt", "lte", "contains"]);
export type RoutingOperator = z.infer<typeof RoutingOperatorSchema>;

export const RoutingConditionSchema = z.object({
  field: z.string().describe("조건을 검사할 페이로드의 dot-path (예: stock.count)"),
  operator: RoutingOperatorSchema,
  value: z.union([z.string(), z.number(), z.boolean()]),
  description: z.string().optional().describe("이 규칙이 어떤 자연어 요청에서 생성되었는지"),
});
export type RoutingCondition = z.infer<typeof RoutingConditionSchema>;

export const FlowDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  source: ConnectorConfigSchema,
  destination: ConnectorConfigSchema,
  mapping: z.array(MappingRuleSchema).optional(),
  routing: RoutingConditionSchema.optional(),
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
  filtered: number;
  errors: string[];
}
