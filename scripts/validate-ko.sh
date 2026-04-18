#!/bin/bash
# Korean localization validator.
# Checks Korean-layer invariants that validate-skills.sh does not cover:
#  - SKILL.en.md backup exists (proof upstream was preserved)
#  - description contains both English and Korean trigger phrases
#  - metadata has ko-version field
#  - description length still within 1024 chars after bilingual expansion

set -u

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

SKILLS_DIR="${SKILLS_DIR:-skills}"
ISSUES=0
WARNINGS=0
PASSED=0
SKIPPED=0

# Allow filtering to one skill: `validate-ko.sh <skill-name>`
FILTER="${1:-}"

echo "🇰🇷 Validating Korean localization layer"
echo "========================================"
echo ""

for skill_dir in "$SKILLS_DIR"/*/; do
    skill_name=$(basename "$skill_dir")
    if [[ -n "$FILTER" && "$skill_name" != "$FILTER" ]]; then
        continue
    fi

    skill_file="$skill_dir/SKILL.md"
    en_backup="$skill_dir/SKILL.en.md"
    errors=()
    warnings=()

    if [[ ! -f "$skill_file" ]]; then
        echo -e "${RED}❌ $skill_name${NC}  Missing SKILL.md"
        ((ISSUES++))
        continue
    fi

    # Detect if the skill has been localized. Rule of thumb: body contains Hangul.
    body=$(awk '/^---$/{c++; next} c>=2' "$skill_file")
    if ! printf '%s' "$body" | LC_ALL=C grep -qP '[\xea-\xed][\x80-\xbf][\x80-\xbf]'; then
        # No Hangul detected → skill not yet translated. Skip, don't fail.
        ((SKIPPED++))
        continue
    fi

    # ===== SKILL.en.md backup =====
    # Korea-only new skills (no upstream) opt out via `ko-only: true` in metadata.
    frontmatter=$(sed -n '/^---$/,/^---$/p' "$skill_file" | head -n -1 | tail -n +2)
    ko_only=$(echo "$frontmatter" | grep -E "^[[:space:]]+ko-only:" | awk '{print $2}' | tr -d '[:space:]')
    if [[ "$ko_only" != "true" && ! -f "$en_backup" ]]; then
        errors+=("Missing SKILL.en.md backup (cp SKILL.md SKILL.en.md before translating, or add 'ko-only: true' for Korea-only new skills)")
    fi

    # ===== description bilingual check =====
    description=$(echo "$frontmatter" | grep "^description:" | head -1)
    if [[ $description == *'description: "'* ]]; then
        description=$(echo "$description" | sed 's/^description: "//' | sed 's/"$//')
    else
        description=$(echo "$description" | sed 's/^description: //')
    fi

    if [[ -z "$description" ]]; then
        errors+=("Missing description field")
    else
        # English trigger present?
        if ! echo "$description" | grep -qiE "when|use|mention"; then
            warnings+=("description lacks English trigger phrases (when/use/mention)")
        fi
        # Korean trigger present? Require at least one Hangul syllable block.
        if ! printf '%s' "$description" | LC_ALL=C grep -qP '[\xea-\xed][\x80-\xbf][\x80-\xbf]'; then
            errors+=("description has no Korean trigger phrases (Hangul expected for bilingual matching)")
        fi
        # Length check (byte count approximates char limit; spec says 1024 chars)
        byte_len=$(printf '%s' "$description" | wc -c)
        if [[ $byte_len -gt 2048 ]]; then
            warnings+=("description is $byte_len bytes (spec max 1024 chars; Hangul is 3 bytes each, so budget is tight — verify char count)")
        fi
    fi

    # ===== ko-version in metadata =====
    if ! echo "$frontmatter" | grep -qE "^[[:space:]]+ko-version:"; then
        warnings+=("metadata missing ko-version field (recommended: ko-version: <upstream>-ko.<n>)")
    fi

    # ===== Report =====
    if [[ ${#errors[@]} -gt 0 ]]; then
        echo -e "${RED}❌ $skill_name${NC}"
        for e in "${errors[@]}"; do echo -e "   ${RED}Error:${NC} $e"; done
        for w in "${warnings[@]}"; do echo -e "   ${YELLOW}Warning:${NC} $w"; done
        ((ISSUES++))
    elif [[ ${#warnings[@]} -gt 0 ]]; then
        echo -e "${YELLOW}⚠️  $skill_name${NC}"
        for w in "${warnings[@]}"; do echo -e "   ${YELLOW}Warning:${NC} $w"; done
        ((WARNINGS++))
    else
        echo -e "${GREEN}✓ $skill_name${NC}"
        ((PASSED++))
    fi
done

echo ""
echo "========================================"
echo "Summary:"
echo -e "  ${GREEN}✓ Passed (localized):${NC} $PASSED"
echo -e "  Skipped (not localized yet): $SKIPPED"
[[ $WARNINGS -gt 0 ]] && echo -e "  ${YELLOW}⚠️  Warnings:${NC} $WARNINGS"
[[ $ISSUES -gt 0 ]]   && echo -e "  ${RED}❌ Issues:${NC} $ISSUES"

[[ $ISSUES -eq 0 ]] && exit 0 || exit 1
