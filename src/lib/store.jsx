import { createContext, useContext, useState, useRef } from "react";
import { toast } from "sonner";

const AppContext = createContext(null);

// localStorage 안전 저장 — QuotaExceededError 방어
function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
  } catch (e) {
    if (e.name === "QuotaExceededError" || e.code === 22) {
      // 오래된 노트 30개 삭제 후 재시도
      try {
        const notes = JSON.parse(localStorage.getItem("lectureai_notes") || "[]");
        if (notes.length > 30) {
          localStorage.setItem("lectureai_notes", JSON.stringify(notes.slice(-30)));
          localStorage.setItem(key, value);
          toast.warning("저장 공간 부족 — 오래된 노트 일부를 정리했습니다.");
          return;
        }
      } catch {}
      toast.error("저장 공간이 가득 찼습니다. 브라우저 데이터를 정리해주세요.");
    }
  }
}

export function AppProvider({ children }) {
  // 기존 localStorage에 남은 API 키 제거 (보안)
  localStorage.removeItem("lectureai_apikey");

  // Setup state
  const [school, setSchool] = useState(null); // "고등학교" | "대학교"
  const [division, setDivision] = useState(null);
  const [subject, setSubject] = useState(null);
  const [lang, setLang] = useState("한국어");
  const [professor, setProfessor] = useState("");

  // AI state
  const [aiProvider, setAiProvider] = useState(() => localStorage.getItem("lectureai_provider") || "claude");
  const [apiKey] = useState(""); // API 키는 서버 환경변수로 관리 (클라이언트 저장 안 함)

  // Session state (with localStorage persistence)
  const [notes, setNotes] = useState(() => {
    try { return JSON.parse(localStorage.getItem("lectureai_notes") || "[]"); } catch { return []; }
  });
  const [elapsed, setElapsed] = useState(0);
  const [totalElapsed, setTotalElapsed] = useState(() => {
    try { return Number(localStorage.getItem("lectureai_totalElapsed") || "0"); } catch { return 0; }
  });
  const [wrongAnswers, setWrongAnswers] = useState(() => {
    try {
      const raw = JSON.parse(localStorage.getItem("lectureai_wrongAnswers") || "[]");
      // 기존 데이터 마이그레이션: reviewCount/lastReviewDate 없으면 추가
      return raw.map((wa) => ({
        ...wa,
        reviewCount: wa.reviewCount ?? 0,
        lastReviewDate: wa.lastReviewDate ?? null,
      }));
    } catch { return []; }
  });
  const timerRef = useRef(null);

  const updateProvider = (p) => {
    setAiProvider(p);
    safeSetItem("lectureai_provider", p);
  };

  const startTimer = () => {
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTotalElapsed((prev) => {
      const updated = prev + elapsed;
      safeSetItem("lectureai_totalElapsed", String(updated));
      return updated;
    });
  };

  const addNote = (note) => setNotes((prev) => {
    const updated = [...prev, note];
    safeSetItem("lectureai_notes", JSON.stringify(updated));
    return updated;
  });
  const addWrongAnswer = (wa) => setWrongAnswers((prev) => {
    const updated = [...prev, { ...wa, reviewCount: wa.reviewCount ?? 0, lastReviewDate: wa.lastReviewDate ?? null }];
    safeSetItem("lectureai_wrongAnswers", JSON.stringify(updated));
    return updated;
  });
  const updateWrongAnswer = (index, updates) => setWrongAnswers((prev) => {
    const updated = prev.map((wa, i) => i === index ? { ...wa, ...updates } : wa);
    safeSetItem("lectureai_wrongAnswers", JSON.stringify(updated));
    return updated;
  });

  return (
    <AppContext.Provider
      value={{
        school, setSchool,
        division, setDivision,
        subject, setSubject,
        lang, setLang,
        professor, setProfessor,
        aiProvider, updateProvider,
        apiKey,
        notes, setNotes, addNote,
        elapsed, setElapsed, startTimer, stopTimer, timerRef,
        totalElapsed, setTotalElapsed,
        wrongAnswers, addWrongAnswer, updateWrongAnswer,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
