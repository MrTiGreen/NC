import { CharacterAuditEventType, ItemCategory, ItemHandType, ItemRarity, Prisma, PrismaClient, WeaponType } from "@prisma/client";
import dotenv from "dotenv";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const scriptsDir = resolve(fileURLToPath(new URL(".", import.meta.url)));
const apiDir = resolve(scriptsDir, "..");
const rootDir = resolve(apiDir, "..", "..");
dotenv.config({ path: resolve(rootDir, ".env") });
dotenv.config({ path: resolve(apiDir, ".env"), override: true });

const prisma = new PrismaClient();

type CatalogItem = Prisma.ItemTemplateCreateInput;
const armor = (head: number, chest: number, abdomen: number, legs: number): Prisma.InputJsonValue => ({ HEAD: head, CHEST: chest, ABDOMEN: abdomen, LEGS: legs });
const properties = (...values: string[]): Prisma.InputJsonValue => values;
const requirements = (...values: string[]): Prisma.InputJsonValue => values;

const catalog: CatalogItem[] = [
  {
    slug: "night-watch-blade", name: "Клинок ночного дозора", category: ItemCategory.EQUIPMENT, icon: "⚔", displaySlot: "Оружие", description: "Сбалансированный клинок для патрулей ночных кварталов.", requirements: requirements("Уровень: 1", "Сила: 10"), properties: properties("Урон: 7–11", "Критический удар: +1%"), rarity: ItemRarity.COMMON, levelRequirement: 1, weaponType: WeaponType.SWORDS, handType: ItemHandType.ONE_HANDED, baseWeaponDamage: 9, modifiers: [{ type: "CRIT_CHANCE", value: 1 }]
  },
  {
    slug: "night-watch-hood", name: "Капюшон ночного дозора", category: ItemCategory.EQUIPMENT, icon: "◒", displaySlot: "Шлем", description: "Плотная ткань защищает голову и не мешает обзору.", requirements: requirements("Уровень: 1"), properties: properties("Интуиция: +1"), rarity: ItemRarity.COMMON, levelRequirement: 1, baseArmor: 2, armorByZone: armor(2, 0, 0, 0), modifiers: [{ type: "INTUITION", value: 1 }]
  },
  {
    slug: "night-watch-coat", name: "Куртка ночного дозора", category: ItemCategory.EQUIPMENT, icon: "▣", displaySlot: "Броня", description: "Лёгкая кожаная куртка для долгих ночных смен.", requirements: requirements("Уровень: 1"), properties: properties("Здоровье: +2"), rarity: ItemRarity.COMMON, levelRequirement: 1, baseArmor: 3, armorByZone: armor(0, 3, 2, 0), modifiers: [{ type: "VITALITY", value: 2 }]
  },
  {
    slug: "night-watch-belt", name: "Пояс ночного дозора", category: ItemCategory.EQUIPMENT, icon: "═", displaySlot: "Пояс", description: "Простой пояс с подсумком для мелочей.", requirements: requirements("Уровень: 1"), properties: properties("Сила: +1"), rarity: ItemRarity.COMMON, levelRequirement: 1, baseArmor: 1, armorByZone: armor(0, 0, 1, 0), modifiers: [{ type: "STRENGTH", value: 1 }]
  },
  {
    slug: "night-watch-trousers", name: "Брюки ночного дозора", category: ItemCategory.EQUIPMENT, icon: "▥", displaySlot: "Ноги", description: "Удобные брюки, рассчитанные на быстрый шаг.", requirements: requirements("Уровень: 1"), properties: properties("Ловкость: +1"), rarity: ItemRarity.COMMON, levelRequirement: 1, baseArmor: 2, armorByZone: armor(0, 0, 0, 2), modifiers: [{ type: "AGILITY", value: 1 }]
  },
  {
    slug: "night-watch-boots", name: "Ботинки ночного дозора", category: ItemCategory.EQUIPMENT, icon: "⌟", displaySlot: "Обувь", description: "Мягкая подошва уменьшает шум шагов.", requirements: requirements("Уровень: 1"), properties: properties("Уворот: +1%"), rarity: ItemRarity.COMMON, levelRequirement: 1, baseArmor: 1, armorByZone: armor(0, 0, 0, 1), modifiers: [{ type: "DODGE_CHANCE", value: 1 }]
  },
  {
    slug: "night-watch-buckler", name: "Баклер ночного дозора", category: ItemCategory.EQUIPMENT, icon: "⬡", displaySlot: "Щит", description: "Небольшой щит для защиты от внезапного удара.", requirements: requirements("Уровень: 1", "Сила: 10"), properties: properties("Блок: +1 зона"), rarity: ItemRarity.COMMON, levelRequirement: 1, handType: ItemHandType.SHIELD, shieldBlockZoneBonus: 1, baseArmor: 2, armorByZone: armor(0, 1, 1, 0)
  },
  {
    slug: "shadow-hunter-daggers", name: "Кинжалы охотника теней", category: ItemCategory.EQUIPMENT, icon: "⚔", displaySlot: "Оружие", description: "Парные кинжалы для быстрых выпадов из тени.", requirements: requirements("Уровень: 8", "Ловкость: 16"), properties: properties("Урон: 12–16", "Критический удар: +3%"), rarity: ItemRarity.RARE, levelRequirement: 8, weaponType: WeaponType.DAGGERS, handType: ItemHandType.ONE_HANDED, canDualWield: true, baseWeaponDamage: 14, modifiers: [{ type: "CRIT_CHANCE", value: 3 }]
  },
  {
    slug: "shadow-hunter-mask", name: "Маска охотника теней", category: ItemCategory.EQUIPMENT, icon: "◒", displaySlot: "Шлем", description: "Маска скрывает лицо и обостряет внимание.", requirements: requirements("Уровень: 8", "Интуиция: 14"), properties: properties("Интуиция: +2", "Уворот: +2%"), rarity: ItemRarity.RARE, levelRequirement: 8, baseArmor: 3, armorByZone: armor(3, 0, 0, 0), modifiers: [{ type: "INTUITION", value: 2 }, { type: "DODGE_CHANCE", value: 2 }]
  },
  {
    slug: "shadow-hunter-vest", name: "Жилет охотника теней", category: ItemCategory.EQUIPMENT, icon: "▣", displaySlot: "Броня", description: "Гибкие пластины защищают корпус и не стесняют движений.", requirements: requirements("Уровень: 8", "Ловкость: 14"), properties: properties("Броня: 5–8", "Снижение физического урона"), rarity: ItemRarity.RARE, levelRequirement: 8, baseArmor: 5, armorByZone: armor(0, 5, 3, 0), modifiers: [{ type: "DAMAGE_RESISTANCE", value: 2 }]
  },
  {
    slug: "shadow-hunter-belt", name: "Пояс охотника теней", category: ItemCategory.EQUIPMENT, icon: "═", displaySlot: "Пояс", description: "Пояс с креплениями для метательного оружия.", requirements: requirements("Уровень: 8"), properties: properties("Ловкость: +2"), rarity: ItemRarity.RARE, levelRequirement: 8, baseArmor: 2, armorByZone: armor(0, 0, 2, 0), modifiers: [{ type: "AGILITY", value: 2 }]
  },
  {
    slug: "shadow-hunter-leggings", name: "Поножи охотника теней", category: ItemCategory.EQUIPMENT, icon: "▥", displaySlot: "Ноги", description: "Усиленные поножи для манёвра в тесных переулках.", requirements: requirements("Уровень: 8"), properties: properties("Уворот: +2%"), rarity: ItemRarity.RARE, levelRequirement: 8, baseArmor: 3, armorByZone: armor(0, 0, 0, 3), modifiers: [{ type: "DODGE_CHANCE", value: 2 }]
  },
  {
    slug: "shadow-hunter-boots", name: "Сапоги охотника теней", category: ItemCategory.EQUIPMENT, icon: "⌟", displaySlot: "Обувь", description: "Сапоги с мягкой подошвой для бесшумного хода.", requirements: requirements("Уровень: 8"), properties: properties("Шанс контрудара: +2%"), rarity: ItemRarity.RARE, levelRequirement: 8, baseArmor: 2, armorByZone: armor(0, 0, 0, 2), modifiers: [{ type: "ANTI_DODGE", value: 2 }]
  },
  {
    slug: "shadow-hunter-parrying-dagger", name: "Парирующий кинжал", category: ItemCategory.EQUIPMENT, icon: "⌁", displaySlot: "Левая рука", description: "Клинок для отвода удара и немедленной контратаки.", requirements: requirements("Уровень: 8", "Ловкость: 16"), properties: properties("Шанс контрудара: +3%"), rarity: ItemRarity.RARE, levelRequirement: 8, weaponType: WeaponType.DAGGERS, handType: ItemHandType.ONE_HANDED, canDualWield: true, baseWeaponDamage: 8, modifiers: [{ type: "ANTI_DODGE", value: 3 }]
  },
  {
    slug: "arena-guard-sabre", name: "Сабля стража арены", category: ItemCategory.EQUIPMENT, icon: "⚔", displaySlot: "Оружие", description: "Тяжёлая сабля, которая особенно хороша в затяжной дуэли.", requirements: requirements("Уровень: 15", "Сила: 22"), properties: properties("Урон: 18–25", "Пробитие блока: +3%"), rarity: ItemRarity.EPIC, levelRequirement: 15, weaponType: WeaponType.SWORDS, handType: ItemHandType.ONE_HANDED, baseWeaponDamage: 21, modifiers: [{ type: "BLOCK_PIERCE_CHANCE", value: 3 }]
  },
  {
    slug: "arena-guard-helm", name: "Шлем стража арены", category: ItemCategory.EQUIPMENT, icon: "◒", displaySlot: "Шлем", description: "Закрытый шлем, выдерживающий сильные удары в голову.", requirements: requirements("Уровень: 15", "Сила: 20"), properties: properties("Броня: 7–10", "Сопротивление травмам: +3%"), rarity: ItemRarity.EPIC, levelRequirement: 15, baseArmor: 7, armorByZone: armor(7, 0, 0, 0), modifiers: [{ type: "INJURY_RESISTANCE", value: 3 }]
  },
  {
    slug: "arena-guard-cuirass", name: "Кираса стража арены", category: ItemCategory.EQUIPMENT, icon: "▣", displaySlot: "Броня", description: "Стальная кираса для сдерживания тяжёлых ударов.", requirements: requirements("Уровень: 15", "Сила: 22"), properties: properties("Броня: 10–14", "Снижение физического урона: +4%"), rarity: ItemRarity.EPIC, levelRequirement: 15, baseArmor: 10, armorByZone: armor(0, 10, 4, 0), modifiers: [{ type: "DAMAGE_RESISTANCE", value: 4 }]
  },
  {
    slug: "arena-guard-belt", name: "Пояс стража арены", category: ItemCategory.EQUIPMENT, icon: "═", displaySlot: "Пояс", description: "Широкий пояс фиксирует кирасу и защищает живот.", requirements: requirements("Уровень: 15", "Сила: 20"), properties: properties("Здоровье: +4"), rarity: ItemRarity.EPIC, levelRequirement: 15, baseArmor: 4, armorByZone: armor(0, 0, 4, 0), modifiers: [{ type: "VITALITY", value: 4 }]
  },
  {
    slug: "arena-guard-greaves", name: "Поножи стража арены", category: ItemCategory.EQUIPMENT, icon: "▥", displaySlot: "Ноги", description: "Ламеллярные поножи сохраняют устойчивость в бою.", requirements: requirements("Уровень: 15", "Сила: 20"), properties: properties("Броня: 6–9"), rarity: ItemRarity.EPIC, levelRequirement: 15, baseArmor: 6, armorByZone: armor(0, 0, 0, 6)
  },
  {
    slug: "arena-guard-boots", name: "Сапоги стража арены", category: ItemCategory.EQUIPMENT, icon: "⌟", displaySlot: "Обувь", description: "Тяжёлые сапоги дают устойчивость при защите.", requirements: requirements("Уровень: 15", "Сила: 18"), properties: properties("Шанс контрудара: +3%"), rarity: ItemRarity.EPIC, levelRequirement: 15, baseArmor: 3, armorByZone: armor(0, 0, 0, 3), modifiers: [{ type: "ANTI_DODGE", value: 3 }]
  },
  {
    slug: "arena-guard-shield", name: "Щит стража арены", category: ItemCategory.EQUIPMENT, icon: "⬡", displaySlot: "Щит", description: "Большой щит для удержания линии в бою.", requirements: requirements("Уровень: 15", "Сила: 22"), properties: properties("Блок: +2 зоны", "Броня: 5–8"), rarity: ItemRarity.EPIC, levelRequirement: 15, handType: ItemHandType.SHIELD, shieldBlockZoneBonus: 2, baseArmor: 5, armorByZone: armor(0, 3, 2, 0)
  }
];

async function main() {
  const templates = await prisma.$transaction(catalog.map((item) => prisma.itemTemplate.upsert({ where: { slug: item.slug }, create: item, update: item })));
  const profile = await prisma.playerProfile.findUnique({ where: { nicknameNormalized: "mrgreen" }, select: { id: true } });

  if (profile) {
    for (const template of templates) {
      const existing = await prisma.itemInstance.findFirst({ where: { characterId: profile.id, templateId: template.id } });
      if (!existing) {
        const instance = await prisma.itemInstance.create({ data: { characterId: profile.id, templateId: template.id } });
        await prisma.characterAuditLog.create({
          data: {
            characterId: profile.id,
            eventType: CharacterAuditEventType.ITEM_GRANTED,
            summary: `Выдан предмет "${template.name}" из seed-каталога.`,
            afterState: { itemInstanceId: instance.id, templateId: template.id, quantity: instance.quantity },
            metadata: { source: "seed-item-catalog", templateSlug: template.slug },
            relatedItemInstanceId: instance.id
          }
        });
      }
    }
  }

  console.table([
    { set: "Ночной дозор", items: 7 },
    { set: "Охотник теней", items: 7 },
    { set: "Страж арены", items: 7 }
  ]);
  console.log(`Каталог: ${templates.length} предметов${profile ? "; наборы выданы MrGreen" : "; профиль MrGreen не найден, предметы не выдавались"}.`);
}

main().catch((error) => { console.error(error); process.exitCode = 1; }).finally(async () => { await prisma.$disconnect(); });
