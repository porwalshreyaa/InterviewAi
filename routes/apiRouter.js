import express from "express";
import {
  startInterview,
  getInterviewStatus,
  streamQuestion,
  submitAnswer,
  streamReview,
  getReview,
} from "../controllers/interview.js";

const router = express.Router();

router.post("/interview/start", startInterview);
router.get("/interview/status", getInterviewStatus);
router.get("/interview/question/stream", streamQuestion);
router.post("/interview/answer", submitAnswer);
router.get("/interview/review/stream", streamReview);
router.get("/interview/review", getReview);

export default router;
