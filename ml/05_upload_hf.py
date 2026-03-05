"""
05_upload_hf.py — 모델 + 추론 서버를 Hugging Face에 업로드/배포

1단계: best_model + onnx_model을 HF Hub 모델 리포에 업로드
2단계: inference_server를 HF Spaces (Docker)에 배포

사용법:
    # 먼저 로그인
    huggingface-cli login

    # 실행
    python 05_upload_hf.py
"""

import json
import os
import sys
from pathlib import Path

MODEL_DIR = Path(__file__).parent / "output" / "best_model"
ONNX_DIR = Path(__file__).parent / "output" / "onnx_model"
SPACES_DIR = Path(__file__).parent / "hf_spaces"


def get_username():
    from huggingface_hub import HfApi
    api = HfApi()
    info = api.whoami()
    return info["name"]


def upload_model(username: str):
    """모델을 HF Hub에 업로드"""
    from huggingface_hub import HfApi

    repo_id = f"{username}/easy-learning-highlight"
    api = HfApi()

    print(f"\n모델 리포 생성/업로드: {repo_id}")
    api.create_repo(repo_id, exist_ok=True)

    # best_model 파일 업로드
    for f in MODEL_DIR.iterdir():
        if f.name.startswith(".") or f.name == "training_args.bin":
            continue
        print(f"  업로드: {f.name} ({f.stat().st_size / 1024:.1f}KB)")
        api.upload_file(
            path_or_fileobj=str(f),
            path_in_repo=f"best_model/{f.name}",
            repo_id=repo_id,
        )

    # ONNX 모델 업로드
    if ONNX_DIR.exists():
        for f in ONNX_DIR.iterdir():
            if f.name.startswith("."):
                continue
            size_mb = f.stat().st_size / (1024 * 1024)
            print(f"  업로드: onnx_model/{f.name} ({size_mb:.1f}MB)")
            api.upload_file(
                path_or_fileobj=str(f),
                path_in_repo=f"onnx_model/{f.name}",
                repo_id=repo_id,
            )

    print(f"  모델 업로드 완료: https://huggingface.co/{repo_id}")
    return repo_id


def create_spaces(username: str):
    """HF Spaces 배포 파일 생성"""
    from huggingface_hub import HfApi

    spaces_repo = f"{username}/easy-learning-inference"
    api = HfApi()

    print(f"\nSpaces 리포 생성: {spaces_repo}")
    api.create_repo(spaces_repo, repo_type="space", space_sdk="docker", exist_ok=True)

    model_repo = f"{username}/easy-learning-highlight"

    # Dockerfile
    dockerfile = f"""FROM python:3.11-slim

WORKDIR /app

RUN pip install --no-cache-dir \\
    fastapi \\
    uvicorn \\
    onnxruntime \\
    transformers \\
    numpy \\
    huggingface_hub

COPY app.py .

ENV MODEL_REPO={model_repo}
ENV PORT=7860

EXPOSE 7860

CMD ["python", "app.py"]
"""

    # app.py (Spaces용 inference server)
    app_py = '''"""
HF Spaces 추론 서버 — ONNX 모델 자동 다운로드 + FastAPI
"""

import json
import os
from pathlib import Path

import numpy as np
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="Easy Learning - Highlight Inference")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

session = None
tokenizer = None
max_len = 256


class Segment(BaseModel):
    text: str
    start: float | None = None
    duration: float | None = None


def download_model():
    """HF Hub에서 ONNX 모델 다운로드"""
    from huggingface_hub import hf_hub_download

    repo_id = os.environ.get("MODEL_REPO", "")
    if not repo_id:
        print("WARNING: MODEL_REPO 환경변수 미설정")
        return None

    cache_dir = Path("/tmp/model_cache")
    cache_dir.mkdir(exist_ok=True)

    files = [
        ("onnx_model/model.onnx", "model.onnx"),
        ("onnx_model/tokenizer.json", "tokenizer.json"),
        ("onnx_model/tokenizer_config.json", "tokenizer_config.json"),
        ("onnx_model/config.json", "config.json"),
        ("onnx_model/meta.json", "meta.json"),
    ]

    local_dir = cache_dir / "onnx_model"
    local_dir.mkdir(exist_ok=True)

    for remote, local in files:
        try:
            path = hf_hub_download(repo_id=repo_id, filename=remote, cache_dir=str(cache_dir))
            dest = local_dir / local
            if not dest.exists():
                import shutil
                shutil.copy2(path, str(dest))
            print(f"  다운로드 완료: {remote}")
        except Exception as e:
            print(f"  다운로드 실패: {remote} — {e}")

    return local_dir


def load_model():
    global session, tokenizer, max_len
    import onnxruntime as ort
    from transformers import AutoTokenizer

    model_dir = download_model()
    if not model_dir:
        return False

    onnx_path = model_dir / "model.onnx"
    if not onnx_path.exists():
        print(f"WARNING: {onnx_path} 없음")
        return False

    meta_path = model_dir / "meta.json"
    if meta_path.exists():
        with open(meta_path, "r", encoding="utf-8") as f:
            meta = json.load(f)
        max_len = meta.get("max_len", 256)

    providers = ["CPUExecutionProvider"]
    print(f"ONNX 모델 로드: {onnx_path}")
    session = ort.InferenceSession(str(onnx_path), providers=providers)

    print(f"토크나이저 로드: {model_dir}")
    tokenizer = AutoTokenizer.from_pretrained(str(model_dir))
    print(f"모델 로드 완료 (max_len={max_len})")
    return True


def predict_segments(segments: list[Segment]) -> list[dict]:
    if not session or not tokenizer:
        raise RuntimeError("모델이 로드되지 않았습니다.")

    texts = [seg.text for seg in segments]

    encoded = tokenizer(
        texts,
        padding="max_length",
        truncation=True,
        max_length=max_len,
        return_tensors="np",
    )

    ort_inputs = {
        "input_ids": encoded["input_ids"].astype(np.int64),
        "attention_mask": encoded["attention_mask"].astype(np.int64),
    }
    logits = session.run(["logits"], ort_inputs)[0]

    exp_logits = np.exp(logits - np.max(logits, axis=-1, keepdims=True))
    probs = exp_logits / exp_logits.sum(axis=-1, keepdims=True)

    results = []
    for i, seg in enumerate(segments):
        pred = int(np.argmax(logits[i]))
        results.append({
            "text": seg.text,
            "start": seg.start,
            "duration": seg.duration,
            "label": pred,
            "confidence": float(probs[i][pred]),
            "importance_score": float(probs[i][1]),
        })
    return results


def segment_transcript(text: str, window_sec: float = 30.0) -> list[Segment]:
    chars_per_segment = 150
    sentences = text.replace(". ", ".\\n").split("\\n")
    segments = []
    current = ""
    seg_idx = 0
    for sent in sentences:
        sent = sent.strip()
        if not sent:
            continue
        if len(current) + len(sent) > chars_per_segment and current:
            segments.append(Segment(text=current.strip(), start=seg_idx * window_sec, duration=window_sec))
            seg_idx += 1
            current = sent
        else:
            current = f"{current} {sent}" if current else sent
    if current.strip():
        segments.append(Segment(text=current.strip(), start=seg_idx * window_sec, duration=window_sec))
    return segments


@app.on_event("startup")
async def startup():
    load_model()


@app.get("/")
async def root():
    return {"status": "ok", "service": "Easy Learning Highlight Inference"}


@app.get("/health")
async def health():
    return {"status": "ok", "model_loaded": session is not None, "max_len": max_len}


@app.post("/analyze")
async def analyze(body: dict):
    text = body.get("text", "")
    timed_segments = body.get("segments")

    if timed_segments:
        segments = [Segment(**s) for s in timed_segments]
    else:
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
    return {"results": results, "total": len(results), "important_count": important_count}


if __name__ == "__main__":
    import uvicorn
    port = int(os.environ.get("PORT", 7860))
    print(f"\\n추론 서버 시작: http://0.0.0.0:{port}")
    uvicorn.run(app, host="0.0.0.0", port=port)
'''

    # 파일 업로드
    print("  Dockerfile 업로드...")
    api.upload_file(
        path_or_fileobj=dockerfile.encode(),
        path_in_repo="Dockerfile",
        repo_id=spaces_repo,
        repo_type="space",
    )

    print("  app.py 업로드...")
    api.upload_file(
        path_or_fileobj=app_py.encode(),
        path_in_repo="app.py",
        repo_id=spaces_repo,
        repo_type="space",
    )

    spaces_url = f"https://{username}-easy-learning-inference.hf.space"
    print(f"\n  Spaces 배포 완료!")
    print(f"  URL: {spaces_url}")
    print(f"  (빌드에 몇 분 소요될 수 있습니다)")

    return spaces_url


def main():
    try:
        username = get_username()
        print(f"HuggingFace 사용자: {username}")
    except Exception as e:
        print(f"ERROR: HuggingFace 로그인이 필요합니다.")
        print(f"  실행: huggingface-cli login")
        print(f"  또는: python -c \"from huggingface_hub import login; login()\"")
        sys.exit(1)

    # 1. 모델 업로드
    model_repo = upload_model(username)

    # 2. Spaces 배포
    spaces_url = create_spaces(username)

    print(f"\n{'='*60}")
    print("배포 완료!")
    print(f"  모델 리포: https://huggingface.co/{model_repo}")
    print(f"  추론 서버: {spaces_url}")
    print(f"\nVercel 환경변수 설정:")
    print(f"  INFERENCE_SERVER_URL={spaces_url}")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
