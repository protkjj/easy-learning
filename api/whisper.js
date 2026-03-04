// Vercel Serverless Function: OpenAI Whisper API 프록시
export const config = {
  api: { bodyParser: { sizeLimit: "25mb" } },
};

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: "OPENAI_API_KEY not configured" });
  }

  try {
    const { audio, language } = req.body;
    if (!audio) {
      return res.status(400).json({ error: "No audio data provided" });
    }

    // base64 → Buffer → Blob
    const audioBuffer = Buffer.from(audio, "base64");
    const formData = new FormData();
    formData.append("file", new Blob([audioBuffer], { type: "audio/webm" }), "audio.webm");
    formData.append("model", "whisper-1");
    formData.append("language", language === "English" ? "en" : "ko");
    formData.append("response_format", "text");

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}` },
      body: formData,
    });

    if (!response.ok) {
      const err = await response.text();
      return res.status(response.status).json({ error: err });
    }

    const text = await response.text();
    return res.status(200).json({ text });
  } catch (error) {
    return res.status(500).json({ error: "Whisper API call failed: " + error.message });
  }
}
