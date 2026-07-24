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
  // Common
  "common.back": {
    en: "Back",
    ko: "뒤로",
  },
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
    en: "Permanently delete your account and all data stored with it. Deletion happens immediately and cannot be undone.",
    ko: "계정과 함께 저장된 모든 데이터를 영구적으로 삭제합니다. 삭제는 즉시 진행되며 취소할 수 없습니다.",
  },
  "account.delete_button": {
    en: "Delete my account",
    ko: "내 계정 삭제",
  },
  "account.delete_confirm_title": {
    en: "Delete your account forever?",
    ko: "계정을 영구적으로 삭제할까요?",
  },
  "account.delete_confirm_body": {
    en: "This immediately and permanently deletes your account and everything in it. There is no way to undo this or recover your data.",
    ko: "계정과 모든 데이터가 즉시 영구 삭제됩니다. 되돌리거나 복구할 방법이 없습니다.",
  },
  "account.delete_confirm_yes": {
    en: "Yes, delete everything",
    ko: "네, 모두 삭제합니다",
  },
  "account.delete_cancel": {
    en: "Cancel",
    ko: "취소",
  },
  "account.deleting": {
    en: "Deleting…",
    ko: "삭제 중…",
  },
  "account.delete_failed": {
    en: "Couldn't delete your account. Check your connection and try again.",
    ko: "계정을 삭제하지 못했어요. 연결을 확인하고 다시 시도해 주세요.",
  },
  "account.delete_offline": {
    en: "Deleting your account needs a connection",
    ko: "계정 삭제는 인터넷이 필요해요",
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
  "account.how_to_use": {
    en: "How to use this app",
    ko: "앱 사용 방법",
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
  "card.expand": { en: "Expand card", ko: "카드 펼치기" },
  "card.collapse": { en: "Collapse card", ko: "카드 접기" },
  "card.groups": { en: "Groups…", ko: "그룹…" },
  "person.groups_section": { en: "Groups", ko: "그룹" },
  "groups.title": { en: "Groups", ko: "그룹" },
  "groups.all": { en: "All", ko: "전체" },
  "groups.manage_title": { en: "Manage groups", ko: "그룹 관리" },
  "groups.manage_hint": {
    en: "Organize people into groups like School or Work.",
    ko: "학교, 직장 같은 그룹으로 사람들을 정리하세요.",
  },
  "groups.new_name": { en: "Group name", ko: "그룹 이름" },
  "groups.new_desc": { en: "Description (optional)", ko: "설명 (선택)" },
  "groups.create": { en: "Create group", ko: "그룹 만들기" },
  "groups.create_failed": { en: "Couldn't save the group.", ko: "그룹을 저장하지 못했어요." },
  "groups.save": { en: "Save", ko: "저장" },
  "groups.saved": { en: "Groups updated", ko: "그룹이 업데이트됐어요" },
  "groups.save_failed": { en: "Couldn't update groups", ko: "그룹을 업데이트하지 못했어요" },
  "groups.cancel": { en: "Cancel", ko: "취소" },
  "groups.edit": { en: "Edit", ko: "수정" },
  "groups.edit_membership": { en: "Edit groups", ko: "그룹 수정" },
  "groups.delete": { en: "Delete", ko: "삭제" },
  "groups.delete_confirm_title": { en: "Delete this group?", ko: "이 그룹을 삭제할까요?" },
  "groups.delete_confirm_body": {
    en: "People stay — they're only removed from this group.",
    ko: "사람들은 그대로 남고, 이 그룹에서만 제외됩니다.",
  },
  "groups.duplicate": {
    en: "A group with this name already exists.",
    ko: "같은 이름의 그룹이 이미 있어요.",
  },
  "groups.empty": { en: "No groups yet.", ko: "아직 그룹이 없어요." },
  "groups.none_in_group": {
    en: "No one in this group yet.",
    ko: "이 그룹에는 아직 아무도 없어요.",
  },
  "groups.none_yet": { en: "Not in any group yet.", ko: "아직 그룹에 없어요." },
  "groups.show_all": { en: "Show everyone", ko: "전체 보기" },
  "groups.offline_hint": {
    en: "Creating and editing groups needs a connection.",
    ko: "그룹 생성·수정은 온라인에서만 가능해요.",
  },
  "groups.add_to": { en: "Add to groups", ko: "그룹에 추가" },
  "groups.quick_create": { en: "New group…", ko: "새 그룹…" },
  "groups.picker_title": { en: "Groups for", ko: "그룹 설정:" },
  "groups.picker_hint": {
    en: "Pick the groups this person belongs to.",
    ko: "이 사람이 속할 그룹을 선택하세요.",
  },
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
  // Home upcoming-meetings banner + its settings
  "meetings.upcoming": { en: "Upcoming meetings", ko: "예정된 만남" },
  "meetings.collapse": { en: "Collapse meetings", ko: "만남 접기" },
  "meetings.expand": { en: "Expand meetings", ko: "만남 펼치기" },
  "calendar.days_ahead": { en: "Show meetings for", ko: "만남 표시 기간" },
  "calendar.days_ahead_hint": {
    en: "How far ahead the home screen lists meetings.",
    ko: "홈 화면에 며칠 뒤 만남까지 표시할지 정합니다.",
  },
  "calendar.days_1": { en: "1 day", ko: "1일" },
  "calendar.days_3": { en: "3 days", ko: "3일" },
  "calendar.days_7": { en: "7 days", ko: "7일" },
  "calendar.days_14": { en: "14 days", ko: "14일" },
  "calendar.days_31": { en: "31 days", ko: "31일" },
  "calendar.notify_toggle": { en: "Notify before meetings", ko: "만남 전 알림" },
  "calendar.notify_toggle_hint": {
    en: "A phone notification before each upcoming meeting.",
    ko: "예정된 만남 전에 휴대폰 알림을 보냅니다.",
  },
  "calendar.notify_lead": { en: "Notify me", ko: "알림 시점" },
  "calendar.lead_10": { en: "10 min before", ko: "10분 전" },
  "calendar.lead_30": { en: "30 min before", ko: "30분 전" },
  "calendar.lead_60": { en: "1 hour before", ko: "1시간 전" },
  "calendar.notify_requires_update": {
    en: "Update the app to use meeting notifications.",
    ko: "만남 알림을 사용하려면 앱을 업데이트하세요.",
  },
  "calendar.notify_denied": {
    en: "Notifications are blocked. Allow them in your phone's settings.",
    ko: "알림이 차단되어 있어요. 휴대폰 설정에서 허용해 주세요.",
  },
  "notif.meeting_title": { en: "Meeting with {name}", ko: "{name}님과의 만남" },
  // Calendar — add/edit meeting dialog
  "calendar.add_meeting": { en: "Add meeting", ko: "만남 추가" },
  "calendar.edit_meeting": { en: "Edit meeting", ko: "만남 수정" },
  "calendar.who": { en: "Who are you meeting?", ko: "누구를 만나나요?" },
  "calendar.just_me": { en: "Just me", ko: "나 혼자" },
  "calendar.search_people": { en: "Search people…", ko: "사람 검색…" },
  "calendar.no_people_found": { en: "No matching people", ko: "일치하는 사람 없음" },
  "calendar.time": { en: "Time", ko: "시간" },
  "calendar.all_day": { en: "All day", ko: "하루 종일" },
  "calendar.start": { en: "Start", ko: "시작" },
  "calendar.end": { en: "End", ko: "종료" },
  "calendar.end_before_start": {
    en: "End must be after the start.",
    ko: "종료는 시작보다 늦어야 해요.",
  },
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

  // Write a person (typed) — /meet/write
  "write.toggle_speak": {
    en: "Speak",
    ko: "말하기",
  },
  "write.toggle_write": {
    en: "Write",
    ko: "쓰기",
  },
  "write.heading": {
    en: "Write someone down",
    ko: "직접 적어보기",
  },
  "write.subheading": {
    en: "Type their name, then everything else about them.",
    ko: "이름을 적고, 그 사람에 대한 모든 것을 적어보세요.",
  },
  "write.name_label": {
    en: "Name",
    ko: "이름",
  },
  "write.name_placeholder": {
    en: "e.g. Mike Anderson",
    ko: "예: 정태현",
  },
  "write.info_label": {
    en: "Everything else",
    ko: "그 외 모든 것",
  },
  "write.info_placeholder": {
    en: "Met him at the conference. He has a son named Jake who is 10 and studies at Stony Brook…",
    ko: "컨퍼런스에서 만났어요. 10살 아들 김민규가 있고 연세대학교에 다녀요…",
  },
  "write.empty_info_hint": {
    en: "Add a few details so we can organize them — or save with just a name.",
    ko: "정리할 수 있도록 몇 가지 정보를 적어주세요 — 이름만으로 저장할 수도 있어요.",
  },
  "write.organize": {
    en: "ORGANIZE",
    ko: "정리하기",
  },
  "write.organizing_title": {
    en: "Organizing your notes...",
    ko: "정보를 정리하고 있어요...",
  },
  "write.organizing_subtitle": {
    en: "Sorting into details, family, and a summary.",
    ko: "속성, 가족, 요약으로 정리하고 있어요.",
  },
  "write.review_heading": {
    en: "Review before saving",
    ko: "저장하기 전에 확인하세요",
  },
  "write.review_subheading": {
    en: "Nothing is saved yet. Edit anything, then save.",
    ko: "아직 저장되지 않았어요. 수정한 뒤 저장하세요.",
  },
  "write.details_label": {
    en: "Details",
    ko: "정보",
  },
  "write.family_label": {
    en: "Family",
    ko: "가족",
  },
  "write.summary_label": {
    en: "Summary",
    ko: "요약",
  },
  "write.add_detail": {
    en: "Add detail",
    ko: "정보 추가",
  },
  "write.add_family": {
    en: "Add family member",
    ko: "가족 추가",
  },
  "write.remove": {
    en: "Remove",
    ko: "제거",
  },
  "write.attr_key_placeholder": {
    en: "Label (e.g. Job)",
    ko: "항목 (예: 직업)",
  },
  "write.attr_value_placeholder": {
    en: "Value",
    ko: "내용",
  },
  "write.fm_name_placeholder": {
    en: "Name",
    ko: "이름",
  },
  "write.fm_relation_placeholder": {
    en: "Relation (e.g. son)",
    ko: "관계 (예: 아들)",
  },
  "write.save": {
    en: "SAVE",
    ko: "저장하기",
  },
  "write.saving_title": {
    en: "Saving...",
    ko: "저장하고 있어요...",
  },
  "write.back_to_edit": {
    en: "BACK TO EDIT",
    ko: "수정하러 가기",
  },
  "write.offline_hint": {
    en: "You're offline — connect to organize.",
    ko: "오프라인이에요 — 연결하면 정리할 수 있어요.",
  },
  "write.organize_failed": {
    en: "Couldn't organize your notes",
    ko: "정보를 정리하지 못했어요",
  },
  "write.rate_limited": {
    en: "You've hit the limit — wait a moment and try again.",
    ko: "요청이 많아요 — 잠시 후 다시 시도해 주세요.",
  },
  "write.save_failed": {
    en: "Couldn't save",
    ko: "저장하지 못했어요",
  },

  // AI consent (Gemini) — App Store 5.1.2(i)
  "consent.title": {
    en: "Use AI to organize this?",
    ko: "AI로 정리할까요?",
  },
  "consent.body": {
    en: "To pull out names and details, RememberOne sends the text you type or speak to Google Gemini, an AI service. It's used only to provide this feature — never to train AI models. You can withdraw this anytime in Account settings.",
    ko: "이름과 세부 정보를 추출하기 위해, 입력하거나 말한 텍스트를 AI 서비스인 Google Gemini로 전송합니다. 이 기능 제공 목적으로만 사용되며 AI 모델 훈련에는 사용되지 않습니다. 계정 설정에서 언제든지 동의를 철회할 수 있어요.",
  },
  "consent.agree": {
    en: "Agree & continue",
    ko: "동의하고 계속",
  },
  "consent.cancel": {
    en: "Not now",
    ko: "나중에",
  },
  "consent.learn_more": {
    en: "Privacy details",
    ko: "개인정보 안내",
  },
  "consent.account_title": {
    en: "AI processing",
    ko: "AI 처리",
  },
  "consent.account_on": {
    en: "You've allowed sending your notes to Google Gemini to extract details.",
    ko: "세부 정보 추출을 위해 메모를 Google Gemini로 전송하는 것에 동의했어요.",
  },
  "consent.account_off": {
    en: "AI features ask for your permission before sending anything to Google Gemini.",
    ko: "AI 기능은 Google Gemini로 전송하기 전에 동의를 요청합니다.",
  },
  "consent.revoke": {
    en: "Withdraw AI consent",
    ko: "AI 동의 철회",
  },
  "consent.revoked_toast": {
    en: "AI consent withdrawn",
    ko: "AI 동의가 철회되었어요",
  },

  // Privacy Policy page
  "privacy.title": { en: "Privacy Policy", ko: "개인정보 처리방침" },
  "privacy.updated": { en: "Last updated: March 2026", ko: "최종 업데이트: 2026년 3월" },
  "privacy.collect.title": { en: "What we collect", ko: "수집 정보" },
  "privacy.collect.body": {
    en: "We collect your email address and name when you create an account. Guest mode collects no personal information about you at all — a random identifier is created instead, and you can add an email later to keep your data. We also store the information you choose to log about people you meet — including their names, attributes, family members, and meeting notes. You are responsible for recording information about other people lawfully and respectfully.",
    ko: "계정 생성 시 이메일 주소와 이름을 수집합니다. 게스트 모드에서는 개인정보를 전혀 수집하지 않으며 무작위 식별자만 생성됩니다(나중에 이메일을 추가해 데이터를 보존할 수 있어요). 또한 만나는 사람들에 대해 기록하는 정보(이름, 속성, 가족 구성원, 미팅 메모)도 저장합니다. 다른 사람에 대한 정보는 적법하고 상대를 존중하는 방식으로 기록할 책임이 이용자에게 있습니다.",
  },
  "privacy.use.title": { en: "How we use your data", ko: "데이터 사용 방법" },
  "privacy.use.body": {
    en: "Your data is used solely to provide the RememberOne service — storing your contacts and generating AI-powered summaries from your meeting notes. We do not sell or share your data with third parties.",
    ko: "데이터는 RememberOne 서비스 제공에만 사용됩니다 — 연락처 저장 및 미팅 메모에서 AI 요약 생성. 제3자에게 데이터를 판매하거나 공유하지 않습니다.",
  },
  "privacy.ai.title": { en: "AI processing", ko: "AI 처리" },
  "privacy.ai.body": {
    en: "When you log a meeting, the text or audio you provide is sent to a third-party AI service (Google Gemini) to extract structured information. We ask for your explicit permission before sending anything, and this content is processed only to provide the service — it is not used to train AI models. You can withdraw your consent at any time in Account settings, which turns the AI features off. You can also disconnect Google Calendar at any time in Account settings, which revokes and deletes the stored calendar tokens.",
    ko: "미팅을 기록할 때 입력한 텍스트나 음성은 구조화된 정보 추출을 위해 제3자 AI 서비스(Google Gemini)로 전송됩니다. 전송 전에 명시적 동의를 요청하며, 이 내용은 서비스 제공 목적으로만 처리되고 AI 모델 훈련에는 사용되지 않습니다. 계정 설정에서 언제든지 동의를 철회할 수 있으며, 철회 시 AI 기능이 꺼집니다. Google 캘린더 연결도 계정 설정에서 언제든지 해제할 수 있으며, 해제 시 저장된 캘린더 토큰이 취소·삭제됩니다.",
  },
  "privacy.transfer.title": { en: "International data transfer", ko: "국외 이전 (개인정보 국외 이전 고지)" },
  "privacy.transfer.body": {
    en: "For AI processing, the note text or voice recording you submit (which may include information about people you describe) is transmitted to Google LLC (1600 Amphitheatre Parkway, Mountain View, CA, USA; googlekrsupport@google.com) for the purpose of extracting structured details. The content is processed for this purpose only, is not used to train Google's models, and is not retained by Google beyond processing. Transmission occurs when you use the AI features, after your explicit consent.",
    ko: "AI 처리를 위해 이용자가 제출한 메모 텍스트 또는 음성 녹음(기록 대상 인물에 대한 정보 포함 가능)은 구조화된 정보 추출 목적으로 미국의 Google LLC(1600 Amphitheatre Parkway, Mountain View, CA, USA; googlekrsupport@google.com)에 전송됩니다. 해당 내용은 이 목적에만 처리되며 Google 모델 학습에 사용되지 않고 처리 후 보관되지 않습니다. 이전 시점은 이용자가 명시적으로 동의한 뒤 AI 기능을 사용하는 때입니다.",
  },
  "privacy.calendar.title": { en: "Calendar access", ko: "캘린더 접근" },
  "privacy.calendar.body": {
    en: "If you connect Google Calendar, or grant calendar permission on your phone, we read upcoming events only to match them to people you've saved and show meeting reminders within the app. Phone calendar events are read on your device, used only for matching, and are never stored on our servers or shared. You can revoke access at any time.",
    ko: "구글 캘린더를 연결하거나 휴대폰 캘린더 권한을 허용하면, 예정된 일정을 저장된 사람과 연결하고 앱 내 미팅 알림을 표시하기 위해서만 일정을 읽습니다. 휴대폰 캘린더 일정은 기기에서 읽어 연결에만 사용하며, 서버에 저장하거나 공유하지 않습니다. 언제든지 권한을 해제할 수 있습니다.",
  },
  "privacy.storage.title": { en: "Data storage", ko: "데이터 보관" },
  "privacy.storage.body": {
    en: "Your data is stored securely using Supabase and served via Vercel; AI processing uses Google's Gemini API under its paid-tier terms. We use industry-standard encryption in transit and at rest, and each of these providers is contractually bound to protect your data to an equivalent standard. Data is retained until you delete it or your account. Guest accounts that have not been used for 60 days are automatically deleted along with all their data.",
    ko: "데이터는 Supabase를 통해 안전하게 저장되고 Vercel을 통해 제공되며, AI 처리는 Google Gemini API(유료 등급 약관)를 사용합니다. 전송 중 및 저장 시 업계 표준 암호화를 사용하고, 각 제공업체는 동등한 수준의 데이터 보호를 계약상 준수합니다. 데이터는 이용자가 삭제하거나 계정을 삭제할 때까지 보관됩니다. 60일간 사용되지 않은 게스트 계정은 모든 데이터와 함께 자동 삭제됩니다.",
  },
  "privacy.deletion.title": { en: "Account deletion", ko: "계정 삭제" },
  "privacy.deletion.body": {
    en: "You can permanently delete your account and all associated data at any time from the Account page in the app (\"Delete Account\"). Deletion is immediate: your profile, saved people, meetings, notes, family members, and calendar connections are removed right away, and any connected Google Calendar access is revoked.",
    ko: "앱의 계정 페이지(\"계정 삭제\")에서 언제든지 계정과 모든 관련 데이터를 영구적으로 삭제할 수 있습니다. 삭제는 즉시 이루어지며 프로필, 저장된 사람, 미팅, 메모, 가족 구성원, 캘린더 연결이 바로 제거되고 연결된 Google 캘린더 접근 권한도 해제됩니다.",
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

  "meet.person_write_placeholder": {
    en: "Type what you learned — job, family, plans…",
    ko: "알게 된 내용을 입력하세요 — 직업, 가족, 계획 등",
  },

  // First-open tour (coach marks)
  "tour.welcome_title": {
    en: "Welcome to Remember One",
    ko: "Remember One에 오신 걸 환영해요",
  },
  "tour.welcome_body": {
    en: "Never forget the people you meet. Speak a few words after a meeting, and AI remembers every detail for you.",
    ko: "만나는 사람들을 잊지 않게 도와드려요. 만남이 끝나고 몇 마디만 말하면, AI가 세부 정보를 대신 기억해 드려요.",
  },
  "tour.welcome_cta": { en: "SHOW ME AROUND", ko: "둘러보기" },
  "tour.skip": { en: "Skip", ko: "건너뛰기" },
  "tour.next": { en: "Next", ko: "다음" },
  "tour.progress": { en: "Step {n} of {m}", ko: "{m}단계 중 {n}단계" },
  "tour.step_people_title": { en: "Your people", ko: "만난 사람들" },
  "tour.step_people_body": {
    en: "Everyone you log lives here. Use groups and search to find anyone fast.",
    ko: "기록한 사람들이 모두 여기에 모여요. 그룹과 검색으로 누구든 빠르게 찾을 수 있어요.",
  },
  "tour.step_banner_title": { en: "Upcoming meetings", ko: "다가오는 만남" },
  "tour.step_banner_body": {
    en: "Meetings with your people show up here, so you can prep before you go.",
    ko: "등록한 사람들과의 만남이 여기에 표시돼요. 만나기 전에 미리 준비할 수 있어요.",
  },
  "tour.step_record_title": { en: "Just talk", ko: "말만 하세요" },
  "tour.step_record_body": {
    en: "Tap the mic and describe who you met. AI saves the name, job, family — everything.",
    ko: "마이크를 누르고 만난 사람에 대해 이야기해 보세요. 이름, 직업, 가족까지 AI가 알아서 저장해요.",
  },
  "tour.step_calendar_title": { en: "Your calendar", ko: "캘린더" },
  "tour.step_calendar_body": {
    en: "Logged meetings appear on this calendar. Connect Google Calendar to see what's coming up too.",
    ko: "기록한 만남이 캘린더에 표시돼요. Google 캘린더를 연결하면 다가오는 일정도 함께 볼 수 있어요.",
  },
  "tour.step_settings_title": { en: "Settings live here", ko: "설정은 여기에서" },
  "tour.step_settings_body": {
    en: "Tap your photo up top anytime to get here. You can replay this tour from this row.",
    ko: "언제든 위쪽 프로필 사진을 누르면 이 화면이 열려요. 이 메뉴에서 투어를 다시 볼 수 있어요.",
  },
  "tour.done_title": { en: "You're all set", ko: "준비 완료!" },
  "tour.done_body": {
    en: "Met someone new? Tap the mic and just talk — Remember One does the rest.",
    ko: "새로운 사람을 만났나요? 마이크를 누르고 말만 하세요. 나머지는 Remember One이 알아서 해요.",
  },
  "tour.done_cta": { en: "GET STARTED", ko: "시작하기" },
  "tour.dismissed_toast": {
    en: "Replay anytime from Settings",
    ko: "설정에서 언제든 다시 볼 수 있어요",
  },
};

/** Returns the translated string for key in lang, falling back to English. */
export function translate(key: string, lang: LanguageCode): string {
  return keys[key]?.[lang] ?? keys[key]?.["en"] ?? key;
}
