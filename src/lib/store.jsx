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

  // Session state
  const [notes, setNotes] = useState([]);
  const [elapsed, setElapsed] = useState(0);
  const [wrongAnswers, setWrongAnswers] = useState([]);
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
  };

  const addNote = (note) => setNotes((prev) => [...prev, note]);
  const addWrongAnswer = (wa) => setWrongAnswers((prev) => [...prev, wa]);

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
