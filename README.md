# Easy Learning - AI 강의 필기 어시스턴트

## Stack
- React 18 + TypeScript + Vite 6
- Tailwind CSS 4 + shadcn/ui
- React Router 7
- motion (framer-motion) - 애니메이션
- recharts - 차트
- sonner - 토스트
- Vercel Serverless Functions - API 프록시

## 구현 완료

### 페이지 (8개)
| 페이지 | 경로 | 설명 |
|--------|------|------|
| Home | `/` | 카테고리 선택 (고등학교/대학교), 최근 학습 이어하기, 빠른 접근 |
| SubjectSelection | `/subjects/:category` | 계열/과목 선택, AI 엔진/API 키 설정, 언어 선택 |
| Recording | `/recording` | 음성 녹음 + AI 필기 생성, 실시간 STT |
| Notes | `/notes` | AI 노트 목록, 마크다운 렌더링, 키워드 설명 팝업 |
| Quiz | `/quiz` | AI 퀴즈 생성, 정답/오답 처리, 결과 리뷰 |
| WrongAnswers | `/wrong-answers` | 오답 목록, 필터/정렬, 재시험 |
| Dashboard | `/dashboard` | 학습 통계, 히트맵 캘린더, 과목별 오답 |
| YouTube | `/youtube` | 유튜브 URL → 자막 추출 → AI 노트 생성 |

### AI 시스템
- **멀티 프로바이더**: Claude API (기본) / OpenAI GPT-4o / 데모 모드
- **폴백 체인**: 유저 키 직접 호출 → Vercel 서버 프록시 → 데모 모드
- **프롬프트**: 과목별 맞춤 (수능형/대학형), 보충설명/자동검색/개념연결 AI 자동 판단
- **퀴즈**: 고등학교 5지선다(수능형) / 대학교 4지선다

### 음성 인식
- **브라우저 모드** (Web Speech API): 무료, 실시간, ~80-85% 정확도
- **Whisper 모드** (OpenAI): 고정밀 ~95%+, 30초 주기 자동 전송

### Notion 연동
- 수업노트 → `수업노트` DB 자동 저장
- 오답 → `오답노트` DB 자동 저장
- Vercel 서버 프록시 경유 (NOTION_TOKEN 환경변수)

### 유튜브 학습
- URL 붙여넣기 → 자막 자동 추출 (한국어/영어)
- 추출된 자막 → AI 노트 생성 파이프라인

### 데이터 영속성
- notes, wrongAnswers → localStorage
- apiKey, aiProvider → localStorage
- 누적 학습 시간 → localStorage

### 배포
- **Vercel**: https://lectureai-app-dusky.vercel.app (API 프록시 포함)
- **GitHub Pages**: https://protkjj.github.io/easy-learning/ (정적)
- GitHub Actions 자동 배포 (push to main)

## Vercel 서버리스 함수
| 엔드포인트 | 파일 | 설명 |
|-----------|------|------|
| `/api/claude` | `api/claude.js` | Claude API 프록시 |
| `/api/openai` | `api/openai.js` | OpenAI Chat API 프록시 |
| `/api/whisper` | `api/whisper.js` | OpenAI Whisper STT 프록시 |
| `/api/notion` | `api/notion.js` | Notion API 프록시 (페이지 생성/DB 쿼리) |
| `/api/youtube` | `api/youtube.js` | YouTube 자막 추출 |

## 환경변수 (Vercel)
```
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
NOTION_TOKEN=ntn_...
```

## 로컬 개발
```bash
npm install
npx vite        # dev server
npx vite build  # production build
```

## 과목 구조
- **고등학교**: 수능 공통(국/수/영), 사회탐구(10과목), 과학탐구(8과목), 직업탐구(5과목)
- **대학교**: 인문(8), 상경(8), 자연(8), 공학(9), 의학/보건(8)
