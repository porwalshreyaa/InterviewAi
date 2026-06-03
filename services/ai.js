import { groq } from "../groq.js";

export function parseJsonFromLLM(raw) {
  const trimmed = raw.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON object found in model response");
  return JSON.parse(jsonMatch[0]);
}

export async function generateInterviewReview({ role, candidateSummary, qaPairs }) {
  const transcript = qaPairs
    .map(
      (pair, i) =>
        `Q${i + 1} (${pair.type}): ${pair.question}\nA${i + 1}: ${pair.answer}`
    )
    .join("\n\n");

  const prompt = `
You are a senior technical interviewer. Review this completed mock interview.

Target role: "${role}"

Candidate profile summary:
${candidateSummary}

Interview transcript:
${transcript}

Return ONLY valid JSON with this exact structure:
{
  "overallScore": 0,
  "overallSummary": "",
  "strengthsShown": [],
  "areasToImprove": [],
  "questionReviews": [
    {
      "question": "",
      "answer": "",
      "score": 0,
      "feedback": ""
    }
  ],
  "recommendation": ""
}

Rules:
- overallScore and each question score: integer 1-10
- recommendation: one of "Strong hire", "Hire", "Maybe", "No hire"
- Be specific and reference what the candidate actually said
`;

  const completion = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
  });

  const raw = completion?.choices?.[0]?.message?.content;
  if (!raw) throw new Error("Empty review response from model");
  return parseJsonFromLLM(raw);
}

export async function streamInterviewReview({ role, candidateSummary, qaPairs, onChunk }) {
  const transcript = qaPairs
    .map(
      (pair, i) =>
        `Q${i + 1} (${pair.type}): ${pair.question}\nA${i + 1}: ${pair.answer}`
    )
    .join("\n\n");

  const prompt = `
You are a senior technical interviewer. Review this completed mock interview.

Target role: "${role}"

Candidate profile summary:
${candidateSummary}

Interview transcript:
${transcript}

Return ONLY valid JSON with this exact structure:
{
  "overallScore": 0,
  "overallSummary": "",
  "strengthsShown": [],
  "areasToImprove": [],
  "questionReviews": [
    {
      "question": "",
      "answer": "",
      "score": 0,
      "feedback": ""
    }
  ],
  "recommendation": ""
}

Rules:
- overallScore and each question score: integer 1-10
- recommendation: one of "Strong hire", "Hire", "Maybe", "No hire"
- Be specific and reference what the candidate actually said
`;

  const stream = await groq.chat.completions.create({
    model: "llama-3.3-70b-versatile",
    messages: [{ role: "user", content: prompt }],
    temperature: 0.3,
    stream: true,
  });

  let full = "";
  for await (const chunk of stream) {
    const text = chunk.choices[0]?.delta?.content || "";
    if (text) {
      full += text;
      onChunk(text);
    }
  }

  return parseJsonFromLLM(full);
}
