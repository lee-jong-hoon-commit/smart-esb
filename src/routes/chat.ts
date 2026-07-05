import { Router } from "express";
import { z } from "zod";
import { answerQuestion } from "../ai/chatSummarizer.js";

export const chatRouter = Router();

const ChatRequestSchema = z.object({ question: z.string().min(1) });

chatRouter.post("/", async (req, res) => {
  const parsed = ChatRequestSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: parsed.error.flatten() });
    return;
  }
  const result = await answerQuestion(parsed.data.question);
  res.json(result);
});
