// Vercel Serverless Function: 핵심 구간 분석 프록시
// 추론 서버(ml/inference_server.py)로 요청을 전달하여
// 자막 세그먼트의 중요도(0/1)를 반환합니다.
//
// 환경변수:
//   INFERENCE_SERVER_URL — 추론 서버 주소 (기본: http://localhost:8000)

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { text, segments } = req.body;
  if (!text && !segments) {
    return res.status(400).json({ error: "text 또는 segments가 필요합니다." });
  }

  // HuggingFace Spaces URL 또는 로컬 서버
  // Vercel 환경변수에서 설정: INFERENCE_SERVER_URL=https://<username>-easy-learning-inference.hf.space
  const serverUrl =
    process.env.INFERENCE_SERVER_URL || "http://localhost:8000";

  try {
    const response = await fetch(`${serverUrl}/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, segments }),
    });

    if (!response.ok) {
      const errText = await response.text();
      return res.status(502).json({
        error: "추론 서버 오류",
        detail: errText,
      });
    }

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    // 추론 서버 연결 실패 시 텍스트 기반 폴백
    if (error.cause?.code === "ECONNREFUSED" || error.message?.includes("fetch")) {
      return res.status(200).json(fallbackAnalyze(text, segments));
    }
    return res.status(500).json({
      error: "핵심 구간 분석 실패: " + error.message,
    });
  }
}

// 추론 서버 없을 때 키워드 기반 간이 분석 (폴백)
function fallbackAnalyze(text, inputSegments) {
  const importantPatterns = [
    /중요/,
    /핵심/,
    /꼭\s*기억/,
    /반드시/,
    /시험에?\s*(잘\s*)?나오/,
    /정리하면/,
    /요약하면/,
    /결론/,
    /포인트/,
    /다시\s*말하면/,
    /즉[,\s]/,
    /따라서/,
    /왜냐하면/,
    /원리는/,
    /공식/,
    /정의/,
    /개념/,
    /원인/,
    /결과적으로/,
    /첫\s*번째/,
    /두\s*번째/,
    /세\s*번째/,
  ];

  // 세그먼트 생성 (없으면 텍스트 분할)
  let segs = inputSegments;
  if (!segs || segs.length === 0) {
    const charsPerSeg = 150;
    const words = (text || "").split(/(?<=[.!?。])\s+/);
    segs = [];
    let current = "";
    let idx = 0;
    for (const w of words) {
      if (current.length + w.length > charsPerSeg && current) {
        segs.push({ text: current.trim(), start: idx * 30, duration: 30 });
        idx++;
        current = w;
      } else {
        current = current ? current + " " + w : w;
      }
    }
    if (current.trim()) {
      segs.push({ text: current.trim(), start: idx * 30, duration: 30 });
    }
  }

  const results = segs.map((seg) => {
    const txt = seg.text || "";
    const matchCount = importantPatterns.filter((p) => p.test(txt)).length;
    const isImportant = matchCount >= 2 || txt.length > 200;
    return {
      text: txt,
      start: seg.start ?? null,
      duration: seg.duration ?? null,
      label: isImportant ? 1 : 0,
      confidence: isImportant ? 0.6 + matchCount * 0.05 : 0.55,
      importance_score: isImportant ? 0.6 + matchCount * 0.05 : 0.3,
    };
  });

  return {
    results,
    total: results.length,
    important_count: results.filter((r) => r.label === 1).length,
    model_loaded: false,
    fallback: true,
  };
}
