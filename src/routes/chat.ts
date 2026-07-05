import { Router } from "express";
import { answerQuestion } from "../monitoring/chatDigest.js";

export const chatRouter = Router();

chatRouter.post("/", async (req, res) => {
  const question = typeof req.body?.question === "string" ? req.body.question.trim() : "";
  if (!question) {
    res.status(400).json({ error: "question은 필수입니다." });
    return;
  }
  const result = await answerQuestion(question);
  res.json(result);
});
