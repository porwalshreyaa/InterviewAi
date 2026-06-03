import { streamInterviewReview } from "../services/ai.js";

const MAX_QUESTIONS = 6;

function buildQuestionList(data) {
  const technical = (data.technicalQuestions || []).slice(0, 3).map((q) => ({
    type: "technical",
    text: q,
  }));
  const behavioral = (data.behavioralQuestions || []).slice(0, 3).map((q) => ({
    type: "behavioral",
    text: q,
  }));
  return [...technical, ...behavioral].slice(0, MAX_QUESTIONS);
}

function requireAnalysis(req, res) {
  if (!req.session.data) {
    res.status(400).json({ error: "No resume analysis found. Upload a resume first." });
    return false;
  }
  return true;
}

export function startInterview(req, res) {
  if (!requireAnalysis(req, res)) return;

  const questions = buildQuestionList(req.session.data);
  if (questions.length === 0) {
    return res.status(400).json({ error: "No interview questions available." });
  }

  req.session.interview = {
    status: "in_progress",
    currentIndex: 0,
    questions,
    answers: [],
    startedAt: new Date().toISOString(),
  };
  delete req.session.interviewReview;

  req.session.save((err) => {
    if (err) return res.status(500).json({ error: "Failed to start interview session." });
    res.json({
      totalQuestions: questions.length,
      currentIndex: 0,
      status: "in_progress",
    });
  });
}

export function getInterviewStatus(req, res) {
  const interview = req.session.interview;
  if (!interview) {
    return res.json({ status: "not_started" });
  }

  res.json({
    status: interview.status,
    currentIndex: interview.currentIndex,
    totalQuestions: interview.questions.length,
    answeredCount: interview.answers.length,
  });
}

export function streamQuestion(req, res) {
  const interview = req.session.interview;
  if (!interview || interview.status !== "in_progress") {
    return res.status(400).json({ error: "No active interview session." });
  }

  const idx = interview.currentIndex;
  if (idx >= interview.questions.length) {
    return res.status(400).json({ error: "All questions have been answered." });
  }

  const question = interview.questions[idx];
  const fullText = question.text;

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  const words = fullText.split(/(\s+)/);
  let buffer = "";

  const sendChunk = () => {
    if (words.length === 0) {
      res.write(
        `data: ${JSON.stringify({ done: true, index: idx, type: question.type, total: interview.questions.length })}\n\n`
      );
      res.end();
      return;
    }

    const chunk = words.splice(0, 2).join("");
    buffer += chunk;
    res.write(
      `data: ${JSON.stringify({ chunk, text: buffer, index: idx, type: question.type })}\n\n`
    );

    setTimeout(sendChunk, 35);
  };

  sendChunk();

  req.on("close", () => {
    words.length = 0;
  });
}

export function submitAnswer(req, res) {
  const interview = req.session.interview;
  if (!interview || interview.status !== "in_progress") {
    return res.status(400).json({ error: "No active interview session." });
  }

  const { answer } = req.body;
  if (!answer || !answer.trim()) {
    return res.status(400).json({ error: "Answer cannot be empty." });
  }

  const idx = interview.currentIndex;
  if (idx >= interview.questions.length) {
    return res.status(400).json({ error: "All questions already answered." });
  }

  const question = interview.questions[idx];
  interview.answers.push({
    question: question.text,
    answer: answer.trim(),
    type: question.type,
    answeredAt: new Date().toISOString(),
  });

  interview.currentIndex += 1;

  if (interview.currentIndex >= interview.questions.length) {
    interview.status = "completed";
    interview.completedAt = new Date().toISOString();
  }

  req.session.save((err) => {
    if (err) return res.status(500).json({ error: "Failed to save answer." });

    res.json({
      status: interview.status,
      currentIndex: interview.currentIndex,
      totalQuestions: interview.questions.length,
      isComplete: interview.status === "completed",
    });
  });
}

export async function streamReview(req, res) {
  const interview = req.session.interview;
  if (!interview || interview.status !== "completed") {
    return res.status(400).json({ error: "Interview is not complete yet." });
  }

  if (req.session.interviewReview) {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.flushHeaders?.();
    res.write(`data: ${JSON.stringify({ review: req.session.interviewReview, cached: true })}\n\n`);
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    return res.end();
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.flushHeaders?.();

  try {
    const review = await streamInterviewReview({
      role: req.session.role || "the role",
      candidateSummary: req.session.data.summary || "",
      qaPairs: interview.answers,
      onChunk: (chunk) => {
        res.write(`data: ${JSON.stringify({ chunk })}\n\n`);
      },
    });

    req.session.interviewReview = review;
    req.session.save(() => {
      res.write(`data: ${JSON.stringify({ review, done: true })}\n\n`);
      res.end();
    });
  } catch (err) {
    console.error("Review generation error:", err);
    res.write(`data: ${JSON.stringify({ error: "Failed to generate review." })}\n\n`);
    res.end();
  }
}

export function getReview(req, res) {
  if (!req.session.interviewReview) {
    return res.status(404).json({ error: "Review not available yet." });
  }
  res.json({
    review: req.session.interviewReview,
    qaPairs: req.session.interview?.answers || [],
    role: req.session.role,
  });
}
