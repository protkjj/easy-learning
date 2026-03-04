import { NOTION_CONFIG } from "./config";

const NOTION_TIMEOUT = 15000;

// Notion API 호출 헬퍼 (타임아웃 + 에러 상세)
async function notionFetch(body, label) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), NOTION_TIMEOUT);
  try {
    const res = await fetch(NOTION_CONFIG.apiBase, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      console.warn(`[Notion] ${label} 실패 (${res.status}):`, errBody);
    }
    return res;
  } catch (e) {
    clearTimeout(timeout);
    if (e.name === "AbortError") console.warn(`[Notion] ${label} 타임아웃 (${NOTION_TIMEOUT / 1000}초)`);
    else console.warn(`[Notion] ${label} 네트워크 오류:`, e.message);
    return null;
  }
}

function localDateStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function saveNoteToNotion(noteData, subject, division, professor) {
  const res = await notionFetch({
    parent: { database_id: NOTION_CONFIG.databases.수업노트 },
    properties: {
      제목: { title: [{ text: { content: noteData.note.substring(0, 60) + "..." } }] },
      과목: { select: { name: subject } },
      영역: { select: { name: division } },
      날짜: { date: { start: localDateStr() } },
      선생님: { rich_text: [{ text: { content: professor || "" } }] },
      중요도: { select: { name: noteData.importance === "high" ? "핵심" : noteData.importance === "low" ? "참고" : "보통" } },
      "수능 포인트": { rich_text: [{ text: { content: noteData.suneung_tip || "" } }] },
      "AI 인사이트": { rich_text: [{ text: { content: noteData.insight || "" } }] },
    },
    children: [
      {
        object: "block",
        type: "paragraph",
        paragraph: { rich_text: [{ text: { content: noteData.note } }] },
      },
    ],
  }, "수업노트 저장");
  return res?.ok || false;
}

export async function saveWrongAnswerToNotion(question, myAnswer, correctAnswer, explain, subject, reviewCount = 0) {
  const res = await notionFetch({
    parent: { database_id: NOTION_CONFIG.databases.오답노트 },
    properties: {
      문제: { title: [{ text: { content: question } }] },
      과목: { select: { name: subject } },
      "내가 고른 답": { rich_text: [{ text: { content: myAnswer } }] },
      정답: { rich_text: [{ text: { content: correctAnswer } }] },
      해설: { rich_text: [{ text: { content: explain } }] },
      "틀린 날짜": { date: { start: localDateStr() } },
      복습횟수: { number: reviewCount },
    },
  }, "오답노트 저장");
  return res?.ok || false;
}

// 진도 기록 저장
export async function saveProgressToNotion(subject, division, school, notesCount, quizScore, studyMinutes) {
  const res = await notionFetch({
    parent: { database_id: NOTION_CONFIG.databases.진도트래커 },
    properties: {
      과목: { title: [{ text: { content: subject } }] },
      영역: { select: { name: division } },
      학교: { select: { name: school } },
      날짜: { date: { start: localDateStr() } },
      "노트 수": { number: notesCount },
      "퀴즈 점수": { number: quizScore || 0 },
      "학습 시간(분)": { number: studyMinutes },
    },
  }, "진도 저장");
  return res?.ok || false;
}

// 진도 데이터 불러오기
export async function fetchProgressFromNotion() {
  const res = await notionFetch({
    action: "query",
    database_id: NOTION_CONFIG.databases.진도트래커,
  }, "진도 불러오기");
  if (!res?.ok) return [];
  try {
    const data = await res.json();
    return (data.results || []).map(page => {
      const p = page.properties;
      return {
        id: page.id,
        subject: p.과목?.title?.[0]?.text?.content || "",
        division: p.영역?.select?.name || "",
        school: p.학교?.select?.name || "",
        date: p.날짜?.date?.start || "",
        notesCount: p["노트 수"]?.number || 0,
        quizScore: p["퀴즈 점수"]?.number || 0,
        studyMinutes: p["학습 시간(분)"]?.number || 0,
      };
    });
  } catch {
    return [];
  }
}
