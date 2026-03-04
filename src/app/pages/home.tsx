import { useNavigate } from "react-router";
import { BookOpen, Settings } from "lucide-react";
import { Button } from "../components/ui/button";
import { useApp } from "../../lib/store";

export function Home() {
  const navigate = useNavigate();
  const { setSchool } = useApp();

  const handleSelect = (school: string, route: string) => {
    setSchool(school);
    navigate(route);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BookOpen className="w-6 h-6 text-[#6366f1]" />
            <h1 className="text-xl font-semibold">Easy Learning</h1>
          </div>
          <Button variant="ghost" size="icon" onClick={() => navigate("/dashboard")}>
            <Settings className="w-5 h-5" />
          </Button>
        </div>
      </header>

      <main className="max-w-md mx-auto px-6 py-8">
        <div className="mb-8">
          <h2 className="text-2xl font-semibold mb-2">학습을 시작하세요</h2>
          <p className="text-gray-600">카테고리를 선택해주세요</p>
        </div>

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
            <Button variant="outline" className="flex-1" onClick={() => navigate("/wrong-answers")}>
              오답노트
            </Button>
            <Button variant="outline" className="flex-1" onClick={() => navigate("/dashboard")}>
              진도 트래커
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
