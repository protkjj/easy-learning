import { useNavigate } from "react-router";
import { ArrowLeft, BookOpen, Clock, TrendingUp, RefreshCw } from "lucide-react";
import { Button } from "../components/ui/button";
import { Progress } from "../components/ui/progress";
import { useApp } from "../../lib/store";
import { useMemo } from "react";

export function Dashboard() {
  const navigate = useNavigate();
  const { notes, wrongAnswers, elapsed } = useApp();

  // Build subject stats from notes
  const subjectStats = useMemo(() => {
    const counts: Record<string, number> = {};
    notes.forEach((n: any) => {
      const sub = n.raw?.slice(0, 20) || "기타";
      // Group by subject stored in context if available
    });
    // Count notes per unique subject keyword
    const subjectSet = new Set<string>();
    notes.forEach((n: any) => {
      if (n.keywords) n.keywords.forEach((k: string) => subjectSet.add(k));
    });
    return { totalNotes: notes.length, totalWrong: wrongAnswers.length, subjects: subjectSet.size };
  }, [notes, wrongAnswers]);

  // Build heatmap from note timestamps
  const heatmapData = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const notesByDay: Record<number, number> = {};
    notes.forEach((n: any) => {
      const d = new Date(n.id); // id is Date.now()
      if (d.getMonth() === month && d.getFullYear() === year) {
        notesByDay[d.getDate()] = (notesByDay[d.getDate()] || 0) + 1;
      }
    });
    return { daysInMonth, firstDay, notesByDay };
  }, [notes]);

  // Weekly dummy data based on elapsed time
  const totalMinutes = Math.round(elapsed / 60);
  const totalHours = (elapsed / 3600).toFixed(1);

  const getHeatmapColor = (intensity: number) => {
    switch (intensity) {
      case 0:
        return "bg-gray-100";
      case 1:
        return "bg-indigo-200";
      case 2:
        return "bg-indigo-400";
      case 3:
        return "bg-indigo-600";
      case 4:
        return "bg-indigo-800";
      default:
        return "bg-gray-100";
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-2xl lg:max-w-4xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-semibold">학습 대시보드</h1>
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <div className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-full">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
              Notion 연동됨
            </div>
            <Button variant="ghost" size="icon">
              <RefreshCw className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-2xl lg:max-w-4xl mx-auto px-6 py-6">
        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-indigo-100 flex items-center justify-center">
                <Clock className="w-5 h-5 text-indigo-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {totalMinutes}분
                </div>
                <div className="text-sm text-gray-600">총 학습 시간</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center">
                <TrendingUp className="w-5 h-5 text-green-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {subjectStats.totalNotes}
                </div>
                <div className="text-sm text-gray-600">생성된 노트</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center">
                <BookOpen className="w-5 h-5 text-amber-600" />
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">
                  {subjectStats.totalWrong}
                </div>
                <div className="text-sm text-gray-600">오답 문제</div>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-10 h-10 rounded-lg bg-red-100 flex items-center justify-center">
                <span className="text-lg">🔥</span>
              </div>
              <div>
                <div className="text-2xl font-bold text-gray-900">{subjectStats.subjects}</div>
                <div className="text-sm text-gray-600">학습 키워드</div>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Calendar Heatmap */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold mb-4">학습 캘린더 ({new Date().getMonth() + 1}월)</h3>
            <div className="space-y-2">
              <div className="flex gap-1 text-xs text-gray-600 mb-2">
                {["일","월","화","수","목","금","토"].map(d => (
                  <span key={d} className="w-6 text-center">{d}</span>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {[...Array(heatmapData.firstDay)].map((_, i) => (
                  <div key={`empty-${i}`} className="w-6 h-6" />
                ))}
                {[...Array(heatmapData.daysInMonth)].map((_, i) => {
                  const day = i + 1;
                  const count = heatmapData.notesByDay[day] || 0;
                  const intensity = count === 0 ? 0 : count <= 1 ? 1 : count <= 2 ? 2 : count <= 3 ? 3 : 4;
                  return (
                    <div
                      key={day}
                      className={`w-6 h-6 rounded text-[9px] flex items-center justify-center ${getHeatmapColor(intensity)} hover:ring-2 hover:ring-indigo-400 transition-all`}
                      title={`${day}일 - ${count}개 노트`}
                    >
                      {count > 0 ? count : ""}
                    </div>
                  );
                })}
              </div>
              <div className="flex items-center gap-2 text-xs text-gray-600 mt-3">
                <span>적음</span>
                <div className="flex gap-1">
                  {[0, 1, 2, 3, 4].map((i) => (
                    <div key={i} className={`w-4 h-4 rounded ${getHeatmapColor(i)}`} />
                  ))}
                </div>
                <span>많음</span>
              </div>
            </div>
          </div>

          {/* Wrong Answers by Subject */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <h3 className="text-lg font-semibold mb-4">과목별 오답</h3>
            {wrongAnswers.length > 0 ? (
              <div className="space-y-3">
                {Object.entries(
                  wrongAnswers.reduce((acc: Record<string, number>, wa: any) => {
                    acc[wa.subject] = (acc[wa.subject] || 0) + 1;
                    return acc;
                  }, {} as Record<string, number>)
                ).map(([subject, count]) => (
                  <div key={subject}>
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">{subject}</span>
                      <span className="text-sm text-gray-600">{count as number}문제</span>
                    </div>
                    <Progress value={Math.min(((count as number) / wrongAnswers.length) * 100, 100)} className="h-2" />
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-400 text-sm text-center py-8">아직 오답 데이터가 없습니다</p>
            )}
          </div>
        </div>

        {/* Recent Notes */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold mb-4">최근 노트</h3>
          {notes.length > 0 ? (
            <div className="space-y-3">
              {notes.slice(-5).reverse().map((n: any) => (
                <div
                  key={n.id}
                  onClick={() => navigate("/notes")}
                  className="p-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-100 cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-1">
                    <p className="font-medium text-gray-900 text-sm line-clamp-1">{n.note?.slice(0, 60) || n.raw?.slice(0, 60)}</p>
                    <span className="text-xs text-gray-500 shrink-0 ml-2">{n.time}</span>
                  </div>
                  {n.importance === "high" && (
                    <span className="text-xs px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded-full">핵심</span>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-gray-400 text-sm">아직 생성된 노트가 없습니다</p>
              <Button variant="outline" size="sm" className="mt-3" onClick={() => navigate("/")}>녹음 시작하기</Button>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
