"""
02_label.py — 자동 라벨링: 챕터 제목 + 강조 표현 기반

3단계 라벨링:
1. 챕터 제목 기반 (confidence 0.85)
2. 강조 표현 기반 (confidence 0.70)
3. 휴리스틱 (confidence 0.50)

confidence >= 0.6인 샘플만 학습 데이터로 사용
"""

import json
import re
from collections import Counter
from pathlib import Path

OUTPUT_DIR = Path(__file__).parent / "output"
RAW_DATA_PATH = OUTPUT_DIR / "raw_data.json"
DATASET_PATH = OUTPUT_DIR / "dataset.json"

# 챕터 제목에서 "핵심" 구간을 나타내는 키워드
IMPORTANT_CHAPTER_KEYWORDS = [
    "핵심", "중요", "시험", "공식", "정리", "요약", "포인트",
    "키포인트", "key", "point", "summary", "필수", "암기",
    "출제", "빈출", "개념", "원리", "법칙", "정의", "결론",
    "꿀팁", "팁", "tip", "주의", "실수", "함정",
]

# 비중요 챕터 키워드
UNIMPORTANT_CHAPTER_KEYWORDS = [
    "인트로", "intro", "오프닝", "opening", "인사", "안녕",
    "아웃트로", "outro", "엔딩", "ending", "마무리",
    "구독", "좋아요", "알림", "광고", "홍보",
    "쉬어가기", "휴식", "잡담",
]

# 자막에서 강조 표현 정규식
EMPHASIS_PATTERNS = [
    r"중요합니다",
    r"중요한\s*(부분|내용|개념|포인트)",
    r"시험에\s*나옵니다",
    r"시험에\s*(잘\s*)?나오는",
    r"꼭\s*(알아야|기억|외워|암기)",
    r"반드시\s*(알아야|기억|외워|암기)",
    r"핵심(은|이|입니다|적인)",
    r"여기서\s*중요한",
    r"이것만\s*알면",
    r"이거\s*하나만",
    r"절대\s*(잊지|빼먹지|놓치지)",
    r"출제\s*(빈도|포인트|됩니다|된|될)",
    r"기출\s*(문제|에서)",
    r"실수하기\s*쉬운",
    r"많이\s*틀리는",
    r"주의하세요",
    r"주의해야",
    r"강조(합니다|하고\s*싶은|할)",
    r"다시\s*한번\s*(강조|말씀|정리)",
    r"밑줄\s*(치세요|긋|쫙)",
    r"별표\s*(치세요|표시)",
    r"형광펜",
    r"표시해\s*두세요",
    r"메모하세요",
    r"적어\s*두세요",
    r"이게\s*진짜\s*중요",
    r"이건\s*꼭",
]

COMPILED_EMPHASIS = [re.compile(p) for p in EMPHASIS_PATTERNS]


def load_raw_data():
    with open(RAW_DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def is_important_chapter(chapter_title):
    """챕터 제목이 중요 구간인지 판별"""
    title_lower = chapter_title.lower()
    for kw in IMPORTANT_CHAPTER_KEYWORDS:
        if kw in title_lower:
            return True
    return False


def is_unimportant_chapter(chapter_title):
    """챕터 제목이 비중요 구간인지 판별"""
    title_lower = chapter_title.lower()
    for kw in UNIMPORTANT_CHAPTER_KEYWORDS:
        if kw in title_lower:
            return True
    return False


def get_chapter_for_segment(segment, chapters):
    """세그먼트가 속하는 챕터 찾기"""
    seg_mid = (segment["start"] + segment["end"]) / 2
    best_chapter = None
    for i, ch in enumerate(chapters):
        ch_start = ch.get("start_time", ch.get("start", 0))
        ch_end = ch.get("end_time", ch.get("end", float("inf")))
        if i + 1 < len(chapters):
            ch_end = chapters[i + 1].get("start_time", chapters[i + 1].get("start", ch_end))
        if ch_start <= seg_mid < ch_end:
            best_chapter = ch
            break
    return best_chapter


def count_emphasis(text):
    """텍스트에서 강조 표현 개수 카운트"""
    count = 0
    for pattern in COMPILED_EMPHASIS:
        if pattern.search(text):
            count += 1
    return count


def label_segment(segment, chapters):
    """세그먼트에 라벨 부여. (label, confidence) 반환"""
    text = segment["text"]

    # 1단계: 챕터 제목 기반 (confidence 0.85)
    if chapters:
        chapter = get_chapter_for_segment(segment, chapters)
        if chapter:
            title = chapter.get("title", "")
            if is_important_chapter(title):
                return 1, 0.85, f"chapter:{title}"
            if is_unimportant_chapter(title):
                return 0, 0.85, f"chapter_unimportant:{title}"

    # 2단계: 강조 표현 기반 (confidence 0.70)
    emphasis_count = count_emphasis(text)
    if emphasis_count >= 2:
        return 1, 0.80, f"emphasis:x{emphasis_count}"
    if emphasis_count == 1:
        return 1, 0.70, f"emphasis:x1"

    # 3단계: 휴리스틱
    # 텍스트가 너무 짧으면 비중요
    if len(text.strip()) < 10:
        return 0, 0.60, "heuristic:short"

    # 기본값: 비중요 (confidence 0.60으로 학습 데이터에 포함)
    return 0, 0.60, "heuristic:default"


def main():
    raw_data = load_raw_data()
    videos = raw_data["videos"]

    print(f"총 {len(videos)}개 영상 라벨링 시작...")

    dataset = []
    label_counts = Counter()
    confidence_dist = Counter()
    reason_dist = Counter()

    for video in videos:
        chapters = video.get("chapters", [])
        segments = video.get("segments", [])

        for seg in segments:
            label, confidence, reason = label_segment(seg, chapters)

            sample = {
                "video_id": video["video_id"],
                "video_title": video["title"],
                "start": seg["start"],
                "end": seg["end"],
                "text": seg["text"],
                "label": label,
                "confidence": confidence,
                "reason": reason,
            }
            dataset.append(sample)
            label_counts[label] += 1
            confidence_dist[f"{confidence:.2f}"] += 1
            reason_dist[reason.split(":")[0]] += 1

    # confidence >= 0.6 필터
    filtered = [s for s in dataset if s["confidence"] >= 0.6]
    filtered_labels = Counter(s["label"] for s in filtered)

    print(f"\n=== 라벨링 결과 ===")
    print(f"전체 세그먼트: {len(dataset)}개")
    print(f"  - 중요(1): {label_counts[1]}개")
    print(f"  - 비중요(0): {label_counts[0]}개")
    print(f"\nConfidence 분포:")
    for conf, cnt in sorted(confidence_dist.items()):
        print(f"  {conf}: {cnt}개")
    print(f"\n라벨링 방법 분포:")
    for reason, cnt in sorted(reason_dist.items(), key=lambda x: -x[1]):
        print(f"  {reason}: {cnt}개")

    print(f"\n학습 데이터 (confidence >= 0.6): {len(filtered)}개")
    print(f"  - 중요(1): {filtered_labels[1]}개")
    print(f"  - 비중요(0): {filtered_labels[0]}개")

    if filtered_labels[1] > 0 and filtered_labels[0] > 0:
        ratio = filtered_labels[0] / filtered_labels[1]
        print(f"  - 비율 (0:1): {ratio:.1f}:1")

    # 저장
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    output = {
        "all_samples": dataset,
        "filtered_samples": filtered,
        "stats": {
            "total": len(dataset),
            "filtered": len(filtered),
            "label_counts": dict(label_counts),
            "filtered_label_counts": dict(filtered_labels),
        },
    }

    with open(DATASET_PATH, "w", encoding="utf-8") as f:
        json.dump(output, f, ensure_ascii=False, indent=2)

    print(f"\n데이터셋 저장: {DATASET_PATH}")


if __name__ == "__main__":
    main()
