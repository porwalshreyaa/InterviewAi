import express from 'express';
const router = express.Router();
import handleCV from "../controllers/cv.js";
import multer from "multer";


router.get("/", async (req, res) => {
    delete req.session.data;
    return res.render("home");
});

router.get("/resume", async (req, res) => {
    delete req.session.data;
    return res.render("resume");
});

const upload = multer({ storage: multer.memoryStorage() });

router.route("/analyze")
    .get( (req,res) => {
        if (!req.session.data){
            return res.redirect("/resume")
        };
        res.render("result", { data: req.session.data });
    })
    .post(upload.single("cv"), handleCV)


export default router;
