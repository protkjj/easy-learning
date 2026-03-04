// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  AI PROVIDER (Claude preferred / OpenAI / Demo)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export async function callAI(messages, system, apiKey, provider) {
  if (provider === "demo") {
    await new Promise((r) => setTimeout(r, 800));
    return null;
  }

  const body =
    provider === "openai"
      ? { model: "gpt-4o-mini", messages: [{ role: "system", content: system }, ...messages], max_tokens: 1500 }
      : { model: "claude-sonnet-4-20250514", max_tokens: 1500, system, messages };

  // 1. Direct API (with user's key)
  if (apiKey) {
    try {
      const url = provider === "openai" ? "https://api.openai.com/v1/chat/completions" : "https://api.anthropic.com/v1/messages";
      const headers =
        provider === "openai"
          ? { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` }
          : { "Content-Type": "application/json", "x-api-key": apiKey, "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true" };

      const res = await fetch(url, { method: "POST", headers, body: JSON.stringify(body) });
      const d = await res.json();
      if (provider === "openai" && d.choices?.[0]?.message?.content) return d.choices[0].message.content;
      if (provider !== "openai" && d.content?.[0]?.text) return d.content[0].text;
    } catch (e) {
      console.warn("Direct API failed:", e.message);
    }
  }

  // 2. Server proxy (Vercel)
  try {
    const proxyUrl = provider === "openai" ? "/api/openai" : "/api/claude";
    const res = await fetch(proxyUrl, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) {
      const d = await res.json();
      if (provider === "openai") return d.choices?.[0]?.message?.content || null;
      return d.content?.[0]?.text || null;
    }
  } catch (e) {
    console.warn("Server proxy failed:", e.message);
  }

  console.warn("AI 호출 실패 — 데모 모드로 폴백됩니다.");
  return null;
}

export function parseJSON(raw) {
  try {
    return JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch {
    return null;
  }
}

// ── 프롬프트 빌더 ──────────────────────────────────────────

export function buildNoteSystem(school, division, subject, lang, prompt) {
  return `당신은 ${school} ${division} ${subject} 수업의 AI 필기 어시스턴트입니다.
수업 언어: ${lang}
과목 규칙: ${prompt}

당신은 단순 필기만 하는 게 아니라, 학생의 입장에서 **스스로 판단**합니다:
1. 이 내용이 학생에게 어려울 것 같으면 → "supplement" 필드에 쉬운 보충설명을 작성
2. 추가 검색이 도움될 것 같으면 → "auto_search" 필드에 {query, result} 형태로 검색 결과를 시뮬레이션
3. 개념 간 연결이 필요하면 → "connections" 필드에 관련 개념 연결 설명

아래 JSON 형식으로만 응답 (마크다운 블록 없이):
{
  "note": "구조화된 필기. 핵심개념 **굵게**, 소제목 ## 사용. 태그([빈출],[EBS],[주의],[수식:...] 등) 적극 활용",
  "insight": "어려운 개념 쉬운 비유 한 줄 (없으면 null)",
  "keywords": ["클릭 가능한 핵심 키워드 최대 4개"],
  "importance": "high|medium|low",
  "suneung_tip": "${school === "고등학교" ? "수능 출제 포인트 한 줄 (없으면 null)" : "null"}",
  "supplement": "AI가 판단하기에 학생이 어려워할 부분에 대한 보충설명 (필요 없으면 null)",
  "auto_search": {"query": "AI가 자동으로 판단한 검색 쿼리", "result": "검색 결과 요약 2~3줄"} 또는 null,
  "connections": "이 개념과 이전에 배운 개념/다른 과목과의 연결점 (없으면 null)"
}`;
}

export function buildExplainSystem(school, subject, keyword) {
  return `당신은 ${school} ${subject} 전문 튜터입니다.
"${keyword}"를 아래 JSON으로만 응답:
{
  "simple": "쉬운 1~2문장 설명",
  "analogy": "일상 비유 한 문장",
  "detail": "정확한 학문적 설명 2~3문장",
  "related": ["관련 개념 2~3개"]
}`;
}

export function buildQuizSystem(school, division, subject, notes, quizType) {
  return `당신은 ${school} ${division} ${subject} ${quizType} 출제자입니다.
수업 내용 기반 퀴즈 3문제를 JSON 배열로만 응답:
[{"q":"질문","options":["A","B","C","D"${school === "고등학교" ? ',"E"' : ""}],"answer":0,"explain":"해설","tag":"[빈출]|[핵심]|[응용] 중 하나"}]

수업 내용:
${notes}`;
}

// ── 데모 모드 응답 생성기 ──────────────────────────────────

export function generateDemoNote(text, school, division, subject) {
  const kws = text.split(/\s+/).filter((w) => w.length > 1).slice(0, 4);
  const isHS = school === "고등학교";
  return {
    note:
      `## ${subject} 핵심 정리\n\n**${text}**에 대한 구조화된 필기:\n\n` +
      `• **핵심 개념**: ${text.substring(0, 40)}의 기본 원리와 적용\n` +
      `• **세부 내용**: ${division} 영역에서 중요하게 다뤄지는 부분\n` +
      (isHS ? `• [빈출] 수능에서 2~3년 주기로 출제\n• [EBS] 연계교재 반복 등장 개념\n` : `• [핵심] 기말고사 서술형 대비 필수\n`) +
      `• **정리**: 반드시 암기해야 할 핵심 포인트`,
    insight: `쉽게 말하면, ${kws[0] || subject}은(는) ${subject}의 뼈대가 되는 개념. 건물의 기둥이라고 생각하면 됨!`,
    keywords: kws.length > 0 ? kws : [subject, division, "개념정리", "핵심"],
    importance: text.length > 30 ? "high" : "medium",
    suneung_tip: isHS ? `이 유형은 수능 ${subject}에서 거의 매년 출제됨. 선지 함정에 주의!` : null,
    supplement: `이 부분 핵심은:\n${text.substring(0, 30)}... 의 기본 원리를 먼저 이해하고, 응용으로 넘어가면 돼. "왜 그런지"를 먼저 파악하자.`,
    auto_search: {
      query: `${subject} ${kws[0] || "핵심개념"} 정리`,
      result: `${subject}의 ${kws[0] || "이 개념"}은 ${division} 분야의 기초 이론에서 파생. 시험에서 다양한 형태로 변형 출제됨.`,
    },
    connections: `이 개념은 ${subject}의 이전 단원 기초 이론과 직접 연결. ${division} 계열의 다른 과목에서도 비슷한 원리 적용!`,
  };
}

export function generateDemoExplain(keyword) {
  return {
    simple: `${keyword}은(는) 해당 분야의 핵심 개념으로, 기본 원리를 설명하는 데 사용됩니다.`,
    analogy: `${keyword}을 일상에 비유하면, 레고 블록의 기본 조각 같은 거야 — 이걸 조합해서 더 큰 구조를 만드는 기초 단위!`,
    detail: `${keyword}은(는) 학문적으로 해당 분야의 기반이 되는 개념입니다. 정확히 이해하면 심화 내용 학습에 큰 도움이 됩니다.`,
    related: ["기초이론", "응용개념", "심화학습"],
  };
}

export function generateDemoQuiz(school, subject) {
  const isHS = school === "고등학교";
  return [
    {
      q: `${subject}에서 다음 중 핵심 개념에 해당하는 것은?`,
      options: isHS
        ? ["기본 원리 A", "응용 개념 B", "핵심 정의 C", "관련 이론 D", "보조 개념 E"]
        : ["기본 원리 A", "응용 개념 B", "핵심 정의 C", "관련 이론 D"],
      answer: 2,
      explain: `정답은 C. ${subject}의 핵심 정의를 정확히 이해하는 것이 중요합니다.`,
      tag: "[핵심]",
    },
    {
      q: `다음 중 ${subject} 학습에서 올바른 설명은?`,
      options: isHS
        ? ["개념 A는 B와 무관하다", "기초 이론은 응용에 필수적이다", "암기만으로 충분하다", "실습은 불필요하다", "이론과 실제는 별개다"]
        : ["개념 A는 B와 무관하다", "기초 이론은 응용에 필수적이다", "암기만으로 충분하다", "실습은 불필요하다"],
      answer: 1,
      explain: `기초 이론의 이해가 응용력의 바탕이 됩니다.`,
      tag: "[빈출]",
    },
    {
      q: `${subject}의 기본 원리에 대한 설명으로 적절한 것은?`,
      options: isHS
        ? ["원리 이해 불필요", "반복만이 답", "개념 간 연결이 중요하다", "독립적 암기가 최선", "상위 개념만 학습"]
        : ["원리 이해 불필요", "반복만이 답", "개념 간 연결이 중요하다", "독립적 암기가 최선"],
      answer: 2,
      explain: `${subject}에서는 개념 간 연결고리를 이해하는 것이 가장 효과적입니다.`,
      tag: "[응용]",
    },
  ];
}
