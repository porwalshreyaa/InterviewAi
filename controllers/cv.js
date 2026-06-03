import { PDFParse } from "pdf-parse";
import { groq } from "../groq.js";
import { parseJsonFromLLM } from "../services/ai.js";


async function handleCV(req, res) {
    try {
        const role = req.body.role;
        const fileBuffer = req.file?.buffer;

        if (!fileBuffer) {
            console.log(req)
            return res.status(400).render("pages/error",{ status: 400, message: "CV file missing" });
        }
        if (!role) {
            console.log(req)
            return res.status(400).render("pages/error",{ status: 400, message: "Which role are you preparing for?" });
        }
        const parser = new PDFParse({ data: fileBuffer });
        const parsed = await parser.getText();
        const cvText = parsed.text ?? "";

        console.log(cvText);

        const prompt = `
      You are an AI interview assistant. Your job is to:
      1. Read and analyze the candidate's CV in detail.
      2. Understand the target role: "${role}".
      3. Infer the candidate's profile, strengths, weaknesses, skills, and seniority.
      4. Generate interview questions SPECIFICALLY tailored to:
         - this candidate's CV  
         - this candidate's experience  
         - the role "${role}"
      
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
      
      DETAILED REQUIREMENTS:
      
      - "summary": A concise 5–7 sentence summary of the candidate created from the CV.
      - "interviewerBrief": A brief for the hiring manager / interviewer (NOT the candidate):
          - "overview": 3–4 sentences on who this candidate is and fit for "${role}"
          - "keyHighlights": 3–5 bullet-worthy strengths to validate in interview
          - "concernsToProbe": 2–4 gaps or risks to explore during interview
          - "recommendedFocus": 1–2 sentences on what areas the interview should emphasize
      - "hardSkills": Extract technologies, tools, programming skills, frameworks, certifications, domain skills.
      - "softSkills": Extract behavioral, communication, leadership, teamwork, problem-solving skills.
      - "seniority": Determine if the candidate is junior, mid-level, senior, or unknown.
      - "strengths": Based on real evidence from the CV.
      - "weaknesses": Based on gaps or areas not strongly shown in the CV.
      - "technicalQuestions": 
          1. Must be highly specific to the role "${role}".
          2. Must reflect the tools, languages, or projects in the CV.
      - "behavioralQuestions":
          1. Must use events from the CV (projects, roles, achievements).
          2. Must test mindset, teamwork, ownership, conflict handling, failures, leadership.
      
      Now analyze this CV text and generate the JSON:
      
      CV TEXT:
      ${cvText}
      `;
        const completion = await groq.chat.completions.create({
            model: "llama-3.3-70b-versatile",
            messages: [{ role: "user", content: prompt }],
            temperature: 0.2
        });

        const raw = completion?.choices?.[0]?.message?.content;
        console.log("RAW MODEL OUTPUT:", raw);

        if (!raw) {
            return res.status(500).render("pages/error",{ status:500, message: "empty_model_response" });
        }
        try {
            req.session.data = parseJsonFromLLM(raw);
            req.session.role = role;

            return res.redirect("/analyze");
        } catch (err) {
            console.error("JSON PARSE ERROR:", err);
            console.log("RAW TEXT:\n", raw);
            return res.status(500).render("pages/error",{
                status:500,
                message: "The server returned invalid structured data. Please try again."
            });
        }

    } catch (err) {
        console.error("SERVER ERROR:", err);
        return res.status(500).render("pages/error",{status:500, message: "Server error."});
    }
}


export default handleCV;