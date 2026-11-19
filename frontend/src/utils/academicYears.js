/**
 * Multi-Year Academic Year Utility
 * Supports dynamic rolling years as well as extensive past and future calendar years.
 */

export const generateAcademicYears = () => {
  const currentYear = new Date().getFullYear();
  const start = Math.min(2023, currentYear - 2);
  const end = Math.max(2035, currentYear + 8);
  const list = [];
  for (let y = start; y <= end; y++) {
    list.push(`${y}-${y + 1}`);
  }
  return list;
};

export const ACADEMIC_YEARS = generateAcademicYears();
export const DEFAULT_ACADEMIC_YEAR = '2026-2027';
