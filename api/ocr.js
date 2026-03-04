export const config = { api: { bodyParser: { sizeLimit: "10mb" } } };

// Vercel Serverless Function: OpenAI Vision OCR 프록시
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "Method not allowed" });

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) return res.status(500).json({ error: "OPENAI_API_KEY not configured" });

  const { image, mimeType } = req.body;
  if (!image) return res.status(400).json({ error: "No image data" });

  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "이 이미지에서 모든 텍스트를 정확하게 추출해주세요. 수식, 표, 도표의 내용도 텍스트로 변환해주세요. 칠판, PPT, 교과서, 노트 등 어떤 형태든 가능합니다. 추출한 텍스트만 반환하고, 추가 설명은 하지 마세요."
              },
              {
                type: "image_url",
                image_url: { url: `data:${mimeType || "image/png"};base64,${image}` }
              }
            ]
          }
        ],
        max_tokens: 4000,
      }),
    });

    const data = await response.json();
    const text = data.choices?.[0]?.message?.content || "";
    return res.status(200).json({ text });
  } catch (error) {
    return res.status(500).json({ error: "OCR failed: " + error.message });
  }
}
