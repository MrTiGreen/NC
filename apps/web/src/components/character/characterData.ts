import type { CharacterPageData } from "./types";

export const characterPageData = {
  level: 12,
  health: { current: 251, maximum: 300, tone: "health" },
  energy: { current: 54, maximum: 100, tone: "energy" },
  experience: { current: 37_800, maximum: 60_000, tone: "experience" },
  currencies: [
    { id: "coins", symbol: "₭", value: 1_250 },
    { id: "shards", symbol: "✦", value: 40 }
  ],
  statusBadges: [
    { id: "survival", label: "S", tone: "green" },
    { id: "reputation", label: "R", tone: "red" },
    { id: "prestige", label: "P", tone: "purple" }
  ],
  encounter: {
    opponentName: "MrRed ур.12",
    buffsLabel: "Бафы:",
    health: { current: 251, maximum: 300, tone: "health" },
    energy: { current: 54, maximum: 100, tone: "energy" }
  },
  stats: [
    { id: "strength", label: "Strength", value: 333 },
    { id: "vitality", label: "Vitality", value: 333 },
    { id: "intuition", label: "Intuition", value: 333 },
    { id: "intelligence", label: "Intelligence", value: 333 },
    { id: "wisdom", label: "Wisdom", value: 333 },
    { id: "agility", label: "Agility", value: 333 }
  ],
  equipment: [
    { id: "earring-left", label: "серьга", side: "left", size: "small" },
    { id: "earring-right", label: "серьга", side: "left", size: "small" },
    { id: "amulet", label: "амулет", side: "left", size: "small" },
    { id: "weapon", label: "оруж.", side: "left", size: "large" },
    { id: "armor", label: "броня", side: "left", size: "large" },
    { id: "pants", label: "штаны", side: "left", size: "large" },
    { id: "helmet", label: "шлем", side: "right", size: "medium" },
    { id: "bracers", label: "наручи", side: "right", size: "small" },
    { id: "gloves", label: "перч.", side: "right", size: "small" },
    { id: "quick-one", label: "I", side: "right", size: "small" },
    { id: "quick-two", label: "II", side: "right", size: "small" },
    { id: "quick-three", label: "III", side: "right", size: "small" },
    { id: "belt", label: "пояс", side: "right", size: "small" },
    { id: "shield", label: "щит", side: "right", size: "large" },
    { id: "boots", label: "обувь", side: "right", size: "medium" }
  ],
  abilities: [
    { id: "quick-strike", name: "Быстрый выпад", icon: "/assets/character-page/abilities.png" },
    { id: "poison-blade", name: "Ядовитый клинок", icon: "/assets/character-page/market.png" },
    { id: "shadow-step", name: "Уход в тень", icon: "/assets/character-page/survival.png" }
  ],
  records: [
    { label: "Losses", value: 0 },
    { label: "Draw", value: 1 },
    { label: "Win", value: 222 }
  ],
  profileSections: [
    {
      title: "About me:",
      content: "30 лет, freelance, люблю игры и природу, науч. поп, пишу стихи. Любимая книга: Поколение Пэ. Живу в Токио, ищу жену в игре и реале."
    },
    { title: "Status:", content: "search wife" },
    { title: "Services:", content: "Лечу травмы: лёгкие — 3 ₭, средние — 10 ₭. Чары: исцеления (5%) — 50 ₭, усиления (4%) — 240 ₭." }
  ],
  actionTabs: ["Сумка", "Приемы"],
  chatTabs: ["Лог боя", "Чат", "События", "Личные"]
} satisfies CharacterPageData;

const characterProfiles: Readonly<Record<string, CharacterPageData>> = {
  mrred: {
    ...characterPageData,
    level: 12,
    stats: [
      { id: "strength", label: "Strength", value: 286 },
      { id: "vitality", label: "Vitality", value: 304 },
      { id: "intuition", label: "Intuition", value: 351 },
      { id: "intelligence", label: "Intelligence", value: 268 },
      { id: "wisdom", label: "Wisdom", value: 290 },
      { id: "agility", label: "Agility", value: 327 }
    ],
    records: [
      { label: "Losses", value: 9 },
      { label: "Draw", value: 14 },
      { label: "Win", value: 187 }
    ],
    profileSections: [
      {
        title: "About me:",
        content: "29 лет, ночной картограф из limbus City. Составляю маршруты через опасные кварталы, собираю редкие городские легенды и не пропускаю честные дуэли."
      },
      { title: "Status:", content: "online · ищу напарника для вылазки" },
      {
        title: "Services:",
        content: "Проводник по городу — 15 ₭. Карта тайников — 35 ₭. Помощь в дуэли: разведка слабостей — 70 ₭."
      }
    ]
  },
  nightfox: {
    ...characterPageData,
    level: 10,
    health: { current: 218, maximum: 260, tone: "health" },
    energy: { current: 88, maximum: 120, tone: "energy" },
    experience: { current: 22_400, maximum: 42_000, tone: "experience" },
    stats: [
      { id: "strength", label: "Strength", value: 198 },
      { id: "vitality", label: "Vitality", value: 224 },
      { id: "intuition", label: "Intuition", value: 332 },
      { id: "intelligence", label: "Intelligence", value: 241 },
      { id: "wisdom", label: "Wisdom", value: 257 },
      { id: "agility", label: "Agility", value: 368 }
    ],
    records: [
      { label: "Losses", value: 6 },
      { label: "Draw", value: 7 },
      { label: "Win", value: 143 }
    ],
    profileSections: [
      {
        title: "About me:",
        content: "27 лет, курьер ночных районов. Люблю скорость, механические головоломки и тихие крыши после дождя. В limbus City знаю короткие пути лучше городских стражей."
      },
      { title: "Status:", content: "online · доставляю заказы" },
      {
        title: "Services:",
        content: "Срочная доставка — 20 ₭. Поиск пропавшего груза — 45 ₭. Сопровождение по опасному маршруту — 90 ₭."
      }
    ]
  },
  ravenna: {
    ...characterPageData,
    level: 11,
    health: { current: 176, maximum: 240, tone: "health" },
    energy: { current: 136, maximum: 150, tone: "energy" },
    experience: { current: 31_600, maximum: 50_000, tone: "experience" },
    stats: [
      { id: "strength", label: "Strength", value: 176 },
      { id: "vitality", label: "Vitality", value: 208 },
      { id: "intuition", label: "Intuition", value: 294 },
      { id: "intelligence", label: "Intelligence", value: 377 },
      { id: "wisdom", label: "Wisdom", value: 361 },
      { id: "agility", label: "Agility", value: 231 }
    ],
    records: [
      { label: "Losses", value: 11 },
      { label: "Draw", value: 18 },
      { label: "Win", value: 166 }
    ],
    profileSections: [
      {
        title: "About me:",
        content: "31 год, алхимик и архивист. Изучаю свойства городской пыли, старые контракты и способы лечить то, что другие считают безнадёжным."
      },
      { title: "Status:", content: "online · принимаю у мастерской" },
      {
        title: "Services:",
        content: "Исцеление (5%) — 50 ₭. Усиление (4%) — 240 ₭. Определение редкого реагента — 80 ₭."
      }
    ]
  }
};

export function getCharacterPageData(characterName: string): CharacterPageData {
  return characterProfiles[characterName.trim().toLocaleLowerCase("ru-RU")] ?? characterPageData;
}
