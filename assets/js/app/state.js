/* CatChat · Tham chiếu DOM, tham chiếu Firebase và toàn bộ state dùng chung.
   Tách từ index.html — nạp bằng <script defer> theo đúng thứ tự trong index.html. */
'use strict';

const els = {
  authView: $('#authView'), appView: $('#appView'), authForm: $('#authForm'), authTitle: $('#authTitle'),
  authEyebrow: $('#authEyebrow'), authDescription: $('#authDescription'), authSubmit: $('#authSubmit'),
  authSubmitText: $('#authSubmitText'), authSubmitArrow: $('#authSubmitArrow'), authSpinner: $('#authSpinner'),
  authNotice: $('#authNotice'), authNoticeText: $('#authNoticeText'), authError: $('#authError'), authErrorText: $('#authErrorText'),
  toggleAuthMode: $('#toggleAuthMode'), displayNameField: $('#displayNameField'), displayName: $('#displayName'),
  email: $('#email'), password: $('#password'), confirmPasswordField: $('#confirmPasswordField'), confirmPassword: $('#confirmPassword'),
  forgotPassword: $('#forgotPassword'), togglePassword: $('#togglePassword'), sidebarName: $('#sidebarName'), sidebarEmail: $('#sidebarEmail'),
  sidebarAvatar: $('#sidebarAvatar'), avatarFileInput: $('#avatarFileInput'), connectionPill: $('#connectionPill'), connectionLabel: $('#connectionLabel'),
  openAdminButton: $('#openAdminButton'), rolePill: $('#rolePill'), membersPanel: $('#membersPanel'), memberList: $('#memberList'),
  channelList: $('#channelList'), channelAddButton: $('#channelAddButton'), mobileChannelSelect: $('#mobileChannelSelect'),
  mobileCreateChannelButton: $('#mobileCreateChannelButton'), channelDialog: $('#channelDialog'), channelCreateForm: $('#channelCreateForm'),
  channelNameInput: $('#channelNameInput'), cancelCreateChannelButton: $('#cancelCreateChannelButton'),
  createChannelSubmit: $('#createChannelSubmit'), clearChannelButton: $('#clearChannelButton'),
  deleteChannelButton: $('#deleteChannelButton'), channelTitle: $('#channelTitle'),
  channelMemberSummary: $('#channelMemberSummary'), channelSymbol: $('#channelSymbol'),
  channelAnnouncements: $('#channelAnnouncements'),
  themeDialog: $('#themeDialog'), themeOptions: $('#themeOptions'), themeStatus: $('#themeStatus'),
  closeThemeDialogButton: $('#closeThemeDialogButton'), openThemeSettingsButton: $('#openThemeSettingsButton'),
  adminOverlay: $('#adminOverlay'), adminMemberList: $('#adminMemberList'), adminMembersTab: $('#adminMembersTab'),
  adminAnnouncementsTab: $('#adminAnnouncementsTab'), adminMemberSearch: $('#adminMemberSearch'),
  announcementInput: $('#announcementInput'), publishAnnouncementButton: $('#publishAnnouncementButton'),
  adminAnnouncementList: $('#adminAnnouncementList'), chatMessages: $('#chatMessages'), chatEmptyState: $('#chatEmptyState'),
  loadOlderButton: $('#loadOlderButton'),
  messageSearchBar: $('#messageSearchBar'), messageSearchInput: $('#messageSearchInput'), messageSearchCount: $('#messageSearchCount'),
  messageInput: $('#messageInput'), sendButton: $('#sendButton'), messageCharCount: $('#messageCharCount'),
  chatImageInput: $('#chatImageInput'), pendingImagePreview: $('#pendingImagePreview'), pendingImageThumb: $('#pendingImageThumb'),
  pendingImageName: $('#pendingImageName'), attachImageButton: $('#attachImageButton'),
  replyPreview: $('#replyPreview'), replyPreviewName: $('#replyPreviewName'), replyPreviewText: $('#replyPreviewText'),
  announcementBanner: $('#announcementBanner'), announcementBannerText: $('#announcementBannerText'),
  announcementBannerTime: $('#announcementBannerTime'), confirmLayer: $('#confirmLayer'), confirmTitle: $('#confirmTitle'),
  confirmDescription: $('#confirmDescription'), confirmReasonWrap: $('#confirmReasonWrap'), confirmReason: $('#confirmReason'),
  confirmAccept: $('#confirmAccept'), confirmCancel: $('#confirmCancel'), toastRegion: $('#toastRegion')
};

let auth = null;
let database = null;
let messagesRef = null;
let generalMessagesRef = null;
let channelsRef = null;
let membersRef = null;
let memberEmailsRef = null;
let presenceRef = null;
let adminsRef = null;
let bansRef = null;
let mutesRef = null;
let adminLogRef = null;
let pinsRef = null;
let locksRef = null;
let deletedUsersRef = null;
let typingRef = null;
let messageReactionsRef = null;
let storage = null;
let firebaseReady = false;

let isSignUp = false;
let currentUser = null;
let isAdmin = false;
let members = {};
let memberEmails = {};
let presence = {};
let bans = {};
let mutes = {};
let pins = {};
let locks = {};
let adminLogEntries = [];
let muteDurationMinutes = 1440;
let channels = {};
let activeChannelId = 'general';
let messages = new Map();
let announcementMessages = new Map();
let messageReactions = {};
let reactionStops = new Map();
let messageSearchQuery = '';
let replyTarget = null;
let pendingImageFile = null;
let pendingImageObjectUrl = null;
let isSendingMessage = false;
let hasAdminMarker = false;
let hasAdminClaim = false;
let hasAdminEmail = false;
let announcementMode = false;
let cleanupFns = [];
let channelCleanupFns = [];
let channelGeneration = 0;
let stopAdminBanListener = null;
let stopAdminEmailListener = null;
let stopMuteListener = null;
let stopAdminLogListener = null;
let stopOwnMuteListener = null;
let stopPinListener = null;
let stopLockListener = null;
let muteResolver = null;
let authGeneration = 0;
let connectionIsOnline = false;
let announcementDismissedId = null;
let confirmResolver = null;
let lastDatabaseErrorAt = 0;
/* Trạng thái đọc tin nhắn: mốc thời gian lần cuối người dùng ở gần cuối danh sách
   và số tin mới đang chờ (dùng cho dải “Tin nhắn mới” + nút nổi). */
let lastReadTimestamp = 0;
let unreadMessageCount = 0;
let hasOlderMessages = false;
let isLoadingOlderMessages = false;
