export const BIRTH_CITIES = [
  "Арден",
  "Велиград",
  "Северный Предел",
  "Туманный Берег",
  "Серебряный Бор",
  "Рубеж Рассвета"
] as const;

export function assignBirthCity(random = Math.random) {
  return BIRTH_CITIES[Math.min(BIRTH_CITIES.length - 1, Math.floor(random() * BIRTH_CITIES.length))];
}

export function normalizeNickname(nickname: string) {
  return nickname.toLocaleLowerCase("ru-RU");
}
