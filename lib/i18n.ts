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
    en: "Sign in to RememberOne at remember-one-1.vercel.app",
    ko: "remember-one-1.vercel.app에서 RememberOne에 로그인하세요",
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
    ko: "말하세요 \"오늘 아침에 마이크를 만났어요. 그에게는 10살 아들 제이크가 있고, 스토니브룩 대학교에 다니고 있어요.\"",
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
};

/** Returns the translated string for key in lang, falling back to English. */
export function translate(key: string, lang: LanguageCode): string {
  return keys[key]?.[lang] ?? keys[key]?.["en"] ?? key;
}
