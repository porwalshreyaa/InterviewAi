import { PDFParse } from "pdf-parse";
import { groq } from "../groq.js";
import { parseJsonFromLLM } from "../services/ai.js";

async function handleCV(req, res) {
  try {
    const role = req.body.role;
    const fileBuffer = req.file?.buffer;

    if (!fileBuffer) {
      return res.status(400).render("pages/error", {
        status: 400,
        message: "CV file missing",
      });
    }
    if (!role) {
      return res.status(400).render("pages/error", {
        status: 400,
        message: "Which role are you preparing for?",
      });
    }

    const parser = new PDFParse({ data: fileBuffer });
    const parsed = await parser.getText();
    const cvText = parsed.text ?? "";

    const prompt = `You are an AI interview assistant. Analyze the candidate's CV for the role "${role}".

IMPORTANT RULES:
- Output ONLY valid JSON.
- Do NOT include markdown, comments, or explanations.
- Every field must be present.
- If any info is missing, use "unknown".

Return JSON with EXACTLY this structure:
{
  "summary": "",
  "interviewerBrief": {
    "overview": "",
    "keyHighlights": [],
    "concernsToProbe": [],
    "recommendedFocus": ""
  },
  "skills": {
    "hardSkills": [],
    "softSkills": []
  },
  "seniority": "",
  "strengths": [],
  "weaknesses": [],
  "technicalQuestions": [],
  "behavioralQuestions": []
}

Requirements:
- "summary": 5–7 sentence candidate summary from the CV.
- "interviewerBrief": brief for the hiring manager (overview, keyHighlights, concernsToProbe, recommendedFocus).
- "hardSkills" / "softSkills": from CV evidence.
- "seniority": junior, mid-level, senior, or unknown.
- "strengths" / "weaknesses": from CV evidence.
- "technicalQuestions": specific to role "${role}" and CV tools/projects.
- "behavioralQuestions": tied to CV projects, roles, and achievements.

CV TEXT:
${cvText}`;

    const completion = await groq.chat.completions.create({
      model: "llama-3.3-70b-versatile",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.2,
    });

    const raw = completion?.choices?.[0]?.message?.content;
    if (!raw) {
      return res.status(500).render("pages/error", {
        status: 500,
        message: "empty_model_response",
      });
    }

    try {
      req.session.data = parseJsonFromLLM(raw);
      req.session.role = role;
      return res.redirect("/analyze");
    } catch (err) {
      console.error("JSON parse error:", err);
      return res.status(500).render("pages/error", {
        status: 500,
        message: "The server returned invalid structured data. Please try again.",
      });
    }
  } catch (err) {
    console.error("CV analysis error:", err);
    return res.status(500).render("pages/error", {
      status: 500,
      message: "Server error.",
    });
  }
}

export default handleCV;
