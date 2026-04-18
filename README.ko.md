# AI 에이전트를 위한 마케팅 스킬 (한국어판)

> 🌐 English version: [README.md](README.md)

AI 에이전트에게 마케팅 업무 전문성을 부여하는 스킬 모음이다. 전환율 최적화, 카피라이팅, SEO, 애널리틱스, 그로스 엔지니어링 작업에 AI 코딩 에이전트의 도움이 필요한 기술 지향 마케터와 창업자를 위해 만들어졌다. Claude Code, OpenAI Codex, Cursor, Windsurf 등 [Agent Skills 스펙](https://agentskills.io)을 지원하는 모든 에이전트에서 작동한다.

[Corey Haines](https://corey.co?ref=marketingskills)가 제작했다. 직접적인 도움이 필요하면 [Conversion Factory](https://conversionfactory.co?ref=marketingskills)(Corey의 전환 최적화·랜딩페이지·그로스 전략 에이전시)를, 마케팅을 더 배우고 싶다면 [Swipe Files](https://swipefiles.com?ref=marketingskills)를, 이 스킬들을 활용하는 자율 CMO 에이전트가 필요하다면 [Magister](https://magistermarketing.com?ref=marketingskills)를 확인해보자.

터미널과 코딩 에이전트에 익숙하지 않다면 동반 가이드 [Coding for Marketers](https://codingformarketers.com?ref=marketingskills)를 참고하라.

**기여 환영!** 스킬을 개선하거나 새 스킬을 추가하고 싶다면 [PR](#기여하기)을 열어달라.

문제가 있거나 질문이 있으면 [이슈를 등록](https://github.com/coreyhaines31/marketingskills/issues)해도 좋다.

## 한국어판에 대하여

이 포크는 원본 프로젝트에 한국어 현지화 레이어를 더한다. 핵심 차이는 다음과 같다.

1. **이중언어 트리거**: 각 스킬 description에 영·한 트리거 문구를 병기해 "전환율 올려줘"와 "improve conversions" 모두 자동으로 스킬을 호출한다.
2. **한국어 본문**: `SKILL.md` 본문을 한국어로 번역한다. 원본 영문은 `SKILL.en.md`에 백업되어 upstream merge가 가능하다.
3. **한국 시장 부록**: 네이버·카카오·쿠팡 등 한국 특화 플랫폼 가이드를 각 스킬의 `references/korea-market.md`에 추가한다.
4. **신규 스킬**: 한국 시장 특화 스킬 2종 (`naver-kin-automation`, `video-script-automation`)을 추가한다.

번역 원칙과 용어집은 [`docs/LOCALIZATION.md`](docs/LOCALIZATION.md)와 [`docs/glossary.ko.md`](docs/glossary.ko.md)를 참조한다.

## 스킬이란?

스킬은 AI 에이전트에게 특정 업무에 대한 전문 지식과 워크플로우를 제공하는 마크다운 파일이다. 프로젝트에 추가하면, 에이전트가 마케팅 업무를 수행 중임을 인식하고 적합한 프레임워크와 모범 사례를 적용한다.

## 스킬들이 어떻게 연결되는가

스킬들은 서로를 참조하며 공유 컨텍스트 위에서 동작한다. `product-marketing-context` 스킬이 기반이다 — 다른 모든 스킬이 이 파일을 먼저 확인해 제품·타겟 오디언스·포지셔닝 맥락을 파악한 뒤 작업에 들어간다.

```
                            ┌──────────────────────────────────────┐
                            │      product-marketing-context       │
                            │    (모든 스킬이 최초에 참조)         │
                            └──────────────────┬───────────────────┘
                                               │
    ┌──────────────┬─────────────┬─────────────┼─────────────┬──────────────┬──────────────┐
    ▼              ▼             ▼             ▼             ▼              ▼              ▼
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌────────────┐ ┌──────────┐ ┌─────────────┐ ┌───────────┐
│  SEO &   │ │   CRO    │ │콘텐츠·   │ │ 유료·      │ │그로스·   │ │세일즈·      │ │  전략     │
│ 발견     │ │          │ │  카피    │ │ 측정       │ │리텐션    │ │   GTM       │ │           │
├──────────┤ ├──────────┤ ├──────────┤ ├────────────┤ ├──────────┤ ├─────────────┤ ├───────────┤
│seo-audit │ │page-cro  │ │copywriting│ │paid-ads   │ │referral  │ │revops       │ │mktg-ideas │
│ai-seo    │ │signup-cro│ │copy-edit │ │ad-creative │ │free-tool │ │sales-enable │ │mktg-psych │
│site-arch │ │onboard   │ │cold-email│ │ab-test     │ │churn-    │ │launch       │ │customer-  │
│programm  │ │form-cro  │ │email-seq │ │analytics   │ │ prevent  │ │pricing      │ │research   │
│schema    │ │popup-cro │ │social    │ │            │ │          │ │competitor   │ │           │
│content   │ │paywall   │ │          │ │            │ │          │ │             │ │           │
└────┬─────┘ └────┬─────┘ └────┬─────┘ └─────┬──────┘ └────┬─────┘ └──────┬──────┘ └─────┬─────┘
     │            │            │              │             │              │              │
     └────────────┴─────┬──────┴──────────────┴─────────────┴──────────────┴──────────────┘
                        │
   스킬 간 교차 참조:
     copywriting ↔ page-cro ↔ ab-test-setup
     revops ↔ sales-enablement ↔ cold-email
     seo-audit ↔ schema-markup ↔ ai-seo
     customer-research → copywriting, page-cro, competitor-alternatives
     naver-kin-automation → ai-seo, social-content  (한국 특화)
     video-script-automation → copywriting, ad-creative, social-content  (한국 특화)
```

각 스킬의 **Related Skills** 섹션에 전체 의존성 지도가 있다.

## 사용 가능한 스킬

영문 스킬 테이블은 원본 [README.md](README.md#available-skills)를 참조한다. 한국어판은 다음 2종을 추가로 제공한다.

| 스킬 | 설명 |
|------|------|
| [naver-kin-automation](skills/naver-kin-automation/) | 네이버 지식iN의 타겟 키워드 질문 모니터링·브랜드 언급 탐지·닉네임/태그 기반 노출 전략. 직접 브랜드 언급 및 자동 답변 등록은 ToS 위반 위험으로 제외. |
| [video-script-automation](skills/video-script-automation/) | 라이브커머스·유료 광고·숏폼·YouTube 긴 영상 대본 자동 생성. 포맷별 플레이북과 한국 전자상거래법·뒷광고 규정 컴플라이언스 내장. |

기존 36개 스킬은 영문 트리거에 더해 한글 트리거로도 호출된다 (예: "랜딩페이지 전환율 올려줘" → `page-cro`).

## 설치

> **주의:** 이 포크는 npm/Vercel `npx skills` 레지스트리나 Claude Code 공식 마켓플레이스에 아직 등록되지 않았다. 따라서 CLI 기반 설치(옵션 1, 2)는 **포크를 별도 패키지로 발행해야** 동작한다. 발행 전까지는 아래 옵션 3-5(클론·서브모듈·직접 fork)를 사용한다. 영문 원본의 CLI 설치가 필요하면 [원본 저장소](https://github.com/coreyhaines31/marketingskills)로 간다.

### 옵션 1: 클론 후 복사 (가장 빠른 사용법)

```bash
git clone <이 포크의 실제 remote URL> AI_maketing_ofice
cp -r AI_maketing_ofice/skills/* .agents/skills/
```

설치 후 `.agents/skills/`에서 각 스킬이 로드된다 (Claude Code는 `.claude/skills/`도 폴백으로 인식).

### 옵션 2: Git 서브모듈 (upstream 업데이트 수월)

```bash
git submodule add <이 포크의 실제 remote URL> .agents/marketingskills
```

그 다음 `.agents/marketingskills/skills/`에서 스킬을 참조한다. upstream pull 시 업데이트도 가능.

### 옵션 3: Fork 후 커스터마이즈

1. 이 저장소를 본인 계정으로 fork
2. 필요에 맞게 스킬·한국 시장 부록 수정
3. fork한 저장소를 프로젝트에 clone

### (향후) 옵션 4: CLI 설치

이 포크를 별도 플러그인 마켓플레이스나 npm 패키지로 발행하면 아래 패턴이 동작할 예정.

```bash
# 발행 후 사용 가능 (현재는 미등록)
npx skills add <본인/포크경로>
/plugin marketplace add <본인/포크경로>
```

## v1.0에서 업그레이드

스킬들이 product-marketing-context 파일을 위해 `.claude/` 대신 `.agents/`를 사용하도록 바뀌었다. 기존 컨텍스트 파일을 이동하라.

```bash
mkdir -p .agents
mv .claude/product-marketing-context.md .agents/product-marketing-context.md
```

스킬들은 여전히 `.claude/`를 폴백으로 확인하므로, 이동하지 않아도 문제 없다.

## 사용법

설치 후 에이전트에게 마케팅 업무를 요청하면 된다.

```
"랜딩페이지 전환율 높여줘"
→ page-cro 스킬 사용

"SaaS 홈페이지 카피 써줘"
→ copywriting 스킬 사용

"GA4에 가입 이벤트 트래킹 설정해줘"
→ analytics-tracking 스킬 사용

"환영 이메일 5회 시퀀스 만들어줘"
→ email-sequence 스킬 사용

"지식iN에서 우리 업계 질문 모니터링해줘"
→ naver-kin-automation 스킬 사용 (한국 특화)

"쿠팡라이브 30분 방송 대본 짜줘"
→ video-script-automation 스킬 사용 (한국 특화)
```

스킬을 직접 호출할 수도 있다.

```
/page-cro
/email-sequence
/seo-audit
/naver-kin-automation
/video-script-automation
```

## 스킬 카테고리

### 전환율 최적화 (CRO)
- `page-cro` — 모든 마케팅 페이지
- `signup-flow-cro` — 가입 플로우
- `onboarding-cro` — 가입 후 활성화
- `form-cro` — 리드 수집 폼
- `popup-cro` — 모달·오버레이
- `paywall-upgrade-cro` — 앱 내 업그레이드 순간

### 콘텐츠·카피
- `copywriting` — 마케팅 페이지 카피
- `copy-editing` — 기존 카피 편집·교정
- `cold-email` — B2B 콜드 이메일과 시퀀스
- `email-sequence` — 자동 이메일 플로우
- `social-content` — 소셜 미디어 콘텐츠

### SEO·발견
- `seo-audit` — 기술·온페이지 SEO
- `ai-seo` — AI 검색 최적화 (AEO, GEO, LLMO)
- `programmatic-seo` — 대량 페이지 생성
- `site-architecture` — 페이지 계층·내비게이션·URL 구조
- `competitor-alternatives` — 비교·대안 페이지
- `schema-markup` — 구조화 데이터

### 유료·배포
- `paid-ads` — Google, Meta, LinkedIn 캠페인
- `ad-creative` — 광고 크리에이티브 대량 생성·반복
- `social-content` — 소셜 미디어 스케줄링·전략

### 측정·실험
- `analytics-tracking` — 이벤트 트래킹 설정
- `ab-test-setup` — 실험 설계

### 리텐션
- `churn-prevention` — 해지 플로우, 할인 제안, 결제 복구

### 그로스 엔지니어링
- `free-tool-strategy` — 마케팅 툴·계산기
- `referral-program` — 레퍼럴·제휴 프로그램

### 전략·수익화
- `marketing-ideas` — SaaS 마케팅 아이디어 140선
- `marketing-psychology` — 심리학·멘탈 모델
- `launch-strategy` — 제품 런칭·발표
- `pricing-strategy` — 가격 정책·패키징·수익화

### 세일즈·RevOps
- `revops` — 리드 라이프사이클, 스코어링, 라우팅, 파이프라인 관리
- `sales-enablement` — 세일즈 덱, 원페이저, 반론 대응, 데모 스크립트

### 한국 특화 (이 포크 전용)
- `naver-kin-automation` — 네이버 지식iN 모니터링·대응 전략
- `video-script-automation` — 라이브커머스·숏폼·YouTube 대본 자동화

## 기여하기

스킬을 개선하거나 새로 제안하고 싶은가? PR과 이슈 모두 환영한다.

한국어판 기여 시 추가 규칙은 [`docs/LOCALIZATION.md`](docs/LOCALIZATION.md)를, 공통 기여 가이드는 [CONTRIBUTING.md](CONTRIBUTING.md) / [CONTRIBUTING.ko.md](CONTRIBUTING.ko.md)를 참고한다.

## 라이선스

[MIT](LICENSE) — 자유롭게 사용 가능.
