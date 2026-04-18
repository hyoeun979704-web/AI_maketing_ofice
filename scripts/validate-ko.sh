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

# Hangul UTF-8 byte pattern (U+AC00–U+D7A3): lead byte 0xEA-0xED, two trailing bytes 0x80-0xBF.
HANGUL_RE='[\xea-\xed][\x80-\xbf][\x80-\xbf]'

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

    # Single read: split frontmatter and body, skip untranslated skills early.
    file_contents=$(cat "$skill_file")
    frontmatter=$(printf '%s\n' "$file_contents" | sed -n '/^---$/,/^---$/p' | head -n -1 | tail -n +2)
    body=$(printf '%s\n' "$file_contents" | awk '/^---$/{c++; next} c>=2')

    if ! printf '%s' "$body" | LC_ALL=C grep -qP "$HANGUL_RE"; then
        ((SKIPPED++))
        continue
    fi

    # Korea-only skills (no upstream) opt out of SKILL.en.md backup via `ko-only: true`.
    ko_only=$(printf '%s\n' "$frontmatter" | grep -E "^[[:space:]]+ko-only:" | awk '{print $2}' | tr -d '[:space:]')
    if [[ "$ko_only" != "true" && ! -f "$en_backup" ]]; then
        errors+=("Missing SKILL.en.md backup (cp SKILL.md SKILL.en.md before translating, or add 'ko-only: true' for Korea-only new skills)")
    fi

    description=$(printf '%s\n' "$frontmatter" | sed -n 's/^description:[[:space:]]*//p' | head -1 | sed 's/^"//; s/"$//')

    if [[ -z "$description" ]]; then
        errors+=("Missing description field")
    else
        if ! printf '%s' "$description" | grep -qiE "when|use|mention"; then
            warnings+=("description lacks English trigger phrases (when/use/mention)")
        fi
        if ! printf '%s' "$description" | LC_ALL=C grep -qP "$HANGUL_RE"; then
            errors+=("description has no Korean trigger phrases (Hangul expected for bilingual matching)")
        fi
        # Spec limit is 1024 chars. Bilingual content mixes 1-byte ASCII and 3-byte Hangul,
        # so worst case (all Hangul) = 3072 bytes, best case (all ASCII) = 1024 bytes.
        # Use awk to get actual char count (not bytes) to enforce the spec exactly.
        char_len=$(printf '%s' "$description" | LC_ALL=en_US.UTF-8 awk '{print length($0)}')
        if [[ -z "$char_len" ]]; then
            char_len=$(printf '%s' "$description" | wc -m)
        fi
        if [[ $char_len -gt 1024 ]]; then
            errors+=("description is $char_len chars (spec max 1024)")
        elif [[ $char_len -gt 900 ]]; then
            warnings+=("description is $char_len chars (spec max 1024, getting close)")
        fi
    fi

    if ! printf '%s\n' "$frontmatter" | grep -qE "^[[:space:]]+ko-version:"; then
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
