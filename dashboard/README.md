# AI Marketing Office — 타이쿤 대시보드

38개 에이전트 스킬을 "직원"으로 시각화하고, 부서별로 관리·호출할 수 있는 브라우저 대시보드.

## 실행 방법

### 옵션 A: 로컬 웹서버 (권장)

CORS 때문에 `fetch('./data/skills.json')`는 `file://` 프로토콜에서 막힙니다. 아래 중 아무거나 실행하세요.

```bash
# Python 3
cd /home/user/AI_maketing_ofice
python3 -m http.server 8000
# → http://localhost:8000/dashboard/

# Node
npx serve .
# → 출력되는 URL + /dashboard/
```

### 옵션 B: Chrome에서 `file://` 직접 열기 (CORS 플래그 필요)

권장하지 않음. 로컬 서버를 쓰세요.

## 구조

```
dashboard/
├── index.html          # 최상위 DOM, 의존성 없음
├── style.css           # 타이쿤 톤의 다크 CSS (이모지 아바타, 책상, 부서 구역)
├── app.js              # 바닐라 JS — 데이터 로드, 렌더, 검색·필터, 모달, 클립보드
├── build-data.mjs      # skills/*/SKILL.md → data/skills.json 빌더
└── data/skills.json    # 빌더 출력 (커밋됨, 변경 시 재생성)
```

빌드·번들러·프레임워크·런타임 의존성 모두 없음. 정적 호스팅(Netlify/Cloudflare Pages/GitHub Pages) 그대로 배포 가능.

## 데이터 갱신

스킬을 추가·수정하면 `skills.json`을 다시 생성해야 합니다.

```bash
node dashboard/build-data.mjs
```

이 스크립트는 `skills/*/SKILL.md`를 모두 읽어 frontmatter(name, description, metadata.version, metadata.ko-version, metadata.ko-only)와 본문 첫 문단을 추출합니다.

## 부서 편제 (8개)

| 부서 | 색상 | 소속 스킬 수 |
|------|------|-------------|
| 🎯 전환율 최적화 | 파랑 | 6 |
| ✍️ 콘텐츠·카피 | 보라 | 5 |
| 🔍 SEO·발견 | 녹색 | 7 |
| 💰 유료·광고·측정 | 주황 | 4 |
| 📈 그로스·리텐션 | 빨강 | 5 |
| 🤝 세일즈·GTM | 청록 | 4 |
| 🧠 전략·리서치 | 남색 | 5 |
| 🇰🇷 한국 특화 | 진홍 | 2 |

편제는 `build-data.mjs`의 `DEPARTMENTS` 상수에 정의되어 있습니다. 신규 스킬 추가 시 해당 부서 배열에 등록하세요. 등록 누락 시 기본적으로 `strategy` 부서에 배치되고, 터미널에 경고가 출력됩니다.

## 사용 흐름

1. 대시보드 접속 → 38명 직원이 부서별로 표시됨
2. 상단 검색창에서 한글·영문 키워드 입력 (예: "전환율", "cold email")
3. 필터 칩 클릭으로 특정 부서만 보기
4. 직원 책상 클릭 → 상세 모달
5. 모달의 "📋 프롬프트 복사" 버튼 → Claude Code에 붙여넣기 → 해당 스킬 자동 호출

## 한계 (Phase 1 MVP)

- **실제 실행 없음**: 직원 상태는 모두 "대기 중"으로 고정. 실제 호출·결과는 Claude Code에서 이루어집니다. 실시간 상태 동기화는 Phase 2 (API/MCP 연동) 범위.
- **정적 데이터**: 스킬 수정 후 `build-data.mjs`를 수동 실행해야 반영됨. Phase 2에서 watch 모드 추가 예정.
- **모바일 레이아웃**: 640px 이하에서는 책상이 좁아집니다. 태블릿·데스크톱 우선 최적화.

## 확장 아이디어 (Phase 2+)

- [ ] 실시간 실행 상태: Claude Code 세션 API 연동 → 현재 어떤 스킬이 활성화되었는지 라이브 표시
- [ ] 스킬 이력: 호출 횟수·최근 호출 시각 표시
- [ ] 성과 지표: 각 직원별 실행 결과 평가 (evals.json 결과 시각화)
- [ ] 드래그앤드롭: 부서 재편성 시 `build-data.mjs`의 DEPARTMENTS 자동 업데이트
- [ ] 하드 모드 아트: 픽셀 스프라이트·애니메이션·발자국 트레일 추가
- [ ] 다국어: 영문 토글 (기존 `skills.json`에 영문 description도 있음)
