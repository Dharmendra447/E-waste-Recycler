import { canonicalRecyclingCategory, parseRecyclingCategories } from '../shared/recycling-categories.js';

export function supportsRecyclerCategory(acceptedCategories: string, requestedCategory: string) {
  if (!requestedCategory.trim()) return true;
  const requested = canonicalRecyclingCategory(requestedCategory);
  if (!requested) return false;

  const accepted = new Set(parseRecyclingCategories(acceptedCategories));
  if (accepted.has(requested)) return true;

  // Legacy "IT Equipment" profiles explicitly cover the common IT device categories.
  if (accepted.has('IT Equipment')) {
    return ['Laptops', 'Desktop Computers', 'Monitors', 'Printers', 'Computer Components'].includes(requested);
  }
  return false;
}
