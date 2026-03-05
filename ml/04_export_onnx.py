"""
04_export_onnx.py — KLUE-RoBERTa best_model → ONNX 변환

best_model/model.safetensors를 ONNX로 변환하고,
tokenizer + meta.json을 함께 onnx_model/ 디렉토리에 저장.

사용법:
    python 04_export_onnx.py
"""

import json
import shutil
import sys
from pathlib import Path

import torch
from transformers import AutoModelForSequenceClassification, AutoTokenizer

MODEL_DIR = Path(__file__).parent / "output" / "best_model"
ONNX_DIR = Path(__file__).parent / "output" / "onnx_model"


def main():
    if not MODEL_DIR.exists():
        print(f"ERROR: {MODEL_DIR} 디렉토리를 찾을 수 없습니다.")
        print("먼저 03_train.py를 실행해주세요.")
        sys.exit(1)

    # meta.json 로드
    meta_path = MODEL_DIR / "meta.json"
    if not meta_path.exists():
        print(f"ERROR: {meta_path} 파일이 없습니다.")
        sys.exit(1)

    with open(meta_path, "r", encoding="utf-8") as f:
        meta = json.load(f)

    max_len = meta.get("max_len", 256)
    model_name = meta.get("model_name", "klue/roberta-large")

    print("=" * 60)
    print("ONNX 변환 시작")
    print(f"  원본 모델: {MODEL_DIR}")
    print(f"  출력 경로: {ONNX_DIR}")
    print(f"  Max Length: {max_len}")
    print("=" * 60)

    # 모델 & 토크나이저 로드
    print("\n모델 로드 중...")
    model = AutoModelForSequenceClassification.from_pretrained(str(MODEL_DIR))
    tokenizer = AutoTokenizer.from_pretrained(str(MODEL_DIR))
    model.eval()

    # 더미 입력 생성
    dummy_text = "이것은 ONNX 변환을 위한 더미 텍스트입니다."
    inputs = tokenizer(
        dummy_text,
        return_tensors="pt",
        padding="max_length",
        truncation=True,
        max_length=max_len,
    )

    # ONNX 출력 디렉토리 생성
    ONNX_DIR.mkdir(parents=True, exist_ok=True)
    onnx_path = ONNX_DIR / "model.onnx"

    # ONNX 변환
    print("ONNX 변환 중...")
    with torch.no_grad():
        torch.onnx.export(
            model,
            (inputs["input_ids"], inputs["attention_mask"]),
            str(onnx_path),
            input_names=["input_ids", "attention_mask"],
            output_names=["logits"],
            dynamic_axes={
                "input_ids": {0: "batch_size", 1: "sequence_length"},
                "attention_mask": {0: "batch_size", 1: "sequence_length"},
                "logits": {0: "batch_size"},
            },
            opset_version=14,
            do_constant_folding=True,
        )

    onnx_size = onnx_path.stat().st_size / (1024 * 1024)
    print(f"ONNX 모델 저장 완료: {onnx_path} ({onnx_size:.1f}MB)")

    # ONNX 모델 검증
    print("\nONNX 모델 검증 중...")
    try:
        import onnxruntime as ort

        session = ort.InferenceSession(str(onnx_path))

        # PyTorch 원본 출력
        with torch.no_grad():
            pt_outputs = model(**inputs)
            pt_logits = pt_outputs.logits.numpy()

        # ONNX 출력
        ort_inputs = {
            "input_ids": inputs["input_ids"].numpy(),
            "attention_mask": inputs["attention_mask"].numpy(),
        }
        ort_logits = session.run(["logits"], ort_inputs)[0]

        # 비교
        import numpy as np

        diff = np.abs(pt_logits - ort_logits).max()
        print(f"  PyTorch logits: {pt_logits[0]}")
        print(f"  ONNX logits:    {ort_logits[0]}")
        print(f"  최대 차이: {diff:.6f}")

        if diff < 1e-4:
            print("  검증 통과: ONNX 출력이 PyTorch와 일치합니다.")
        else:
            print(f"  WARNING: 차이가 큽니다 ({diff:.6f}). 결과를 확인하세요.")
    except ImportError:
        print("  WARNING: onnxruntime이 설치되지 않아 검증을 건너뜁니다.")
        print("  설치: pip install onnxruntime  (CPU) 또는  pip install onnxruntime-gpu  (GPU)")

    # 토크나이저 복사
    print("\n토크나이저 저장 중...")
    tokenizer.save_pretrained(str(ONNX_DIR))

    # meta.json 복사 (onnx 경로 추가)
    onnx_meta = {**meta, "onnx_model_path": "model.onnx"}
    with open(ONNX_DIR / "meta.json", "w", encoding="utf-8") as f:
        json.dump(onnx_meta, f, ensure_ascii=False, indent=2)

    # config.json 복사
    config_src = MODEL_DIR / "config.json"
    if config_src.exists():
        shutil.copy2(str(config_src), str(ONNX_DIR / "config.json"))

    print(f"\n{'='*60}")
    print("ONNX 변환 완료!")
    print(f"  모델: {onnx_path} ({onnx_size:.1f}MB)")
    print(f"  토크나이저: {ONNX_DIR}/tokenizer.json")
    print(f"  메타: {ONNX_DIR}/meta.json")
    print(f"\n추론 서버 실행:")
    print(f"  python inference_server.py")
    print(f"{'='*60}")


if __name__ == "__main__":
    main()
