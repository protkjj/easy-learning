import { NOTION_CONFIG } from "./config";

export async function saveNoteToNotion(noteData, subject, division, professor) {
  try {
    const res = await fetch(NOTION_CONFIG.apiBase, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parent: { database_id: NOTION_CONFIG.databases.수업노트 },
        properties: {
          제목: { title: [{ text: { content: noteData.note.substring(0, 60) + "..." } }] },
          과목: { select: { name: subject } },
          영역: { select: { name: division } },
          날짜: { date: { start: new Date().toISOString().split("T")[0] } },
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
      }),
    });
    return res.ok;
  } catch {
    console.warn("노션 저장 실패 (오프라인 모드)");
    return false;
  }
}

export async function saveWrongAnswerToNotion(question, myAnswer, correctAnswer, explain, subject) {
  try {
    const res = await fetch(NOTION_CONFIG.apiBase, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parent: { database_id: NOTION_CONFIG.databases.오답노트 },
        properties: {
          문제: { title: [{ text: { content: question } }] },
          과목: { select: { name: subject } },
          "내가 고른 답": { rich_text: [{ text: { content: myAnswer } }] },
          정답: { rich_text: [{ text: { content: correctAnswer } }] },
          해설: { rich_text: [{ text: { content: explain } }] },
          "틀린 날짜": { date: { start: new Date().toISOString().split("T")[0] } },
          복습횟수: { number: 0 },
        },
      }),
    });
    return res.ok;
  } catch {
    console.warn("오답 노션 저장 실패");
    return false;
  }
}

// 진도 기록 저장
export async function saveProgressToNotion(subject, division, school, notesCount, quizScore, studyMinutes) {
  try {
    const res = await fetch(NOTION_CONFIG.apiBase, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        parent: { database_id: NOTION_CONFIG.databases.진도트래커 },
        properties: {
          과목: { title: [{ text: { content: subject } }] },
          영역: { select: { name: division } },
          학교: { select: { name: school } },
          날짜: { date: { start: new Date().toISOString().split("T")[0] } },
          "노트 수": { number: notesCount },
          "퀴즈 점수": { number: quizScore || 0 },
          "학습 시간(분)": { number: studyMinutes },
        },
      }),
    });
    return res.ok;
  } catch {
    console.warn("진도 저장 실패");
    return false;
  }
}

// 진도 데이터 불러오기
export async function fetchProgressFromNotion() {
  try {
    const res = await fetch(NOTION_CONFIG.apiBase, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "query",
        database_id: NOTION_CONFIG.databases.진도트래커,
      }),
    });
    if (!res.ok) return [];
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
    console.warn("진도 불러오기 실패");
    return [];
  }
}
