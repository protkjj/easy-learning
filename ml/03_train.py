"""
03_train.py — KLUE-RoBERTa fine-tune 이진 분류

모델: klue/roberta-base (110M params)
입력: 30초 세그먼트 텍스트
출력: 중요(1) / 비중요(0)

RTX 5070 Ti Super 16GB 기준 batch 32, fp16으로 학습
"""

import json
import os
import sys
from pathlib import Path

import numpy as np
import torch
from datasets import Dataset
from sklearn.metrics import (
    accuracy_score,
    classification_report,
    f1_score,
    precision_score,
    recall_score,
)
from sklearn.model_selection import train_test_split
from transformers import (
    AutoModelForSequenceClassification,
    AutoTokenizer,
    EarlyStoppingCallback,
    Trainer,
    TrainingArguments,
)

OUTPUT_DIR = Path(__file__).parent / "output"
DATASET_PATH = OUTPUT_DIR / "dataset.json"
MODEL_DIR = OUTPUT_DIR / "best_model"
LOG_PATH = OUTPUT_DIR / "training_log.txt"

MODEL_NAME = "klue/roberta-large"
MAX_LEN = 256
BATCH_SIZE = 16
GRADIENT_ACCUMULATION = 2  # effective batch = 32
EPOCHS = 15
LR = 1e-5
WARMUP_RATIO = 0.1
WEIGHT_DECAY = 0.01
SEED = 42


class LogWriter:
    """stdout과 파일에 동시 출력"""

    def __init__(self, filepath):
        self.terminal = sys.stdout
        self.log = open(filepath, "w", encoding="utf-8")

    def write(self, message):
        self.terminal.write(message)
        self.log.write(message)

    def flush(self):
        self.terminal.flush()
        self.log.flush()

    def isatty(self):
        return False

    def close(self):
        self.log.close()


def load_dataset():
    with open(DATASET_PATH, "r", encoding="utf-8") as f:
        data = json.load(f)
    return data["filtered_samples"]


def compute_class_weights(labels):
    """클래스 불균형 처리를 위한 가중치 계산"""
    from collections import Counter
    counts = Counter(labels)
    total = len(labels)
    n_classes = len(counts)
    weights = {}
    for cls, count in counts.items():
        weights[cls] = total / (n_classes * count)
    return weights


def compute_metrics(eval_pred):
    logits, labels = eval_pred
    predictions = np.argmax(logits, axis=-1)
    f1 = f1_score(labels, predictions, average="binary")
    acc = accuracy_score(labels, predictions)
    precision = precision_score(labels, predictions, average="binary", zero_division=0)
    recall = recall_score(labels, predictions, average="binary", zero_division=0)
    return {
        "f1": f1,
        "accuracy": acc,
        "precision": precision,
        "recall": recall,
    }


class WeightedTrainer(Trainer):
    """클래스 가중치를 적용한 Trainer"""

    def __init__(self, class_weights=None, **kwargs):
        super().__init__(**kwargs)
        if class_weights is not None:
            self.class_weights = torch.tensor(
                [class_weights[i] for i in range(len(class_weights))],
                dtype=torch.float32,
            )
        else:
            self.class_weights = None

    def compute_loss(self, model, inputs, return_outputs=False, **kwargs):
        labels = inputs.pop("labels")
        outputs = model(**inputs)
        logits = outputs.logits

        if self.class_weights is not None:
            weight = self.class_weights.to(logits.device)
            loss_fn = torch.nn.CrossEntropyLoss(weight=weight)
        else:
            loss_fn = torch.nn.CrossEntropyLoss()

        loss = loss_fn(logits, labels)
        return (loss, outputs) if return_outputs else loss


def main():
    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    logger = LogWriter(LOG_PATH)
    sys.stdout = logger

    print("=" * 60)
    print("유튜브 자막 핵심 구간 분류 모델 학습")
    print("=" * 60)

    # GPU 확인
    device = "cuda" if torch.cuda.is_available() else "cpu"
    if device == "cuda":
        gpu_name = torch.cuda.get_device_name(0)
        gpu_mem = torch.cuda.get_device_properties(0).total_memory / 1e9
        print(f"GPU: {gpu_name} ({gpu_mem:.1f}GB)")
    else:
        print("WARNING: GPU를 찾을 수 없습니다. CPU로 학습합니다.")
    print(f"Device: {device}")
    print(f"모델: {MODEL_NAME}")
    print()

    # 데이터 로드
    print("데이터 로드 중...")
    samples = load_dataset()
    texts = [s["text"] for s in samples]
    labels = [s["label"] for s in samples]

    print(f"총 샘플: {len(samples)}개")
    print(f"중요(1): {sum(labels)}개 ({sum(labels)/len(labels)*100:.1f}%)")
    print(f"비중요(0): {len(labels)-sum(labels)}개 ({(len(labels)-sum(labels))/len(labels)*100:.1f}%)")

    if len(samples) < 100:
        print(f"\nWARNING: 샘플이 {len(samples)}개로 적습니다. 100개 이상 권장.")

    if sum(labels) == 0 or sum(labels) == len(labels):
        print("ERROR: 한 클래스만 존재합니다. 학습 불가.")
        sys.stdout = logger.terminal
        logger.close()
        return

    # 클래스 가중치 계산
    class_weights = compute_class_weights(labels)
    print(f"클래스 가중치: {class_weights}")

    # Train/Eval split
    train_texts, eval_texts, train_labels, eval_labels = train_test_split(
        texts, labels, test_size=0.2, random_state=SEED, stratify=labels
    )
    print(f"\nTrain: {len(train_texts)}개, Eval: {len(eval_texts)}개")

    # 토크나이저
    print(f"\n토크나이저 로드: {MODEL_NAME}")
    tokenizer = AutoTokenizer.from_pretrained(MODEL_NAME)

    def tokenize(examples):
        return tokenizer(
            examples["text"],
            padding="max_length",
            truncation=True,
            max_length=MAX_LEN,
        )

    # Dataset 생성
    train_dataset = Dataset.from_dict({"text": train_texts, "label": train_labels})
    eval_dataset = Dataset.from_dict({"text": eval_texts, "label": eval_labels})

    train_dataset = train_dataset.map(tokenize, batched=True, remove_columns=["text"])
    eval_dataset = eval_dataset.map(tokenize, batched=True, remove_columns=["text"])

    train_dataset.set_format("torch")
    eval_dataset.set_format("torch")

    # 모델 로드
    print(f"모델 로드: {MODEL_NAME}")
    model = AutoModelForSequenceClassification.from_pretrained(
        MODEL_NAME,
        num_labels=2,
        id2label={0: "비중요", 1: "중요"},
        label2id={"비중요": 0, "중요": 1},
    )

    # 학습 설정
    training_args = TrainingArguments(
        output_dir=str(OUTPUT_DIR / "checkpoints"),
        num_train_epochs=EPOCHS,
        per_device_train_batch_size=BATCH_SIZE,
        per_device_eval_batch_size=BATCH_SIZE,
        gradient_accumulation_steps=GRADIENT_ACCUMULATION,
        learning_rate=LR,
        warmup_ratio=WARMUP_RATIO,
        weight_decay=WEIGHT_DECAY,
        fp16=(device == "cuda"),
        eval_strategy="epoch",
        save_strategy="epoch",
        load_best_model_at_end=True,
        metric_for_best_model="f1",
        greater_is_better=True,
        save_total_limit=2,
        logging_steps=50,
        report_to="none",
        seed=SEED,
        dataloader_num_workers=4,
    )

    # Trainer
    trainer = WeightedTrainer(
        class_weights=class_weights,
        model=model,
        args=training_args,
        train_dataset=train_dataset,
        eval_dataset=eval_dataset,
        compute_metrics=compute_metrics,
        callbacks=[EarlyStoppingCallback(early_stopping_patience=2)],
    )

    # 학습
    print(f"\n{'='*60}")
    print("학습 시작")
    print(f"  Epochs: {EPOCHS}")
    print(f"  Batch size: {BATCH_SIZE}")
    print(f"  Learning rate: {LR}")
    print(f"  Max length: {MAX_LEN}")
    print(f"  FP16: {device == 'cuda'}")
    print(f"{'='*60}\n")

    train_result = trainer.train()

    # 학습 결과
    print(f"\n{'='*60}")
    print("학습 완료")
    print(f"  Total steps: {train_result.global_step}")
    print(f"  Training loss: {train_result.training_loss:.4f}")
    print(f"{'='*60}")

    # 최종 평가
    print("\n최종 평가:")
    eval_results = trainer.evaluate()
    for key, value in eval_results.items():
        if isinstance(value, float):
            print(f"  {key}: {value:.4f}")
        else:
            print(f"  {key}: {value}")

    # 상세 classification report
    predictions = trainer.predict(eval_dataset)
    preds = np.argmax(predictions.predictions, axis=-1)
    print(f"\nClassification Report:")
    print(classification_report(
        eval_labels, preds,
        target_names=["비중요", "중요"],
        digits=4,
    ))

    # 모델 저장
    print(f"\n모델 저장: {MODEL_DIR}")
    MODEL_DIR.mkdir(parents=True, exist_ok=True)
    trainer.save_model(str(MODEL_DIR))
    tokenizer.save_pretrained(str(MODEL_DIR))

    # 모델 메타 정보 저장
    meta = {
        "model_name": MODEL_NAME,
        "max_len": MAX_LEN,
        "num_labels": 2,
        "id2label": {0: "비중요", 1: "중요"},
        "eval_metrics": {k: float(v) if isinstance(v, (float, np.floating)) else v
                        for k, v in eval_results.items()},
        "train_samples": len(train_texts),
        "eval_samples": len(eval_texts),
        "class_weights": {str(k): float(v) for k, v in class_weights.items()},
    }
    with open(MODEL_DIR / "meta.json", "w", encoding="utf-8") as f:
        json.dump(meta, f, ensure_ascii=False, indent=2)

    print(f"\n=== 완료 ===")
    print(f"모델 저장 위치: {MODEL_DIR}")
    print(f"학습 로그: {LOG_PATH}")

    # stdout 복원
    sys.stdout = logger.terminal
    logger.close()


if __name__ == "__main__":
    main()
