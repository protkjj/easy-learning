import { useNavigate } from "react-router";
import { BookOpen, Settings, ArrowRight, Youtube, Upload as UploadIcon } from "lucide-react";
import { Button } from "../components/ui/button";
import { useApp } from "../../lib/store";
import { getTodayReviewCount } from "../../lib/weakness";
import { useMemo } from "react";

export function Home() {
  const navigate = useNavigate();
  const { setSchool, subject, school, division, wrongAnswers } = useApp();

  const reviewCount = useMemo(() => getTodayReviewCount(wrongAnswers), [wrongAnswers]);

  const handleSelect = (school: string, route: string) => {
    setSchool(school);
    navigate(route);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-[#6366f1]" />
            <h1 className="text-xl font-semibold">Easy Learning</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <Settings className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-2">학습을 시작하세요</h2>
          <p className="text-gray-600">카테고리를 선택해주세요</p>
        </div>

        {subject && (
          <div className="mb-6 bg-white rounded-2xl p-5 shadow-sm border border-indigo-100">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-indigo-500 font-medium mb-1">최근 학습 이어하기</p>
                <p className="text-sm text-gray-700">이전 학습: {subject}</p>
              </div>
              <Button onClick={() => navigate("/recording")} className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm">
                이어하기 <ArrowRight className="w-4 h-4 ml-1" />
              </Button>
            </div>
          </div>
        )}

        <div className="space-y-4">
          <button
            onClick={() => handleSelect("고등학교", "/subjects/highschool")}
            className="w-full bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-all border border-gray-100 group"
          >
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-amber-50 flex items-center justify-center text-3xl group-hover:bg-amber-100 transition-colors">
                📚
              </div>
              <div className="flex-1 text-left">
                <h3 className="text-xl font-semibold mb-1">고등학교</h3>
                <p className="text-sm text-gray-600">수능 및 내신 대비</p>
              </div>
              <div className="w-2 h-2 rounded-full bg-[#f59e0b]"></div>
            </div>
          </button>

          <button
            onClick={() => handleSelect("대학교", "/subjects/university")}
            className="w-full bg-white rounded-2xl p-6 shadow-sm hover:shadow-md transition-all border border-gray-100 group"
          >
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-2xl bg-indigo-50 flex items-center justify-center text-3xl group-hover:bg-indigo-100 transition-colors">
                🎓
              </div>
              <div className="flex-1 text-left">
                <h3 className="text-xl font-semibold mb-1">대학교</h3>
                <p className="text-sm text-gray-600">전공 과목 학습</p>
              </div>
              <div className="w-2 h-2 rounded-full bg-[#6366f1]"></div>
            </div>
          </button>
        </div>

        <div className="mt-8 pt-8 border-t border-gray-200">
          <h3 className="text-sm font-medium text-gray-700 mb-3">빠른 접근</h3>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1 relative" onClick={() => navigate("/wrong-answers")}>
              오답노트{reviewCount > 0 ? ` (${reviewCount})` : ""}
              {reviewCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] font-bold rounded-full">
                  {reviewCount}
                </span>
              )}
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => navigate("/dashboard")}>
              진도 트래커
            </Button>
          </div>
          <div className="mt-3 flex gap-3">
            <Button
              variant="outline"
              className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              onClick={() => navigate("/youtube")}
            >
              <Youtube className="w-4 h-4 mr-2" />
              YouTube 학습
            </Button>
            <Button
              variant="outline"
              className="flex-1 border-indigo-200 text-indigo-600 hover:bg-indigo-50 hover:text-indigo-700"
              onClick={() => navigate("/upload")}
            >
              <UploadIcon className="w-4 h-4 mr-2" />
              PDF/이미지
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
