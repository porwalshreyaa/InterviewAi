import express from "express";
import { upload } from "../config/multer.js";
import {
  startInterview,
  streamQuestion,
  submitAnswer,
  streamReview,
} from "../controllers/interview.js";
import { transcribeAnswer } from "../controllers/transcription.js";

const router = express.Router();

router.post("/interview/start", startInterview);
router.get("/interview/question/stream", streamQuestion);
router.post("/interview/answer", submitAnswer);
router.post("/interview/transcribe", upload.single("audio"), transcribeAnswer);
router.get("/interview/review/stream", streamReview);

export default router;
