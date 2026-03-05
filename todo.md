# Easy Learning - TODO

## 완료
- [x] Figma UI 마이그레이션
- [x] AI 로직 통합 (Claude/OpenAI/데모)
- [x] 음성 인식 (Web Speech API + Whisper)
- [x] Notion 자동 저장
- [x] Vercel + GitHub Pages 배포
- [x] #1 로딩/에러 상태 UI 추가
- [x] #2 네비게이션 흐름 개선 (최근 학습 이어하기)
- [x] #3 대시보드 데이터 영속성 (localStorage)
- [x] #4 오답노트 정렬 버그 수정
- [x] #5 반응형 레이아웃 통일
- [x] #6 녹음 페이지 UX 개선
- [x] #7 퀴즈 결과 문제별 리뷰 화면
- [x] #8 다크모드 → 전체 라이트 통일
- [x] #9 접근성(a11y) 개선
- [x] #10 빈 상태(Empty State) 디자인
- [x] 유튜브 자막 학습 기능 (URL → 자막 추출 → AI 노트)
- [x] 진도트래커 Notion DB 연동 (저장 + 읽기 + 대시보드)
- [x] 취약점 예측 (오답 패턴 분석, 과목별 취약점)
- [x] 스페이스드 리피티션 (SM-2 간소화, 망각 곡선 복습 추천)

## 백로그
### 딥러닝/ML
- [ ] 유튜브 Whisper 고급 모드 (자막 없는 영상 → 음성 추출 → STT → AI 필기)
- [ ] 유사 문제 생성 (틀린 문제 임베딩 기반 유사 유형 생성)
- [ ] OCR + 필기 인식 (칠판/PPT 사진 → 텍스트 추출 → AI 노트)

### 유튜브 자막 핵심 구간 추출 모델 (`ml/`)
> KLUE-RoBERTa 기반 이진 분류 — 30초 세그먼트가 "중요한지" 자동 판별
> 위치: `lectureai-app/ml/`

- [x] 파이프라인 구축 (`run_all.sh` → 크롤링 → 라벨링 → 학습)
- [x] 크롤링 (`01_crawl.py`): yt-dlp 검색 → 자막 추출 → 30초 세그먼트 분할
- [x] 자동 라벨링 (`02_label.py`): 챕터 키워드 + 강조 표현 + 휴리스틱, confidence 필터
- [x] 학습 (`03_train.py`): klue/roberta-base fine-tune, class weight, F1 기준 best model 저장
- [ ] 학습 결과 검증 (F1 ≥ 0.75 목표)
- [x] 모델 ONNX 변환 스크립트 (`04_export_onnx.py`)
- [x] 추론 서버 (`inference_server.py` — FastAPI + ONNX Runtime)
- [x] Vercel 프록시 API (`api/highlight.js` — 추론 서버 연동 + 키워드 폴백)
- [x] YouTube API 타임스탬프 세그먼트 반환 (`api/youtube.js` 수정)
- [x] 앱 UI에 "핵심 구간" 하이라이트 표시 통합 (`youtube.tsx` 업데이트)
- [ ] 추론 서버 배포 (VPS/Cloud Run) + `INFERENCE_SERVER_URL` 환경변수 설정

### 기능 개선
- [ ] 진도트래커 "총 수업 수" 목표 설정 UI (진도율 계산용)
- [ ] Notion pagination 지원 (100개 이상 데이터 처리)
- [ ] 복습횟수 Notion 오답노트 DB 동기화
- [ ] 코드 스플리팅 (dynamic import로 번들 사이즈 최적화)
- [ ] Notion DB에서 양방향 동기화
- [ ] PWA 지원 (오프라인 사용, 푸시 알림) → 아래 "아이패드 PWA" 참고
- [ ] 멀티 세션 관리 (여러 수업 동시 기록)
- [ ] PDF/이미지 업로드 → OCR → AI 필기
- [ ] 학습 통계 분석 (주간 리포트, 취약점 분석)
- [ ] 소셜 기능 (노트 공유, 스터디 그룹)

### 아이패드 PWA (모바일 앱 대응)
> 현재 Vite + React 웹앱을 아이패드에서 네이티브 앱처럼 사용할 수 있도록 PWA 전환

- [ ] `manifest.json` 생성 (앱 이름, 아이콘, 테마색, display: standalone)
- [ ] Service Worker 등록 (오프라인 캐싱, Workbox 활용)
- [ ] 아이패드 전용 메타태그 추가 (apple-mobile-web-app-capable, 상태바 스타일 등)
- [ ] 앱 아이콘 제작 (180x180 touch-icon + 다양한 사이즈)
- [ ] 스플래시 스크린 이미지 (아이패드 해상도별)
- [ ] 아이패드 레이아웃 최적화 (넓은 화면 활용, 2컬럼 등)
- [ ] 마이크 권한 흐름 테스트 (Safari getUserMedia 호환)
- [ ] index.html에 PWA 관련 링크/메타 반영
