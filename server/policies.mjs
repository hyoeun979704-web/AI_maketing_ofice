// Per-skill approval policy. The user's rule:
// "중요 이벤트 말고는 다 능동적으로" — only gate the important events
// (money spending, public upload/publish, deletions, legally sensitive actions).
//
// Each policy returns { autonomous: bool, approvalReason?: string }
// for a given action kind ('draft' | 'publish' | 'spend' | 'delete').
//
// Default: autonomous for 'draft' (all skills), gated for 'publish'/'spend'.

export const POLICIES = {
  // ---- Always needs approval (money or publish side effects) ----
  'paid-ads':              { publish: '광고비 집행 — 금전 이벤트', spend: '광고 예산 변경' },
  'pricing-strategy':      { publish: '가격 변경 — 금전 이벤트' },
  'paywall-upgrade-cro':   { publish: '페이월 변경 — 금전 이벤트' },

  // ---- Publish-only gating (public upload, external communication) ----
  'launch-strategy':       { publish: '런칭 발표 — 대외 업로드' },
  'cold-email':            { publish: '콜드 이메일 발송 — 대외 커뮤니케이션' },
  'email-sequence':        { publish: '이메일 시퀀스 활성화 — 고객 수신' },
  'social-content':        { publish: '소셜 게시물 업로드' },
  'ad-creative':           { publish: '광고 크리에이티브 배포' },
  'video-script-automation': { publish: '영상 발행 — 대외 업로드' },
  'naver-kin-automation':  { publish: '지식iN 답변 등록 — 대외 업로드' },
  'referral-program':      { publish: '레퍼럴 프로그램 런치 — 금전 이벤트' },

  // ---- Structural changes (site/data) ----
  'site-architecture':     { publish: '사이트 구조 변경 — 배포 전 승인' },
  'schema-markup':         { publish: '프로덕션 스키마 배포' },
  'programmatic-seo':      { publish: '대량 페이지 생성·발행' },

  // ---- Deletes / destructive ----
  'churn-prevention':      { publish: '해지 플로우 변경 — 고객 경험 영향' },

  // All other skills are autonomous for drafting/reporting.
};

// Returns { autonomous, reason }
export function decideAction(skillName, actionKind) {
  const policy = POLICIES[skillName];
  if (!policy) return { autonomous: true };
  const reason = policy[actionKind];
  if (reason) return { autonomous: false, reason };
  return { autonomous: true };
}

// Suggested seed tasks per skill, with action kind. The scheduler picks from
// this list. `kind` maps to the policy above. Draft actions proceed without
// approval; publish/spend pause for human review.
export const SEED_TASKS = {
  'seo-audit': [
    { title: '이번 주 SEO 감사 — Core Web Vitals 리포트', kind: 'draft' },
    { title: 'Noindex 태그 누락 페이지 점검', kind: 'draft' },
  ],
  'ai-seo': [
    { title: '주요 키워드에 대한 AI 검색 인용률 추적', kind: 'draft' },
  ],
  'analytics-tracking': [
    { title: 'GA4 이벤트 누락 여부 자동 점검', kind: 'draft' },
  ],
  'customer-research': [
    { title: '최근 인터뷰 5건에서 테마 추출', kind: 'draft' },
  ],
  'competitor-alternatives': [
    { title: '신규 경쟁사 비교 페이지 초안', kind: 'draft' },
  ],
  'copywriting': [
    { title: '홈페이지 히어로 카피 A/B 대안 3종', kind: 'draft' },
  ],
  'copy-editing': [
    { title: '블로그 발행 전 카피 교정', kind: 'draft' },
  ],
  'content-strategy': [
    { title: '다음 분기 콘텐츠 캘린더 초안', kind: 'draft' },
  ],
  'page-cro': [
    { title: '가격 페이지 이탈 지점 진단', kind: 'draft' },
    { title: '히어로 섹션 전환 실험 설계', kind: 'draft' },
  ],
  'signup-flow-cro': [
    { title: '가입 플로우 단계별 드롭오프 분석', kind: 'draft' },
  ],
  'onboarding-cro': [
    { title: 'Time-to-value 구간 측정', kind: 'draft' },
  ],
  'form-cro': [
    { title: '컨택트 폼 필드 축소 실험안', kind: 'draft' },
  ],
  'popup-cro': [
    { title: '이탈 방지 팝업 카피 초안 3종', kind: 'draft' },
  ],
  'paywall-upgrade-cro': [
    { title: '페이월 메시지 개선안 (배포 전 승인)', kind: 'publish' },
  ],
  'ab-test-setup': [
    { title: '진행 중 실험의 샘플 사이즈 체크', kind: 'draft' },
  ],
  'cold-email': [
    { title: '신규 타겟 리스트에 콜드 이메일 발송', kind: 'publish' },
  ],
  'email-sequence': [
    { title: '웰컴 시퀀스 5회 자동화 활성화', kind: 'publish' },
  ],
  'social-content': [
    { title: '이번 주 소셜 포스트 업로드 예약', kind: 'publish' },
  ],
  'paid-ads': [
    { title: 'Meta 캠페인 예산 10% 증액 요청', kind: 'spend' },
    { title: '새 광고셋 집행 요청', kind: 'publish' },
  ],
  'ad-creative': [
    { title: 'Meta Reels용 크리에이티브 5종 발행', kind: 'publish' },
  ],
  'referral-program': [
    { title: '레퍼럴 보상률 상향 조정 요청', kind: 'publish' },
  ],
  'free-tool-strategy': [
    { title: '신규 프리 툴 아이디어 평가', kind: 'draft' },
  ],
  'churn-prevention': [
    { title: '해지 플로우 개선안 (배포 전 승인)', kind: 'publish' },
  ],
  'lead-magnets': [
    { title: '신규 리드 매그넷 기획 초안', kind: 'draft' },
  ],
  'community-marketing': [
    { title: '커뮤니티 월간 참여도 리포트', kind: 'draft' },
  ],
  'marketing-ideas': [
    { title: '이번 분기 실험 아이디어 10선', kind: 'draft' },
  ],
  'marketing-psychology': [
    { title: '최근 카피에 적용된 심리 레버 분석', kind: 'draft' },
  ],
  'launch-strategy': [
    { title: 'v2 제품 런칭 플레이북 배포', kind: 'publish' },
  ],
  'pricing-strategy': [
    { title: '새 티어 도입 제안 (승인 필요)', kind: 'publish' },
  ],
  'sales-enablement': [
    { title: '신규 영업 덱 초안', kind: 'draft' },
  ],
  'revops': [
    { title: '리드 라우팅 룰 점검', kind: 'draft' },
  ],
  'aso-audit': [
    { title: '앱스토어 리스팅 주간 점검', kind: 'draft' },
  ],
  'schema-markup': [
    { title: 'FAQPage 스키마 신규 페이지 반영', kind: 'publish' },
  ],
  'site-architecture': [
    { title: '신규 섹션 URL 구조 제안', kind: 'publish' },
  ],
  'programmatic-seo': [
    { title: '지역×키워드 250개 페이지 발행 요청', kind: 'publish' },
  ],
  'product-marketing-context': [
    { title: '분기 컨텍스트 문서 업데이트', kind: 'draft' },
  ],
  'naver-kin-automation': [
    { title: '이번 주 타겟 키워드 지식iN 모니터링', kind: 'draft' },
    { title: '수집한 Q&A 중 대응 후보 답변 초안 (등록 승인 필요)', kind: 'publish' },
  ],
  'video-script-automation': [
    { title: '쿠팡라이브 토요 방송 대본 초안', kind: 'draft' },
    { title: '완성된 대본 영상 제작·업로드 요청', kind: 'publish' },
  ],
};
