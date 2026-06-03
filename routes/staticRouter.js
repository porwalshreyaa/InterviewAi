import express from 'express';
const router = express.Router();
import handleCV from "../controllers/cv.js";
import multer from "multer";


router.get("/", async (req, res) => {
    delete req.session.data;
    return res.render("pages/home");
});

router.get("/resume", async (req, res) => {
    delete req.session.data;
    return res.render("pages/resume");
});

const upload = multer({ storage: multer.memoryStorage() });

router.route("/analyze")
    .get( (req,res) => {
        if (!req.session.data){
            return res.redirect("/resume")
        };
        res.render("pages/result", { data: req.session.data, role: req.session.role || "" });
    })
    .post(upload.single("cv"), handleCV)

router.get("/interview", (req, res) => {
    if (!req.session.data) {
        return res.redirect("/resume");
    }
    res.render("pages/interview", {
        role: req.session.role || "",
        candidateName: "Candidate",
    });
});

router.get("/interview/review", (req, res) => {
    if (!req.session.interview || req.session.interview.status !== "completed") {
        return res.redirect("/interview");
    }
    res.render("pages/review", {
        role: req.session.role || "",
        qaPairs: req.session.interview.answers || [],
        review: req.session.interviewReview || null,
    });
});


export default router;
