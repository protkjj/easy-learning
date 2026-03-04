import { useNavigate } from "react-router";
import { ArrowLeft, AlertTriangle, CheckCircle, XCircle } from "lucide-react";
import { Button } from "../components/ui/button";
import { useState, useEffect, useRef } from "react";
import { useApp } from "../../lib/store";
import { CONFIG } from "../../lib/config";
import { callAI, parseJSON, buildQuizSystem, generateDemoQuiz } from "../../lib/ai";
import { saveWrongAnswerToNotion } from "../../lib/notion";
import { toast } from "sonner";

export function Quiz() {
  const navigate = useNavigate();
  const { school, division, subject, notes, aiProvider, apiKey, addWrongAnswer } = useApp();
  const [quizData, setQuizData] = useState<any[]>([]);
  const [idx, setIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const userAnswers = useRef<(number | null)[]>([]);

  const isHighschool = school === "고등학교";
  const cfg = school ? CONFIG[school as keyof typeof CONFIG] : null;

  useEffect(() => {
    generateQuiz();
  }, []);

  const generateQuiz = async () => {
    if (!cfg || !division) return;
    setLoading(true);
    setError(false);
    try {
      const allNotes = notes.map((n: any) => n.note).join("\n");
      const sys = buildQuizSystem(school!, division!, subject!, allNotes, cfg.quizType);
      const raw = await callAI([{ role: "user", content: "퀴즈 만들어주세요." }], sys, apiKey, aiProvider);
      const data = raw ? parseJSON(raw) || [] : generateDemoQuiz(school!, subject!);
      if (!data || data.length === 0) {
        setError(true);
        toast.error("퀴즈를 생성할 수 없습니다. 다시 시도해주세요.");
      } else {
        setQuizData(data);
        userAnswers.current = new Array(data.length).fill(null);
      }
    } catch (e) {
      console.error("Quiz generation failed:", e);
      setError(true);
      toast.error("퀴즈 생성 중 오류가 발생했습니다.");
    }
    setLoading(false);
  };

  const handleSelect = (i: number) => {
    if (selected !== null) return;
    const correct = i === quizData[idx].answer;
    setSelected(i);
    userAnswers.current[idx] = i;
    if (correct) setScore((s) => s + 1);

    // Save wrong answer
    if (!correct) {
      const q = quizData[idx];
      const optLabel = isHighschool ? "①②③④⑤".split("") : ["A", "B", "C", "D"];
      const now = new Date();
      const dateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      const wa = {
        question: q.q,
        myAnswer: `${optLabel[i]} ${q.options[i]}`,
        correctAnswer: `${optLabel[q.answer]} ${q.options[q.answer]}`,
        explain: q.explain || "",
        subject: subject!,
        date: dateStr,
        reviewCount: 0,
        lastReviewDate: null,
      };
      addWrongAnswer(wa);
      saveWrongAnswerToNotion(wa.question, wa.myAnswer, wa.correctAnswer, wa.explain, wa.subject);
    }
  };

  const handleNext = () => {
    if (idx + 1 >= quizData.length) {
      setDone(true);
    } else {
      setIdx((i) => i + 1);
      setSelected(null);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full mx-auto mb-4" />
          <p className="text-gray-500 text-sm">퀴즈 생성 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <AlertTriangle className="w-12 h-12 text-orange-500 mb-4" />
        <h2 className="text-xl font-semibold text-gray-900 mb-2">퀴즈 생성 실패</h2>
        <p className="text-gray-500 text-sm mb-6 text-center">퀴즈를 불러올 수 없습니다. 네트워크 또는 API 설정을 확인해주세요.</p>
        <div className="flex gap-3">
          <Button variant="outline" onClick={() => navigate("/notes")}>
            <ArrowLeft className="w-4 h-4 mr-2" />
            돌아가기
          </Button>
          <Button onClick={generateQuiz} className="bg-indigo-600 hover:bg-indigo-700 text-white">
            다시 시도
          </Button>
        </div>
      </div>
    );
  }

  if (done) {
    const optLabel = isHighschool ? "①②③④⑤".split("") : ["A", "B", "C", "D"];
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col">
        {/* Score Header */}
        <div className="bg-white border-b border-gray-200 px-6 py-6">
          <div className="max-w-lg mx-auto text-center">
            <div className="text-5xl font-bold text-indigo-600 mb-1">
              {score}<span className="text-2xl text-gray-400">/{quizData.length}</span>
            </div>
            <p className="text-lg text-gray-600">
              {score === quizData.length ? "완벽!" : score >= quizData.length * 0.6 ? "잘했어요" : "복습 필요"}
            </p>
          </div>
        </div>

        {/* Question Review List */}
        <main className="max-w-lg mx-auto px-6 py-6 flex-1 overflow-y-auto w-full">
          <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-4">문제별 리뷰</h3>
          <div className="space-y-4">
            {quizData.map((q: any, i: number) => {
              const userAnswer = userAnswers.current[i];
              const isCorrect = userAnswer === q.answer;
              return (
                <div key={i} className={`bg-white rounded-xl p-5 shadow-sm border ${isCorrect ? "border-emerald-200" : "border-red-200"}`}>
                  <div className="flex items-start gap-3 mb-3">
                    <div className="shrink-0 mt-0.5">
                      {isCorrect ? (
                        <CheckCircle className="w-5 h-5 text-emerald-500" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500" />
                      )}
                    </div>
                    <div className="flex-1">
                      <p className="text-xs text-gray-400 font-mono mb-1">Q{i + 1}</p>
                      <p className="text-sm font-medium text-gray-900 leading-relaxed">{q.q}</p>
                    </div>
                  </div>
                  {!isCorrect && (
                    <div className="ml-8 space-y-2">
                      <div className="flex items-start gap-2 p-2.5 bg-red-50 border border-red-100 rounded-lg">
                        <span className="text-xs font-medium text-red-600 shrink-0">내 답:</span>
                        <span className="text-xs text-red-800">
                          {userAnswer !== null ? `${optLabel[userAnswer]} ${q.options[userAnswer]}` : "미응답"}
                        </span>
                      </div>
                      <div className="flex items-start gap-2 p-2.5 bg-emerald-50 border border-emerald-100 rounded-lg">
                        <span className="text-xs font-medium text-emerald-600 shrink-0">정답:</span>
                        <span className="text-xs text-emerald-800">{optLabel[q.answer]} {q.options[q.answer]}</span>
                      </div>
                      {q.explain && (
                        <p className="text-xs text-gray-500 mt-1 pl-1">{q.explain}</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </main>

        {/* Bottom Navigation */}
        <div className="bg-white border-t border-gray-200 px-6 py-4 shrink-0">
          <div className="max-w-lg mx-auto flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => navigate("/notes")}>노트 보기</Button>
            <Button onClick={() => navigate("/wrong-answers")} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white">오답노트</Button>
          </div>
        </div>
      </div>
    );
  }

  const q = quizData[idx];
  if (!q) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-lg mx-auto">
          <div className="flex items-center justify-between mb-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/notes")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <span className="text-sm text-gray-500 font-mono">Q{idx + 1}/{quizData.length}</span>
          </div>
          {/* Progress */}
          <div className="flex gap-1.5">
            {quizData.map((_: any, i: number) => (
              <div key={i} className={`flex-1 h-1 rounded-full ${i <= idx ? "bg-indigo-500" : "bg-gray-200"} ${i < idx ? "opacity-60" : ""}`} />
            ))}
          </div>
        </div>
      </header>

      <main className="max-w-lg mx-auto px-6 py-8">
        {/* Tag */}
        {q.tag && (
          <span className="inline-block px-2.5 py-1 text-xs bg-purple-100 text-purple-700 rounded-md mb-4">
            {q.tag}
          </span>
        )}

        {/* Question */}
        <h2 className="text-xl font-semibold mb-6 leading-relaxed">{q.q}</h2>

        {/* Options */}
        <div className="space-y-3">
          {q.options.map((opt: string, i: number) => {
            const isCorrect = i === q.answer;
            const isSelected = selected === i;
            let cls = "bg-white border-gray-200 text-gray-700 hover:border-indigo-300";
            if (selected !== null) {
              if (isCorrect) cls = "bg-emerald-50 border-emerald-500 text-emerald-700";
              else if (isSelected) cls = "bg-red-50 border-red-500 text-red-700";
              else cls = "bg-white border-gray-100 text-gray-400";
            }

            return (
              <button
                key={i}
                onClick={() => handleSelect(i)}
                disabled={selected !== null}
                aria-label={`${isHighschool ? "①②③④⑤".split("")[i] : String.fromCharCode(65 + i)}번 선택지: ${opt}`}
                className={`w-full text-left px-4 py-3.5 rounded-xl border transition-all flex items-center gap-3 ${cls}`}
              >
                <span className="text-xs font-mono text-gray-400 w-4">
                  {isHighschool ? "①②③④⑤".split("")[i] : String.fromCharCode(65 + i)}
                </span>
                <span className="text-sm">{opt}</span>
                {selected !== null && isCorrect && <span className="ml-auto text-emerald-500">✓<span className="sr-only">정답</span></span>}
                {selected !== null && isSelected && !isCorrect && <span className="ml-auto text-red-500">✗<span className="sr-only">오답</span></span>}
              </button>
            );
          })}
        </div>

        {/* Explanation */}
        {selected !== null && (
          <div className="mt-6">
            <div className={`p-4 rounded-xl text-sm ${
              selected === q.answer ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-700"
            }`}>
              <p className="font-medium mb-1">{selected === q.answer ? "정답!" : "오답"}</p>
              <p className="text-gray-600">{q.explain}</p>
            </div>

            {selected !== q.answer && (
              <div className="mt-2 text-xs text-indigo-500 text-center font-mono">
                📋 오답노트에 자동 저장됨
              </div>
            )}

            <Button onClick={handleNext} className="w-full mt-4 bg-indigo-600 hover:bg-indigo-700 text-white">
              {idx + 1 >= quizData.length ? "결과 보기 →" : "다음 →"}
            </Button>
          </div>
        )}
      </main>
    </div>
  );
}
