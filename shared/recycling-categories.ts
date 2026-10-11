export const recyclingCategories = [
  'Mobile Phones',
  'Tablets',
  'Laptops',
  'Desktop Computers',
  'Monitors',
  'Printers',
  'Computer Components',
  'Electronic Components',
  'Batteries',
  'Chargers and Cables',
  'Small Household Electronics',
] as const;

const categoryAliases: Record<string, (typeof recyclingCategories)[number] | 'IT Equipment'> = {
  'mobile phone': 'Mobile Phones',
  'mobile phones': 'Mobile Phones',
  smartphone: 'Mobile Phones',
  smartphones: 'Mobile Phones',
  phone: 'Mobile Phones',
  phones: 'Mobile Phones',
  tablet: 'Tablets',
  tablets: 'Tablets',
  laptop: 'Laptops',
  laptops: 'Laptops',
  notebook: 'Laptops',
  notebooks: 'Laptops',
  'desktop computer': 'Desktop Computers',
  'desktop computers': 'Desktop Computers',
  desktop: 'Desktop Computers',
  desktops: 'Desktop Computers',
  'office computer': 'Desktop Computers',
  'office computers': 'Desktop Computers',
  'computer monitor': 'Monitors',
  monitors: 'Monitors',
  monitor: 'Monitors',
  printer: 'Printers',
  printers: 'Printers',
  'computer component': 'Computer Components',
  'computer components': 'Computer Components',
  'computer equipment': 'Computer Components',
  peripheral: 'Computer Components',
  peripherals: 'Computer Components',
  keyboard: 'Computer Components',
  keyboards: 'Computer Components',
  mouse: 'Computer Components',
  mice: 'Computer Components',
  'keyboard and mouse': 'Computer Components',
  'keyboards and mice': 'Computer Components',
  'it equipment': 'IT Equipment',
  'electronic component': 'Electronic Components',
  'electronic components': 'Electronic Components',
  'circuit board': 'Electronic Components',
  'circuit boards': 'Electronic Components',
  battery: 'Batteries',
  batteries: 'Batteries',
  'battery containing devices': 'Batteries',
  charger: 'Chargers and Cables',
  chargers: 'Chargers and Cables',
  cable: 'Chargers and Cables',
  cables: 'Chargers and Cables',
  'chargers and cables': 'Chargers and Cables',
  'electrical component': 'Electronic Components',
  'electrical components': 'Electronic Components',
  'small household electronic': 'Small Household Electronics',
  'small household electronics': 'Small Household Electronics',
  'consumer electronics': 'Small Household Electronics',
  'supported electronic devices': 'Small Household Electronics',
  'small electronic': 'Small Household Electronics',
  'small electronics': 'Small Household Electronics',
};

function normalizeLabel(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

export function canonicalRecyclingCategory(value: string) {
  const normalized = normalizeLabel(value);
  return categoryAliases[normalized] ?? null;
}

export function parseRecyclingCategories(value: string) {
  return value
    .split(',')
    .map((category) => canonicalRecyclingCategory(category.trim()))
    .filter((category): category is NonNullable<typeof category> => category !== null);
}

export function categoryForDeviceType(value: string) {
  return canonicalRecyclingCategory(value);
}
