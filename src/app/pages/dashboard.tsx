import { useNavigate } from "react-router";
import { ArrowLeft, BookOpen, Clock, TrendingUp, RefreshCw, AlertTriangle, Bell, ArrowRight, Loader2 } from "lucide-react";
import { Button } from "../components/ui/button";
import { Progress } from "../components/ui/progress";
import { useApp } from "../../lib/store";
import { useMemo, useState, useEffect, useCallback } from "react";
import { analyzeWeaknesses, getReviewSchedule, getTodayReviewCount } from "../../lib/weakness";
import { fetchProgressFromNotion } from "../../lib/notion";

interface NotionProgress {
  id: string;
  subject: string;
  division: string;
  school: string;
  date: string;
  notesCount: number;
  quizScore: number;
  studyMinutes: number;
}

export function Dashboard() {
  const navigate = useNavigate();
  const { notes, wrongAnswers, elapsed } = useApp();

  // Notion progress state
  const [notionProgress, setNotionProgress] = useState<NotionProgress[]>([]);
  const [notionLoading, setNotionLoading] = useState(false);
  const [notionConnected, setNotionConnected] = useState<boolean | null>(null);

  const loadNotionData = useCallback(async () => {
    setNotionLoading(true);
    try {
      const data = await fetchProgressFromNotion();
      setNotionProgress(data);
      setNotionConnected(true);
    } catch {
      setNotionConnected(false);
    }
    setNotionLoading(false);
  }, []);

  // Fetch Notion data on mount
  useEffect(() => {
    loadNotionData();
  }, [loadNotionData]);

  // Build subject stats from BOTH local notes AND Notion data
  const subjectStats = useMemo(() => {
    const subjectSet = new Set<string>();
    notes.forEach((n: any) => {
      if (n.keywords) n.keywords.forEach((k: string) => subjectSet.add(k));
    });
    const notionNotesTotal = notionProgress.reduce((sum, p) => sum + p.notesCount, 0);
    return {
      totalNotes: notes.length + notionNotesTotal,
      totalWrong: wrongAnswers.length,
      subjects: subjectSet.size,
    };
  }, [notes, wrongAnswers, notionProgress]);

  // Build subject-wise study time from Notion data
  const subjectStudyTime = useMemo(() => {
    const map: Record<string, number> = {};
    notionProgress.forEach((p) => {
      if (p.subject) {
        map[p.subject] = (map[p.subject] || 0) + p.studyMinutes;
      }
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [notionProgress]);

  // Max study time for progress bar scaling
  const maxStudyTime = useMemo(() => {
    if (subjectStudyTime.length === 0) return 1;
    return Math.max(...subjectStudyTime.map(([, m]) => m), 1);
  }, [subjectStudyTime]);

  // Build heatmap from BOTH note timestamps AND Notion dates
  const heatmapData = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDay = new Date(year, month, 1).getDay();
    const notesByDay: Record<number, number> = {};
    // Local notes
    notes.forEach((n: any) => {
      const d = new Date(n.id); // id is Date.now()
      if (d.getMonth() === month && d.getFullYear() === year) {
        notesByDay[d.getDate()] = (notesByDay[d.getDate()] || 0) + 1;
      }
    });
    // Notion progress dates
    notionProgress.forEach((p) => {
      if (p.date) {
        const d = new Date(p.date);
        if (d.getMonth() === month && d.getFullYear() === year) {
          notesByDay[d.getDate()] = (notesByDay[d.getDate()] || 0) + p.notesCount;
        }
      }
    });
    return { daysInMonth, firstDay, notesByDay };
  }, [notes, notionProgress]);

  // Weakness analysis
  const weaknessData = useMemo(() => analyzeWeaknesses(wrongAnswers), [wrongAnswers]);

  // Spaced repetition review schedule
  const reviewSchedule = useMemo(() => getReviewSchedule(wrongAnswers), [wrongAnswers]);
  const todayReviewCount = useMemo(() => getTodayReviewCount(wrongAnswers), [wrongAnswers]);

  // Next 3 items to review
  const nextReviewItems = useMemo(() => reviewSchedule.slice(0, 3), [reviewSchedule]);

  // Total study time from BOTH local elapsed AND Notion data
  const notionTotalMinutes = notionProgress.reduce((sum, p) => sum + p.studyMinutes, 0);
  const totalMinutes = Math.round(elapsed / 60) + notionTotalMinutes;

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
            {notionConnected === null ? (
              <div className="flex items-center gap-1 px-3 py-1.5 bg-gray-100 text-gray-500 rounded-full">
                <Loader2 className="w-3 h-3 animate-spin" />
                연결 확인중
              </div>
            ) : notionConnected ? (
              <div className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-full">
                <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                Notion 연동됨
              </div>
            ) : (
              <div className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-600 rounded-full">
                <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                Notion 연결 실패
              </div>
            )}
            <Button variant="ghost" size="icon" onClick={loadNotionData} disabled={notionLoading}>
              <RefreshCw className={`w-4 h-4 ${notionLoading ? "animate-spin" : ""}`} />
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

        {/* 과목별 학습 시간 (Notion) */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold">과목별 학습 시간</h3>
            {notionLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
          </div>
          {subjectStudyTime.length > 0 ? (
            <div className="space-y-3">
              {subjectStudyTime.map(([subject, minutes]) => (
                <div key={subject}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium text-gray-700">{subject}</span>
                    <span className="text-sm text-gray-600">{minutes}분</span>
                  </div>
                  <Progress value={Math.min((minutes / maxStudyTime) * 100, 100)} className="h-2" />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-gray-400 text-sm text-center py-8">
              {notionLoading ? "Notion에서 데이터를 불러오는 중..." : "아직 Notion 진도 데이터가 없습니다"}
            </p>
          )}
        </div>

        {/* Weakness Analysis & Review Reminder */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* 취약점 분석 Card */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-4">
              <AlertTriangle className="w-5 h-5 text-orange-500" />
              <h3 className="text-lg font-semibold">취약점 분석</h3>
            </div>
            {weaknessData.subjects.length > 0 ? (
              <div className="space-y-4">
                {/* Subject bar chart */}
                <div className="space-y-2">
                  {weaknessData.subjects.map((s: any) => (
                    <div key={s.subject}>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-gray-700">{s.subject}</span>
                        <span className="text-xs text-gray-500">{s.count}문제 ({s.percentage}%)</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2.5">
                        <div
                          className="bg-orange-400 h-2.5 rounded-full transition-all"
                          style={{ width: `${s.percentage}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* Trend indicator */}
                <div className="flex items-center gap-2 pt-2 border-t border-gray-100">
                  <span className="text-xs text-gray-500">최근 7일 트렌드:</span>
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                    weaknessData.recentTrend === "increasing"
                      ? "bg-red-100 text-red-700"
                      : weaknessData.recentTrend === "decreasing"
                        ? "bg-green-100 text-green-700"
                        : "bg-gray-100 text-gray-600"
                  }`}>
                    {weaknessData.recentTrend === "increasing" ? "오답 증가" :
                     weaknessData.recentTrend === "decreasing" ? "오답 감소" : "안정"}
                  </span>
                </div>

                {/* AI Recommendation */}
                {weaknessData.recommendation && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-3">
                    <p className="text-sm text-orange-800 leading-relaxed">
                      {weaknessData.recommendation}
                    </p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-gray-400 text-sm text-center py-8">아직 오답 데이터가 없습니다</p>
            )}
          </div>

          {/* 복습 알림 Card */}
          <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Bell className="w-5 h-5 text-indigo-500" />
                <h3 className="text-lg font-semibold">복습 알림</h3>
              </div>
              {todayReviewCount > 0 && (
                <span className="flex items-center justify-center min-w-[24px] h-6 px-2 bg-red-500 text-white text-xs font-bold rounded-full">
                  {todayReviewCount}
                </span>
              )}
            </div>

            {wrongAnswers.length > 0 ? (
              <div className="space-y-4">
                {/* Today's review count */}
                <div className={`rounded-lg p-4 text-center ${
                  todayReviewCount > 0 ? "bg-red-50 border border-red-200" : "bg-green-50 border border-green-200"
                }`}>
                  <div className={`text-2xl font-bold ${todayReviewCount > 0 ? "text-red-600" : "text-green-600"}`}>
                    {todayReviewCount}문제
                  </div>
                  <p className={`text-sm ${todayReviewCount > 0 ? "text-red-600" : "text-green-600"}`}>
                    {todayReviewCount > 0 ? "오늘 복습이 필요합니다" : "오늘 복습할 문제가 없습니다"}
                  </p>
                </div>

                {/* Next 3 items to review */}
                {nextReviewItems.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs text-gray-500 font-medium">다음 복습 항목</p>
                    {nextReviewItems.map((item: any, i: number) => (
                      <div
                        key={i}
                        className={`p-3 rounded-lg border text-sm ${
                          item.urgency === "overdue"
                            ? "bg-red-50 border-red-200"
                            : item.urgency === "today"
                              ? "bg-amber-50 border-amber-200"
                              : item.urgency === "soon"
                                ? "bg-blue-50 border-blue-200"
                                : "bg-gray-50 border-gray-200"
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium text-gray-800 line-clamp-1 flex-1 mr-2">
                            {item.question?.slice(0, 40)}{item.question?.length > 40 ? "..." : ""}
                          </span>
                          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${
                            item.urgency === "overdue"
                              ? "bg-red-200 text-red-800"
                              : item.urgency === "today"
                                ? "bg-amber-200 text-amber-800"
                                : item.urgency === "soon"
                                  ? "bg-blue-200 text-blue-800"
                                  : "bg-gray-200 text-gray-600"
                          }`}>
                            {item.urgency === "overdue"
                              ? "기한 초과"
                              : item.urgency === "today"
                                ? "오늘"
                                : item.urgency === "soon"
                                  ? `${item.daysUntilReview}일 후`
                                  : `${item.daysUntilReview}일 후`}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">{item.subject} - 복습일: {item.nextReviewDate}</p>
                      </div>
                    ))}
                  </div>
                )}

                {/* Start review button */}
                <Button
                  onClick={() => navigate("/quiz")}
                  className="w-full bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  복습 시작 <ArrowRight className="w-4 h-4 ml-1" />
                </Button>
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
