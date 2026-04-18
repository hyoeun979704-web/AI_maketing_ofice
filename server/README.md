# Server — 자율 에이전트 오피스 백엔드

zero-dep Node 18+ HTTP 서버. 정적 오피스 앱(`office/`) 서빙 + REST + SSE 이벤트 스트림으로 프론트엔드와 통신, 스케줄러가 능동적으로 태스크를 띄워 에이전트가 처리.

## 실행

```bash
cd /home/user/AI_maketing_ofice
node server/server.mjs
# → http://localhost:8787
```

### 환경 변수

| 변수 | 기본 | 설명 |
|------|------|------|
| `ANTHROPIC_API_KEY` | (없음) | 설정되면 실제 Claude API 호출. 없으면 시뮬레이션 모드 |
| `ANTHROPIC_MODEL` | `claude-haiku-4-5` | 사용할 모델 |
| `PORT` | `8787` | 서버 포트 |

세 가지 전달 방법:

```bash
# 1) 인라인 (권장 — shell 히스토리에 키가 안 남음)
ANTHROPIC_API_KEY=sk-ant-... node server/server.mjs

# 2) shell 세션 export
export ANTHROPIC_API_KEY=sk-ant-...
node server/server.mjs

# 3) .env 파일 (저장소 루트)
echo "ANTHROPIC_API_KEY=sk-ant-..." > .env
node server/server.mjs    # env.mjs가 .env를 자동 로드
```

`.env`는 `.gitignore`에 등록되어 있어 커밋되지 않습니다.

성공 시 서버 로그가 `API key: present — real Claude execution`로 표시되고,
브라우저 사이드바 상단 pill이 "● LIVE — Claude API"로 바뀝니다.

API 키가 없을 때는 미리 정의된 템플릿(`server/agent.mjs:TEMPLATES`)을 기반으로 한 그럴듯한 한국어 출력을 생성. UI 데모와 승인 플로우 검증에는 충분.

## 구조

```
server/
├── server.mjs        # http 라우터, 정적 서빙, REST + SSE 엔드포인트
├── queue.mjs         # 태스크/승인/에이전트 상태 (in-memory) + 이벤트 버스
├── agent.mjs         # SKILL.md를 system prompt로 로드, Claude API 호출 (또는 시뮬)
├── scheduler.mjs     # 시드 백로그 + 주기적 태스크 자동 생성, 실행 오케스트레이션
└── policies.mjs      # 스킬별 승인 규칙 (금전·업로드·중요 이벤트), 시드 태스크 뱅크
```

상태는 모두 인-메모리. 서버 재시작 시 리셋. 영속성 필요 시 `queue.mjs`에 sqlite 추가만 하면 됨.

## REST API

| Method | Path | 용도 |
|--------|------|------|
| `GET` | `/api/state` | 초기 스냅샷 (tasks, approvals, agentStatus, activity, apiKeyPresent) |
| `GET` | `/api/stream` | Server-Sent Events 스트림 (`task.created`, `task.updated`, `approval.requested`, `approval.resolved`, `agent.status`) |
| `POST` | `/api/tasks` | 수동 태스크 생성 — `{agent, title, kind?}` |
| `POST` | `/api/approvals/:id` | 승인/거절 — `{decision: "approve"\|"reject"}` |
| `GET` | `/`, `/<file>` | `office/` 정적 자원 |
| `GET` | `/data/skills.json` | `dashboard/data/skills.json` 공유 |

## 승인 정책

`server/policies.mjs`의 `POLICIES` 객체로 스킬별·액션별 정책 정의. 사용자 룰 *"중요 이벤트 말고는 다 능동적으로"* 에 따라 다음만 게이트:

| 종류 | 해당 스킬 |
|------|-----------|
| 💰 **금전** | paid-ads, pricing-strategy, paywall-upgrade-cro, referral-program |
| 📤 **대외 업로드** | launch-strategy, cold-email, email-sequence, social-content, ad-creative, video-script-automation, naver-kin-automation |
| 🏗️ **구조 변경** | site-architecture, schema-markup, programmatic-seo |
| 🚪 **고객 경험 영향** | churn-prevention |

나머지 스킬(seo-audit, copywriting, customer-research 등)은 **승인 없이 자율 실행**.

`SEED_TASKS`는 스케줄러가 무작위로 뽑아 띄우는 대표 업무 카탈로그. 스킬당 1-2개의 `{title, kind}` 항목.

## 스케줄러 동작

1. 시작 시 `seedCount`(기본 6)개 태스크를 무작위 에이전트에게 분배
2. 각 태스크는 1.5초 간격으로 stagger 시작 → working → (필요 시 awaiting_approval →) completed/rejected/failed
3. `spawnIntervalMs`(기본 15s)마다 idle 상태 에이전트 한 명에게 새 태스크 부여

조정: `server/server.mjs`의 `scheduler.start({ seedCount, spawnIntervalMs })` 인자.

## 에이전트 실행 흐름

1. `runTask({agent, title, kind})` 호출
2. `skills/<agent>/SKILL.md` 전문을 system prompt로 로드 (캐시됨)
3. `kind`에 따라 user prompt 합성 (업무 요청 + 6줄 이내 한국어 보고 지시)
4. Claude Messages API 호출 (또는 시뮬레이션 출력)
5. 결과 텍스트를 `task.output`으로 저장
6. policy가 승인 필요라고 판정하면 `awaiting_approval`로 전환, 사이드바에 카드 표시
7. 승인되면 `completed`, 거절되면 `rejected`

## 비용 가이드 (실제 API 사용 시)

- 모델: `claude-haiku-4-5` (가장 저렴, 빠름)
- 시스템 프롬프트: 평균 3-5KB (스킬 SKILL.md 전체)
- 출력: max_tokens=512 (~1KB)
- 호출 빈도: 시드 6 + 시간당 240개(15초마다) ≈ 일 5,750 호출
- 대략 일 $1-3 수준 (모델·트래픽에 따라). 운영 시 spawnIntervalMs를 늘리거나 SEED_TASKS를 좁힐 것.

## 테스트

`POST /api/tasks` curl 예:

```bash
curl -X POST http://localhost:8787/api/tasks \
  -H 'content-type: application/json' \
  -d '{"agent": "seo-audit", "title": "긴급: 메인 도메인 robots.txt 검증", "kind": "draft"}'
```

승인 처리 예:

```bash
# 1) /api/state로 pending 승인 id 조회
curl http://localhost:8787/api/state | python3 -m json.tool | grep -A2 approvals

# 2) 해당 id로 승인
curl -X POST http://localhost:8787/api/approvals/<id> \
  -H 'content-type: application/json' \
  -d '{"decision": "approve"}'
```

## 한계

- 인-메모리 (재시작 시 리셋) — 운영 시 sqlite/redis 필요
- 단일 프로세스 (수평 확장 시 이벤트 버스를 외부 broker로)
- API 호출 동시성 제한 없음 — 대량 호출 시 rate-limit 필요
- 시뮬레이션 출력은 정적 템플릿 — 실제 API 키 권장
