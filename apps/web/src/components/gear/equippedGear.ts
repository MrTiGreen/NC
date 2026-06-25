export type EquippedSlotId =
  | "earring-left"
  | "earring-right"
  | "helmet"
  | "bracers"
  | "amulet"
  | "weapon"
  | "gloves"
  | "quick-one"
  | "quick-two"
  | "quick-three"
  | "armor"
  | "belt"
  | "shield"
  | "pants"
  | "boots";

export type EquippedGearItem = {
  id: string;
  slot: EquippedSlotId;
  name: string;
  icon: string;
  rarity: "common" | "rare" | "epic";
  description: string;
  requirements: readonly string[];
  properties: readonly string[];
  stats: ReadonlyArray<{ label: string; value: string }>;
  modifiers: readonly string[];
  armor?: string;
  damageReduction?: string;
};

export const equippedSlotLabels: Record<EquippedSlotId, string> = {
  "earring-left": "Серьга",
  "earring-right": "Серьга",
  amulet: "Амулет",
  weapon: "Оружие",
  armor: "Броня",
  pants: "Штаны",
  helmet: "Шлем",
  bracers: "Наручи",
  gloves: "Перчатки",
  "quick-one": "Быстрый 1",
  "quick-two": "Быстрый 2",
  "quick-three": "Быстрый 3",
  belt: "Пояс",
  shield: "Щит",
  boots: "Обувь"
};

export const equippedGearByOwner: Record<"player" | "enemy", ReadonlyArray<EquippedGearItem>> = {
  player: [
    {
      id: "dew-earring",
      slot: "earring-left",
      name: "Серьга росы",
      icon: "◈",
      rarity: "rare",
      description: "Тонкая серьга, сохраняющая холод дождя перед ударом.",
      requirements: ["Уровень: 3"],
      properties: ["Ловкость: +4", "Уклонение: +2%", "Сопротивление холоду: +3%"],
      stats: [{ label: "Ловкость", value: "+4" }, { label: "Уклонение", value: "+2%" }],
      modifiers: ["Сопротивление холоду +3%"]
    },
    {
      id: "wind-earring",
      slot: "earring-right",
      name: "Серьга ветра",
      icon: "◈",
      rarity: "rare",
      description: "Лёгкая серьга с тонкой серебряной цепочкой.",
      requirements: ["Уровень: 3"],
      properties: ["Скорость: +3", "Уклонение: +2%"],
      stats: [{ label: "Скорость", value: "+3" }, { label: "Уклонение", value: "+2%" }],
      modifiers: ["Скорость первого хода +2%"]
    },
    {
      id: "mist-amulet",
      slot: "amulet",
      name: "Амулет тумана",
      icon: "✦",
      rarity: "epic",
      description: "Старинный амулет, который скрывает намерение следующей атаки.",
      requirements: ["Мудрость: 12"],
      properties: ["Стойкость: +7", "Мана: +14", "Регенерация: +1 HP/мин"],
      stats: [{ label: "Стойкость", value: "+7" }, { label: "Мана", value: "+14" }],
      modifiers: ["Первый блок в раунде поглощает ещё 4 урона", "Скорость восстановления маны +5%"]
    },
    {
      id: "rain-blade",
      slot: "weapon",
      name: "Клинок дождя",
      icon: "⚔",
      rarity: "epic",
      description: "Клинок, заточенный для быстрых выпадов в тесном бою.",
      requirements: ["Сила: 18", "Ловкость: 20"],
      properties: ["Урон: +18", "Точность: +6", "Критический урон: +8%"],
      stats: [{ label: "Урон", value: "+18" }, { label: "Точность", value: "+6" }],
      modifiers: ["Критический урон +8%", "Урон по корпусу +4%"]
    },
    {
      id: "watch-helmet",
      slot: "helmet",
      name: "Шлем дозора",
      icon: "◒",
      rarity: "rare",
      description: "Закалённый шлем городской стражи с усиленной защитой лица.",
      requirements: ["Уровень: 8"],
      properties: ["Броня: +11", "Здоровье: +18"],
      stats: [{ label: "Броня", value: "+11" }, { label: "Здоровье", value: "+18" }],
      modifiers: ["Сопротивление критическому удару +3%"],
      armor: "11",
      damageReduction: "Голова: 4–7"
    },
    {
      id: "scout-bracers",
      slot: "bracers",
      name: "Наручи разведчика",
      icon: "⌁",
      rarity: "rare",
      description: "Гибкие наручи, не сковывающие кисть во время финта.",
      requirements: ["Ловкость: 14"],
      properties: ["Точность: +5", "Ловкость: +3"],
      stats: [{ label: "Точность", value: "+5" }, { label: "Ловкость", value: "+3" }],
      modifiers: ["Шанс контратаки +2%"]
    },
    {
      id: "steel-gloves",
      slot: "gloves",
      name: "Перчатки стали",
      icon: "⌁",
      rarity: "rare",
      description: "Плотные перчатки, защищающие кисти при блоке.",
      requirements: ["Ловкость: 12"],
      properties: ["Блок: +3%", "Точность: +3"],
      stats: [{ label: "Блок", value: "+3%" }, { label: "Точность", value: "+3" }],
      modifiers: ["Защита рук +4"]
    },
    {
      id: "wind-cuirass",
      slot: "armor",
      name: "Кираса ветра",
      icon: "⬡",
      rarity: "epic",
      description: "Лёгкая многослойная кираса для выживания в затяжном поединке.",
      requirements: ["Выносливость: 18"],
      properties: ["Броня: +22", "Стойкость: +6"],
      stats: [{ label: "Броня", value: "+22" }, { label: "Стойкость", value: "+6" }],
      modifiers: ["Получаемый урон от ног -3%", "Сопротивление кровотечению +6%"],
      armor: "22",
      damageReduction: "Корпус: 12–18"
    },
    {
      id: "watch-shield",
      slot: "shield",
      name: "Щит дозора",
      icon: "⬟",
      rarity: "rare",
      description: "Широкий щит, которым удобно закрывать корпус и живот.",
      requirements: ["Сила: 16"],
      properties: ["Блок: +9%", "Броня: +8"],
      stats: [{ label: "Блок", value: "+9%" }, { label: "Броня", value: "+8" }],
      modifiers: ["Успешный блок даёт 2 стойкости"],
      armor: "8",
      damageReduction: "Корпус/живот: 8–12"
    },
    {
      id: "ward-belt",
      slot: "belt",
      name: "Пояс стражи",
      icon: "◫",
      rarity: "rare",
      description: "Кожаный пояс с несколькими боевыми креплениями.",
      requirements: ["Выносливость: 10"],
      properties: ["Здоровье: +12", "Стойкость: +3"],
      stats: [{ label: "Здоровье", value: "+12" }, { label: "Стойкость", value: "+3" }],
      modifiers: ["Вместимость быстрых предметов +1"]
    },
    {
      id: "storm-greaves",
      slot: "pants",
      name: "Поножи грозы",
      icon: "▥",
      rarity: "rare",
      description: "Гибкие поножи, не мешающие уходить с линии удара.",
      requirements: ["Выносливость: 12"],
      properties: ["Броня: +9", "Ловкость: +4"],
      stats: [{ label: "Броня", value: "+9" }, { label: "Ловкость", value: "+4" }],
      modifiers: ["Защита ног +3%"],
      armor: "9",
      damageReduction: "Ноги: 5–8"
    },
    {
      id: "trail-boots",
      slot: "boots",
      name: "Обувь следопыта",
      icon: "◒",
      rarity: "rare",
      description: "Мягкая боевая обувь с цепкой подошвой.",
      requirements: ["Ловкость: 12"],
      properties: ["Скорость: +5", "Уклонение: +2%"],
      stats: [{ label: "Скорость", value: "+5" }, { label: "Уклонение", value: "+2%" }],
      modifiers: ["Сопротивление замедлению +4%"],
      armor: "5",
      damageReduction: "Ноги: 3–6"
    },
    {
      id: "ruby-potion",
      slot: "quick-one",
      name: "Зелье рубина",
      icon: "◉",
      rarity: "rare",
      description: "Боевой флакон с быстрым восстановлением сил.",
      requirements: ["Быстрый слот"],
      properties: ["Здоровье: +35", "Зарядов: 3"],
      stats: [{ label: "Здоровье", value: "+35" }, { label: "Зарядов", value: "3" }],
      modifiers: ["Использование не завершает ход"]
    },
    {
      id: "smoke-flask",
      slot: "quick-two",
      name: "Дымовой флакон",
      icon: "◌",
      rarity: "rare",
      description: "Флакон, сбивающий противнику прицел.",
      requirements: ["Быстрый слот"],
      properties: ["Уклонение: +8%", "Зарядов: 2"],
      stats: [{ label: "Уклонение", value: "+8%" }, { label: "Зарядов", value: "2" }],
      modifiers: ["Действует один раунд"]
    },
    {
      id: "ward-scroll",
      slot: "quick-three",
      name: "Свиток защиты",
      icon: "✷",
      rarity: "epic",
      description: "Одноразовый свиток с кругом отражения удара.",
      requirements: ["Быстрый слот"],
      properties: ["Блок: +12%", "Зарядов: 1"],
      stats: [{ label: "Блок", value: "+12%" }, { label: "Зарядов", value: "1" }],
      modifiers: ["Снимает один отрицательный эффект"]
    }
  ],
  enemy: []
};

export const enemyEquippedGear: ReadonlyArray<EquippedGearItem> = equippedGearByOwner.player.map((item) => ({
  ...item,
  id: `enemy-${item.id}`,
  name: item.name
    .replace("дождя", "угля")
    .replace("росы", "искры")
    .replace("ветра", "пепла")
    .replace("дозора", "Гестии")
    .replace("стражи", "дуэлянта"),
  description: item.description.replace("дождя", "угля").replace("городской стражи", "соперницы"),
  properties: item.properties.map((property) => property.replace("Ловкость", "Сила")),
  stats: item.stats.map((stat) => ({ ...stat, label: stat.label.replace("Ловкость", "Сила") }))
}));

equippedGearByOwner.enemy = enemyEquippedGear;

export function getEquippedGear(owner: "player" | "enemy") {
  return equippedGearByOwner[owner];
}

export function getEquippedGearBySlot(owner: "player" | "enemy") {
  return new Map(getEquippedGear(owner).map((item) => [item.slot, item]));
}
