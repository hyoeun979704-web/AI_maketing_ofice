// Hand-authored per-skill profile metadata shown when the user clicks an
// agent's desk. Each entry has:
//   duties — 하는 일 (3-5 concrete action bullets)
//   data   — 다루는 데이터 (2-4 bullets on inputs / outputs / tools)
// All 38 skills covered. Keep bullets short — they render as list items.

export const PROFILES = {
  // ---------- CRO ----------
  'page-cro': {
    duties: [
      '타겟 페이지의 이탈·전환 퍼널 진단',
      'Above-the-fold 히어로·CTA·사회적 증거 점검',
      '메시지 계층·페이지 구조 재설계 초안',
      '실험 가설 도출 → ab-test-setup으로 이관',
    ],
    data: [
      '입력: 랜딩 URL, 전환율·이탈률, 사용자 피드백',
      '출력: CRO 이슈 리포트 + 3개 이상 실험안',
      '연동: copywriting · ab-test-setup · customer-research',
    ],
  },
  'signup-flow-cro': {
    duties: [
      '가입 플로우 단계별 드롭오프 계단 분석',
      '이메일 입력·비번 규칙·소셜 로그인 마찰 점검',
      'Time-to-first-value 단축안 제시',
    ],
    data: [
      '입력: 가입 URL, 단계별 전환 퍼널',
      '출력: 단계별 드롭 원인 + 수정안',
    ],
  },
  'onboarding-cro': {
    duties: [
      '첫 로그인 후 활성화까지의 경로 설계',
      '체크리스트·프로덕트 투어·템플릿 프리필 도입 검토',
      '가입 → 핵심 action까지 Time-to-Value 측정',
    ],
    data: [
      '입력: 제품 온보딩 URL, 첫 로그인 퍼널',
      '출력: 활성화 개선안 + 단계별 지표 제안',
    ],
  },
  'form-cro': {
    duties: [
      '리드 수집 폼의 필드 수·순서·조건 검증',
      '에러 메시지·인라인 검증·progressive disclosure 제안',
      'A/B 실험안 도출',
    ],
    data: [
      '입력: 폼 URL, 제출률',
      '출력: 폼 구조 개선안',
    ],
  },
  'popup-cro': {
    duties: [
      '팝업·모달·슬라이드인 타이밍·빈도 검토',
      '카피·offer·폼 필드 최적화',
      '이탈 의도·체류시간 기반 트리거 설계',
    ],
    data: [
      '입력: 팝업 스크린샷·트리거 규칙·제출률',
      '출력: 팝업 카피 3종 + 트리거 조정안',
    ],
  },
  'paywall-upgrade-cro': {
    duties: [
      '페이월·업그레이드 모달의 메시지 계층 점검',
      '플랜 비교 표·가격 전시 방식 제안',
      '업그레이드 시점 타이밍 최적화',
    ],
    data: [
      '입력: 페이월 UI, 업그레이드 전환율',
      '출력: 메시지·레이아웃 개선안 (승인 필요)',
    ],
  },

  // ---------- Content & Copy ----------
  'copywriting': {
    duties: [
      '히어로·섹션·CTA 카피 3종 A/B 대안 생성',
      'JTBD·PAS·AIDA 프레임 적용',
      '브랜드 보이스와 일치하는지 검증',
    ],
    data: [
      '입력: 기존 카피·타겟 오디언스·product-marketing-context',
      '출력: 대안 카피 3종 + 근거',
    ],
  },
  'copy-editing': {
    duties: [
      '발행 전 카피의 문법·어투·일관성 교정',
      '읽기 속도·가독성 점수 확인',
      '외래어·전문용어 한글화 여부 체크',
    ],
    data: [
      '입력: 기존 글 원고',
      '출력: 교정안 + 변경 이유',
    ],
  },
  'cold-email': {
    duties: [
      'B2B 콜드 이메일 초안·팔로업 시퀀스 작성',
      '제목·오프닝·CTA의 개인화 삽입 구간 설계',
      '수신거부·뒷광고 규정 준수 검토',
    ],
    data: [
      '입력: 리드 리스트 구조, 회사 프로필',
      '출력: 3-5단 시퀀스 초안 (발송은 승인 필요)',
      '⚠️ ESP 연동 없이는 실제 발송 불가',
    ],
  },
  'email-sequence': {
    duties: [
      '웰컴·너처링·리텐션 이메일 시퀀스 기획',
      '발송 간격·분기 조건 설계',
      '오픈률·클릭률 목표 지표 설정',
    ],
    data: [
      '입력: 고객 라이프사이클 단계, 기존 시퀀스 성과',
      '출력: 시퀀스 플로우차트 + 각 메일 초안',
      '⚠️ Mailchimp·Customer.io·스티비 등 ESP 연동 필요',
    ],
  },
  'social-content': {
    duties: [
      'Instagram·LinkedIn·X·Threads용 포스트 기획',
      '헤드라인·캡션·해시태그 최적화',
      '이미지·영상 썸네일 브리프 작성',
    ],
    data: [
      '입력: 브랜드 톤, 이번 분기 메시지 축',
      '출력: 주간 포스트 캘린더 + 카피 초안',
    ],
  },

  // ---------- SEO & Discovery ----------
  'seo-audit': {
    duties: [
      '기술 SEO 진단 (robots.txt·sitemap·canonical)',
      '온페이지 SEO (title·meta·H1·alt)',
      'Core Web Vitals 측정 + 이슈 우선순위',
      'orphan 페이지·리디렉션 체인 탐지',
    ],
    data: [
      '입력: 타겟 URL, GSC 데이터(선택)',
      '출력: 이슈 우선순위 리포트',
      '도구: fetch-page.mjs로 실제 HTML 분석',
    ],
  },
  'ai-seo': {
    duties: [
      'AEO/GEO/LLMO — AI 검색 인용 최적화',
      'FAQ·HowTo·Product 스키마 점검',
      '답변형 콘텐츠 구조화',
    ],
    data: [
      '입력: 타겟 페이지 HTML, JSON-LD 스키마',
      '출력: AI 검색 인용을 위한 구조 개선안',
    ],
  },
  'programmatic-seo': {
    duties: [
      '템플릿 + 데이터로 대량 페이지 생성 플랜',
      '중복 콘텐츠 회피 전략',
      '캐노니컬·noindex 규칙 설계',
    ],
    data: [
      '입력: 카테고리·지역·키워드 DB',
      '출력: 페이지 템플릿 + 생성 규칙 (발행은 승인 필요)',
    ],
  },
  'site-architecture': {
    duties: [
      '사이트맵·URL 구조·네비게이션 IA 설계',
      '허브 페이지·카테고리 분류 체계 정리',
      '내부 링크 전략 문서화',
    ],
    data: [
      '입력: 기존 사이트 구조, 크롤 데이터',
      '출력: IA 다이어그램 + 리디렉션 매핑',
    ],
  },
  'competitor-alternatives': {
    duties: [
      '경쟁사 비교·대안 페이지 기획',
      '차별점 메시지 도출',
      '공정거래법 준수하는 비교 표현',
    ],
    data: [
      '입력: 경쟁사 URL·기능·가격',
      '출력: "X vs Y" 페이지 구조 + 카피',
    ],
  },
  'schema-markup': {
    duties: [
      'JSON-LD 스키마 작성 (FAQ·HowTo·Product·Article)',
      '기존 스키마 오류 검출',
      'Rich Results Test 통과 검증',
    ],
    data: [
      '입력: 타겟 페이지 HTML',
      '출력: 스키마 JSON + 배포 체크리스트 (승인 필요)',
    ],
  },
  'content-strategy': {
    duties: [
      '타겟 오디언스별 콘텐츠 pillar 정의',
      '분기 콘텐츠 캘린더 기획',
      '검색 의도 vs 퍼널 단계 매트릭스 작성',
    ],
    data: [
      '입력: 키워드 리서치, 자사 콘텐츠 성과',
      '출력: 콘텐츠 캘린더 + 우선순위',
    ],
  },

  // ---------- Paid & Measurement ----------
  'paid-ads': {
    duties: [
      '캠페인 구조·오디언스·예산 할당 설계',
      '크리에이티브 피로도 점검',
      '입찰 전략 조정 권장',
    ],
    data: [
      '⚠️ Google Ads / Meta Ads API 연동 필요',
      '입력: 광고 계정 30일 성과 데이터',
      '출력: 조정 권장안 (예산 변경은 승인 필요)',
    ],
  },
  'ad-creative': {
    duties: [
      '플랫폼별 크리에이티브 변주 (5-10개)',
      'Hook·메시지·시각 변수 매트릭스 작성',
      '브리프 → 제작자 연결',
    ],
    data: [
      '입력: 기존 크리에이티브 성과·브랜드 가이드',
      '출력: 크리에이티브 변주 목록 + 제작 브리프',
    ],
  },
  'ab-test-setup': {
    duties: [
      '실험 가설·지표·샘플 사이즈 문서화',
      '통계 유의성 계산',
      '실험 충돌 방지 체크',
    ],
    data: [
      '⚠️ Optimizely·VWO·자체 실험 플랫폼 연동 필요',
      '입력: 가설, 예상 효과 크기',
      '출력: 실험 설계서 + 통계 파라미터',
    ],
  },
  'analytics-tracking': {
    duties: [
      'GA4 이벤트·전환 설계',
      '데이터 레이어 스키마 검증',
      '누락된 트래킹 이벤트 탐지',
    ],
    data: [
      '입력: 타겟 페이지 HTML (GTM·GA4 태그 감지)',
      '출력: 누락 이벤트 목록 + 구현 예시',
    ],
  },

  // ---------- Growth & Retention ----------
  'referral-program': {
    duties: [
      '레퍼럴 프로그램 설계 (보상·조건·한도)',
      'Viral k-factor 추정',
      '부정 사용 방지 규칙 설정',
    ],
    data: [
      '⚠️ Rewardful·Tolt 등 레퍼럴 시스템 연동 필요',
      '입력: 고객 LTV, 획득 비용',
      '출력: 보상 구조 + 런치 플랜 (승인 필요)',
    ],
  },
  'free-tool-strategy': {
    duties: [
      'SEO·리드 수집 목적의 무료 툴 기획',
      '제작 난이도·잠재 트래픽 평가',
      '리드 전환 경로 설계',
    ],
    data: [
      '입력: 타겟 키워드, 기술 제약',
      '출력: 툴 아이디어 3-5개 + 우선순위',
    ],
  },
  'churn-prevention': {
    duties: [
      '해지 플로우 단계별 save offer 설계',
      '해지 사유 분석 루프 설정',
      'dunning (결제 실패 복구) 시퀀스 설계',
    ],
    data: [
      '⚠️ Stripe·토스페이먼츠 결제 데이터 + 해지 사유 코드 필요',
      '출력: 해지 플로우 변경안 (고객 경험 영향 — 승인 필요)',
    ],
  },
  'lead-magnets': {
    duties: [
      '리드 매그넷(e-book·템플릿·계산기) 기획',
      '랜딩페이지·폼 흐름 설계',
      '후속 이메일 시퀀스 연결',
    ],
    data: [
      '입력: 타겟 오디언스 페르소나',
      '출력: 매그넷 아이디어 + 발행 플랜',
    ],
  },
  'community-marketing': {
    duties: [
      'Discord/Slack/Naver 카페 등 커뮤니티 전략',
      '참여 지표·멤버 여정 설계',
      '모더레이션·규칙 제안',
    ],
    data: [
      '⚠️ 커뮤니티 플랫폼 통계 연동 필요',
      '출력: 커뮤니티 월간 플랜',
    ],
  },

  // ---------- Sales & GTM ----------
  'revops': {
    duties: [
      '리드 라우팅·스코어링·SLA 룰 점검',
      'MQL → SQL 전환율 분석',
      'CRM 데이터 품질 감사',
    ],
    data: [
      '⚠️ HubSpot·Salesforce 등 CRM 연동 필요',
      '출력: 라우팅·스코어링 룰 조정안',
    ],
  },
  'sales-enablement': {
    duties: [
      '영업 덱·원페이저·반론 대응 문서 초안',
      '데모 스크립트 작성',
      '경쟁사 대응 카드 정리',
    ],
    data: [
      '입력: 제품 업데이트, 최근 딜 로그',
      '출력: 세일즈 자료 키트',
    ],
  },
  'launch-strategy': {
    duties: [
      '제품 런칭·발표 플레이북 작성',
      '채널별 타이밍·메시지 조율',
      'ProductHunt·Wadiz 등 한국 채널 포함',
    ],
    data: [
      '입력: 제품 정보, 경쟁 상황',
      '출력: 런칭 체크리스트 + 채널별 카피 (업로드는 승인 필요)',
    ],
  },
  'pricing-strategy': {
    duties: [
      '가격 티어·패키징 설계',
      '가격 민감도·경쟁 벤치마크 분석',
      '업그레이드 경로 제안',
    ],
    data: [
      '⚠️ 결제 데이터·코호트 LTV 필요',
      '출력: 가격 변경안 (승인 필요)',
    ],
  },

  // ---------- Strategy & Research ----------
  'marketing-ideas': {
    duties: [
      '분기별 마케팅 실험 아이디어 브레인스토밍',
      '영향 × 실행 난이도 매트릭스 스코어링',
      '상위 아이디어 구체화',
    ],
    data: [
      '입력: 회사 프로필, 경쟁 상황',
      '출력: 실험 아이디어 10선 + 우선순위',
    ],
  },
  'marketing-psychology': {
    duties: [
      '카피·UI에 적용된 심리 레버 분석',
      '앵커링·희소성·사회적 증거 등 적용 검토',
      '다크 패턴 회피 가이드',
    ],
    data: [
      '입력: 기존 카피·UI',
      '출력: 심리 레버 적용 제안',
    ],
  },
  'customer-research': {
    duties: [
      '고객 인터뷰 질문 세트 작성',
      'NPS·CSAT 설문 설계',
      '피드백 테마 추출 + 인사이트 정리',
    ],
    data: [
      '입력: 인터뷰 녹취·피드백·리뷰',
      '출력: 인사이트 리포트 + 페르소나 업데이트',
    ],
  },
  'aso-audit': {
    duties: [
      '앱스토어 리스팅 점검 (제목·부제·키워드·스크린샷)',
      '리뷰·평점 트렌드 분석',
      'iOS·Android 각 스토어별 최적화',
    ],
    data: [
      '입력: 앱스토어 / Play 스토어 URL',
      '출력: 리스팅 개선 체크리스트',
    ],
  },
  'product-marketing-context': {
    duties: [
      '회사 프로필 작성·갱신 가이드',
      'ICP·JTBD·포지셔닝 문서 유지',
      '다른 스킬이 참조할 기반 문서 관리',
    ],
    data: [
      '입력: 회사 인터뷰, 기존 제품 설명',
      '출력: .agents/product-marketing-context.md',
    ],
  },

  // ---------- Korea-specific ----------
  'naver-kin-automation': {
    duties: [
      '타겟 키워드·카테고리 지식iN 질문 모니터링',
      '자사·경쟁사 브랜드 언급 탐지',
      '답변 초안 (닉네임·태그 간접 전략)',
      'Q&A를 자사 FAQ로 자산화',
    ],
    data: [
      '⚠️ 네이버 검색 오픈API 키(NAVER_CLIENT_ID/SECRET) 필요',
      '출력: 답변 초안은 승인 후 수동 등록 (자동 등록 불가 — ToS)',
    ],
  },
  'video-script-automation': {
    duties: [
      '라이브커머스·유료 광고·숏폼·YouTube 긴 영상 대본',
      'Hook·Problem·Solution·CTA 구조화',
      '한국어 자막·컴플라이언스(「광고」 표기) 점검',
    ],
    data: [
      '입력: 상품 정보, 플랫폼·길이 선택',
      '출력: 분당 타임라인 + 대사 + 컴플라이언스 체크 (업로드는 승인 필요)',
    ],
  },
};

export function getProfile(skillName) {
  return PROFILES[skillName] || {
    duties: ['이 스킬의 세부 책무가 아직 정의되지 않았습니다.'],
    data: ['skills/' + skillName + '/SKILL.md 를 참고하세요.'],
  };
}
