import { transcribeAudioBuffer } from "../services/transcription.js";

export async function transcribeAnswer(req, res) {
  try {
    if (!req.session.data) {
      return res.status(400).json({ error: "No resume analysis found." });
    }

    const draftText = req.body.draftText || "";
    const audioBuffer = req.file?.buffer;

    let text = "";

    if (audioBuffer?.length) {
      text = await transcribeAudioBuffer(audioBuffer, req.file.mimetype);
    } else if (draftText.trim()) {
      text = draftText.trim();
    }

    res.json({
      text,
      source: audioBuffer?.length ? "whisper" : draftText.trim() ? "draft" : "empty",
    });
  } catch (err) {
    console.error("Transcription error:", err);
    res.status(500).json({ error: "Failed to transcribe answer." });
  }
}
