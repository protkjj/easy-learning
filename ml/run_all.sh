#!/bin/bash
set -e

cd "$(dirname "$0")"
mkdir -p output

# 가상환경 생성 및 활성화
if [ ! -d ".venv" ]; then
    echo "가상환경 생성 중..."
    python3 -m venv .venv
fi
source .venv/bin/activate
pip install -r requirements.txt

echo "========================================"
echo " 유튜브 자막 핵심 구간 추출 모델 파이프라인"
echo " $(date)"
echo "========================================"
echo ""

echo "=== Step 1/3: 크롤링 ==="
python 01_crawl.py 2>&1 | tee output/crawl_log.txt
echo ""

echo "=== Step 2/3: 라벨링 ==="
python 02_label.py 2>&1 | tee output/label_log.txt
echo ""

echo "=== Step 3/4: 학습 ==="
python 03_train.py 2>&1 | tee output/training_log.txt
echo ""

echo "=== Step 4/4: ONNX 변환 ==="
python 04_export_onnx.py 2>&1 | tee output/onnx_export_log.txt
echo ""

echo "========================================"
echo " 파이프라인 완료! $(date)"
echo "========================================"
echo ""
echo "결과 확인:"
echo "  모델: output/best_model/"
echo "  ONNX: output/onnx_model/"
echo "  로그: output/training_log.txt"
echo "  데이터: output/dataset.json"
echo ""
echo "추론 서버 실행:"
echo "  python inference_server.py"
