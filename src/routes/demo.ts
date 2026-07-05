import { Router } from "express";

export const demoRouter = Router();

// 템플릿이 기본으로 가리키는 목적지 엔드포인트. 실제 운영에서는 Flow의 destination.url을
// 실제 사내 시스템/외부 API 주소로 교체해서 쓰면 됩니다.
demoRouter.post("/echo", (req, res) => {
  res.json({ received: true, payload: req.body });
});
