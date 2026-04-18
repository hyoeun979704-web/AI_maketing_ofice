# AGENTS.md

Guidelines for AI agents working in this repository.

## Repository Overview

This repository contains **Agent Skills** for AI agents following the [Agent Skills specification](https://agentskills.io/specification.md). Skills install to `.agents/skills/` (the cross-agent standard). This repo also serves as a **Claude Code plugin marketplace** via `.claude-plugin/marketplace.json`.

- **Name**: Marketing Skills
- **GitHub**: [coreyhaines31/marketingskills](https://github.com/coreyhaines31/marketingskills)
- **Creator**: Corey Haines
- **License**: MIT

## Repository Structure

```
marketingskills/
├── .claude-plugin/
│   └── marketplace.json   # Claude Code plugin marketplace manifest
├── skills/                # Agent Skills
│   └── skill-name/
│       └── SKILL.md       # Required skill file
├── tools/
│   ├── clis/              # Zero-dependency Node.js CLI tools (51 tools)
│   ├── composio/          # Composio integration layer (quick start + toolkit mapping)
│   ├── integrations/      # API integration guides per tool
│   └── REGISTRY.md        # Tool index with capabilities
├── CONTRIBUTING.md
├── LICENSE
└── README.md
```

## Build / Lint / Test Commands

**Skills** are content-only (no build step). Verify manually:
- YAML frontmatter is valid
- `name` field matches directory name exactly
- `name` is 1-64 chars, lowercase alphanumeric and hyphens only
- `description` is 1-1024 characters

**CLI tools** (`tools/clis/*.js`) are zero-dependency Node.js scripts (Node 18+). Verify with:
```bash
node --check tools/clis/<name>.js   # Syntax check
node tools/clis/<name>.js           # Show usage (no args = help)
node tools/clis/<name>.js <cmd> --dry-run  # Preview request without sending
```

## Agent Skills Specification

Skills follow the [Agent Skills spec](https://agentskills.io/specification.md).

### Required Frontmatter

```yaml
---
name: skill-name
description: What this skill does and when to use it. Include trigger phrases.
---
```

### Frontmatter Field Constraints

| Field         | Required | Constraints                                                      |
|---------------|----------|------------------------------------------------------------------|
| `name`        | Yes      | 1-64 chars, lowercase `a-z`, numbers, hyphens. Must match dir.   |
| `description` | Yes      | 1-1024 chars. Describe what it does and when to use it.          |
| `license`     | No       | License name (default: MIT)                                      |
| `metadata`    | No       | Key-value pairs (author, version, etc.)                          |

### Name Field Rules

- Lowercase letters, numbers, and hyphens only
- Cannot start or end with hyphen
- No consecutive hyphens (`--`)
- Must match parent directory name exactly

**Valid**: `page-cro`, `email-sequence`, `ab-test-setup`
**Invalid**: `Page-CRO`, `-page`, `page--cro`

### Optional Skill Directories

```
skills/skill-name/
├── SKILL.md        # Required - main instructions (<500 lines)
├── references/     # Optional - detailed docs loaded on demand
├── scripts/        # Optional - executable code
└── assets/         # Optional - templates, data files
```

## Writing Style Guidelines

### Structure

- Keep `SKILL.md` under 500 lines (move details to `references/`)
- Use H2 (`##`) for main sections, H3 (`###`) for subsections
- Use bullet points and numbered lists liberally
- Short paragraphs (2-4 sentences max)

### Tone

- Direct and instructional
- Second person ("You are a conversion rate optimization expert")
- Professional but approachable

### Formatting

- Bold (`**text**`) for key terms
- Code blocks for examples and templates
- Tables for reference data
- No excessive emojis

### Clarity Principles

- Clarity over cleverness
- Specific over vague
- Active voice over passive
- One idea per section

### Description Field Best Practices

The `description` is critical for skill discovery. Include:
1. What the skill does
2. When to use it (trigger phrases)
3. Related skills for scope boundaries

```yaml
description: When the user wants to optimize conversions on any marketing page. Use when the user says "CRO," "conversion rate optimization," "this page isn't converting." For signup flows, see signup-flow-cro.
```

## Claude Code Plugin

This repo also serves as a plugin marketplace. The manifest at `.claude-plugin/marketplace.json` lists all skills for installation via:

```bash
/plugin marketplace add coreyhaines31/marketingskills
/plugin install marketing-skills
```

See [Claude Code plugins documentation](https://code.claude.com/docs/en/plugins.md) for details.

## Git Workflow

### Branch Naming

- New skills: `feature/skill-name`
- Improvements: `fix/skill-name-description`
- Documentation: `docs/description`

### Commit Messages

Follow the [Conventional Commits](https://www.conventionalcommits.org/) specification:

- `feat: add skill-name skill`
- `fix: improve clarity in page-cro`
- `docs: update README`

### Pull Request Checklist

- [ ] `name` matches directory name exactly
- [ ] `name` follows naming rules (lowercase, hyphens, no `--`)
- [ ] `description` is 1-1024 chars with trigger phrases
- [ ] `SKILL.md` is under 500 lines
- [ ] No sensitive data or credentials

## Tool Integrations

This repository includes a tools registry for agent-compatible marketing tools.

- **Tool discovery**: Read `tools/REGISTRY.md` to see available tools and their capabilities
- **Integration details**: See `tools/integrations/{tool}.md` for API endpoints, auth, and common operations
- **MCP-enabled tools**: ga4, stripe, mailchimp, google-ads, resend, zapier, zoominfo, clay, supermetrics, coupler, outreach, crossbeam, introw, composio
- **Composio** (integration layer): Adds MCP access to OAuth-heavy tools without native MCP servers (HubSpot, Salesforce, Meta Ads, LinkedIn Ads, Google Sheets, Slack, etc.). See `tools/integrations/composio.md`

### Registry Structure

```
tools/
├── REGISTRY.md              # Index of all tools with capabilities
└── integrations/            # Detailed integration guides
    ├── ga4.md
    ├── stripe.md
    ├── rewardful.md
    └── ...
```

### When to Use Tools

Skills reference relevant tools for implementation. For example:
- `referral-program` skill → rewardful, tolt, dub-co, mention-me guides
- `analytics-tracking` skill → ga4, mixpanel, segment guides
- `email-sequence` skill → customer-io, mailchimp, resend guides
- `paid-ads` skill → google-ads, meta-ads, linkedin-ads guides

For tools without native MCP servers (HubSpot, Salesforce, Meta Ads, LinkedIn Ads, Google Sheets, Slack, Notion), Composio provides MCP access via a single server. See `tools/integrations/composio.md` for setup and `tools/composio/marketing-tools.md` for the full toolkit mapping.

## Checking for Updates

When using any skill from this repository:

1. **Once per session**, on first skill use, check for updates:
   - Fetch `VERSIONS.md` from GitHub: https://raw.githubusercontent.com/coreyhaines31/marketingskills/main/VERSIONS.md
   - Compare versions against local skill files

2. **Only prompt if meaningful**:
   - 2 or more skills have updates, OR
   - Any skill has a major version bump (e.g., 1.x to 2.x)

3. **Non-blocking notification** at end of response:
   ```
   ---
   Skills update available: X marketing skills have updates.
   Say "update skills" to update automatically, or run `git pull` in your marketingskills folder.
   ```

4. **If user says "update skills"**:
   - Run `git pull` in the marketingskills directory
   - Confirm what was updated

## Skill Categories

See `README.md` for the current list of skills organized by category. When adding new skills, follow the naming patterns of existing skills in that category.

## Claude Code-Specific Enhancements

These patterns are **Claude Code only** and must not be added to `SKILL.md` files directly, as skills are designed to be cross-agent compatible (Codex, Cursor, Windsurf, etc.). Apply them locally in your own project's `.claude/skills/` overrides instead.

### Dynamic content injection with `!`command``

Claude Code supports embedding shell commands in SKILL.md using `` !`command` `` syntax. When the skill is invoked, Claude Code runs the command and injects the output inline — the model sees the result, not the instruction.

**Most useful application: auto-inject the product marketing context file**

Instead of every skill telling the agent "go check if `.agents/product-marketing-context.md` exists and read it," you can inject it automatically:

```markdown
Product context: !`cat .agents/product-marketing-context.md 2>/dev/null || echo "No product context file found — ask the user about their product before proceeding."`
```

Place this at the top of a skill's body (after frontmatter) to make context available immediately without any file-reading step.

**Other useful injections:**

```markdown
# Inject today's date for recency-sensitive skills
Today's date: !`date +%Y-%m-%d`

# Inject current git branch (useful for workflow skills)
Current branch: !`git branch --show-current 2>/dev/null`

# Inject recent commits for context
Recent commits: !`git log --oneline -5 2>/dev/null`
```

**Why this is Claude Code-only**: Other agents that load skills will see the literal `` !`command` `` string rather than executing it, which would appear as garbled instructions. Keep cross-agent skill files free of this syntax.

## 한국어 현지화 가이드

This fork ships a Korean localization layer on top of the upstream project. Agents working on skills in this repo must follow these additional rules. See [`docs/LOCALIZATION.md`](docs/LOCALIZATION.md) and [`docs/glossary.ko.md`](docs/glossary.ko.md) for full detail.

### Localization invariants

1. **스킬 디렉터리명과 `name` 필드는 영어 유지** — Agent Skills 스펙상 `name`은 `[a-z0-9-]{1,64}`로 디렉터리명과 일치해야 한다. 따라서 본문만 번역하고 식별자는 건드리지 않는다.
2. **`description`은 영·한 트리거 병기** — 1024자 한도 안에서 영문 원문 + "Also use when the user says '...한글 트리거...'" 형태로 확장한다. 이래야 "전환율 올려줘"와 "improve conversions" 둘 다 매칭된다.
3. **`SKILL.en.md` 백업 유지** — 번역 시 원본 SKILL.md를 반드시 `SKILL.en.md`로 복사해둔다. upstream merge 시 기준점이 된다.
4. **`metadata`에 `ko-version` 추가** — 형식 `ko-version: <upstream>-ko.<iteration>` (예: `1.2.0-ko.1`). 한국어판 자체 변경 시에만 iteration을 올린다.
5. **코드·테스트·URL은 번역 금지** — `tools/clis/*.js`, `evals/`, CLI 커맨드, URL, 프런트매터 키는 영문 그대로.
6. **한국 시장 부록은 additive** — 네이버·카카오·쿠팡 관련 추가 가이드는 기존 파일을 고치지 말고 `references/korea-market.md`로 별도 생성한다.

### Required metadata shape (localized skills)

```yaml
---
name: page-cro
description: "When the user wants to optimize ... Also use when the user says '전환율 최적화', '랜딩페이지 개선', 'CRO'. For signup flows, see signup-flow-cro."
metadata:
  version: 1.2.0          # upstream, do not change
  ko-version: 1.2.0-ko.1  # Korean translation iteration
---
```

### Validation

- `bash validate-skills.sh` — upstream 스펙 검증 (기존)
- `bash scripts/validate-ko.sh` — 한국어 레이어 검증 (SKILL.en.md 백업 존재, description에 한글·영문 트리거 공존, ko-version 존재)
- 두 스크립트 모두 통과해야 PR merge 가능.

### Compliance for Korea-specific skills

한국 시장 특화 스킬(`naver-kin-automation`, `video-script-automation` 등)은 SKILL.md 하단에 `## 컴플라이언스` 섹션을 반드시 포함한다. 대표 규정:

- **지식iN**: 광고성 답변·외부 링크 남발·중복 답변 금지 (신고·계정 정지 사유)
- **라이브커머스·유료 광고**: 전자상거래법상 「광고」 표기 의무, 식약처·공정위 표시 규정
- **유료 광고 일반**: 「뒷광고」 방지 가이드라인 — 유료 광고 표기 필수
- **개인정보**: 개인정보보호법(PIPA) 수집·이용 동의, 정보통신망법 광고성 정보 수신 동의

에이전트가 대본·답변·카피를 생성할 때 이 규정을 자동 반영하도록 스킬 본문에 체크리스트 형태로 명시한다.

### Translation workflow for upstream agents

If you're an agent pulling updates from upstream:

1. `git fetch upstream main` → diff `skills/<name>/SKILL.en.md` against `upstream/main:skills/<name>/SKILL.md`
2. If upstream changed: apply the same changes to `skills/<name>/SKILL.en.md`, then re-translate the diff into `skills/<name>/SKILL.md`
3. Bump `ko-version` iteration. If upstream's `version` bumped, reset iteration to `.1` (e.g., `1.2.0-ko.3` → upstream 1.3.0 → `1.3.0-ko.1`).
4. Run both validators and commit with `i18n(<skill>): sync with upstream <new-version>`
