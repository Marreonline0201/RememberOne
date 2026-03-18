export type LanguageCode = "en" | "ko";

export interface Language {
  code: LanguageCode;
  name: string;       // English name
  nativeName: string; // Name in its own language
  locale: string;     // BCP-47 locale for speech recognition
  flag: string;
}

export const languages: Language[] = [
  { code: "en", name: "English", nativeName: "English", locale: "en-US", flag: "🇺🇸" },
  { code: "ko", name: "Korean",  nativeName: "한국어",    locale: "ko-KR", flag: "🇰🇷" },
];

export function getLanguage(code: string): Language {
  return languages.find((l) => l.code === code) ?? languages[0];
}

// ── Translations ──────────────────────────────────────────────────────────────

type Translations = Record<string, Record<LanguageCode, string>>;

const keys: Translations = {
  // Language picker
  "lang.choose_title": {
    en: "Choose Your Language",
    ko: "언어를 선택하세요",
  },
  "lang.choose_subtitle": {
    en: "Select the language you'd like to use in the app.",
    ko: "앱에서 사용할 언어를 선택하세요.",
  },
  "lang.continue": {
    en: "Continue",
    ko: "계속하기",
  },
  // Navigation
  "nav.people": {
    en: "People",
    ko: "사람들",
  },
  "nav.log_meeting": {
    en: "Log meeting",
    ko: "만남 기록",
  },
  "nav.calendar": {
    en: "Calendar",
    ko: "캘린더",
  },
  // Account page
  "account.session": {
    en: "Session",
    ko: "세션",
  },
  "account.sign_out": {
    en: "Sign out",
    ko: "로그아웃",
  },
  "account.signing_out": {
    en: "Signing out...",
    ko: "로그아웃 중...",
  },
  "account.settings": {
    en: "Settings",
    ko: "설정",
  },
  "account.language": {
    en: "Language",
    ko: "언어",
  },
  "account.delete_account": {
    en: "Delete Account",
    ko: "계정 삭제",
  },
  "account.delete_description": {
    en: "To permanently delete your account and all associated data (contacts, meetings, notes), follow these steps:",
    ko: "계정과 모든 관련 데이터(연락처, 미팅, 메모)를 영구적으로 삭제하려면 아래 단계를 따르세요.",
  },
  "account.delete_step1": {
    en: "Sign in to RememberOne at rememberone.online",
    ko: "rememberone.online에서 RememberOne에 로그인하세요",
  },
  "account.delete_step2": {
    en: "Open this Account page by tapping your profile picture",
    ko: "프로필 사진을 눌러 이 계정 페이지를 여세요",
  },
  "account.delete_step3": {
    en: "Tap \"Sign out\" above to confirm your identity",
    ko: "위의 \"로그아웃\"을 눌러 신원을 확인하세요",
  },
  "account.delete_step4": {
    en: "Send a deletion request to the email below — include the email address associated with your account",
    ko: "아래 이메일로 삭제 요청을 보내세요 — 계정에 연결된 이메일 주소를 포함해 주세요",
  },
  "account.delete_step5": {
    en: "We will permanently delete your account and all data within 30 days",
    ko: "30일 이내에 계정과 모든 데이터를 영구적으로 삭제해 드립니다",
  },
  "account.delete_note": {
    en: "Note: deletion is permanent and cannot be undone. All your saved contacts and meeting history will be removed.",
    ko: "참고: 삭제는 영구적이며 취소할 수 없습니다. 저장된 모든 연락처와 미팅 기록이 삭제됩니다.",
  },
  "account.delete_data_note": {
    en: "Data deleted includes: your profile, all saved people, meeting logs, notes, family members, and calendar connections.",
    ko: "삭제되는 데이터: 프로필, 저장된 모든 사람, 미팅 로그, 메모, 가족 구성원, 캘린더 연결.",
  },
  "account.policy": {
    en: "Policy",
    ko: "정책",
  },
  "account.privacy_policy": {
    en: "Privacy Policy",
    ko: "개인정보 처리방침",
  },
  "account.child_safety": {
    en: "Child Safety Standards",
    ko: "아동 안전 기준",
  },

  // Home page empty state
  "home.empty_title": { en: "No one here yet", ko: "아직 아무도 없어요" },
  "home.empty_body": {
    en: "Tap the mic button below and describe who you met — AI will save their details automatically.",
    ko: "아래 마이크 버튼을 눌러 만난 사람을 설명하세요 — AI가 자동으로 정보를 저장해 드립니다.",
  },
  "home.log_first": { en: "LOG YOUR FIRST MEETING", ko: "첫 만남 기록하기" },

  // Person page labels
  "person.edit_details": { en: "Edit Details", ko: "정보 수정" },
  "person.family_section": { en: "Family", ko: "가족" },
  "person.interest_section": { en: "Interest", ko: "관심사" },
  "person.log_meeting_with": { en: "LOG MEETING WITH", ko: "만남 기록하기 —" },
  "person.back": { en: "Back", ko: "뒤로" },

  // Person card labels
  "person.last_met": {
    en: "Last met",
    ko: "마지막 만남",
  },
  "person.family": {
    en: "Family",
    ko: "가족",
  },
  "person.interest": {
    en: "Interest",
    ko: "관심사",
  },
  // Meet / ConversationInput page
  "meet.instruction": {
    en: "Speak \"I met Mike this morning. He has a son named Jake and he is 10 years old. He is attending Stony Brook University.\"",
    ko: "말하세요 \"오늘 아침에 정태현을 만났어요. 그에게는 10살 아들 김민규가 있고, 연세대학교에 다니고 있어요.\"",
  },
  "meet.listening": {
    en: "LISTENING...",
    ko: "듣고 있어요...",
  },
  "meet.tap_to_speak": {
    en: "CLICK TO BECOME FRIENDLY",
    ko: "탭해서 기록하기",
  },
  "meet.extract_save": {
    en: "EXTRACT & SAVE",
    ko: "추출 및 저장",
  },
  "meet.tip_title": {
    en: "TIP: Don't Know What to Speak?",
    ko: "팁: 무슨 말을 해야 할지 모르겠나요?",
  },
  "meet.tip_body": {
    en: "Speak about Name, School, Job, Interest, Company, Family members, ETC!",
    ko: "이름, 학교, 직업, 관심사, 회사, 가족 등을 말해보세요!",
  },
  "meet.loading_title": {
    en: "Reading your notes...",
    ko: "노트를 읽고 있어요...",
  },
  "meet.loading_subtitle": {
    en: "AI is extracting people and details.",
    ko: "AI가 사람과 세부 정보를 추출하고 있어요.",
  },
  "meet.saved": {
    en: "Saved!",
    ko: "저장됨!",
  },
  "meet.found_people": {
    en: "person",
    ko: "명",
  },
  "meet.found_all_saved": {
    en: "all saved.",
    ko: "모두 저장됨.",
  },
  "meet.go_to_people": {
    en: "GO TO PEOPLE",
    ko: "사람들 보기",
  },
  "meet.log_another": {
    en: "LOG ANOTHER",
    ko: "다시 기록하기",
  },
  "meet.mic_denied_title": {
    en: "Microphone permission denied",
    ko: "마이크 권한 거부됨",
  },
  "meet.mic_denied_body": {
    en: "Please allow microphone access in your device settings.",
    ko: "기기 설정에서 마이크 접근을 허용해 주세요.",
  },
  "meet.not_supported_title": {
    en: "Not supported",
    ko: "지원되지 않음",
  },
  "meet.not_supported_body": {
    en: "Voice input requires Chrome or Edge.",
    ko: "음성 입력은 Chrome 또는 Edge가 필요해요.",
  },
  "meet.extraction_failed": {
    en: "Extraction failed",
    ko: "추출 실패",
  },
  "meet.something_wrong": {
    en: "Something went wrong",
    ko: "문제가 발생했어요",
  },
  "meet.log_type_met": {
    en: "We met",
    ko: "만났어요",
  },
  "meet.log_type_details": {
    en: "Just updating details",
    ko: "정보만 업데이트",
  },

  // Privacy Policy page
  "privacy.title": { en: "Privacy Policy", ko: "개인정보 처리방침" },
  "privacy.updated": { en: "Last updated: March 2026", ko: "최종 업데이트: 2026년 3월" },
  "privacy.collect.title": { en: "What we collect", ko: "수집 정보" },
  "privacy.collect.body": {
    en: "We collect your email address and name when you create an account. We also store the information you choose to log about people you meet — including their names, attributes, family members, and meeting notes.",
    ko: "계정 생성 시 이메일 주소와 이름을 수집합니다. 또한 만나는 사람들에 대해 기록하는 정보(이름, 속성, 가족 구성원, 미팅 메모)도 저장합니다.",
  },
  "privacy.use.title": { en: "How we use your data", ko: "데이터 사용 방법" },
  "privacy.use.body": {
    en: "Your data is used solely to provide the RememberOne service — storing your contacts and generating AI-powered summaries from your meeting notes. We do not sell or share your data with third parties.",
    ko: "데이터는 RememberOne 서비스 제공에만 사용됩니다 — 연락처 저장 및 미팅 메모에서 AI 요약 생성. 제3자에게 데이터를 판매하거나 공유하지 않습니다.",
  },
  "privacy.ai.title": { en: "AI processing", ko: "AI 처리" },
  "privacy.ai.body": {
    en: "When you log a meeting, the text you provide is sent to an AI service (Gemini) to extract structured information. This text is processed to provide the service and is not used to train AI models.",
    ko: "미팅을 기록할 때 입력한 텍스트는 구조화된 정보 추출을 위해 AI 서비스(Gemini)로 전송됩니다. 이 텍스트는 서비스 제공 목적으로만 처리되며 AI 모델 훈련에 사용되지 않습니다.",
  },
  "privacy.calendar.title": { en: "Google Calendar", ko: "구글 캘린더" },
  "privacy.calendar.body": {
    en: "If you connect Google Calendar, we access your calendar events only to show upcoming meeting reminders within the app. We do not store or share your calendar data.",
    ko: "구글 캘린더를 연결하면 앱 내 예정 미팅 알림 표시를 위해서만 캘린더 이벤트에 접근합니다. 캘린더 데이터는 저장하거나 공유하지 않습니다.",
  },
  "privacy.storage.title": { en: "Data storage", ko: "데이터 보관" },
  "privacy.storage.body": {
    en: "Your data is stored securely using Supabase. We use industry-standard encryption in transit and at rest.",
    ko: "데이터는 Supabase를 통해 안전하게 저장됩니다. 전송 중 및 저장 시 업계 표준 암호화를 사용합니다.",
  },
  "privacy.deletion.title": { en: "Account deletion", ko: "계정 삭제" },
  "privacy.deletion.body": {
    en: "You can request deletion of your account and all associated data at any time by visiting your Account page in the app and following the deletion instructions. All data is permanently removed within 30 days.",
    ko: "앱의 계정 페이지에서 언제든지 계정 및 모든 관련 데이터 삭제를 요청할 수 있습니다. 모든 데이터는 30일 이내에 영구적으로 삭제됩니다.",
  },
  "privacy.contact.title": { en: "Contact", ko: "연락처" },
  "privacy.contact.body": {
    en: "For any privacy-related questions or requests, contact us at comgamemarre@gmail.com.",
    ko: "개인정보 관련 질문이나 요청은 comgamemarre@gmail.com으로 연락해 주세요.",
  },

  // Child Safety page
  "child.title": { en: "Child Safety Standards", ko: "아동 안전 기준" },
  "child.updated": { en: "Last updated: March 2026", ko: "최종 업데이트: 2026년 3월" },
  "child.commitment.title": { en: "Our Commitment", ko: "우리의 약속" },
  "child.commitment.body": {
    en: "RememberOne is committed to the safety and protection of children. We have zero tolerance for child sexual abuse material (CSAM) or any content that exploits or endangers minors.",
    ko: "RememberOne은 아동의 안전과 보호를 최우선으로 합니다. 아동 성적 학대 자료(CSAM) 또는 미성년자를 착취하거나 위험에 빠뜨리는 모든 콘텐츠에 무관용 원칙을 적용합니다.",
  },
  "child.prohibited.title": { en: "Prohibited Content", ko: "금지 콘텐츠" },
  "child.prohibited.body": {
    en: "Our platform strictly prohibits the creation, distribution, or storage of any content that sexually exploits or abuses minors. Any such content will be immediately removed, and the responsible accounts will be permanently banned.",
    ko: "당사 플랫폼은 미성년자를 성적으로 착취하거나 학대하는 콘텐츠의 생성, 배포 또는 저장을 엄격히 금지합니다. 해당 콘텐츠는 즉시 삭제되며 관련 계정은 영구적으로 정지됩니다.",
  },
  "child.reporting.title": { en: "Reporting Mechanism", ko: "신고 방법" },
  "child.reporting.body": {
    en: "Users can report child safety concerns directly in the app. If you encounter any content or behavior that may endanger a child, please contact us immediately at comgamemarre@gmail.com. All reports are reviewed promptly.",
    ko: "사용자는 앱에서 직접 아동 안전 우려 사항을 신고할 수 있습니다. 아동을 위험에 빠뜨릴 수 있는 콘텐츠나 행동을 발견하면 즉시 comgamemarre@gmail.com으로 연락해 주세요. 모든 신고는 신속하게 검토됩니다.",
  },
  "child.compliance.title": { en: "Compliance", ko: "법적 준수" },
  "child.compliance.body": {
    en: "RememberOne complies with all applicable child safety laws and regulations. We report confirmed CSAM to the National Center for Missing & Exploited Children (NCMEC) and cooperate fully with law enforcement agencies.",
    ko: "RememberOne은 모든 아동 안전 관련 법률 및 규정을 준수합니다. 확인된 CSAM은 실종 및 착취 아동을 위한 국립 센터(NCMEC)에 신고하며 법 집행 기관과 전적으로 협력합니다.",
  },
  "child.prevention.title": { en: "Prevention Practices", ko: "예방 조치" },
  "child.prevention.body": {
    en: "We employ technical measures and human review processes to detect and prevent child exploitation. Our moderation policies are regularly reviewed and updated to meet evolving safety standards.",
    ko: "아동 착취를 탐지하고 예방하기 위한 기술적 조치와 인적 검토 프로세스를 운영합니다. 변화하는 안전 기준에 맞춰 관리 정책을 정기적으로 검토하고 업데이트합니다.",
  },
  "child.contact.title": { en: "Contact", ko: "연락처" },
  "child.contact.body": {
    en: "For child safety concerns or questions about our standards, contact our designated safety officer at comgamemarre@gmail.com",
    ko: "아동 안전 우려 사항이나 기준에 관한 질문은 지정된 안전 담당자에게 comgamemarre@gmail.com으로 연락해 주세요.",
  },
};

/** Returns the translated string for key in lang, falling back to English. */
export function translate(key: string, lang: LanguageCode): string {
  return keys[key]?.[lang] ?? keys[key]?.["en"] ?? key;
}
