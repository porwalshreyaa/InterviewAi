import express from "express";
import handleCV from "../controllers/cv.js";
import { upload } from "../config/multer.js";

const router = express.Router();

router.get("/", (req, res) => {
  delete req.session.data;
  delete req.session.role;
  delete req.session.interview;
  delete req.session.interviewReview;
  res.render("pages/home");
});

router.get("/resume", (req, res) => {
  delete req.session.data;
  delete req.session.role;
  delete req.session.interview;
  delete req.session.interviewReview;
  res.render("pages/resume");
});

router
  .route("/analyze")
  .get((req, res) => {
    if (!req.session.data) {
      return res.redirect("/resume");
    }
    res.render("pages/result", {
      data: req.session.data,
      role: req.session.role || "",
    });
  })
  .post(upload.single("cv"), handleCV);

router.get("/interview", (req, res) => {
  if (!req.session.data) {
    return res.redirect("/resume");
  }
  res.render("pages/interview", { role: req.session.role || "" });
});

router.get("/interview/review", (req, res) => {
  if (!req.session.interview || req.session.interview.status !== "completed") {
    return res.redirect("/interview");
  }
  if (!req.session.interviewReview) {
    return res.redirect("/interview");
  }
  res.render("pages/review", {
    role: req.session.role || "",
    qaPairs: req.session.interview.answers || [],
    review: req.session.interviewReview,
  });
});

export default router;
