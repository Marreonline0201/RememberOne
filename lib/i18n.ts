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
  // Person card long-press action menu
  "card.share": { en: "Share", ko: "공유" },
  "card.edit": { en: "Edit", ko: "수정" },
  "card.delete": { en: "Delete", ko: "삭제" },
  "confirm.delete_title": {
    en: "Delete this person?",
    ko: "이 사람을 삭제할까요?",
  },
  "confirm.delete_body": {
    en: "This permanently removes their info, family, interests, and meeting history. This can't be undone.",
    ko: "정보, 가족, 관심사, 만남 기록이 영구적으로 삭제됩니다. 되돌릴 수 없어요.",
  },
  "confirm.yes": { en: "Yes", ko: "네" },
  "confirm.no": { en: "No", ko: "아니요" },
  "toast.deleted": { en: "Deleted", ko: "삭제됨" },
  "toast.delete_failed": { en: "Delete failed", ko: "삭제 실패" },
  "toast.copied": { en: "Copied to clipboard", ko: "클립보드에 복사됨" },
  // Timezone setting (account page) + calendar
  "account.timezone": { en: "Timezone", ko: "시간대" },
  "timezone.auto": { en: "Auto (use device timezone)", ko: "자동 (기기 시간대 사용)" },
  "timezone.auto_short": { en: "Auto", ko: "자동" },
  "timezone.auto_hint": {
    en: "Calendar times follow this timezone.",
    ko: "캘린더 시간이 이 시간대를 따릅니다.",
  },
  "timezone.search_placeholder": { en: "Search timezone…", ko: "시간대 검색…" },
  "timezone.none_found": { en: "No matching timezone", ko: "일치하는 시간대 없음" },
  // Calendar setting (account page)
  "account.calendar": { en: "Calendar", ko: "캘린더" },
  "calendar.connected": { en: "Connected", ko: "연결됨" },
  "calendar.not_connected": { en: "Not connected", ko: "연결 안 됨" },
  "calendar.connect": { en: "Connect Google Calendar", ko: "Google 캘린더 연결하기" },
  "calendar.disconnect": { en: "Disconnect", ko: "연결 해제" },
  "calendar.disconnecting": { en: "Disconnecting…", ko: "해제 중…" },
  "calendar.show_google_prompt": { en: "Show Google Calendar prompt", ko: "Google 캘린더 안내 표시" },
  "calendar.show_google_prompt_hint": {
    en: "Show the connect banner on the calendar screen.",
    ko: "캘린더 화면에 연결 안내 배너를 표시합니다.",
  },
  "calendar.show_phone_prompt": { en: "Show phone calendar prompt", ko: "휴대폰 캘린더 안내 표시" },
  "calendar.show_phone_prompt_hint": {
    en: "Reappears on the calendar screen when your phone calendar isn't linked.",
    ko: "휴대폰 캘린더가 연결되지 않았을 때 캘린더 화면에 다시 표시됩니다.",
  },
  "calendar.today_first": { en: "Today's meetings first", ko: "오늘 만남 먼저 보기" },
  "calendar.today_first_hint": {
    en: "Show the selected day right below the calendar, above Upcoming.",
    ko: "선택한 날짜를 캘린더 바로 아래, 예정된 만남 위에 표시합니다.",
  },
  // Calendar — add/edit meeting dialog
  "calendar.add_meeting": { en: "Add meeting", ko: "만남 추가" },
  "calendar.edit_meeting": { en: "Edit meeting", ko: "만남 수정" },
  "calendar.who": { en: "Who are you meeting?", ko: "누구를 만나나요?" },
  "calendar.just_me": { en: "Just me", ko: "나 혼자" },
  "calendar.search_people": { en: "Search people…", ko: "사람 검색…" },
  "calendar.no_people_found": { en: "No matching people", ko: "일치하는 사람 없음" },
  "calendar.time": { en: "Time", ko: "시간" },
  "calendar.all_day": { en: "All day", ko: "하루 종일" },
  "calendar.details": { en: "Details", ko: "세부 정보" },
  "calendar.event_title": { en: "Title", ko: "제목" },
  "calendar.duration": { en: "Duration", ko: "소요 시간" },
  "calendar.location": { en: "Location", ko: "장소" },
  "calendar.note": { en: "Note", ko: "메모" },
  "calendar.date": { en: "Date", ko: "날짜" },
  "calendar.add_action": { en: "Add to calendar", ko: "캘린더에 추가" },
  "calendar.save_action": { en: "Save changes", ko: "변경 사항 저장" },
  "calendar.delete_action": { en: "Delete event", ko: "일정 삭제" },
  "calendar.delete_confirm": { en: "Delete this event?", ko: "이 일정을 삭제할까요?" },
  "calendar.saving": { en: "Saving…", ko: "저장 중…" },
  "calendar.personal_plan": { en: "Personal plan", ko: "개인 일정" },
  "calendar.add_connect_hint": {
    en: "Connect Google Calendar to add meetings from the app. They'll show on your phone's calendar too.",
    ko: "앱에서 만남을 추가하려면 Google 캘린더를 연결하세요. 휴대폰 캘린더에도 표시됩니다.",
  },
  "calendar.reconnect_hint": {
    en: "Google needs a one-time reconnect to let the app add events.",
    ko: "앱에서 일정을 추가하려면 Google 캘린더를 한 번 다시 연결해 주세요.",
  },
  "calendar.reconnect": { en: "Reconnect Google Calendar", ko: "Google 캘린더 다시 연결" },
  "calendar.save_failed": {
    en: "Couldn't save the event. Please try again.",
    ko: "일정을 저장하지 못했어요. 다시 시도해 주세요.",
  },
  "calendar.event_gone": {
    en: "This event no longer exists in Google Calendar.",
    ko: "이 일정은 Google 캘린더에 더 이상 없습니다.",
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
  "privacy.calendar.title": { en: "Calendar access", ko: "캘린더 접근" },
  "privacy.calendar.body": {
    en: "If you connect Google Calendar, or grant calendar permission on your phone, we read upcoming events only to match them to people you've saved and show meeting reminders within the app. Phone calendar events are read on your device, used only for matching, and are never stored on our servers or shared. You can revoke access at any time.",
    ko: "구글 캘린더를 연결하거나 휴대폰 캘린더 권한을 허용하면, 예정된 일정을 저장된 사람과 연결하고 앱 내 미팅 알림을 표시하기 위해서만 일정을 읽습니다. 휴대폰 캘린더 일정은 기기에서 읽어 연결에만 사용하며, 서버에 저장하거나 공유하지 않습니다. 언제든지 권한을 해제할 수 있습니다.",
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
