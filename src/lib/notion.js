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
