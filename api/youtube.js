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

    // Parse XML to timed segments
    const segmentRegex = /<text\s+start="([^"]*)"(?:\s+dur="([^"]*)")?[^>]*>([\s\S]*?)<\/text>/g;
    const timedSegments = [];
    let m;
    while ((m = segmentRegex.exec(xml)) !== null) {
      const text = m[3]
        .replace(/&amp;/g, "&")
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .replace(/\s+/g, " ")
        .trim();
      if (text) {
        timedSegments.push({
          start: parseFloat(m[1]) || 0,
          duration: parseFloat(m[2]) || 0,
          text,
        });
      }
    }

    // Group into 30-second windows for highlight analysis
    const windowSec = 30;
    const grouped = [];
    let windowStart = 0;
    let windowTexts = [];

    for (const seg of timedSegments) {
      while (seg.start >= windowStart + windowSec && windowTexts.length > 0) {
        grouped.push({
          start: windowStart,
          duration: windowSec,
          text: windowTexts.join(" "),
        });
        windowStart += windowSec;
        windowTexts = [];
      }
      windowTexts.push(seg.text);
    }
    if (windowTexts.length > 0) {
      grouped.push({
        start: windowStart,
        duration: windowSec,
        text: windowTexts.join(" "),
      });
    }

    // Plain text transcript (기존 호환)
    const transcript = timedSegments.map((s) => s.text).join(" ");

    return res.status(200).json({
      transcript,
      title,
      videoId,
      segments: grouped,
    });
  } catch (error) {
    return res
      .status(500)
      .json({ error: "자막 추출 실패: " + error.message });
  }
}
