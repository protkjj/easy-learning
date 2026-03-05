"""
inference_server.py — ONNX 모델 추론 API 서버

KLUE-RoBERTa ONNX 모델을 로드하여 유튜브 자막 세그먼트의
중요도(0/1)를 예측하는 FastAPI 서버.

사용법:
    pip install fastapi uvicorn onnxruntime transformers
    python inference_server.py

엔드포인트:
    POST /predict  — 세그먼트 배열 → 중요도 예측
    GET  /health   — 서버 상태 확인
"""

import json
import os
from pathlib import Path

import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

ONNX_DIR = Path(__file__).parent / "output" / "onnx_model"
FALLBACK_DIR = Path(__file__).parent / "output" / "best_model"

app = FastAPI(title="핵심 구간 추론 서버")

ALLOWED_ORIGINS = os.environ.get("ALLOWED_ORIGINS", "").split(",")
if not ALLOWED_ORIGINS or ALLOWED_ORIGINS == [""]:
    ALLOWED_ORIGINS = [
        "https://lectureai-app-dusky.vercel.app",
        "https://protkjj.github.io",
        "http://localhost:5173",
        "http://localhost:3000",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)

MAX_TEXT_LENGTH = 10_000

# 전역 모델/토크나이저
session = None
tokenizer = None
max_len = 256


class Segment(BaseModel):
    text: str
    start: float | None = None
    duration: float | None = None


class PredictRequest(BaseModel):
    segments: list[Segment]


class PredictResponse(BaseModel):
    results: list[dict]


def load_model():
    """ONNX 모델과 토크나이저를 로드"""
    global session, tokenizer, max_len
    import onnxruntime as ort
    from transformers import AutoTokenizer

    # ONNX 모델 경로 결정
    onnx_path = ONNX_DIR / "model.onnx"
    tokenizer_dir = ONNX_DIR

    if not onnx_path.exists():
        print(f"WARNING: {onnx_path} 없음. 04_export_onnx.py를 먼저 실행하세요.")
        print("PyTorch fallback 모드로 시작합니다 (느림).")
        return False

    # meta.json에서 max_len 로드
    meta_path = tokenizer_dir / "meta.json"
    if meta_path.exists():
        with open(meta_path, "r", encoding="utf-8") as f:
            meta = json.load(f)
        max_len = meta.get("max_len", 256)

    # ONNX 세션 생성
    providers = ["CUDAExecutionProvider", "CPUExecutionProvider"]
    available = ort.get_available_providers()
    providers = [p for p in providers if p in available]

    print(f"ONNX 모델 로드: {onnx_path}")
    print(f"Providers: {providers}")
    session = ort.InferenceSession(str(onnx_path), providers=providers)

    # 토크나이저 로드
    print(f"토크나이저 로드: {tokenizer_dir}")
    tokenizer = AutoTokenizer.from_pretrained(str(tokenizer_dir))

    print(f"모델 로드 완료 (max_len={max_len})")
    return True


def predict_segments(segments: list[Segment]) -> list[dict]:
    """세그먼트 배열에 대해 배치 추론 실행"""
    if not session or not tokenizer:
        raise RuntimeError("모델이 로드되지 않았습니다.")

    texts = [seg.text for seg in segments]

    # 배치 토크나이징
    encoded = tokenizer(
        texts,
        padding="max_length",
        truncation=True,
        max_length=max_len,
        return_tensors="np",
    )

    # ONNX 추론
    ort_inputs = {
        "input_ids": encoded["input_ids"].astype(np.int64),
        "attention_mask": encoded["attention_mask"].astype(np.int64),
    }
    logits = session.run(["logits"], ort_inputs)[0]

    # softmax로 확률 계산
    exp_logits = np.exp(logits - np.max(logits, axis=-1, keepdims=True))
    probs = exp_logits / exp_logits.sum(axis=-1, keepdims=True)

    results = []
    for i, seg in enumerate(segments):
        pred = int(np.argmax(logits[i]))
        results.append({
            "text": seg.text,
            "start": seg.start,
            "duration": seg.duration,
            "label": pred,  # 0: 비중요, 1: 중요
            "confidence": float(probs[i][pred]),
            "importance_score": float(probs[i][1]),  # 중요 확률
        })

    return results


def segment_transcript(text: str, window_sec: float = 30.0) -> list[Segment]:
    """타임스탬프 없는 일반 텍스트를 약 30초 분량 세그먼트로 분할.
    한국어 기준 약 150자/30초 (말하기 속도 약 300자/분)"""
    chars_per_segment = 150
    sentences = text.replace(". ", ".\n").split("\n")

    segments = []
    current = ""
    seg_idx = 0

    for sent in sentences:
        sent = sent.strip()
        if not sent:
            continue

        if len(current) + len(sent) > chars_per_segment and current:
            segments.append(Segment(
                text=current.strip(),
                start=seg_idx * window_sec,
                duration=window_sec,
            ))
            seg_idx += 1
            current = sent
        else:
            current = f"{current} {sent}" if current else sent

    if current.strip():
        segments.append(Segment(
            text=current.strip(),
            start=seg_idx * window_sec,
            duration=window_sec,
        ))

    return segments


@app.on_event("startup")
async def startup():
    load_model()


@app.get("/health")
async def health():
    return {
        "status": "ok",
        "model_loaded": session is not None,
        "max_len": max_len,
    }


@app.post("/predict", response_model=PredictResponse)
async def predict(req: PredictRequest):
    """세그먼트 배열을 받아 중요도를 예측"""
    # 텍스트 길이 제한: 총 텍스트가 MAX_TEXT_LENGTH 초과 시 앞쪽 세그먼트만 처리
    segments = req.segments
    total_len = sum(len(s.text) for s in segments)
    if total_len > MAX_TEXT_LENGTH:
        trimmed = []
        acc = 0
        for s in segments:
            if acc + len(s.text) > MAX_TEXT_LENGTH:
                break
            trimmed.append(s)
            acc += len(s.text)
        segments = trimmed

    if not session:
        return PredictResponse(results=[
            {"text": s.text, "start": s.start, "duration": s.duration,
             "label": 0, "confidence": 0.5, "importance_score": 0.5}
            for s in segments
        ])

    results = predict_segments(segments)
    return PredictResponse(results=results)


@app.post("/analyze")
async def analyze(body: dict):
    """텍스트를 받아 자동으로 세그먼트 분할 후 예측.
    프론트엔드에서 직접 호출할 수 있는 간편 API."""
    text = body.get("text", "")
    timed_segments = body.get("segments")

    # 텍스트 길이 제한 (초과 시 조용히 잘라서 처리)
    if text and len(text) > MAX_TEXT_LENGTH:
        text = text[:MAX_TEXT_LENGTH]
    if timed_segments:
        trimmed = []
        acc = 0
        for s in timed_segments:
            seg_len = len(s.get("text", ""))
            if acc + seg_len > MAX_TEXT_LENGTH:
                break
            trimmed.append(s)
            acc += seg_len
        timed_segments = trimmed

    if timed_segments:
        # 타임스탬프 정보가 있는 세그먼트 사용
        segments = [Segment(**s) for s in timed_segments]
    else:
        # 일반 텍스트를 자동 분할
        segments = segment_transcript(text)

    if not segments:
        return {"results": [], "total": 0, "important_count": 0}

    if not session:
        return {
            "results": [
                {"text": s.text, "start": s.start, "duration": s.duration,
                 "label": 0, "confidence": 0.5, "importance_score": 0.5}
                for s in segments
            ],
            "total": len(segments),
            "important_count": 0,
            "model_loaded": False,
        }

    results = predict_segments(segments)
    important_count = sum(1 for r in results if r["label"] == 1)

    return {
        "results": results,
        "total": len(results),
        "important_count": important_count,
    }


if __name__ == "__main__":
    import uvicorn

    port = int(os.environ.get("PORT", 8000))
    print(f"\n추론 서버 시작: http://localhost:{port}")
    print(f"API 문서: http://localhost:{port}/docs\n")
    uvicorn.run(app, host="0.0.0.0", port=port)
