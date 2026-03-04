import { useNavigate } from "react-router";
import { ArrowLeft, Copy, FileText, Lightbulb, Search, Link2, Target } from "lucide-react";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { toast } from "sonner";
import { useApp } from "../../lib/store";
import { useState } from "react";
import { callAI, parseJSON, buildExplainSystem, generateDemoExplain } from "../../lib/ai";

export function Notes() {
  const navigate = useNavigate();
  const { notes, school, subject, division, aiProvider, apiKey } = useApp();
  const [explainPopup, setExplainPopup] = useState<any>(null);

  const handleCopy = () => {
    const allText = notes.map((n: any) => n.note).join("\n\n---\n\n");
    navigator.clipboard.writeText(allText);
    toast.success("노트가 클립보드에 복사되었습니다");
  };

  const explainKeyword = async (kw: string) => {
    setExplainPopup({ kw, loading: true, data: null });
    const sys = buildExplainSystem(school!, subject!, kw);
    const raw = await callAI([{ role: "user", content: `"${kw}" 설명해주세요.` }], sys, apiKey, aiProvider);
    const data = raw ? parseJSON(raw) : generateDemoExplain(kw);
    setExplainPopup({ kw, loading: false, data });
  };

  const renderBadges = (text: string) => {
    const parts = text.split(/(\[빈출\]|\[EBS\]|\[주의\]|\[핵심\]|\[수식: [^\]]+\]|\[정리: [^\]]+\]|\[출처: [^\]]+\]|\*\*[^*]+\*\*)/g);
    return parts.map((part, i) => {
      if (part === "[빈출]") return <Badge key={i} className="ml-1 bg-red-500 text-white text-[10px]">빈출</Badge>;
      if (part === "[EBS]") return <Badge key={i} className="ml-1 bg-blue-500 text-white text-[10px]">EBS</Badge>;
      if (part === "[주의]") return <Badge key={i} className="ml-1 bg-orange-500 text-white text-[10px]">주의</Badge>;
      if (part === "[핵심]") return <Badge key={i} className="ml-1 bg-purple-500 text-white text-[10px]">핵심</Badge>;
      if (part.startsWith("[수식:")) return <code key={i} className="px-1.5 py-0.5 bg-gray-100 rounded text-sm font-mono">{part.slice(5, -1)}</code>;
      if (part.startsWith("[정리:")) return <span key={i} className="text-emerald-600 font-semibold text-sm">{part.slice(5, -1)}</span>;
      if (part.startsWith("[출처:")) return <span key={i} className="text-indigo-500 italic text-sm">{part.slice(5, -1)}</span>;
      if (part.startsWith("**") && part.endsWith("**")) return <strong key={i} className="font-semibold text-gray-900">{part.slice(2, -2)}</strong>;
      return <span key={i}>{part}</span>;
    });
  };

  const renderMarkdown = (text: string) => {
    return text.split("\n").map((line, idx) => {
      if (line.startsWith("## ")) return <h2 key={idx} className="text-lg font-semibold mt-5 mb-2 text-indigo-600 uppercase tracking-wider text-xs">{renderBadges(line.slice(3))}</h2>;
      if (line.startsWith("• ") || line.startsWith("- ")) return <li key={idx} className="ml-4 mb-1.5 text-sm leading-relaxed">{renderBadges(line.slice(2))}</li>;
      if (line.trim()) return <p key={idx} className="mb-2 text-sm leading-relaxed">{renderBadges(line)}</p>;
      return null;
    });
  };

  if (notes.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6">
        <FileText className="w-12 h-12 text-gray-300 mb-4" />
        <p className="text-gray-500 font-medium mb-1">아직 생성된 노트가 없습니다</p>
        <p className="text-gray-400 text-sm mb-4 text-center">녹음 버튼을 눌러 강의를 녹음하고<br/>AI가 자동으로 필기해드립니다</p>
        <Button onClick={() => navigate("/recording")} className="bg-indigo-600 hover:bg-indigo-700 text-white">녹음 시작하기</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4 sticky top-0 z-10">
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <span className="font-medium">{subject} 노트</span>
          <div className="flex gap-2">
            <Button variant="ghost" size="icon" onClick={handleCopy}>
              <Copy className="w-5 h-5" />
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-6 py-6">
        {/* Action Bar */}
        <div className="flex gap-3 mb-6">
          <Button onClick={() => toast.success("Notion 저장 시도")} className="flex-1 bg-black hover:bg-gray-800 text-white text-sm">
            <FileText className="w-4 h-4 mr-2" /> Notion에 저장
          </Button>
          <Button onClick={() => navigate("/quiz")} className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white text-sm">
            퀴즈 생성
          </Button>
        </div>

        {/* Notes */}
        <div className="space-y-4">
          {notes.map((n: any) => (
            <div
              key={n.id}
              className={`bg-white rounded-2xl p-5 shadow-sm border ${
                n.importance === "high" ? "border-l-4 border-l-indigo-500 border-gray-100" : "border-gray-100"
              }`}
            >
              {/* Meta */}
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xs text-gray-400 font-mono">● {n.time}</span>
                {n.importance === "high" && <Badge className="bg-indigo-100 text-indigo-700 text-[10px]">핵심</Badge>}
              </div>

              {/* Original */}
              <div className="text-xs text-gray-500 bg-gray-50 border-l-2 border-gray-200 px-3 py-2 rounded mb-3 italic">
                "{n.raw}"
              </div>

              {/* AI Note */}
              <div className="text-gray-700">{renderMarkdown(n.note)}</div>

              {/* Supplement */}
              {n.supplement && (
                <div className="mt-3 p-3 bg-indigo-50 border border-indigo-100 rounded-xl">
                  <div className="flex items-center gap-1.5 text-xs text-indigo-600 font-medium mb-1">
                    <Lightbulb className="w-3.5 h-3.5" /> AI 보충설명
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">{n.supplement}</p>
                </div>
              )}

              {/* Auto Search */}
              {n.auto_search && (
                <div className="mt-3 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                  <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium mb-1">
                    <Search className="w-3.5 h-3.5" /> AI 자동 서칭: "{n.auto_search.query}"
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">{n.auto_search.result}</p>
                </div>
              )}

              {/* Connections */}
              {n.connections && (
                <div className="mt-3 p-3 bg-amber-50 border border-amber-100 rounded-xl">
                  <div className="flex items-center gap-1.5 text-xs text-amber-600 font-medium mb-1">
                    <Link2 className="w-3.5 h-3.5" /> 개념 연결
                  </div>
                  <p className="text-xs text-gray-600 leading-relaxed">{n.connections}</p>
                </div>
              )}

              {/* Insight */}
              {n.insight && (
                <div className="mt-3 p-2.5 bg-purple-50 border border-purple-100 rounded-lg text-xs text-purple-700">
                  💡 {n.insight}
                </div>
              )}

              {/* Suneung Tip */}
              {n.suneung_tip && (
                <div className="mt-2 p-2.5 bg-amber-50 border border-amber-100 rounded-lg text-xs text-amber-700 font-mono">
                  <Target className="w-3 h-3 inline mr-1" /> 수능 포인트: {n.suneung_tip}
                </div>
              )}

              {/* Keywords */}
              {n.keywords?.length > 0 && (
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-[10px] text-gray-400 font-mono">잠깐, 이게 뭐야? →</span>
                  {n.keywords.map((kw: string) => (
                    <button
                      key={kw}
                      onClick={() => explainKeyword(kw)}
                      className="px-2.5 py-1 border border-indigo-300 text-indigo-600 rounded-full text-xs hover:bg-indigo-600 hover:text-white transition-colors"
                    >
                      {kw}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </main>

      {/* Explain Popup */}
      {explainPopup && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50 p-4" onClick={() => setExplainPopup(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-md w-full shadow-xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">💬 {explainPopup.kw}</h3>
              <button onClick={() => setExplainPopup(null)} className="text-gray-400 hover:text-gray-600">✕</button>
            </div>
            {explainPopup.loading ? (
              <p className="text-gray-400 text-center py-8">설명 생성 중...</p>
            ) : explainPopup.data && (
              <div className="space-y-4">
                <div>
                  <p className="text-[10px] text-gray-400 uppercase tracking-wider font-mono mb-1">한 줄 설명</p>
                  <p className="text-sm">{explainPopup.data.simple}</p>
                </div>
                {explainPopup.data.analogy && (
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider font-mono mb-1">비유</p>
                    <p className="text-sm text-indigo-600">"{explainPopup.data.analogy}"</p>
                  </div>
                )}
                {explainPopup.data.detail && (
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider font-mono mb-1">자세히</p>
                    <p className="text-sm text-gray-600">{explainPopup.data.detail}</p>
                  </div>
                )}
                {explainPopup.data.related?.length > 0 && (
                  <div>
                    <p className="text-[10px] text-gray-400 uppercase tracking-wider font-mono mb-1">관련 개념</p>
                    <div className="flex gap-2">
                      {explainPopup.data.related.map((r: string) => (
                        <button key={r} onClick={() => explainKeyword(r)} className="px-2.5 py-1 border border-indigo-300 text-indigo-600 rounded-full text-xs hover:bg-indigo-600 hover:text-white transition-colors">
                          {r}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
