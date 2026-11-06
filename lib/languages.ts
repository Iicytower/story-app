// Languages a folder can be written in: only those that both proofreading (LanguageTool) and
// the dictionary tools support (D58).
export const FOLDER_LANGUAGES = ["pl"] as const;

export type FolderLanguage = (typeof FOLDER_LANGUAGES)[number];

export const DEFAULT_FOLDER_LANGUAGE: FolderLanguage = "pl";

const LANGUAGETOOL_CODES: Record<FolderLanguage, string> = { pl: "pl-PL" };

export function isFolderLanguage(value: unknown): value is FolderLanguage {
  return (FOLDER_LANGUAGES as readonly unknown[]).includes(value);
}

// Folders without a language (all from before task 29) and values no longer offered are Polish.
export function folderLanguage(value: unknown): FolderLanguage {
  return isFolderLanguage(value) ? value : DEFAULT_FOLDER_LANGUAGE;
}

export function languageToolCode(language: FolderLanguage): string {
  return LANGUAGETOOL_CODES[language];
}

export interface FolderOption {
  name: string;
  language: FolderLanguage;
}

// Dialogs pick the folder by typed name; a name with no folder creates one, which starts
// in the default language.
export function languageOfFolder(
  folders: FolderOption[],
  name: string,
): FolderLanguage {
  const trimmed = name.trim();
  return (
    folders.find((folder) => folder.name === trimmed)?.language ??
    DEFAULT_FOLDER_LANGUAGE
  );
}
