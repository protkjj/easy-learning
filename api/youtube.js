// Vercel Serverless Function: YouTube 자막 추출
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { url } = req.body;
  if (!url) {
    return res.status(400).json({ error: "No URL provided" });
  }

  // Extract video ID from various YouTube URL formats
  const match = url.match(
    /(?:v=|youtu\.be\/|\/v\/|\/embed\/)([a-zA-Z0-9_-]{11})/
  );
  if (!match) {
    return res.status(400).json({ error: "Invalid YouTube URL" });
  }
  const videoId = match[1];

  try {
    // Fetch the YouTube watch page
    const pageRes = await fetch(
      `https://www.youtube.com/watch?v=${videoId}`,
      {
        headers: {
          "Accept-Language": "ko-KR,ko;q=0.9,en;q=0.8",
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        },
      }
    );
    const html = await pageRes.text();

    // Extract title
    const titleMatch = html.match(/<title>([^<]*)<\/title>/);
    const title = titleMatch
      ? titleMatch[1].replace(" - YouTube", "").trim()
      : "YouTube 영상";

    // Extract caption tracks from page data
    const captionMatch = html.match(/"captionTracks":\s*(\[.*?\])/);
    if (!captionMatch) {
      return res.status(404).json({
        error:
          "자막을 찾을 수 없습니다. 자막이 있는 영상을 사용해주세요.",
      });
    }

    const tracks = JSON.parse(captionMatch[1]);
    // Prefer Korean, then English, then first available
    const track =
      tracks.find((t) => t.languageCode === "ko") ||
      tracks.find((t) => t.languageCode === "en") ||
      tracks[0];

    if (!track?.baseUrl) {
      return res
        .status(404)
        .json({ error: "자막 URL을 찾을 수 없습니다." });
    }

    // Fetch actual transcript XML
    const captionRes = await fetch(track.baseUrl);
    const xml = await captionRes.text();

    // Parse XML to plain text
    const transcript = xml
      .replace(/<[^>]+>/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/\s+/g, " ")
      .trim();

    return res.status(200).json({ transcript, title, videoId });
  } catch (error) {
    return res
      .status(500)
      .json({ error: "자막 추출 실패: " + error.message });
  }
}
