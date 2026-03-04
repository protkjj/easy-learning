import { createContext, useContext, useState, useRef } from "react";

const AppContext = createContext(null);

export function AppProvider({ children }) {
  // Setup state
  const [school, setSchool] = useState(null); // "고등학교" | "대학교"
  const [division, setDivision] = useState(null);
  const [subject, setSubject] = useState(null);
  const [lang, setLang] = useState("한국어");
  const [professor, setProfessor] = useState("");

  // AI state
  const [aiProvider, setAiProvider] = useState(() => localStorage.getItem("lectureai_provider") || "claude");
  const [apiKey, setApiKey] = useState(() => localStorage.getItem("lectureai_apikey") || "");

  // Session state (with localStorage persistence)
  const [notes, setNotes] = useState(() => {
    try { return JSON.parse(localStorage.getItem("lectureai_notes") || "[]"); } catch { return []; }
  });
  const [elapsed, setElapsed] = useState(0);
  const [totalElapsed, setTotalElapsed] = useState(() => {
    try { return Number(localStorage.getItem("lectureai_totalElapsed") || "0"); } catch { return 0; }
  });
  const [wrongAnswers, setWrongAnswers] = useState(() => {
    try { return JSON.parse(localStorage.getItem("lectureai_wrongAnswers") || "[]"); } catch { return []; }
  });
  const timerRef = useRef(null);

  const updateApiKey = (key) => {
    setApiKey(key);
    localStorage.setItem("lectureai_apikey", key);
  };

  const updateProvider = (p) => {
    setAiProvider(p);
    localStorage.setItem("lectureai_provider", p);
  };

  const startTimer = () => {
    setElapsed(0);
    timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
  };

  const stopTimer = () => {
    if (timerRef.current) clearInterval(timerRef.current);
    setTotalElapsed((prev) => {
      const updated = prev + elapsed;
      localStorage.setItem("lectureai_totalElapsed", String(updated));
      return updated;
    });
  };

  const addNote = (note) => setNotes((prev) => {
    const updated = [...prev, note];
    localStorage.setItem("lectureai_notes", JSON.stringify(updated));
    return updated;
  });
  const addWrongAnswer = (wa) => setWrongAnswers((prev) => {
    const updated = [...prev, wa];
    localStorage.setItem("lectureai_wrongAnswers", JSON.stringify(updated));
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
        apiKey, updateApiKey,
        notes, setNotes, addNote,
        elapsed, setElapsed, startTimer, stopTimer, timerRef,
        totalElapsed, setTotalElapsed,
        wrongAnswers, addWrongAnswer,
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
