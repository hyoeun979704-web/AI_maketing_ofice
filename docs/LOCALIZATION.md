# Localization Guide (한국어판)

This document defines how the Korean localization layer is organized and maintained.

## Why this layer exists

The upstream project (`coreyhaines31/marketingskills`) is English-only. Korean marketers need:

1. **Korean trigger phrases** so agents recognize requests like "전환율 올려줘" (not just "improve conversions")
2. **Korean body content** so marketers can read/edit skills without translation friction
3. **Korea-specific market context** — Naver SEO, Kakao, Coupang, Stibee, PIPA — that upstream does not cover

## Design principles

### 1. Spec-first

The Agent Skills spec (agentskills.io) requires `name` to match the directory name and be `[a-z0-9-]{1,64}`. **Skill directory names and `name` fields stay in English.** Only body content and trigger phrases are localized.

### 2. Bilingual triggers

The `description` field (1024-char limit) must carry both English and Korean trigger phrases so auto-matching works for both languages.

Example:

```yaml
description: "When the user wants to optimize conversions on any marketing page. Also use when the user says '전환율 최적화', '랜딩페이지 개선', 'CRO'. For signup flows, see signup-flow-cro."
```

Format convention:

1. English sentence from upstream (verbatim or lightly edited)
2. `Also use when the user says '<Korean trigger 1>', '<Korean trigger 2>', ...`
3. `For X, see Y.` cross-references (English, since `name` fields are English)

### 3. Upstream compatibility

Every translated `SKILL.md` has a sibling `SKILL.en.md` that preserves the upstream English version verbatim. This lets us:

- Diff against upstream when pulling updates
- Re-translate when upstream content changes
- Serve the English version to English users if we ever re-split files

### 4. Code is not translated

- `tools/clis/*.js` — JavaScript logic, argument names, error messages stay English
- `skills/*/evals/*` — test cases stay English (upstream eval suite must keep passing)
- YAML frontmatter keys (`name`, `description`, `metadata`, etc.) — English
- File paths, CLI commands, URLs — unchanged

### 5. Korea-specific additions are additive

Korea-specific guidance (Naver, Kakao, Coupang, PIPA law, etc.) goes in **new files**, never replacing existing content:

```
skills/<name>/references/korea-market.md   # new, Korea-only
skills/<name>/references/<original>.md     # upstream, untouched
skills/<name>/references/<original>.ko.md  # translation (Tier 3, optional)
```

The main `SKILL.md` references `korea-market.md` with a short pointer like:

```markdown
### 한국 시장 대응
네이버·카카오·쿠팡·스티비 관련 상세는 `references/korea-market.md` 참조.
```

## File layout

```
repo/
├── README.md                # Upstream (English). Add only a top banner pointing to README.ko.md
├── README.ko.md             # Full Korean translation
├── AGENTS.md                # Upstream + appended "## 한국어 현지화 가이드" section
├── CONTRIBUTING.md          # Upstream
├── CONTRIBUTING.ko.md       # Korean translation
├── VERSIONS.md              # Upstream + new "Korean versions" table at top
├── docs/
│   ├── LOCALIZATION.md      # This file
│   └── glossary.ko.md       # Marketing term glossary (EN → KO)
├── scripts/
│   └── validate-ko.sh       # Korean-aware validator (extends validate-skills.sh)
└── skills/<name>/
    ├── SKILL.md             # Korean body, bilingual description
    ├── SKILL.en.md          # Upstream English backup
    ├── references/
    │   ├── <original>.md    # Upstream
    │   ├── <original>.ko.md # Translation (Tier 3)
    │   └── korea-market.md  # Korea-specific appendix (Tier 4, new)
    └── evals/               # Untouched
```

## Version tracking

Each translated skill adds a `ko-version` to `metadata`:

```yaml
metadata:
  version: 1.2.0          # upstream version (do not change)
  ko-version: 1.2.0-ko.1  # Korean translation iteration
```

`ko-version` format: `<upstream>-ko.<iteration>`. Bump the iteration only for Korean-side changes (retranslation, glossary update, Korea-market appendix revision). Reset the iteration when upstream bumps and we re-translate.

See `VERSIONS.md` "Korean versions" table for the authoritative list.

## Translation workflow (per skill)

1. `cp skills/<name>/SKILL.md skills/<name>/SKILL.en.md` — backup upstream
2. Translate body of `SKILL.md` to Korean per the glossary (`docs/glossary.ko.md`)
3. Extend `description` with Korean triggers (keep under 1024 chars)
4. Add `ko-version` under `metadata`
5. Update `VERSIONS.md` Korean table
6. `bash scripts/validate-ko.sh <name>` — must pass
7. Commit with message: `i18n(<skill>): translate to Korean`

## Style guide (Korean)

Follow `AGENTS.md` upstream style, adapted to Korean:

- **2인칭 지시문**: "~하세요" 대신 선언형 "~한다" 또는 간결한 명령형 사용 (마케터 대상 전문 문서 톤)
- **단문 선호**: 한 문장 2절 이내
- **전문 용어**: 글로서리 준수. 외래어는 한글로 표기하되 처음 등장할 때 괄호로 원어 병기 (예: "랜딩페이지(landing page)")
- **불필요한 존댓말 지양**: 문서 성격상 "합니다" 대신 "한다" 체
- **코드·명령어·URL**: 영어 원문 유지

## Adding a new Korea-specific skill

Follow the upstream skill spec (see `AGENTS.md`). Skill name is still English (e.g., `naver-kin-automation`), but body and trigger phrases are Korean. Register in `.claude-plugin/marketplace.json` and `VERSIONS.md`.

## Validation

Run before committing:

```bash
bash validate-skills.sh       # Upstream spec compliance
bash scripts/validate-ko.sh   # Korean-layer compliance (SKILL.en.md backup, bilingual description, ko-version)
```
