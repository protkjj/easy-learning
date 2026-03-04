import { useNavigate, useParams } from "react-router";
import { ArrowLeft, Key } from "lucide-react";
import { Button } from "../components/ui/button";
import { useState } from "react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { useApp } from "../../lib/store";
import { CONFIG, LANGS } from "../../lib/config";

export function SubjectSelection() {
  const navigate = useNavigate();
  const { category } = useParams<{ category: string }>();
  const { school, setSchool, setDivision, setSubject, lang, setLang, aiProvider, updateProvider, apiKey, updateApiKey, setProfessor } = useApp();

  const schoolName = category === "highschool" ? "고등학교" : "대학교";
  if (school !== schoolName) setSchool(schoolName);

  const cfg = CONFIG[schoolName as keyof typeof CONFIG];
  const divisions = Object.keys(cfg.계열);
  const [selectedDivision, setSelectedDivision] = useState(divisions[0]);
  const [showSettings, setShowSettings] = useState(false);
  const [prof, setProf] = useState("");

  const isHighschool = category === "highschool";
  const bgColor = isHighschool ? "bg-amber-500" : "bg-indigo-500";
  const accentColor = isHighschool ? "#f59e0b" : "#6366f1";

  const divCfg = cfg.계열[selectedDivision as keyof typeof cfg.계열];
  const subjects = divCfg?.subjects || [];

  const handleSubjectClick = (sub: string) => {
    setDivision(selectedDivision);
    setSubject(sub);
    setProfessor(prof);
    navigate("/recording");
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className={`${bgColor} text-white px-6 py-4`}>
        <div className="max-w-2xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => navigate("/")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <div className="flex gap-2">
              <Select value={lang} onValueChange={setLang}>
                <SelectTrigger className="w-32 bg-white/20 border-white/30 text-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {LANGS.map((l) => (
                    <SelectItem key={l} value={l}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/20" onClick={() => setShowSettings(!showSettings)}>
                <Key className="w-4 h-4" />
              </Button>
            </div>
          </div>
          <h2 className="text-2xl font-semibold">{schoolName}</h2>
          <p className="text-white/90 text-sm mt-1">과목을 선택해주세요</p>
        </div>
      </header>

      {showSettings && (
        <div className="max-w-2xl mx-auto px-6 py-4 bg-white border-b">
          <div className="space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">AI 엔진</label>
              <div className="flex gap-2 mt-1">
                {[
                  { id: "claude", label: "Claude" },
                  { id: "openai", label: "OpenAI" },
                  { id: "demo", label: "데모" },
                ].map((p) => (
                  <button
                    key={p.id}
                    onClick={() => updateProvider(p.id)}
                    className={`px-3 py-1.5 rounded-lg text-sm transition-colors ${
                      aiProvider === p.id ? `${bgColor} text-white` : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
            {aiProvider !== "demo" && (
              <div>
                <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">API Key</label>
                <input
                  type="password"
                  className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  placeholder={aiProvider === "openai" ? "sk-..." : "sk-ant-..."}
                  value={apiKey}
                  onChange={(e) => updateApiKey(e.target.value)}
                />
              </div>
            )}
            <div>
              <label className="text-xs font-medium text-gray-500 uppercase tracking-wider">교수/선생님 (선택)</label>
              <input
                className="w-full mt-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                placeholder="예: 김민준 선생님"
                value={prof}
                onChange={(e) => setProf(e.target.value)}
              />
            </div>
          </div>
        </div>
      )}

      <main className="max-w-2xl mx-auto px-6 py-6">
        <div className="flex gap-2 mb-6 overflow-x-auto pb-2">
          {divisions.map((div) => (
            <button
              key={div}
              onClick={() => setSelectedDivision(div)}
              className={`px-4 py-2 rounded-lg whitespace-nowrap transition-colors text-sm ${
                selectedDivision === div ? `${bgColor} text-white` : "bg-white text-gray-700 hover:bg-gray-100"
              }`}
            >
              {div}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {subjects.map((sub: string) => (
            <button
              key={sub}
              onClick={() => handleSubjectClick(sub)}
              className="bg-white rounded-xl p-4 shadow-sm hover:shadow-md transition-all border border-gray-100 text-left group"
            >
              <div className="flex items-center justify-between">
                <span className="font-medium text-gray-900 group-hover:text-gray-600 text-sm">{sub}</span>
                <div
                  className="w-2 h-2 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                  style={{ backgroundColor: accentColor }}
                />
              </div>
            </button>
          ))}
        </div>

        <div className="mt-6 text-center">
          <span className="text-xs text-gray-400 font-mono">퀴즈 형식: {cfg.quizType}</span>
        </div>
      </main>
    </div>
  );
}
