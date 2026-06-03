import { toFile } from "groq-sdk";
import { groq } from "../groq.js";

export async function transcribeAudioBuffer(buffer, mimeType) {
  const extension = mimeType?.includes("mp4") ? "mp4" : "webm";

  const file = await toFile(buffer, `answer.${extension}`, {
    type: mimeType || "audio/webm",
  });

  const result = await groq.audio.transcriptions.create({
    file,
    model: "whisper-large-v3-turbo",
    language: "en",
    response_format: "json",
    temperature: 0,
  });

  return result.text?.trim() || "";
}
