export const ROLES = ["TEACHER", "STUDENT"] as const;
export type Role = (typeof ROLES)[number];

export const GRADES = ["3", "4", "5", "6", "7", "8", "9", "10", "11", "12"];

export const SUBJECT_COLORS: Record<string, string> = {
  teal: "#2f8f83",
  indigo: "#5b63d3",
  amber: "#d4962a",
  rose: "#d0587a",
  sky: "#3b93c9",
  violet: "#8a5cd1",
  emerald: "#3a9a5b",
  orange: "#d9733b",
};
export const SUBJECT_COLOR_KEYS = Object.keys(SUBJECT_COLORS);
export const subjectColor = (key: string) => SUBJECT_COLORS[key] ?? SUBJECT_COLORS.teal;

/** Quick-add suggestions for a CBSE class; teachers can add any subject. */
export const COMMON_SUBJECTS = ["Science", "Mathematics", "Social Science", "English", "Hindi", "Sanskrit"];

export const UPLOAD_MAX_BYTES = 15 * 1024 * 1024;
