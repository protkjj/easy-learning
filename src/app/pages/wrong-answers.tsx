import { useNavigate } from "react-router";
import { ArrowLeft, Filter, RotateCcw } from "lucide-react";
import { Button } from "../components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../components/ui/select";
import { useState } from "react";
import { useApp } from "../../lib/store";

export function WrongAnswers() {
  const navigate = useNavigate();
  const { wrongAnswers } = useApp();
  const [subjectFilter, setSubjectFilter] = useState<string>("all");
  const [sortBy, setSortBy] = useState<string>("date");

  const subjects = ["all", ...new Set(wrongAnswers.map((q: any) => q.subject))];

  const sorted = [...wrongAnswers].sort((a: any, b: any) => {
    if (sortBy === "date") return b.date.localeCompare(a.date);
    if (sortBy === "subject") return a.subject.localeCompare(b.subject);
    return 0;
  });

  const filteredQuestions = sorted.filter(
    (q: any) => subjectFilter === "all" || q.subject === subjectFilter
  );

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-semibold">오답노트</h1>
            <div className="w-10"></div>
          </div>

          {/* Filters */}
          <div className="flex gap-3">
            <Select value={subjectFilter} onValueChange={setSubjectFilter}>
              <SelectTrigger className="w-40">
                <Filter className="w-4 h-4 mr-2" />
                <SelectValue placeholder="과목" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">전체 과목</SelectItem>
                {subjects.slice(1).map((subject) => (
                  <SelectItem key={subject} value={subject}>
                    {subject}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="정렬" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="date">최신순</SelectItem>
                <SelectItem value="subject">과목순</SelectItem>
                <SelectItem value="difficulty">난이도순</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-6 py-6">
        {/* Stats */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100 mb-6">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-2xl font-bold text-gray-900">
                {wrongAnswers.length}
              </div>
              <div className="text-sm text-gray-600">총 오답 문제</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-orange-600">
                {filteredQuestions.length}
              </div>
              <div className="text-sm text-gray-600">필터된 문제</div>
            </div>
            <div>
              <div className="text-2xl font-bold text-indigo-600">
                {subjects.length - 1}
              </div>
              <div className="text-sm text-gray-600">과목 수</div>
            </div>
          </div>
        </div>

        {/* Re-test Button */}
        <Button onClick={() => navigate("/quiz")} className="w-full mb-6 bg-indigo-600 hover:bg-indigo-700 text-white">
          <RotateCcw className="w-4 h-4 mr-2" />
          오답 문제 재시험
        </Button>

        {/* Questions List */}
        <div className="space-y-4">
          {filteredQuestions.map((q: any, i: number) => (
            <div
              key={i}
              className="bg-white rounded-xl p-6 shadow-sm border border-gray-100"
            >
              {/* Header */}
              <div className="flex items-center justify-between mb-4">
                <span className="px-3 py-1 bg-indigo-100 text-indigo-700 rounded-full text-sm font-medium">
                  {q.subject}
                </span>
                <span className="text-sm text-gray-500">{q.date}</span>
              </div>

              {/* Question */}
              <h3 className="font-semibold text-gray-900 mb-4">
                {q.question}
              </h3>

              {/* Answers */}
              <div className="space-y-3 mb-4">
                <div className="flex items-start gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <span className="text-red-700 font-medium text-sm shrink-0">
                    내 답안:
                  </span>
                  <span className="text-red-900">{q.myAnswer}</span>
                </div>
                <div className="flex items-start gap-3 p-3 bg-green-50 border border-green-200 rounded-lg">
                  <span className="text-green-700 font-medium text-sm shrink-0">
                    정답:
                  </span>
                  <span className="text-green-900">{q.correctAnswer}</span>
                </div>
              </div>

              {/* Explanation */}
              {q.explain && (
                <div className="bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="text-sm font-medium text-gray-700 mb-1">
                    해설
                  </div>
                  <p className="text-sm text-gray-600">{q.explain}</p>
                </div>
              )}
            </div>
          ))}
        </div>

        {filteredQuestions.length === 0 && (
          <div className="text-center py-12 text-gray-500">
            <p>오답 문제가 없습니다.</p>
            <p className="text-sm mt-2">퀴즈를 풀어보세요!</p>
          </div>
        )}
      </main>
    </div>
  );
}
