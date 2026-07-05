import { z } from "zod";

const identifier = z.string().regex(/^[A-Za-z_][A-Za-z0-9_]*$/, "영문/숫자/밑줄로 시작하는 식별자만 허용합니다");

export const MappingRuleSchema = z.object({
  from: z.string().describe("소스 페이로드에서 값을 읽어올 dot-path (예: user.name)"),
  to: z.string().describe("타겟 페이로드에 값을 쓸 dot-path (예: customer.fullName)"),
  transform: z.string().optional().describe("적용할 내장 변환 함수 이름 (예: uppercase, toNumber)"),
});
export type MappingRule = z.infer<typeof MappingRuleSchema>;

export const ConnectorConfigSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("file"), path: z.string() }),
  z.object({ type: z.literal("memory"), queue: z.string() }),
  z.object({
    type: z.literal("http"),
    url: z.string().url(),
    method: z.enum(["GET", "POST", "PUT", "PATCH"]).default("POST"),
  }),
  z.object({
    type: z.literal("db"),
    table: identifier.describe("조회/적재할 테이블명"),
    watermarkColumn: identifier.optional().describe("source로 쓸 때: 증가값 기준 폴링 컬럼 (예: id)"),
    filter: z
      .object({ column: identifier, equals: z.union([z.string(), z.number(), z.boolean()]) })
      .optional()
      .describe("source로 쓸 때: 추가 WHERE 조건 (예: status = 'NEW')"),
  }),
]);
export type ConnectorConfig = z.infer<typeof ConnectorConfigSchema>;

export const FlowDefinitionSchema = z.object({
  id: z.string(),
  name: z.string(),
  source: ConnectorConfigSchema,
  destination: ConnectorConfigSchema,
  mapping: z.array(MappingRuleSchema).optional(),
  schedule: z.string().optional().describe("cron 표현식 (예: '0 1 * * *' = 매일 01:00). 없으면 수동/웹훅 실행만"),
  templateId: z.string().optional(),
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
