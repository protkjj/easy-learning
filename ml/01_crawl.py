"""
01_crawl.py — 유튜브 교육 영상 자막 + 챕터 크롤링

yt-dlp로 검색 → 챕터 있는 영상 필터 → 자막 추출 → 30초 세그먼트 분할
중간 결과를 output/raw_data.json에 저장하여 중단 시 이어받기 가능
"""

import json
import os
import re
import subprocess
import time
from pathlib import Path

from tqdm import tqdm

try:
    from youtube_transcript_api import YouTubeTranscriptApi
except ImportError:
    print("youtube-transcript-api 설치 필요: pip install youtube-transcript-api")
    raise

OUTPUT_DIR = Path(__file__).parent / "output"
RAW_DATA_PATH = OUTPUT_DIR / "raw_data.json"
CHANNELS_PATH = Path(__file__).parent / "channels.json"

SEGMENT_DURATION = 30  # 초


def load_channels_config():
    with open(CHANNELS_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def search_videos(query, max_results=10):
    """yt-dlp로 유튜브 검색하여 영상 ID 목록 반환"""
    cmd = [
        "yt-dlp",
        f"ytsearch{max_results}:{query}",
        "--flat-playlist",
        "--dump-json",
        "--no-warnings",
        "--quiet",
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=60)
        videos = []
        for line in result.stdout.strip().split("\n"):
            if not line:
                continue
            try:
                data = json.loads(line)
                videos.append({
                    "id": data.get("id", ""),
                    "title": data.get("title", ""),
                    "duration": data.get("duration", 0),
                })
            except json.JSONDecodeError:
                continue
        return videos
    except (subprocess.TimeoutExpired, FileNotFoundError) as e:
        print(f"  검색 실패 ({query}): {e}")
        return []


def get_video_info(video_id):
    """yt-dlp로 영상의 챕터 정보와 설명 추출"""
    cmd = [
        "yt-dlp",
        f"https://www.youtube.com/watch?v={video_id}",
        "--dump-json",
        "--no-download",
        "--no-warnings",
        "--quiet",
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, timeout=30)
        if result.returncode != 0:
            return None
        data = json.loads(result.stdout)
        return {
            "chapters": data.get("chapters") or [],
            "description": data.get("description", ""),
            "title": data.get("title", ""),
            "duration": data.get("duration", 0),
        }
    except (subprocess.TimeoutExpired, json.JSONDecodeError, FileNotFoundError):
        return None


def parse_timestamps_from_description(description):
    """영상 설명에서 타임스탬프 파싱 (챕터가 없는 경우 대체)"""
    pattern = r"(?:(\d{1,2}):)?(\d{1,2}):(\d{2})\s+(.+)"
    timestamps = []
    for match in re.finditer(pattern, description):
        hours = int(match.group(1) or 0)
        minutes = int(match.group(2))
        seconds = int(match.group(3))
        title = match.group(4).strip()
        total_seconds = hours * 3600 + minutes * 60 + seconds
        timestamps.append({
            "start_time": total_seconds,
            "title": title,
        })
    return timestamps


def get_transcript(video_id):
    """youtube-transcript-api 1.x로 한국어 자막 추출"""
    try:
        ytt_api = YouTubeTranscriptApi()
        fetched = ytt_api.fetch(video_id, languages=["ko"])
        return fetched.to_raw_data()
    except Exception:
        return None


def segment_transcript(transcript_entries, segment_duration=SEGMENT_DURATION):
    """자막을 segment_duration 초 단위로 분할"""
    if not transcript_entries:
        return []

    segments = []
    current_segment = {"start": 0, "end": segment_duration, "texts": []}

    for entry in transcript_entries:
        entry_start = entry["start"]

        # 현재 세그먼트를 넘어가면 새 세그먼트 시작
        while entry_start >= current_segment["end"]:
            if current_segment["texts"]:
                segments.append({
                    "start": current_segment["start"],
                    "end": current_segment["end"],
                    "text": " ".join(current_segment["texts"]),
                })
            current_segment = {
                "start": current_segment["end"],
                "end": current_segment["end"] + segment_duration,
                "texts": [],
            }

        current_segment["texts"].append(entry["text"])

    # 마지막 세그먼트
    if current_segment["texts"]:
        segments.append({
            "start": current_segment["start"],
            "end": current_segment["end"],
            "text": " ".join(current_segment["texts"]),
        })

    return segments


def load_existing_data():
    """기존 크롤링 데이터 로드 (이어받기용)"""
    if RAW_DATA_PATH.exists():
        with open(RAW_DATA_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"videos": [], "processed_ids": []}


def save_data(data):
    """크롤링 데이터 저장"""
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    with open(RAW_DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=2)


def main():
    config = load_channels_config()
    settings = config["settings"]
    queries = config["search_queries"]

    data = load_existing_data()
    processed_ids = set(data["processed_ids"])

    print(f"기존 데이터: {len(data['videos'])}개 영상, {len(processed_ids)}개 처리됨")
    print(f"검색 쿼리 {len(queries)}개로 영상 수집 시작...")

    # 1단계: 영상 검색
    candidate_videos = []
    for query in tqdm(queries, desc="검색 중"):
        videos = search_videos(query, max_results=settings["max_videos_per_query"])
        for v in videos:
            if v["id"] and v["id"] not in processed_ids:
                duration = v.get("duration") or 0
                if settings["min_duration_seconds"] <= duration <= settings["max_duration_seconds"]:
                    candidate_videos.append(v)
        time.sleep(1)  # rate limit

    # 중복 제거
    seen = set()
    unique_videos = []
    for v in candidate_videos:
        if v["id"] not in seen and v["id"] not in processed_ids:
            seen.add(v["id"])
            unique_videos.append(v)

    # 최대 영상 수 제한
    max_total = settings["max_total_videos"] - len(data["videos"])
    unique_videos = unique_videos[:max(0, max_total)]

    print(f"\n후보 영상 {len(unique_videos)}개 발견. 자막 + 챕터 추출 시작...")

    # 2단계: 각 영상에서 자막 + 챕터 추출
    success_count = 0
    for video in tqdm(unique_videos, desc="크롤링 중"):
        video_id = video["id"]
        processed_ids.add(video_id)

        # 자막 추출
        transcript = get_transcript(video_id)
        if not transcript:
            data["processed_ids"] = list(processed_ids)
            save_data(data)
            time.sleep(1)
            continue

        # 영상 정보 (챕터, 설명) 추출
        info = get_video_info(video_id)
        chapters = []
        if info:
            chapters = info.get("chapters", [])
            if not chapters:
                # 설명에서 타임스탬프 파싱
                timestamps = parse_timestamps_from_description(info.get("description", ""))
                if timestamps:
                    chapters = timestamps

        # 30초 단위 세그먼트 분할
        segments = segment_transcript(transcript, SEGMENT_DURATION)

        if segments:
            video_data = {
                "video_id": video_id,
                "title": video.get("title", info.get("title", "") if info else ""),
                "chapters": chapters,
                "segments": segments,
                "segment_count": len(segments),
            }
            data["videos"].append(video_data)
            success_count += 1

        data["processed_ids"] = list(processed_ids)
        save_data(data)
        time.sleep(1)  # rate limit

    # 통계 출력
    total_segments = sum(v["segment_count"] for v in data["videos"])
    videos_with_chapters = sum(1 for v in data["videos"] if v["chapters"])

    print(f"\n=== 크롤링 완료 ===")
    print(f"총 영상: {len(data['videos'])}개")
    print(f"이번 세션 추가: {success_count}개")
    print(f"챕터 있는 영상: {videos_with_chapters}개")
    print(f"총 세그먼트: {total_segments}개")
    print(f"데이터 저장: {RAW_DATA_PATH}")


if __name__ == "__main__":
    main()
