import { useState, useRef, useEffect, useCallback } from "react";

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  DATA CONFIG
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const CONFIG = {
  고등학교: {
    icon: "📚",
    color: "#f59e0b",
    quizType: "5지선다 (수능형)",
    계열: {
      "수능 공통": {
        subjects: ["국어", "수학", "영어"],
        prompt: `수능 출제 경향에 맞춰 필기하라. 핵심 개념은 ★ 표시, EBS 연계 포인트는 [EBS] 태그, 자주 출제되는 포인트는 [빈출] 태그를 달아라. 퀴즈는 반드시 5지선다로 생성하라.`,
      },
      사회탐구: {
        subjects: ["한국사", "생활과 윤리", "윤리와 사상", "한국지리", "세계지리", "동아시아사", "세계사", "경제", "정치와 법", "사회·문화"],
        prompt: `사탐 수능 기출 흐름에 맞춰 필기하라. 연도·사건·인물은 굵게, 인과관계는 → 로 표시. 선지에 자주 나오는 오개념은 [주의] 태그. 5지선다 퀴즈 생성.`,
      },
      과학탐구: {
        subjects: ["물리학Ⅰ", "물리학Ⅱ", "화학Ⅰ", "화학Ⅱ", "생명과학Ⅰ", "생명과학Ⅱ", "지구과학Ⅰ", "지구과학Ⅱ"],
        prompt: `과탐 수능 기출 흐름에 맞춰 필기하라. 수식은 [수식: ...], 단위 항상 명시. 실험 조건과 결과는 표 형태로 정리. [빈출] 개념 태깅. 5지선다 퀴즈.`,
      },
      직업탐구: {
        subjects: ["농업 기초 기술", "공업 일반", "상업 경제", "수산·해운 산업 기초", "인간 발달"],
        prompt: `직탐 수능 기준으로 필기. 실무 개념과 이론 연결, 핵심 용어 정의 중심. 5지선다 퀴즈.`,
      },
    },
  },
  대학교: {
    icon: "🎓",
    color: "#6366f1",
    quizType: "4지선다 + 서술형",
    계열: {
      인문: {
        subjects: ["철학", "역사학", "문학", "언어학", "심리학", "사회학", "문화인류학", "종교학"],
        prompt: `논리 흐름과 핵심 주장을 중심으로 필기. 학자명·저서는 [출처: ...], 논쟁 구도는 A ↔ B 형태로. 비판적 시각과 반론도 함께 정리. 4지선다 + 서술형 퀴즈.`,
      },
      상경: {
        subjects: ["경제학", "경영학", "회계학", "통계학", "마케팅", "재무관리", "국제경영", "데이터분석"],
        prompt: `경제·경영 모델과 실무 적용을 중심으로 필기. 핵심 변수는 굵게, 수식은 [수식: ...], 그래프 설명 시 축/이동 방향 명시. 정책 함의는 별도 정리. 4지선다 퀴즈.`,
      },
      자연: {
        subjects: ["수학", "통계학", "물리학", "화학", "생물학", "지구과학", "천문학", "환경과학"],
        prompt: `수식은 [수식: ...] 유니코드 기호 사용. 증명은 단계별 번호. 정리/법칙은 [정리: 이름] 형태. 단위 항상 명시. LaTeX 없이 유니코드로 수식 표현. 4지선다 퀴즈.`,
      },
      공학: {
        subjects: ["기계공학", "전기공학", "전자공학", "컴퓨터공학", "화학공학", "토목공학", "건축학", "산업공학", "AI/머신러닝"],
        prompt: `알고리즘은 의사코드, 시간복잡도는 O() 표기. 회로/시스템은 블록 텍스트 다이어그램. 설계 원칙과 trade-off 명시. 코드 예시는 인라인으로. 4지선다 퀴즈.`,
      },
      "의학/보건": {
        subjects: ["해부학", "생리학", "병리학", "약리학", "내과학", "외과학", "간호학", "공중보건학"],
        prompt: `의학 용어는 한영 병기 (예: 심근경색 Myocardial Infarction). 기전(Mechanism)은 단계별 번호. 임상 증상→진단→치료 흐름으로 정리. 금기사항은 [주의] 태그. 4지선다 퀴즈.`,
      },
    },
  },
};

const LANGS = ["한국어", "English", "혼합 (한+영)"];

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  NOTION CONFIG (생성된 DB ID)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const NOTION_CONFIG = {
  // 실제 운영 시 서버 사이드 프록시를 통해 호출해야 함
  apiBase: "/api/notion", // 프록시 엔드포인트
  databases: {
    진도트래커: "8e94a12d-f75b-446d-a614-0c88a72bdded",
    수업노트: "41f055ed-133c-4ab8-ac33-022d552f7f92",
    오답노트: "4b21c47b-12c1-4faf-9946-0e121dd0d684",
  },
};

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  CLAUDE API
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function callClaude(messages, system, apiKey) {
  if (!apiKey) return "";
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "anthropic-dangerous-direct-browser-access": "true",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1500,
      system,
      messages,
    }),
  });
  const d = await res.json();
  return d.content?.[0]?.text || "";
}

function parseJSON(raw) {
  try {
    return JSON.parse(raw.replace(/```json|```/g, "").trim());
  } catch {
    return null;
  }
}

// ── 필기 + AI 자동 판단 (서칭/보충설명) 통합 프롬프트 ──────
function buildNoteSystem(school, division, subject, lang, prompt) {
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

function buildExplainSystem(school, subject, keyword) {
  return `당신은 ${school} ${subject} 전문 튜터입니다.
"${keyword}"를 아래 JSON으로만 응답:
{
  "simple": "쉬운 1~2문장 설명",
  "analogy": "일상 비유 한 문장",
  "detail": "정확한 학문적 설명 2~3문장",
  "related": ["관련 개념 2~3개"]
}`;
}

function buildQuizSystem(school, division, subject, notes, quizType) {
  return `당신은 ${school} ${division} ${subject} ${quizType} 출제자입니다.
수업 내용 기반 퀴즈 3문제를 JSON 배열로만 응답:
[{"q":"질문","options":["A","B","C","D"${school === "고등학교" ? ',"E"' : ""}],"answer":0,"explain":"해설","tag":"[빈출]|[핵심]|[응용] 중 하나"}]

수업 내용:
${notes}`;
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  NOTION 저장 함수
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

async function saveNoteToNotion(noteData, subject, division, professor) {
  try {
    const res = await fetch(`${NOTION_CONFIG.apiBase}/pages`, {
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

async function saveWrongAnswerToNotion(question, myAnswer, correctAnswer, explain, subject) {
  try {
    const res = await fetch(`${NOTION_CONFIG.apiBase}/pages`, {
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

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  MAIN COMPONENT
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

export default function App() {
  const [phase, setPhase] = useState("select");
  const [school, setSchool] = useState(null);
  const [division, setDivision] = useState(null);
  const [subject, setSubject] = useState(null);
  const [lang, setLang] = useState("한국어");
  const [professor, setProfessor] = useState("");
  const [notes, setNotes] = useState([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [popup, setPopup] = useState(null);
  const [elapsed, setElapsed] = useState(0);
  const [quiz, setQuiz] = useState({ active: false, data: [], idx: 0, selected: null, score: 0, done: false, loading: false });
  const [tab, setTab] = useState("live");
  const [notionStatus, setNotionStatus] = useState(null); // "saving"|"saved"|"failed"
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("lectureai_apikey") || "");
  const timerRef = useRef(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const cfg = school ? CONFIG[school] : null;
  const divCfg = cfg && division ? cfg.계열[division] : null;

  useEffect(() => {
    if (phase === "session") {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
      return () => clearInterval(timerRef.current);
    }
  }, [phase]);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [notes, loading]);

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

  // ── 수업 내용 → AI 필기 + 자동 판단 ─────────────────────
  const processNote = useCallback(async () => {
    if (!input.trim() || loading) return;
    const text = input.trim();
    setInput("");
    setLoading(true);

    const sys = buildNoteSystem(school, division, subject, lang, divCfg.prompt);
    const raw = await callClaude([{ role: "user", content: `수업 내용: "${text}"` }], sys, apiKey);
    const parsed = parseJSON(raw);

    const noteObj = {
      id: Date.now(),
      time: fmt(elapsed),
      raw: text,
      note: parsed?.note || text,
      insight: parsed?.insight || null,
      keywords: parsed?.keywords || [],
      importance: parsed?.importance || "medium",
      suneung_tip: parsed?.suneung_tip || null,
      supplement: parsed?.supplement || null,
      auto_search: parsed?.auto_search || null,
      connections: parsed?.connections || null,
    };

    setNotes((prev) => [...prev, noteObj]);
    setLoading(false);
    inputRef.current?.focus();

    // 노션 백그라운드 저장
    setNotionStatus("saving");
    const ok = await saveNoteToNotion(noteObj, subject, division, professor);
    setNotionStatus(ok ? "saved" : "failed");
    setTimeout(() => setNotionStatus(null), 2000);
  }, [input, loading, school, division, subject, lang, elapsed, divCfg, professor]);

  // ── 키워드 설명 ──────────────────────────────────────────
  const explainKw = async (kw) => {
    setPopup({ kw, data: null, loading: true });
    const sys = buildExplainSystem(school, subject, kw);
    const raw = await callClaude([{ role: "user", content: `"${kw}" 설명해주세요.` }], sys, apiKey);
    const data = parseJSON(raw);
    setPopup({ kw, data, loading: false });
  };

  // ── 퀴즈 생성 ───────────────────────────────────────────
  const genQuiz = async () => {
    setQuiz((q) => ({ ...q, loading: true }));
    const allNotes = notes.map((n) => n.note).join("\n");
    const sys = buildQuizSystem(school, division, subject, allNotes, cfg.quizType);
    const raw = await callClaude([{ role: "user", content: "퀴즈 만들어주세요." }], sys, apiKey);
    const data = parseJSON(raw) || [];
    setQuiz({ active: true, data, idx: 0, selected: null, score: 0, done: false, loading: false });
  };

  // ── 퀴즈 오답 → 노션 저장 ───────────────────────────────
  const handleQuizSelect = (i) => {
    if (quiz.selected !== null) return;
    const correct = i === quiz.data[quiz.idx].answer;
    setQuiz((q) => ({ ...q, selected: i, score: q.score + (correct ? 1 : 0) }));

    // 오답이면 노션에 자동 저장
    if (!correct) {
      const q = quiz.data[quiz.idx];
      const optLabel = school === "고등학교" ? "①②③④⑤".split("") : ["A", "B", "C", "D"];
      saveWrongAnswerToNotion(q.q, `${optLabel[i]} ${q.options[i]}`, `${optLabel[q.answer]} ${q.options[q.answer]}`, q.explain || "", subject);
    }
  };

  // ── 마크다운 렌더 ───────────────────────────────────────
  const md = (t) =>
    t
      .replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>")
      .replace(/## (.*?)(<br|$)/g, '<span class="nh">$1</span><br/>')
      .replace(/\[빈출\]/g, '<span class="tag-freq">빈출</span>')
      .replace(/\[EBS\]/g, '<span class="tag-ebs">EBS</span>')
      .replace(/\[주의\]/g, '<span class="tag-warn">주의</span>')
      .replace(/\[핵심\]/g, '<span class="tag-key">핵심</span>')
      .replace(/\[수식: (.*?)\]/g, '<code class="formula">$1</code>')
      .replace(/\[정리: (.*?)\]/g, '<span class="tag-theorem">$1</span>')
      .replace(/\[출처: (.*?)\]/g, '<span class="tag-src">$1</span>')
      .replace(/\n/g, "<br/>");

  const accent = cfg?.color || "#6366f1";
  const CSS = buildCSS(accent);

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  PHASE: SELECT
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (phase === "select")
    return (
      <div style={S.page}>
        <style>{CSS}</style>
        <div className="select-wrap">
          <div className="brand">✦ LECTUREAI</div>
          <h1 className="big-title">
            어디서 듣는
            <br />
            수업인가요?
          </h1>
          <div className="school-cards">
            {Object.entries(CONFIG).map(([name, c]) => (
              <button
                key={name}
                className="school-card"
                style={{ "--sc": c.color }}
                onClick={() => {
                  setSchool(name);
                  setDivision(null);
                  setSubject(null);
                  setPhase("setup");
                }}
              >
                <div className="sc-icon">{c.icon}</div>
                <div className="sc-name">{name}</div>
                <div className="sc-sub">{Object.keys(c.계열).join(" · ")}</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  PHASE: SETUP
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (phase === "setup")
    return (
      <div style={S.page}>
        <style>{CSS}</style>
        <div className="setup-wrap">
          <button className="back-btn" onClick={() => setPhase("select")}>
            ← 뒤로
          </button>
          <div className="brand" style={{ color: accent }}>
            {cfg.icon} {school}
          </div>
          <h1 className="setup-title">수업 세팅</h1>

          <div className="s-label">계열 / 영역</div>
          <div className="chips">
            {Object.keys(cfg.계열).map((d) => (
              <button
                key={d}
                className={`chip ${division === d ? "on" : ""}`}
                onClick={() => {
                  setDivision(d);
                  setSubject(null);
                }}
              >
                {d}
              </button>
            ))}
          </div>

          {division && (
            <>
              <div className="s-label">과목</div>
              <div className="chips">
                {cfg.계열[division].subjects.map((s) => (
                  <button key={s} className={`chip ${subject === s ? "on" : ""}`} onClick={() => setSubject(s)}>
                    {s}
                  </button>
                ))}
              </div>
            </>
          )}

          {subject && (
            <>
              <div className="s-label">수업 언어</div>
              <div className="chips">
                {LANGS.map((l) => (
                  <button key={l} className={`chip ${lang === l ? "on" : ""}`} onClick={() => setLang(l)}>
                    {l}
                  </button>
                ))}
              </div>

              <div className="s-label">
                교수 / 선생님 <span style={{ color: "#333", fontWeight: 400 }}>선택</span>
              </div>
              <input
                className="s-input"
                placeholder="예: 김민준 선생님"
                value={professor}
                onChange={(e) => setProfessor(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && setPhase("session")}
              />

              <div className="s-label">
                Claude API Key <span style={{ color: "#999", fontWeight: 400 }}>선택 — 없으면 UI만 테스트</span>
              </div>
              <input
                className="s-input"
                type="password"
                placeholder="sk-ant-..."
                value={apiKey}
                onChange={(e) => {
                  setApiKey(e.target.value);
                  localStorage.setItem("lectureai_apikey", e.target.value);
                }}
              />

              <div className="quiz-type-badge">퀴즈 형식: {cfg.quizType}</div>

              <button
                className="start-btn"
                onClick={() => {
                  setNotes([]);
                  setElapsed(0);
                  setPhase("session");
                }}
              >
                <span className="dot-live" style={{ background: "#fff" }} /> 수업 시작
              </button>
            </>
          )}
        </div>
      </div>
    );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  PHASE: QUIZ
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  if (quiz.active)
    return (
      <div style={S.page}>
        <style>{CSS}</style>
        <div className="quiz-wrap">
          {!quiz.done ? (
            <>
              <div className="quiz-prog">
                {quiz.data.map((_, i) => (
                  <div key={i} className="qbar" style={{ background: i <= quiz.idx ? accent : "#e5e7eb", opacity: i < quiz.idx ? 0.7 : 1 }} />
                ))}
              </div>
              <div className="quiz-meta">
                <span className="qcnt">
                  Q{quiz.idx + 1}/{quiz.data.length}
                </span>
                {quiz.data[quiz.idx]?.tag && <span className="quiz-tag">{quiz.data[quiz.idx].tag}</span>}
              </div>
              <div className="quiz-q">{quiz.data[quiz.idx]?.q}</div>
              {quiz.data[quiz.idx]?.options.map((opt, i) => (
                <button
                  key={i}
                  className={`q-opt ${quiz.selected !== null ? (i === quiz.data[quiz.idx].answer ? "opt-ok" : quiz.selected === i ? "opt-ng" : "") : ""}`}
                  onClick={() => handleQuizSelect(i)}
                  disabled={quiz.selected !== null}
                >
                  <span className="opt-l">{school === "고등학교" ? "①②③④⑤".split("")[i] : String.fromCharCode(65 + i)}</span>
                  {opt}
                </button>
              ))}
              {quiz.selected !== null && (
                <>
                  <div className="quiz-exp">{quiz.data[quiz.idx]?.explain}</div>
                  {quiz.selected !== quiz.data[quiz.idx].answer && <div className="notion-save-badge">📋 오답노트에 자동 저장됨</div>}
                  <button
                    className="qnext"
                    onClick={() => {
                      if (quiz.idx + 1 >= quiz.data.length) setQuiz((q) => ({ ...q, done: true }));
                      else setQuiz((q) => ({ ...q, idx: q.idx + 1, selected: null }));
                    }}
                  >
                    {quiz.idx + 1 >= quiz.data.length ? "결과 보기 →" : "다음 →"}
                  </button>
                </>
              )}
            </>
          ) : (
            <>
              <div className="result-score" style={{ color: accent }}>
                {quiz.score}
                <span className="rs-denom">/{quiz.data.length}</span>
              </div>
              <div className="result-msg">
                {quiz.score === quiz.data.length ? "🎉 완벽!" : quiz.score >= quiz.data.length * 0.6 ? "👍 잘했어요" : "📖 복습 필요"}
              </div>
              <button className="start-btn" style={{ marginTop: 28 }} onClick={() => setQuiz((q) => ({ ...q, active: false }))}>
                ← 수업으로 돌아가기
              </button>
            </>
          )}
        </div>
      </div>
    );

  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  //  PHASE: SESSION
  // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
  return (
    <div style={S.page}>
      <style>{CSS}</style>

      {/* 헤더 */}
      <div className="hdr">
        <div className="hdr-l">
          <span className="dot-live" style={{ background: accent }} />
          <span className="hdr-school" style={{ color: accent }}>
            {school === "고등학교" ? "📚" : "🎓"}
          </span>
          <span className="hdr-div">{division}</span>
          <span className="hdr-sub">{subject}</span>
          {professor && <span className="badge2">{professor}</span>}
          <span className="badge2">{lang}</span>
        </div>
        <div className="hdr-timer">{fmt(elapsed)}</div>
        <div className="hdr-r">
          {notionStatus && (
            <span className={`notion-sync ${notionStatus}`}>
              {notionStatus === "saving" ? "⏳ 노션 저장 중" : notionStatus === "saved" ? "✅ 노션 저장됨" : "⚠️ 저장 실패"}
            </span>
          )}
          <button
            className="end-btn"
            onClick={() => {
              clearInterval(timerRef.current);
              setPhase("setup");
            }}
          >
            종료 →
          </button>
        </div>
      </div>

      {/* 탭바 */}
      <div className="tabbar">
        {["live", "all"].map((t) => (
          <button key={t} className={`tabbt ${tab === t ? "tabon" : ""}`} style={tab === t ? { "--ac": accent } : {}} onClick={() => setTab(t)}>
            {t === "live" ? "실시간 필기" : "전체 노트"}
          </button>
        ))}
        <div style={{ flex: 1 }} />
        <button className="quiztrig" style={{ "--ac": accent }} onClick={genQuiz} disabled={notes.length === 0 || quiz.loading}>
          {quiz.loading ? "생성 중…" : "📝 복습 퀴즈"}
        </button>
      </div>

      {/* 노트 */}
      <div className="notes-scroll" ref={scrollRef}>
        {notes.length === 0 && !loading && (
          <div className="empty">
            <div style={{ fontSize: 40, marginBottom: 16 }}>{school === "고등학교" ? "📖" : "🎧"}</div>
            <div>
              수업 내용을 아래에 입력하면
              <br />
              AI가 {school === "고등학교" ? "수능 맞춤" : "계열 맞춤"} 필기를 합니다
            </div>
          </div>
        )}

        {notes.map((n) => (
          <div key={n.id} className={`ncard imp-${n.importance}`} style={{ "--ac": accent }}>
            <div className="nmeta">
              <span className="ntime">● {n.time}</span>
              {n.importance === "high" && (
                <span className="ibadge" style={{ background: `${accent}12`, color: accent, border: `1px solid ${accent}30` }}>
                  ⭐ 핵심
                </span>
              )}
            </div>
            <div className="nraw">"{n.raw}"</div>
            <div className="nbody" dangerouslySetInnerHTML={{ __html: md(n.note) }} />

            {/* AI 보충설명 */}
            {n.supplement && (
              <div className="supplement-box">
                <div className="supplement-label">🤖 AI 보충설명</div>
                <div className="supplement-text">{n.supplement}</div>
              </div>
            )}

            {/* AI 자동 서칭 */}
            {n.auto_search && (
              <div className="search-box">
                <div className="search-label">🔍 AI 자동 서칭: "{n.auto_search.query}"</div>
                <div className="search-result">{n.auto_search.result}</div>
              </div>
            )}

            {/* 개념 연결 */}
            {n.connections && (
              <div className="connections-box">
                <div className="connections-label">🔗 개념 연결</div>
                <div className="connections-text">{n.connections}</div>
              </div>
            )}

            {n.insight && <div className="insight">💡 {n.insight}</div>}
            {n.suneung_tip && <div className="suneung-tip">🎯 수능 포인트: {n.suneung_tip}</div>}

            {n.keywords?.length > 0 && (
              <div className="kwrow">
                <span className="kwlabel">잠깐, 이게 뭐야? →</span>
                {n.keywords.map((kw) => (
                  <button key={kw} className="kwbtn" style={{ "--ac": accent }} onClick={() => explainKw(kw)}>
                    {kw}
                  </button>
                ))}
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="ncard" style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 28, opacity: 0.6 }}>
            <div className="ldots">
              <span />
              <span />
              <span />
            </div>
            <div style={{ fontSize: 12, color: "#999", marginTop: 10 }}>Claude가 필기 + 분석 중…</div>
          </div>
        )}
      </div>

      {/* 입력 */}
      <div className="inp-area">
        <textarea
          ref={inputRef}
          className="inp-box"
          rows={3}
          placeholder={`수업 내용 입력 (실제 앱: 마이크 자동입력)\n\n예시: ${
            school === "고등학교"
              ? "확률변수 X가 이항분포 B(n,p)를 따를 때 평균은 np, 분산은 npq입니다."
              : "중심극한정리에 의해 n≥30이면 표본평균의 분포는 정규분포에 근사합니다."
          }`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) processNote();
          }}
        />
        <button className="send-btn" style={{ background: accent }} onClick={processNote} disabled={loading || !input.trim()}>
          {loading ? "…" : "필기 ↵"}
        </button>
        <div className="inp-hint">⌘ Enter</div>
      </div>

      {/* 키워드 팝업 */}
      {popup && (
        <div className="overlay" onClick={() => setPopup(null)}>
          <div className="popup" onClick={(e) => e.stopPropagation()}>
            <div className="pop-hdr">
              <div className="pop-kw" style={{ color: "#1a1a2e" }}>
                💬 {popup.kw}
              </div>
              <button className="pop-close" onClick={() => setPopup(null)}>
                ✕
              </button>
            </div>
            {popup.loading ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: 32 }}>
                <div className="ldots">
                  <span />
                  <span />
                  <span />
                </div>
                <div style={{ fontSize: 12, color: "#999", marginTop: 10 }}>설명 중…</div>
              </div>
            ) : (
              popup.data && (
                <>
                  <div className="psec">
                    <div className="ptag">한 줄 설명</div>
                    <div className="ptxt">{popup.data.simple}</div>
                  </div>
                  {popup.data.analogy && (
                    <div className="psec">
                      <div className="ptag">비유</div>
                      <div className="ptxt" style={{ color: "#8888cc" }}>
                        "{popup.data.analogy}"
                      </div>
                    </div>
                  )}
                  {popup.data.detail && (
                    <div className="psec">
                      <div className="ptag">자세히</div>
                      <div className="ptxt" style={{ fontSize: 13 }}>
                        {popup.data.detail}
                      </div>
                    </div>
                  )}
                  {popup.data.related?.length > 0 && (
                    <div className="psec">
                      <div className="ptag">관련 개념</div>
                      <div className="kwrow" style={{ marginTop: 6 }}>
                        {popup.data.related.map((r) => (
                          <button key={r} className="kwbtn" style={{ "--ac": accent }} onClick={() => explainKw(r)}>
                            {r}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  STYLES
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

const S = {
  page: {
    minHeight: "100vh",
    background: "#f5f6fa",
    color: "#1a1a2e",
    fontFamily: "'Pretendard','Apple SD Gothic Neo',sans-serif",
    display: "flex",
    flexDirection: "column",
  },
};

function buildCSS(accent) {
  return `
@import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Instrument+Serif:ital@0;1&display=swap');
*{box-sizing:border-box;margin:0;padding:0;}
::-webkit-scrollbar{width:3px;}::-webkit-scrollbar-track{background:#f0f0f4;}::-webkit-scrollbar-thumb{background:#ccc;border-radius:3px;}

/* SELECT */
.select-wrap{max-width:480px;margin:0 auto;padding:60px 24px;}
.brand{font-family:'DM Mono',monospace;font-size:11px;letter-spacing:.25em;color:#999;margin-bottom:24px;}
.big-title{font-family:'Instrument Serif',serif;font-size:44px;color:#1a1a2e;line-height:1.2;margin-bottom:36px;font-style:italic;}
.school-cards{display:flex;flex-direction:column;gap:14px;}
.school-card{background:#fff;border:1px solid #e5e7eb;border-radius:20px;padding:24px 28px;text-align:left;cursor:pointer;transition:all .2s;border-left:3px solid var(--sc);box-shadow:0 1px 3px rgba(0,0,0,.04);}
.school-card:hover{background:#fafbff;transform:translateX(4px);box-shadow:0 4px 20px rgba(0,0,0,.08);}
.sc-icon{font-size:28px;margin-bottom:10px;}
.sc-name{font-family:'Instrument Serif',serif;font-size:22px;color:#1a1a2e;margin-bottom:4px;}
.sc-sub{font-family:'DM Mono',monospace;font-size:10px;color:#999;letter-spacing:.05em;}

/* SETUP */
.setup-wrap{max-width:520px;margin:0 auto;padding:48px 24px;}
.back-btn{background:none;border:none;color:#999;font-size:12px;font-family:'DM Mono',monospace;cursor:pointer;margin-bottom:24px;padding:0;letter-spacing:.05em;}
.back-btn:hover{color:#555;}
.setup-title{font-family:'Instrument Serif',serif;font-size:36px;color:#1a1a2e;font-style:italic;margin-bottom:8px;margin-top:6px;}
.s-label{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.15em;color:#888;text-transform:uppercase;margin-bottom:10px;margin-top:24px;}
.chips{display:flex;flex-wrap:wrap;gap:7px;}
.chip{padding:7px 15px;border-radius:100px;border:1px solid #e0e0e8;background:#fff;color:#666;font-size:12px;cursor:pointer;transition:all .15s;font-family:inherit;}
.chip.on{background:${accent};border-color:${accent};color:#fff;font-weight:600;}
.chip:hover:not(.on){border-color:${accent};color:${accent};}
.s-input{width:100%;background:#fff;border:1px solid #e0e0e8;border-radius:12px;padding:12px 16px;color:#1a1a2e;font-size:13px;font-family:inherit;outline:none;margin-top:10px;transition:border .15s;}
.s-input:focus{border-color:${accent};}
.s-input::placeholder{color:#bbb;}
.quiz-type-badge{font-family:'DM Mono',monospace;font-size:10px;color:${accent};background:${accent}10;border:1px solid ${accent}30;padding:6px 14px;border-radius:100px;width:fit-content;margin-top:20px;}
.start-btn{width:100%;margin-top:20px;padding:15px;background:${accent};border:none;border-radius:12px;color:#fff;font-family:'DM Mono',monospace;font-size:13px;letter-spacing:.08em;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:10px;transition:all .2s;}
.start-btn:hover{opacity:.9;transform:translateY(-1px);box-shadow:0 8px 28px ${accent}44;}
.dot-live{width:8px;height:8px;border-radius:50%;display:inline-block;animation:blink 1s infinite;flex-shrink:0;}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}

/* HEADER */
.hdr{display:flex;align-items:center;justify-content:space-between;padding:13px 20px;border-bottom:1px solid #eee;background:#fff;flex-shrink:0;box-shadow:0 1px 3px rgba(0,0,0,.03);}
.hdr-l{display:flex;align-items:center;gap:9px;}
.hdr-school{font-size:16px;}
.hdr-div{font-family:'DM Mono',monospace;font-size:11px;color:#888;}
.hdr-sub{font-family:'Instrument Serif',serif;font-size:16px;color:#1a1a2e;}
.badge2{font-size:10px;color:#666;background:#f3f4f6;border:1px solid #e5e7eb;padding:3px 9px;border-radius:100px;}
.hdr-timer{font-family:'DM Mono',monospace;font-size:20px;color:${accent};}
.hdr-r{display:flex;align-items:center;gap:10px;}
.end-btn{padding:7px 15px;border:1px solid #ddd;border-radius:100px;background:transparent;color:#888;font-size:11px;font-family:'DM Mono',monospace;cursor:pointer;transition:all .15s;letter-spacing:.05em;}
.end-btn:hover{border-color:#ef4444;color:#ef4444;}

/* NOTION SYNC */
.notion-sync{font-family:'DM Mono',monospace;font-size:10px;padding:4px 10px;border-radius:100px;letter-spacing:.03em;animation:fadeIn .3s ease;}
.notion-sync.saving{color:#d97706;background:#fef3c7;border:1px solid #fde68a;}
.notion-sync.saved{color:#059669;background:#d1fae5;border:1px solid #a7f3d0;}
.notion-sync.failed{color:#dc2626;background:#fee2e2;border:1px solid #fecaca;}
@keyframes fadeIn{from{opacity:0}to{opacity:1}}

/* TABBAR */
.tabbar{display:flex;align-items:center;gap:4px;padding:9px 20px;border-bottom:1px solid #eee;background:#fafbfc;flex-shrink:0;}
.tabbt{padding:6px 16px;border:none;background:transparent;color:#aaa;font-size:11px;font-family:'DM Mono',monospace;cursor:pointer;border-radius:8px;letter-spacing:.05em;transition:all .15s;}
.tabon{background:#fff;color:var(--ac);box-shadow:0 1px 3px rgba(0,0,0,.06);}
.quiztrig{padding:7px 15px;border:1px solid ${accent}55;border-radius:8px;background:transparent;color:${accent};font-size:11px;font-family:'DM Mono',monospace;cursor:pointer;letter-spacing:.05em;transition:all .15s;}
.quiztrig:hover:not(:disabled){background:${accent};color:#fff;}
.quiztrig:disabled{opacity:.25;cursor:not-allowed;}

/* NOTES */
.notes-scroll{flex:1;overflow-y:auto;padding:18px 20px;display:flex;flex-direction:column;gap:13px;}
.empty{display:flex;flex-direction:column;align-items:center;justify-content:center;flex:1;color:#bbb;text-align:center;font-size:13px;line-height:1.9;}
.ncard{background:#fff;border:1px solid #e8e8ee;border-radius:16px;padding:18px 20px;animation:up .35s ease;box-shadow:0 1px 4px rgba(0,0,0,.03);}
@keyframes up{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
.imp-high{border-left:3px solid var(--ac);}
.imp-low{opacity:.7;}
.nmeta{display:flex;align-items:center;gap:10px;margin-bottom:10px;}
.ntime{font-family:'DM Mono',monospace;font-size:10px;color:#aaa;}
.ibadge{font-size:10px;padding:2px 8px;border-radius:100px;}
.nraw{font-size:11px;color:#888;background:#f8f8fa;border-left:2px solid #e0e0e8;padding:8px 12px;border-radius:6px;margin-bottom:12px;line-height:1.6;font-style:italic;}
.nbody{font-size:13px;color:#444;line-height:1.8;}
.nbody strong{color:#1a1a2e;}
.nh{font-family:'DM Mono',monospace;font-size:10px;letter-spacing:.12em;color:${accent};text-transform:uppercase;display:block;margin:10px 0 4px;}

/* TAGS */
.tag-freq{font-size:10px;color:#dc2626;background:#fef2f2;border:1px solid #fecaca;padding:1px 7px;border-radius:4px;font-family:'DM Mono',monospace;}
.tag-ebs{font-size:10px;color:#2563eb;background:#eff6ff;border:1px solid #bfdbfe;padding:1px 7px;border-radius:4px;font-family:'DM Mono',monospace;}
.tag-warn{font-size:10px;color:#d97706;background:#fffbeb;border:1px solid #fde68a;padding:1px 7px;border-radius:4px;font-family:'DM Mono',monospace;}
.tag-key{font-size:10px;color:#7c3aed;background:#f5f3ff;border:1px solid #ddd6fe;padding:1px 7px;border-radius:4px;font-family:'DM Mono',monospace;}
.tag-theorem{font-size:10px;color:#059669;background:#ecfdf5;border:1px solid #a7f3d0;padding:2px 7px;border-radius:4px;font-weight:600;}
.tag-src{font-size:10px;color:#4f46e5;font-style:italic;}
code.formula{font-family:'DM Mono',monospace;font-size:12px;color:#1a1a2e;background:#f3f4f6;padding:2px 8px;border-radius:4px;border:1px solid #e5e7eb;}

/* AI SUPPLEMENT */
.supplement-box{margin-top:12px;padding:12px 14px;background:#eef2ff;border:1px solid #c7d2fe;border-radius:10px;border-left:3px solid #6366f1;}
.supplement-label{font-family:'DM Mono',monospace;font-size:10px;color:#4f46e5;letter-spacing:.08em;margin-bottom:6px;font-weight:500;}
.supplement-text{font-size:12px;color:#555;line-height:1.7;}

/* AI AUTO SEARCH */
.search-box{margin-top:10px;padding:12px 14px;background:#ecfdf5;border:1px solid #a7f3d0;border-radius:10px;border-left:3px solid #10b981;}
.search-label{font-family:'DM Mono',monospace;font-size:10px;color:#059669;letter-spacing:.05em;margin-bottom:6px;font-weight:500;}
.search-result{font-size:12px;color:#4b7a5e;line-height:1.7;}

/* CONNECTIONS */
.connections-box{margin-top:10px;padding:12px 14px;background:#fffbeb;border:1px solid #fde68a;border-radius:10px;border-left:3px solid #f59e0b;}
.connections-label{font-family:'DM Mono',monospace;font-size:10px;color:#d97706;letter-spacing:.08em;margin-bottom:6px;font-weight:500;}
.connections-text{font-size:12px;color:#92753a;line-height:1.7;}

/* INSIGHT & TIPS */
.insight{margin-top:12px;padding:10px 14px;background:#f5f3ff;border:1px solid #e9e5ff;border-radius:8px;font-size:12px;color:#6d5aac;line-height:1.6;}
.suneung-tip{margin-top:8px;padding:8px 14px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;font-size:11px;color:#b45309;line-height:1.5;font-family:'DM Mono',monospace;}

/* KEYWORDS */
.kwrow{display:flex;flex-wrap:wrap;align-items:center;gap:6px;margin-top:12px;}
.kwlabel{font-family:'DM Mono',monospace;font-size:10px;color:#999;letter-spacing:.05em;}
.kwbtn{padding:5px 12px;border:1px solid var(--ac);border-radius:100px;background:transparent;color:var(--ac);font-size:11px;cursor:pointer;transition:all .15s;font-family:inherit;}
.kwbtn:hover{background:var(--ac);color:#fff;}

/* LOADING */
.ldots{display:flex;gap:6px;}
.ldots span{width:6px;height:6px;border-radius:50%;background:${accent};animation:dot 1.2s infinite;}
.ldots span:nth-child(2){animation-delay:.2s;}
.ldots span:nth-child(3){animation-delay:.4s;}
@keyframes dot{0%,80%,100%{transform:scale(.6);opacity:.3}40%{transform:scale(1);opacity:1}}

/* INPUT */
.inp-area{padding:14px 20px;border-top:1px solid #eee;background:#fff;flex-shrink:0;display:flex;flex-direction:column;gap:6px;}
.inp-box{width:100%;background:#f8f9fc;border:1px solid #e0e0e8;border-radius:12px;padding:12px 16px;color:#1a1a2e;font-size:13px;font-family:inherit;outline:none;resize:none;line-height:1.6;transition:border .15s;}
.inp-box:focus{border-color:${accent};}
.inp-box::placeholder{color:#bbb;font-size:12px;}
.send-btn{align-self:flex-end;padding:8px 20px;border:none;border-radius:8px;color:#fff;font-family:'DM Mono',monospace;font-size:12px;cursor:pointer;transition:all .15s;}
.send-btn:hover:not(:disabled){opacity:.85;}
.send-btn:disabled{opacity:.3;cursor:not-allowed;}
.inp-hint{font-family:'DM Mono',monospace;font-size:10px;color:#ccc;text-align:right;}

/* POPUP */
.overlay{position:fixed;inset:0;background:rgba(0,0,0,.3);display:flex;align-items:center;justify-content:center;z-index:100;backdrop-filter:blur(4px);}
.popup{background:#fff;border:1px solid #e5e7eb;border-radius:20px;padding:28px;max-width:420px;width:90%;max-height:80vh;overflow-y:auto;animation:popIn .25s ease;box-shadow:0 20px 60px rgba(0,0,0,.12);}
@keyframes popIn{from{opacity:0;transform:scale(.95)}to{opacity:1;transform:scale(1)}}
.pop-hdr{display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;}
.pop-kw{font-family:'Instrument Serif',serif;font-size:20px;color:#1a1a2e;}
.pop-close{background:none;border:none;color:#aaa;font-size:16px;cursor:pointer;padding:4px;}
.pop-close:hover{color:#333;}
.psec{margin-bottom:16px;}
.ptag{font-family:'DM Mono',monospace;font-size:9px;letter-spacing:.15em;color:#999;text-transform:uppercase;margin-bottom:6px;}
.ptxt{font-size:14px;color:#444;line-height:1.7;}

/* QUIZ */
.quiz-wrap{max-width:480px;width:100%;margin:0 auto;padding:48px 24px;}
.quiz-prog{display:flex;gap:6px;margin-bottom:28px;}
.qbar{flex:1;height:3px;border-radius:100px;transition:all .3s;}
.quiz-meta{display:flex;align-items:center;gap:10px;margin-bottom:16px;}
.qcnt{font-family:'DM Mono',monospace;font-size:10px;color:#999;letter-spacing:.1em;}
.quiz-tag{font-size:10px;padding:2px 8px;border-radius:4px;color:#7c3aed;background:#f5f3ff;border:1px solid #ddd6fe;}
.quiz-q{font-family:'Instrument Serif',serif;font-size:22px;color:#1a1a2e;line-height:1.5;margin-bottom:24px;}
.q-opt{width:100%;text-align:left;padding:13px 18px;border-radius:10px;border:1px solid #e5e7eb;background:#fff;color:#555;font-size:13px;font-family:inherit;cursor:pointer;margin-bottom:8px;transition:all .15s;display:flex;align-items:center;gap:12px;}
.q-opt:hover:not(:disabled){border-color:${accent};color:#1a1a2e;background:#fafbff;}
.opt-l{font-family:'DM Mono',monospace;font-size:11px;color:#999;width:16px;flex-shrink:0;}
.opt-ok{background:#ecfdf5!important;border-color:#10b981!important;color:#059669!important;}
.opt-ng{background:#fef2f2!important;border-color:#ef4444!important;color:#dc2626!important;}
.quiz-exp{padding:14px;background:#f8f9fc;border-radius:10px;font-size:13px;color:#555;line-height:1.6;margin:4px 0 8px;border:1px solid #e8e8ee;}
.notion-save-badge{font-family:'DM Mono',monospace;font-size:10px;color:#4f46e5;background:#eef2ff;border:1px solid #c7d2fe;padding:6px 12px;border-radius:8px;margin-bottom:8px;text-align:center;}
.qnext{width:100%;padding:14px;background:${accent};border:none;border-radius:10px;color:#fff;font-family:'DM Mono',monospace;font-size:12px;font-weight:500;letter-spacing:.08em;cursor:pointer;transition:all .2s;}
.qnext:hover{opacity:.9;transform:translateY(-1px);}
.result-score{font-family:'Instrument Serif',serif;font-size:80px;color:${accent};line-height:1;text-align:center;margin-top:20px;}
.rs-denom{font-size:28px;color:#aaa;}
.result-msg{font-size:16px;color:#666;text-align:center;margin-top:12px;}
`;
}
