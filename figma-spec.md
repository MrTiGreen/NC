# NightClub Mobile RPG UI — implementation specification

## Evidence and scope

- Local source inspected: `NightClub Mobile RPG UI Sample/FigmaHTML/figma-to-html (1)/index.html` and `css/main.css`.
- This is a Figma-to-HTML export, not a live `figma-bridge` response. It supplies exact exported CSS geometry, paints, text, and asset references.
- The export root is `v22_154`, which corresponds to the supplied Figma node reference `22:154`. The other supplied node, `1:2`, remains unverified because `figma-bridge` has no connected file in this session.
- The HTML is flat: `v22_154` has 111 direct absolute-positioned child layers. It contains no semantic subframe hierarchy and no auto-layout metadata.
- `box-sizing: border-box` is global. The document body only declares `font-size: 14px`; typography is otherwise defined per text layer where exported.

## Root frame

| Property | Exported value |
| --- | --- |
| Layer | `v22_154` |
| Size | `430 × 932 px` |
| Position | `x: 0`, `y: 0` |
| Positioning | `absolute` |
| Fill | `rgba(6, 7, 6, 1)` / `#060706` |
| Opacity | `1` |
| Corner radius | `16 px` on all corners |
| Clipping | `overflow: hidden` |
| Layout | No auto-layout, flex, grid, or constraints encoded |

## Shared visual tokens

| Purpose | Exact exported value |
| --- | --- |
| Main gold border | `1px solid rgba(154,117,32,1)` / `#9A7520` |
| Bright gold accent/border | `rgba(214,168,74,1)` / `#D6A84A` |
| Light gold border | `rgba(254,213,128,1)` / `#FED580` |
| Panel fill | `rgba(13,10,6,1)` / `#0D0A06`; variants use alpha `.96` and `.98` |
| Item-slot fill | `rgba(19,15,10,.96)` / `#130F0A`; ability buttons use alpha `.90` |
| Secondary dark fill | `rgba(28,22,15,1)` / `#1C160F`; stat-bar tracks use alpha `.65` |
| Main muted text | `rgba(143,118,80,1)` / `#8F7650` |
| Light text | `rgba(216,193,138,1)` / `#D8C18A` |
| Health fill | `rgba(198,83,53,1)` / `#C65335` |
| Mana fill | `rgba(59,121,168,1)` / `#3B79A8` |
| Green | `rgba(63,157,88,1)` / `#3F9D58` |
| Purple | `rgba(125,78,166,1)` / `#7D4EA6` |
| White / off-white | `#FFFFFF`, `#F2F2F7` |
| Gradients | None exported |
| Effects | Only `v22_172`: `0 4px 4px rgba(0,0,0,.25)` |

## Typography

- Imported web font: `Inter` from Google Fonts.
- Exported values have no `line-height` or `letter-spacing` declarations. Use normal browser values only if reproducing the exported HTML exactly; these values are otherwise missing.
- All text layers have `opacity: 1`; no text-layer shadows, strokes, gradients, or text transforms are exported.
- `v22_287` has no font family, weight, or size declaration. Only its color, position, width, opacity, and left alignment are available; it inherits the browser/default font settings except for the body `font-size: 14px`.

| Text style | Layers | Exact typography |
| --- | --- | --- |
| Header name | `v22_157` | Inter Medium, 14px, `#3F9D58`, left |
| Opponent name | `v22_293` | Inter Medium, 20px, `#3F9D58`, left |
| Small bar labels | `v22_160`, `v22_163` | Inter Medium, 7px, `#D8C18A`, left |
| Currency | `v22_164` | Inter Bold, 20px, `#D6A84A`, left |
| Star currency | `v22_165` | Inter Medium, 20px, `#8F7650`, left |
| S/R/P badges | `v22_167`, `v22_169`, `v22_171` | Inter Bold, 12px, centered; `S #3F9D58`, `R #C65335`, `P #7D4EA6` |
| Experience label | `v22_174` | Inter Bold, 8px, `#000000`, centered |
| Section labels | `v22_185`, `v22_186`, `v22_188`, `v22_189` | Inter Medium, 16px, `#8F7650`, left |
| Attribute labels | `v22_219`–`v22_224` | Inter Medium, 16px, `#8F7650`, left |
| Attribute values | `v22_233`–`v22_238` | Inter Bold, 16px, centered; `#FFFFFF` except `v22_235` and `v22_238`: `#F2F2F7` |
| Win/draw/loss labels | `v22_216`–`v22_218` | Inter Medium, 20px, `#8F7650`, centered |
| Win/draw/loss values | `v22_213`–`v22_215` | Inter Bold, 20px, left; `v22_213 #FFFFFF` at alpha `.74`, `v22_214 #F2F2F7`, `v22_215 #FFFFFF` |
| Equipment labels | `v29_79`, `v29_80`, `v29_82`, `v29_84`, `v29_86`, `v29_88`, `v29_90`, `v29_92`, `v29_94` | Inter Medium, 7px, `#8F7650`, centered |
| Equipment headings | `v29_70`, `v29_71` | Inter Bold, 11px, `#D6A84A`, left |
| Tab labels | `v36_98` | Inter Bold, 10px, `#D6A84A`, centered; `v36_100`, `v36_102`, `v36_104` Inter Medium, 10px, `#8F7650`, centered |
| Chat summary and buff label | `v22_273`, `v36_121` | Inter Medium, 10px, `#8F7650`; summary left, buff centered |
| Placeholder | `v36_172` | Inter Regular, 11px, `#8F7650`, left |
| Gifts / About / Market labels | `v29_116`, `v2015_739`, `v2015_746` | Inter Medium, 20px, `#8F7650`, centered |

## Assets

All image layers use `background-repeat: no-repeat`, centered positioning, `background-size: cover`, and opacity `1`.

| Layer | Source asset | Natural size | Display bounds |
| --- | --- | --- | --- |
| `v36_173` | `images/v36_173.png` | `43 × 41 px` | `x:368, y:872, 43 × 41 px` |
| `v2013_312` | `images/v2013_312.png` | `512 × 512 px` | `x:23, y:759, 40 × 25 px` |
| `v2013_313` | `images/v2013_313.png` | `512 × 512 px` | `x:324, y:762, 40 × 25 px` |
| `v2013_314` | `images/v2013_314.png` | `512 × 512 px` | `x:375, y:762, 40 × 25 px` |
| `v2013_732` | `images/v2013_732.png` | `116 × 154 px` | `x:10, y:10, 50 × 50 px`; gold 1px border, 200px corner radii |
| `v2025_31` | `images/v2025_31.png` | `887 × 1774 px` | `x:60, y:95, 148 × 296 px` |

## Layer manifest — visible within the exported root

Coordinates are relative to `v22_154`. `auto` means the CSS does not declare that dimension. All listed layers are `position: absolute` and `opacity: 1`.

### Header and progress

| Layer | Type / content | x, y | Width × height | Fill / border / radius |
| --- | --- | --- | --- | --- |
| `v22_155` | header panel | `6, 7` | `418 × 66` | `#0D0A06` alpha `.96`; main gold 1px; 10px |
| `v22_157` | `MrGreen · ур.12` | `74, 12` | `120 × auto` | typography above |
| `v22_164` | `₭ 1 250` | `285, 13` | `135 × auto` | typography above |
| `v22_166` | square badge background | `189, 11` | `20 × 20` | `#130F0A`; green 1px; square |
| `v22_167` | `S` | `194, 13` | `10 × auto` | typography above |
| `v22_168` | round badge background | `210, 11` | `20 × 20` | `#130F0A`; 50% radius |
| `v22_169` | `R` | `211, 13` | `18 × auto` | typography above |
| `v22_170` | round badge background | `231, 11` | `20 × 20` | `#130F0A`; 50% radius |
| `v22_171` | `P` | `232, 13` | `19 × auto` | typography above |
| `v22_158` | health track | `70, 34` | `206 × 10` | `#1C160F` alpha `.65`; main gold 1px; 7px |
| `v22_159` | health fill | `71, 35` | `154 × 8` | `#C65335`; 6px |
| `v22_160` | `251/300` | `74, 35` | `88 × auto` | typography above |
| `v22_165` | `✦ 40` | `284, 35` | `66 × auto` | typography above |
| `v22_161` | mana track | `70, 47` | `206 × 10` | `#1C160F` alpha `.65`; main gold 1px; 7px |
| `v22_162` | mana fill | `71, 48` | `67 × 8` | `#3B79A8`; 6px |
| `v22_163` | `54/100` | `74, 48` | `35 × auto` | typography above |
| `v22_172` | experience track | `6, 62` | `418 × 11` | black alpha `.55`; main gold 1px; shadow `0 4px 4px rgba(0,0,0,.25)` |
| `v22_173` | experience fill | `6, 63` | `263 × 9` | `#D6A84A` alpha `.95`; lower corners 10px |
| `v22_174` | `EXP 37 800 / 60 000` | `14, 62` | `130 × auto` | typography above |

### Character and combat statistics

| Layer | Type / content | x, y | Width × height | Fill / border / radius |
| --- | --- | --- | --- | --- |
| `v22_293` | `MrRed ур.12` | `77, 79` | `120 × auto` | typography above |
| `v36_121` | `Бафы:` | `190, 81` | `55 × auto` | typography above |
| `v2025_31` | character image | `60, 95` | `148 × 296` | asset listed above |
| `v29_76` | equipment slot | `9, 105` | `31 × 25` | item-slot fill; main gold 1px; 6px |
| `v29_72` | equipment slot | `42, 105` | `31 × 25` | item-slot fill; main gold 1px; 6px |
| `v29_97` | equipment slot | `9, 133` | `64 × 20` | item-slot fill; main gold 1px; 6px |
| `v29_87` | helmet slot | `191, 105` | `65 × 45` | item-slot fill; main gold 1px; 6px |
| `v29_88` | `шлем` | `193, 121` | `58 × auto` | typography above |
| `v22_219` | `Strength` | `271, 105` | `71 × auto` | typography above |
| `v22_234` | `333` | `360, 107` | `60 × auto` | typography above |
| `v22_224` | `Agility` | `271, 137` | `71 × auto` | typography above |
| `v22_233` | `333` | `360, 138` | `60 × auto` | typography above |
| `v29_93` | bracer slot | `191, 153` | `65 × 25` | item-slot fill; main gold 1px; 6px |
| `v29_94` | `наручи` | `196, 162` | `55 × auto` | typography above |
| `v29_78` | weapon slot | `9, 156` | `65 × 70` | item-slot fill; main gold 1px; 6px |
| `v29_79` | `оруж.` | `12, 189` | `57 × auto` | typography above |
| `v22_220` | `Vitality` | `271, 168` | `71 × auto` | typography above |
| `v22_235` | `333` | `360, 168` | `60 × auto` | typography above |
| `v29_91` | glove slot | `191, 180` | `65 × 35` | item-slot fill; main gold 1px; 6px |
| `v29_92` | `перч.` | `197, 192` | `56 × auto` | typography above |
| `v22_221` | `Intuition` | `271, 200` | `71 × auto` | typography above |
| `v22_236` | `333` | `360, 202` | `60 × auto` | typography above |
| `v29_75` | equipment slot | `191, 217` | `20 × 20` | item-slot fill; main gold 1px; 6px |
| `v29_74` | equipment slot | `214, 217` | `20 × 20` | item-slot fill; main gold 1px; 6px |
| `v29_77` | equipment slot | `237, 217` | `20 × 20` | item-slot fill; main gold 1px; no radius exported |
| `v29_89` | armour slot | `9, 228` | `65 × 75` | item-slot fill; main gold 1px; 6px |
| `v29_90` | `броня` | `13, 257` | `57 × auto` | typography above |
| `v22_222` | `Intelligence` | `271, 231` | `100 × auto` | typography above |
| `v22_237` | `333` | `361, 233` | `60 × auto` | typography above |
| `v29_81` | belt slot | `191, 239` | `66 × 23` | item-slot fill; main gold 1px; 6px |
| `v29_82` | `пояс` | `196, 245` | `54 × auto` | typography above |
| `v22_223` | `Wisdom` | `271, 262` | `71 × auto` | typography above |
| `v29_73` | shield slot | `191, 264` | `65 × 75` | item-slot fill; main gold 1px; 6px |
| `v22_238` | `333` | `361, 263` | `60 × auto` | typography above |
| `v29_80` | `щит` | `196, 305` | `56 × auto` | typography above |
| `v29_83` | trousers slot | `9, 307` | `65 × 68` | item-slot fill; main gold 1px; 6px |
| `v29_84` | `штаны` | `13, 338` | `55 × auto` | typography above |
| `v22_218` | `Win:` | `244, 304` | `97 × auto` | typography above |
| `v22_215` | `222` | `351, 304` | `67 × auto` | typography above |
| `v22_216` | `Losses:` | `256, 332` | `103 × auto` | typography above |
| `v22_214` | `1` | `351, 332` | `67 × auto` | typography above |
| `v29_85` | footwear slot | `191, 341` | `65 × 34` | item-slot fill; main gold 1px; 6px |
| `v29_86` | `обувь` | `196, 353` | `56 × auto` | typography above |
| `v22_217` | `Draw:` | `233, 363` | `132 × auto` | typography above |
| `v22_213` | `0` | `351, 362` | `67 × auto` | typography above |

### Equipment actions and profile tabs

| Layer | Type / content | x, y | Width × height | Fill / border / radius |
| --- | --- | --- | --- | --- |
| `v29_70` | `Сумка` | `38, 379` | `39 × auto` | typography above |
| `v29_71` | `Приемы` | `182, 380` | `48 × auto` | typography above |
| `v29_96` | equipment action slot | `9, 396` | `30 × 25` | item-slot fill; main gold 1px; 6px |
| `v29_95` | equipment action slot | `44, 396` | `30 × 25` | item-slot fill; main gold 1px; 6px |
| `v29_100` | equipment action slot | `79, 396` | `30 × 25` | item-slot fill; main gold 1px; no radius exported |
| `v29_103` | equipment action slot | `156, 397` | `30 × 25` | item-slot fill; main gold 1px; 6px |
| `v29_101` | equipment action slot | `191, 397` | `30 × 25` | item-slot fill; main gold 1px; 6px |
| `v29_102` | equipment action slot | `226, 397` | `30 × 25` | item-slot fill; main gold 1px; no radius exported |
| `v22_185` | `Merits:` | `27, 434` | `54 × auto` | typography above |
| `v2015_738` | About tab background | `24, 466` | `80 × 25` | `#1C160F`; light-gold 1px; 6px |
| `v2015_739` | `About` | `29, 466` | `70 × auto` | typography above |
| `v2015_734` | Gifts tab background | `110, 466` | `71 × 25` | `#1C160F`; bright-gold 1px; 6px |
| `v29_116` | `Gifts` | `110, 466` | `70 × auto` | typography above |
| `v2015_741` | MyMarket tab background | `193, 466` | `106 × 25` | `#1C160F`; bright-gold 1px; 6px |
| `v2015_746` | `MyMarket` | `195, 466` | `103 × auto` | typography above |
| `v22_188` | `Status:` | `32, 497` | `68 × auto` | typography above |
| `v22_189` | `search wife` | `88, 497` | `127 × auto` | typography above |
| `v22_186` | `About me:` | `32, 529` | `78 × auto` | typography above |
| `v22_287` | profile description, healing and spells text | `28, 535` | `387 × auto` | `#8F7650`; font details missing as described above |

### Chat panel

| Layer | Type / content | x, y | Width × height | Fill / border / radius |
| --- | --- | --- | --- | --- |
| `v22_271` | chat panel | `6, 755` | `418 × 165` | `#0D0A06` alpha `.98`; main gold 1px; 10px |
| `v22_272` | drag handle | `178, 759` | `78 × 4` | `#9A7520` alpha `.45`; 2px |
| `v2013_312` | tab icon asset | `23, 759` | `40 × 25` | asset listed above |
| `v2013_313` | tab icon asset | `324, 762` | `40 × 25` | asset listed above |
| `v2013_314` | tab icon asset | `375, 762` | `40 × 25` | asset listed above |
| `v36_97` | selected tab background | `20, 792` | `86 × 25` | `#1C160F`; bright-gold 1px; 6px |
| `v36_98` | `Лог боя` | `20, 799` | `86 × auto` | typography above |
| `v36_99` | chat tab background | `121, 792` | `86 × 25` | `#0D0A06`; main gold 1px; 6px |
| `v36_100` | `Чат` | `121, 799` | `86 × auto` | typography above |
| `v36_101` | events tab background | `222, 792` | `86 × 25` | `#0D0A06`; main gold 1px; 6px |
| `v36_102` | `События` | `222, 799` | `86 × auto` | typography above |
| `v36_103` | private tab background | `324, 792` | `86 × 25` | `#0D0A06`; main gold 1px; 6px |
| `v36_104` | `Личные` | `324, 799` | `86 × auto` | typography above |
| `v22_273` | `Чат · Лог боя · События` | `21, 847` | `210 × auto` | typography above |
| `v36_173` | send/control icon asset | `368, 872` | `43 × 41` | asset listed above |
| `v36_171` | message input background | `17, 875` | `336 × 36` | black alpha `.45`; main gold 1px; 6px |
| `v36_172` | `Введите сообщение...` | `29, 884` | `260 × auto` | typography above |

### Exported but clipped by the root frame

These ten layers have `y ≥ 1014`; `v22_154` clips them because its height is 932px and `overflow: hidden`. They are present in the export but not visible in the exported root frame.

| Layer | Type / content | x, y | Width × height | Fill / border / radius |
| --- | --- | --- | --- | --- |
| `v22_203` | survival track | `36, 1014` | `358 × 8` | black alpha `.35`; main gold 1px; 4px |
| `v22_204` | survival fill | `37, 1015` | `178 × 6` | `#D6A84A` alpha `.90`; 3px |
| `v22_205` | `Выживание: еда, болезни, регенерация` | `36, 1024` | `358 × auto` | Inter Medium 8px, `#8F7650`, left |
| `v22_206` | `Активные способности` | `34, 1052` | `362 × auto` | Inter Bold 12px, `#D6A84A`, left |
| `v22_207` | ability button background | `34, 1080` | `110 × 34` | `#130F0A` alpha `.90`; main gold 1px; 6px |
| `v22_208` | `Быстрый выпад` | `40, 1089` | `98 × auto` | Inter Bold 9px, `#D8C18A`, centered |
| `v22_209` | ability button background | `157, 1080` | `110 × 34` | `#130F0A` alpha `.90`; main gold 1px; 6px |
| `v22_210` | `Ядовитый клинок` | `163, 1089` | `98 × auto` | Inter Bold 9px, `#D8C18A`, centered |
| `v22_211` | ability button background | `280, 1080` | `110 × 34` | `#130F0A` alpha `.90`; main gold 1px; 6px |
| `v22_212` | `Уход в тень` | `286, 1089` | `98 × auto` | Inter Bold 9px, `#D8C18A`, centered |

## Export limitations that remain missing

- Figma page names, parent/component hierarchy, component properties, variants, layout constraints, and design variables are not available from this flat HTML export.
- No height, line height, letter spacing, or paragraph spacing is defined for text layers unless explicitly listed above; text dimensions therefore cannot be recovered exactly.
- Asset layer names are exported as opaque IDs. Their intended semantic names are not encoded.
- The source contains no interaction, hover, pressed, disabled, responsive, or animation state definitions.
