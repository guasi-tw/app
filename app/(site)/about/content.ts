export type AboutStep = { n: number; title: string; body: string };
export type AboutTrustItem = { title: string; body: string };
export type AboutAccount = {
  platform: string;
  handle: string;
  verified: string;
  main?: boolean;
};

export const aboutContent = {
  hook: {
    title: "帳號被封了，你要怎麼說「這真的是我」？",
    body: "2026 年 6 月，Meta 一波大封號，許多人一夕失去經營多年的主帳號。新帳號沒有歷史，舊帳號已無法發聲；冒名者卻搶著喊「本尊回來了」。最該證明自己的那一刻，你反而最沒辦法證明。",
  },

  brand: {
    kicker: "一個字的答案",
    wordmark: "guasi",
    pronunciation: "guá-sī ·「我是」",
    body: "把那句你最想喊、卻沒人信的「我是本人」，變成任何人都能查證的事實。這就是 guasi（我是）。",
  },

  how: {
    title: "怎麼運作",
    body: "趁帳號還活著，在 guasi 把你散落各平台的帳號綁定、驗證、公開連結。被封時，存活的帳號就能替你的新帳號背書。",
    gloss: "（你的身分中樞，我們叫它「正身」(tsiànn-sin)；各平台帳號則是「分身」。）",
    steps: [
      { n: 1, title: "建立正身", body: "註冊一個帳號，當你所有分身的中樞。" },
      { n: 2, title: "綁定分身", body: "複製一段含驗證碼的文字，從該帳號發一篇公開貼文，貼回網址即完成。" },
      { n: 3, title: "驗明正身", body: "任何人免登入就能查：這個帳號，跟哪些帳號是同一個人。" },
    ] satisfies AboutStep[],
  },

  examplePost: {
    badge: "範例貼文",
    author: "你的帳號",
    time: "剛剛",
    tag: "@gua.si.tw",
    headline: "我是分身認證貼文",
    linkIntro: "點此觀看此帳號的正身：",
    shortUrl: "guasi.tw/r/ABC…",
    codeLabel: "我是分身驗證碼：",
    code: "374829",
    previewDomain: "🌐 guasi.tw",
    previewTitle: "我是正身 · guasi",
    caption: "↑ 這篇公開貼文本身，就替你向所有看到的人驗明正身。",
  },

  platforms: {
    label: "目前支援",
    items: ["Threads", "Instagram", "miin.cc"],
    more: "更多陸續支援",
  },

  independence: {
    kicker: "平台中立",
    title: "不綁任何一家平台",
    body: "guasi 不屬於任何平台，也不需要平台開放 API 或授權。驗證只靠一件事——你從自己帳號發出的一篇公開貼文，任何人都讀得到、查得到。正因如此，只要一個平台有公開貼文，就能納入支援；而會封你帳號的那家平台，管不到你的正身。",
  },

  exampleProfile: {
    sectionTitle: "驗明正身的公開頁",
    sectionDesc: "每個正身都有專屬的公開連結（例如 guasi.tw/gua/meimei）——這就是你對外的公開檔案。任何人點開，都能看到你公開承認的帳號與驗證證據。",
    shareCaption: "↑ 把這個連結放進各平台的個人簡介或貼文，粉絲一點就能確認：這些散落在不同平台的帳號，真的都是你本人。",
    badge: "範例",
    avatarInitial: "美",
    name: "小美",
    handleUrl: "guasi.tw/gua/meimei",
    count: "3 個分身",
    tabs: { accounts: "帳號", timeline: "時間軸" },
    guarantee: "✓ 以下帳號皆經 guasi 確認屬於同一人，由本人公開貼文驗證。",
    accounts: [
      { platform: "Threads", handle: "@meimei", verified: "驗證於 2026/05", main: true },
      { platform: "Instagram", handle: "@meimei.ig", verified: "驗證於 2026/05" },
      { platform: "Threads", handle: "@meimei.new", verified: "驗證於 2026/06" },
    ] satisfies AboutAccount[],
  },

  trust: {
    title: "為什麼可信",
    items: [
      { title: "驗證靠本人公開動作", body: "貼文必須從該帳號本人發出，冒名者沒有控制權就發不出來。" },
      { title: "證據是公開貼文，人人可查", body: "每筆綁定都附上原始驗證貼文連結，任何人都能點開核對，不必只相信我們。" },
      { title: "不靠平台授權，只靠公開貼文", body: "驗證證據是你本人發的公開貼文，人人可讀、可查，不需要任何平台開放 API 或授權。會封人的正是平台，所以身分的可信度握在你自己手上，不在它們手上。" },
    ] satisfies AboutTrustItem[],
  },

  whyNow: {
    title: "為什麼是現在",
    body: "封號當下，被封的帳號已經發不出驗證貼文。guasi 的價值來自「事先」——趁帳號還活著就登記、串好，被封後才有存活的帳號替你的新帳號背書。",
  },

  cta: {
    title: "趁現在，先驗明你的正身",
    subtitle: "被封後就來不及了。建立正身只要幾分鐘。",
    buttonLabel: "以 Google 登入，建立我的正身 →",
    href: "/login",
    note: "免費 · 無需密碼",
  },

  contact: {
    label: "有任何問題或建議，歡迎來信：",
    email: "support@guasi.tw",
  },
} as const;
