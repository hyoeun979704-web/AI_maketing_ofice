# 기여 가이드

> 🌐 English version: [CONTRIBUTING.md](CONTRIBUTING.md)

Marketing Skills 한국어판에 기여하고 싶다면 이 가이드를 따른다. 새 스킬을 추가하거나 기존 스킬을 개선할 때 참고한다.

## 스킬 요청하기

새 스킬을 제안하고 싶다면 [스킬 요청 이슈를 등록](https://github.com/coreyhaines31/marketingskills/issues/new?template=skill-request.yml)한다.

## 새 스킬 추가하기

### 1. 스킬 디렉터리 생성

```bash
mkdir -p skills/your-skill-name
```

### 2. SKILL.md 파일 생성

모든 스킬은 YAML 프런트매터가 있는 `SKILL.md` 파일이 필요하다.

```yaml
---
name: your-skill-name
description: 이 스킬을 언제 사용하는지. 에이전트가 관련 업무를 식별할 수 있도록 트리거 문구와 키워드를 포함한다.
---

# 스킬 이름

에이전트를 위한 지시사항...
```

선택 프런트매터 필드: `license` (기본값 MIT), `metadata` (author, version 등)

### 3. 명명 규칙 준수

- **디렉터리명**: 소문자·하이픈만 (예: `email-sequence`)
- **name 필드**: 디렉터리명과 정확히 일치
- **description**: 1-1024자, 트리거 문구 포함
- **한국어판 추가 규칙**: description에 영문 트리거와 한글 트리거를 모두 포함 (상세는 [`docs/LOCALIZATION.md`](docs/LOCALIZATION.md))

### 4. 스킬 구조

```
skills/your-skill-name/
├── SKILL.md           # 필수 - 메인 지시사항
├── SKILL.en.md        # 한국어판 신규 스킬 제외 시 필수 - 원본 영어 백업
├── references/        # 선택 - 추가 문서
│   ├── guide.md
│   └── korea-market.md # 한국 특화 부록 (선택)
├── scripts/           # 선택 - 실행 가능한 코드
│   └── helper.py
└── assets/            # 선택 - 템플릿·이미지·데이터
    └── template.json
```

### 5. 효과적인 지시사항 작성

- `SKILL.md`는 500줄 이하로 유지
- 상세 레퍼런스는 `references/`로 이동
- 단계별 지시사항 포함
- 입출력 예시 추가
- 일반적인 엣지 케이스 커버
- **한국어 스타일**: `docs/LOCALIZATION.md` 스타일 가이드 준수 (2인칭 선언형·단문·용어집 준수)

## 기존 스킬 번역·개선하기

### 기존 영문 스킬 번역

1. `cp skills/<name>/SKILL.md skills/<name>/SKILL.en.md` — 원본 백업
2. `SKILL.md` 본문을 한국어로 번역 ([`docs/glossary.ko.md`](docs/glossary.ko.md) 준수)
3. `description` 필드를 이중언어로 확장 (영문 원문 + 한글 트리거, 1024자 이내)
4. `metadata`에 `ko-version: <upstream>-ko.<n>` 추가
5. `VERSIONS.md`의 한국어판 버전 표 갱신
6. `bash scripts/validate-ko.sh <name>` 실행 — 통과해야 함

### 기존 스킬 개선

1. 기존 스킬을 끝까지 읽는다
2. 로컬에서 변경 사항을 테스트
3. 변경은 작고 집중적으로
4. 중요한 변경이면 metadata의 버전 업데이트

## 기여 제출하기

1. 저장소 fork
2. 기능 브랜치 생성 (`git checkout -b feature/new-skill-name` 또는 `i18n/<skill-name>-ko`)
3. 변경 적용
4. 로컬에서 AI 에이전트로 테스트
5. 검증 스크립트 실행
   ```bash
   bash validate-skills.sh
   bash scripts/validate-ko.sh
   ```
6. PR 제출 (적절한 템플릿 선택):
   - [신규 스킬](?template=new-skill.md)
   - [스킬 업데이트](?template=skill-update.md)
   - [문서](?template=documentation.md)

## 스킬 품질 체크리스트

- [ ] `name`이 디렉터리명과 일치
- [ ] `description`이 스킬 사용 시점을 명확히 설명
- [ ] 지시사항이 명확하고 실행 가능
- [ ] 민감 정보·자격 증명 없음
- [ ] 저장소의 기존 스킬 패턴 준수
- [ ] **한국어판**: `SKILL.en.md` 백업 존재
- [ ] **한국어판**: description에 한글 트리거 포함
- [ ] **한국어판**: metadata에 `ko-version` 필드 존재
- [ ] **한국어판**: 법규 준수 필요 시 `## 컴플라이언스` 섹션 포함 (지식iN 광고성 답변 금지, 전자상거래법 광고 표시 의무, 뒷광고 방지 등)

## 질문 있나요?

이슈를 열어 질문하거나 기여에 도움을 요청할 수 있다.
