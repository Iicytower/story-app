import type { ProofreadIssue } from "@/lib/proofreading/languagetool";
import { createContext, useContext } from "react";

// What a tool working on the open chapter gets from the editor.
export interface EditorTool {
  storyId: string;
  // The folder's language (D58).
  lang: string;
  // Saves pending edits first; resolves to an error message, or null when saved.
  prepare: () => Promise<string | null>;
  content: () => string;
  // Whether the chapter has an open proofreading (task 55).
  proofreading: boolean;
  // Marks the issues in the chapter's editor and, when any fit, closes the dialog and
  // focuses them; resolves to how many fit.
  startProofreading: (markdown: string, issues: ProofreadIssue[]) => number;
}

export const EditorToolContext = createContext<EditorTool | null>(null);

// Tools render only inside the editor's ToolDialog, which provides the context.
export const useEditorTool = () => useContext(EditorToolContext)!;
