// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
//  취약점 예측 + 스페이스드 리피티션 (망각 곡선 기반 복습)
// ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

// "2024-01-15" → 로컬 타임존 Date (UTC 해석 방지)
function parseLocalDate(dateStr) {
  if (!dateStr) return new Date();
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
  }
  return new Date(dateStr);
}

// 오답 데이터 분석 → 취약 과목/패턴 추출
export function analyzeWeaknesses(wrongAnswers) {
  if (!wrongAnswers.length) return { subjects: [], recentTrend: "none", recommendation: "" };

  // 과목별 오답 수
  const subjectCounts = {};
  wrongAnswers.forEach((wa) => {
    subjectCounts[wa.subject] = (subjectCounts[wa.subject] || 0) + 1;
  });

  // 정렬 (오답 많은 순)
  const subjects = Object.entries(subjectCounts)
    .map(([subject, count]) => ({
      subject,
      count,
      percentage: Math.round((count / wrongAnswers.length) * 100),
    }))
    .sort((a, b) => b.count - a.count);

  // 최근 7일 트렌드
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const recentWrong = wrongAnswers.filter((wa) => parseLocalDate(wa.date) >= weekAgo);
  const recentTrend =
    recentWrong.length > wrongAnswers.length * 0.5
      ? "increasing"
      : recentWrong.length < wrongAnswers.length * 0.2
        ? "decreasing"
        : "stable";

  // 추천
  const weakest = subjects[0];
  const recommendation = weakest
    ? `${weakest.subject}에서 오답이 ${weakest.count}개로 가장 많습니다. 이 과목을 집중 복습하세요.`
    : "";

  return { subjects, recentTrend, recommendation };
}

// ── 스페이스드 리피티션 (SM-2 알고리즘 간소화 버전) ──────────

// 망각 곡선 기반 복습 추천
export function getReviewSchedule(wrongAnswers) {
  const now = new Date();

  // 복습 간격 (일): 1, 3, 7, 14, 30
  const intervals = [1, 3, 7, 14, 30];

  return wrongAnswers
    .map((wa) => {
      const wrongDate = parseLocalDate(wa.date);
      const daysSince = Math.floor((now - wrongDate) / (1000 * 60 * 60 * 24));
      const reviewCount = wa.reviewCount || 0;

      // lastReviewDate 기준으로 다음 복습 계산 (있으면 마지막 복습일 기준, 없으면 오답일 기준)
      const baseDate = wa.lastReviewDate ? parseLocalDate(wa.lastReviewDate) : wrongDate;
      const daysSinceBase = Math.floor((now - baseDate) / (1000 * 60 * 60 * 24));
      const nextInterval = intervals[Math.min(reviewCount, intervals.length - 1)];
      const daysUntilReview = nextInterval - daysSinceBase;

      // 우선순위: 복습 기한 지난 것 > 오늘 > 미래
      let urgency = "normal";
      if (daysUntilReview <= 0) urgency = "overdue";
      else if (daysUntilReview <= 1) urgency = "today";
      else if (daysUntilReview <= 3) urgency = "soon";

      // nextReviewDate를 로컬 포맷으로 생성
      const nextDate = new Date(baseDate);
      nextDate.setDate(nextDate.getDate() + nextInterval);
      const nextReviewDate = `${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}-${String(nextDate.getDate()).padStart(2, "0")}`;

      return {
        ...wa,
        daysSince,
        daysUntilReview,
        urgency,
        nextReviewDate,
      };
    })
    .sort((a, b) => a.daysUntilReview - b.daysUntilReview);
}

// 오늘 복습해야 할 문제 수
export function getTodayReviewCount(wrongAnswers) {
  const schedule = getReviewSchedule(wrongAnswers);
  return schedule.filter(
    (item) => item.urgency === "overdue" || item.urgency === "today"
  ).length;
}
