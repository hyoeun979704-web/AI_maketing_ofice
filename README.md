# Agency OS

> AI 워커로 운영하는 멀티 클라이언트 마케팅 자동화 플랫폼

여러 클라이언트(업체)의 마케팅 업무 — 지식인 순위관리, 블로그 포스팅, 영상 마케팅(쇼츠·릴스·네이버 클립), 바이럴, 퍼포먼스 광고 — 를 AI 워커로 자동화하고, 하나의 콘솔에서 운영하는 시스템.

---

## 🎯 핵심 개념

**3가지 원칙**

1. **멀티 테넌트** — 한 명의 AI 워커가 여러 클라이언트를 동시에 담당
2. **Human-in-the-loop** — AI 결과물은 자동 발행 X, 승인 큐를 거쳐 사람이 검수 후 발행
3. **모듈형 워커** — 각 "AI 직원"은 독립된 파이프라인. 기존 스크립트를 워커 인터페이스만 맞추면 그대로 편입

---

## 🏗️ 아키텍처

```
                    ┌──────────────────────────────┐
                    │        운영 콘솔 (Web)        │
                    │  Next.js · Supabase Auth     │
                    └──────────────┬───────────────┘
                                   │
                    ┌──────────────▼───────────────┐
                    │         Supabase             │
                    │  Postgres + Auth + Storage   │
                    │  Edge Functions · Realtime   │
                    └──────────────┬───────────────┘
                                   │
         ┌─────────────────────────┼─────────────────────────┐
         │                         │                         │
  ┌──────▼──────┐          ┌───────▼────────┐        ┌───────▼────────┐
  │  스케줄러    │          │   승인 알림     │        │   외부 API      │
  │ (Inngest /  │          │  (Telegram /   │        │  네이버·메타·  │
  │   n8n)      │          │    Slack)      │        │  YouTube·IG    │
  └──────┬──────┘          └────────────────┘        └────────────────┘
         │
  ┌──────▼───────────────────────────────────────────┐
  │              AI 워커 풀 (Python)                  │
  │                                                   │
  │  지식인팀 · 블로그팀 · 영상팀 · 바이럴팀 · 퍼포먼스팀 │
  │     │         │         │        │         │    │
  │     └─────────┴─────────┼────────┴─────────┘    │
  │                         ▼                        │
  │            Claude API · Flux · Whisper          │
  └──────────────────────────────────────────────────┘
```

---

## 💼 부서 & 워커 맵

| 부서 | 워커 | 역할 | 스택 |
|-----|-----|------|-----|
| **지식인** | `qna-scout` | 고가치 질문 탐지 | Python · 네이버 검색 API |
| | `qna-writer` | 답변 초안 생성 → 승인큐 | Claude API |
| | `qna-ranker` | 계정 등급/순위 관리 | Python 스케줄러 |
| **블로그** | `naver-blogger` | 네이버 블로그 포스팅 | Naver OAuth · Flux · Claude |
| | `wp-editor` | 워드프레스 포스팅 | WP REST API · Flux · Claude |
| | `seo-analyst` | 키워드/경쟁 분석 | GA4 · Search Console API |
| **영상** | `shorts-writer` | 훅·스크립트 기획 | Claude API |
| | `video-editor` | 자막/컷편집 자동화 | FFmpeg · Whisper · Remotion |
| | `thumb-designer` | 썸네일 변형 생성 | Flux (Replicate) |
| | `multi-uploader` | 쇼츠·릴스·클립 동시 업로드 | YouTube · IG Graph · 네이버 Clip |
| **바이럴** | `copy-writer` | CTA·헤드라인 A/B 생성 | Claude API |
| | `community-scout` | 카페·커뮤 모니터링 | Python 크롤러 |
| | `trend-hunter` | 실시간 키워드 수집 | Naver DataLab · Google Trends |
| **퍼포먼스** | `ad-strategist` | 캠페인 설계 | Meta · Google Ads API |
| | `audience-analyst` | 타겟/오디언스 분석 | GA4 · Meta Insights |
| | `bid-optimizer` | 예산/입찰 최적화 | Meta · Google Ads API |

---

## 🛠️ 기술 스택

| 레이어 | 기술 | 비고 |
|-------|------|------|
| Frontend | Next.js 14 · React · Tailwind | App Router · Server Components |
| Backend | Supabase | Postgres · Auth · Edge Functions · Realtime |
| 워커 런타임 | Python 3.11+ | 기존 파이프라인 재활용 |
| 오케스트레이션 | Inngest 또는 n8n | cron + 재시도 + 이벤트 기반 |
| LLM | Claude API (Anthropic) | 원고·카피·답변 생성 |
| 이미지 | Flux (Replicate) | 목업·썸네일 |
| 음성 | Whisper | 영상 자막 |
| 영상 편집 | Remotion · FFmpeg | 프로그래매틱 편집 |
| 알림 | Telegram Bot · Slack | 승인 요청 푸시 |

---

## 📁 디렉토리 구조

```
agency-os/
├── apps/
│   ├── console/              # 운영 콘솔 (Next.js)
│   │   ├── app/
│   │   │   ├── (auth)/
│   │   │   ├── clients/      # 클라이언트 관리
│   │   │   ├── workers/      # 워커 모니터링
│   │   │   ├── approvals/    # 승인 큐
│   │   │   ├── analytics/    # KPI 대시보드
│   │   │   └── settings/
│   │   ├── components/
│   │   └── lib/supabase/
│   │
│   └── workers/              # Python 워커
│       ├── base/
│       │   ├── worker.py     # 워커 추상 클래스
│       │   ├── context.py    # 클라이언트 컨텍스트 로더
│       │   ├── queue.py      # 승인 큐 인터페이스
│       │   └── telemetry.py  # 로깅·실행이력
│       ├── qna/
│       │   ├── scout.py
│       │   ├── writer.py
│       │   └── ranker.py
│       ├── blog/
│       │   ├── naver_blogger.py
│       │   ├── wp_editor.py
│       │   └── seo_analyst.py
│       ├── video/
│       │   ├── shorts_writer.py
│       │   ├── video_editor.py
│       │   ├── thumb_designer.py
│       │   └── multi_uploader.py
│       ├── viral/
│       │   ├── copy_writer.py
│       │   ├── community_scout.py
│       │   └── trend_hunter.py
│       └── performance/
│           ├── ad_strategist.py
│           ├── audience_analyst.py
│           └── bid_optimizer.py
│
├── packages/
│   ├── shared/               # 공유 타입·유틸
│   └── prompts/              # 클라이언트별 프롬프트 템플릿
│
├── supabase/
│   ├── migrations/           # DB 마이그레이션
│   ├── functions/            # Edge Functions (웹훅·알림)
│   └── seed.sql
│
├── .env.example
├── docker-compose.yml
└── README.md
```

---

## 🗄️ 데이터 모델

### 핵심 테이블

```sql
-- 클라이언트 (업체)
CREATE TABLE clients (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name            text NOT NULL,
  industry        text,
  logo_url        text,
  priority        text CHECK (priority IN ('A','B','C')),
  plan            text,                      -- 프리미엄/스탠다드/퍼포먼스
  monthly_fee     numeric,
  active          boolean DEFAULT true,
  platforms       text[],                    -- ['네이버블로그','유튜브쇼츠',...]
  brand_context   jsonb,                     -- 톤·금지어·키워드·타겟 페르소나
  created_at      timestamptz DEFAULT now()
);

-- 워커 정의
CREATE TABLE workers (
  id              text PRIMARY KEY,          -- 'qna-writer' 등 고정 ID
  dept            text NOT NULL,             -- 지식인/블로그/영상/바이럴/퍼포먼스
  role            text NOT NULL,
  name            text NOT NULL,
  stack           text,
  module_path     text NOT NULL,             -- 'workers.qna.writer'
  config_schema   jsonb,                     -- 워커가 받는 config 스키마
  enabled         boolean DEFAULT true,
  created_at      timestamptz DEFAULT now()
);

-- 워커 × 클라이언트 배정
CREATE TABLE worker_assignments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id       text REFERENCES workers(id),
  client_id       uuid REFERENCES clients(id),
  config          jsonb,                     -- 이 클라이언트용 개별 설정
  schedule        text,                      -- cron 표현식 (예: '0 11,17,22 * * *')
  daily_target    integer,
  active          boolean DEFAULT true,
  UNIQUE(worker_id, client_id)
);

-- 작업 실행 인스턴스
CREATE TABLE tasks (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  worker_id       text REFERENCES workers(id),
  client_id       uuid REFERENCES clients(id),
  status          text DEFAULT 'queued',     -- queued/running/completed/failed
  input           jsonb,
  started_at      timestamptz,
  finished_at     timestamptz,
  duration_ms     integer,
  error_message   text,
  retry_count     integer DEFAULT 0,
  created_at      timestamptz DEFAULT now()
);

-- 결과물 (승인 큐 대상)
CREATE TABLE outputs (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  task_id         uuid REFERENCES tasks(id),
  worker_id       text REFERENCES workers(id),
  client_id       uuid REFERENCES clients(id),
  output_type     text,                      -- qna_answer/blog_post/ad_copy/shorts_script...
  title           text,
  content         jsonb,                     -- 실제 결과물 (텍스트·URL·메타)
  priority        text DEFAULT 'medium',     -- high/medium/low
  status          text DEFAULT 'pending',    -- pending/approved/rejected/published
  approved_by     uuid REFERENCES auth.users(id),
  approved_at     timestamptz,
  published_at    timestamptz,
  publish_meta    jsonb,                     -- 발행된 URL·ID 등
  created_at      timestamptz DEFAULT now()
);

-- 승인 이력
CREATE TABLE approvals (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  output_id       uuid REFERENCES outputs(id),
  action          text NOT NULL,             -- approve/reject/revise
  reviewer_id     uuid REFERENCES auth.users(id),
  note            text,
  created_at      timestamptz DEFAULT now()
);

-- 일일 KPI 집계
CREATE TABLE daily_kpis (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid REFERENCES clients(id),
  metric_date     date NOT NULL,
  platform        text,
  metric_type     text,                      -- visits/clicks/impressions/roas/answered...
  value           numeric,
  meta            jsonb,
  UNIQUE(client_id, metric_date, platform, metric_type)
);

-- 클라이언트별 지식)정보/자산
CREATE TABLE client_assets (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id       uuid REFERENCES clients(id),
  asset_type      text,                      -- logo/product_image/reference_post...
  url             text,
  meta            jsonb,
  created_at      timestamptz DEFAULT now()
);

-- RLS 정책: 로그인 유저는 모든 클라이언트 조회 가능 (에이전시 운영자 가정)
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;
-- ... (정책 생략)
```

---

## 🔌 워커 인터페이스

모든 워커는 아래 추상 클래스를 상속. 신규 워커 추가 시 `run()`만 구현하면 됨.

```python
# apps/workers/base/worker.py
from abc import ABC, abstractmethod
from dataclasses import dataclass
from typing import Any
import time

@dataclass
class ClientContext:
    """클라이언트 컨텍스트 - 브랜드, 금지어, 키워드, 자산"""
    client_id: str
    name: str
    industry: str
    brand_context: dict       # {'tone': '전문적', 'avoid': [...], 'keywords': [...]}
    assets: list[dict]
    platforms: list[str]

@dataclass
class TaskResult:
    output_type: str          # 'qna_answer' / 'blog_post' / ...
    title: str
    content: dict             # 실제 결과물
    priority: str = 'medium'
    requires_approval: bool = True

class Worker(ABC):
    worker_id: str
    dept: str

    def __init__(self, ctx: ClientContext, config: dict):
        self.ctx = ctx
        self.config = config

    @abstractmethod
    def run(self) -> list[TaskResult]:
        """워커 실행. 0개 이상의 결과물 반환"""
        ...

    def submit(self, results: list[TaskResult]):
        """결과물을 승인 큐(outputs 테이블)에 삽입"""
        from .queue import enqueue_outputs
        enqueue_outputs(
            client_id=self.ctx.client_id,
            worker_id=self.worker_id,
            results=results,
        )

    @classmethod
    def execute(cls, ctx: ClientContext, config: dict):
        """스케줄러가 호출하는 진입점. 실행 이력 자동 기록"""
        from .telemetry import record_task
        start = time.time()
        worker = cls(ctx, config)
        task_id = record_task.start(cls.worker_id, ctx.client_id)
        try:
            results = worker.run()
            worker.submit(results)
            record_task.complete(task_id, duration=time.time() - start)
            return results
        except Exception as e:
            record_task.fail(task_id, error=str(e))
            raise
```

### 워커 구현 예시

```python
# apps/workers/qna/writer.py
from ..base.worker import Worker, TaskResult
import anthropic

class QnaWriter(Worker):
    worker_id = 'qna-writer'
    dept = '지식인'

    def run(self) -> list[TaskResult]:
        questions = self.config['questions']   # scout가 넘긴 질문들
        client = anthropic.Anthropic()
        results = []

        for q in questions:
            msg = client.messages.create(
                model="claude-sonnet-4-5",
                max_tokens=1500,
                system=self._build_system_prompt(),
                messages=[{"role": "user", "content": q['title']}],
            )
            results.append(TaskResult(
                output_type='qna_answer',
                title=f"지식인 답변: {q['title'][:40]}",
                content={
                    'question_url': q['url'],
                    'answer': msg.content[0].text,
                    'category': q['category'],
                },
                priority='high' if q['is_high_value'] else 'medium',
            ))
        return results

    def _build_system_prompt(self) -> str:
        ctx = self.ctx
        return f"""당신은 {ctx.name}의 지식인 답변 작가입니다.
업종: {ctx.industry}
톤: {ctx.brand_context.get('tone', '친근하고 전문적')}
금지어: {', '.join(ctx.brand_context.get('avoid', []))}
답변에 자연스럽게 녹여야 하는 키워드: {', '.join(ctx.brand_context.get('keywords', []))}

AI 티가 나지 않게, 실제 경험담처럼 구체적으로 작성하세요."""
```

---

## 🚀 시작하기

### 1. 저장소 클론

```bash
git clone https://github.com/your-org/agency-os.git
cd agency-os
```

### 2. 환경변수 설정

```bash
cp .env.example .env
```

필수 키:
```env
# Supabase
SUPABASE_URL=
SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# AI
ANTHROPIC_API_KEY=
REPLICATE_API_TOKEN=

# 네이버
NAVER_CLIENT_ID=
NAVER_CLIENT_SECRET=
NAVER_BLOG_TOKEN=

# 메타
META_APP_ID=
META_APP_SECRET=
META_ACCESS_TOKEN=

# 구글
GOOGLE_ADS_DEVELOPER_TOKEN=
GA4_PROPERTY_ID=
YOUTUBE_API_KEY=

# 승인 알림
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
```

### 3. Supabase 초기화

```bash
npx supabase init
npx supabase start
npx supabase db reset   # migrations 실행 + seed 로드
```

### 4. 워커 설치

```bash
cd apps/workers
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### 5. 콘솔 실행

```bash
cd apps/console
npm install
npm run dev
# → http://localhost:3000
```

### 6. 워커 실행 (로컬 테스트)

```bash
# 특정 워커를 특정 클라이언트로 단발 실행
python -m workers.run --worker qna-writer --client resin

# 스케줄러 데몬 (Inngest 사용)
npx inngest-cli dev
```

---

## 🗓️ 개발 로드맵

### **Phase 1: 기반 구축** (Week 1-2)
- [x] 데이터 모델 설계
- [ ] Supabase 프로젝트 생성 + 마이그레이션
- [ ] 워커 추상 클래스 (`Worker`, `ClientContext`, `TaskResult`)
- [ ] 실행 이력 로깅 (`tasks`, `outputs` 삽입)
- [ ] 간단한 Next.js 콘솔 레이아웃 (클라이언트 리스트 · 워커 상태)

### **Phase 2: 첫 워커 MVP** (Week 3)
- [ ] 기존 레진공예 파이프라인을 `naver-blogger` 워커로 리팩토링
- [ ] 1개 클라이언트(레진) + 1개 워커로 엔드투엔드 검증
- [ ] 승인 큐 UI + 승인/반려 기능

### **Phase 3: 승인 흐름 완성** (Week 4)
- [ ] Telegram 봇으로 승인 요청 푸시
- [ ] 승인 시 자동 발행 (네이버 블로그 API 연동)
- [ ] 반려 시 워커에게 피드백 전달 → 재생성 플로우

### **Phase 4: 부서별 확장** (Week 5-8)
- [ ] 지식인팀 3종 (scout/writer/ranker)
- [ ] 블로그팀 WP 포스팅 추가
- [ ] 영상팀 쇼츠 파이프라인 (Remotion · FFmpeg · Whisper)
- [ ] 퍼포먼스팀 (Meta Ads 자동 입찰)
- [ ] 바이럴팀 (커뮤니티 모니터 · 트렌드 헌터)

### **Phase 5: 멀티 클라이언트 운영** (Week 9+)
- [ ] 신규 클라이언트 온보딩 플로우 (브랜드 컨텍스트 입력 UI)
- [ ] 클라이언트별 KPI 대시보드
- [ ] 주간/월간 리포트 자동 생성
- [ ] 업종별 플레이북 템플릿 (수공예/웨딩/F&B/의료/통신)

### **Phase 6: 확장** (선택)
- [ ] 세컨드 브레인 RAG (클라이언트별 자료 기반 생성)
- [ ] 다국어 확장 (일본어·영어 커뮤니티 마케팅)
- [ ] 자동 A/B 테스트 루프 (카피 → 광고 집행 → 결과 피드백)

---

## ⚠️ 운영 체크리스트

**AI 티 방지 (플랫폼 정책 준수)**
- 모든 생성물은 승인 큐 통과 필수
- 동일 키워드·동일 템플릿 반복 금지 (네이버 저품질 필터)
- 사람 손길 추가 — 한 문장씩 바꾸거나 실제 사진 삽입
- 시간대 분산 (오전/오후/저녁 다른 톤)

**보안**
- 모든 API 키는 `.env`로 관리 (절대 커밋 금지)
- Supabase RLS 필수 설정
- 승인 큐 UI는 2FA 권장

**비용 모니터링**
- 클라이언트별 API 호출 비용 일일 집계 (`daily_kpis.metric_type='api_cost'`)
- 플랜별 작업 한도 설정

---

## 📚 참고

- 기존 레진공예 파이프라인: `legacy/resin_pipeline/` (v1 참고용)
- Supabase 스키마 상세: `supabase/migrations/`
- 워커 개발 가이드: `docs/workers.md`
- 프롬프트 템플릿: `packages/prompts/`

---

## 📜 라이선스

Private · 내부 운영용
