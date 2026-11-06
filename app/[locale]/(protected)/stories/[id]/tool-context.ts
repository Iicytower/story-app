import { createContext, useContext } from "react";

// What a tool working on the open chapter gets from the editor.
export interface EditorTool {
  storyId: string;
  // The folder's language (D58).
  lang: string;
  // Saves pending edits first; resolves to an error message, or null when saved.
  prepare: () => Promise<string | null>;
  content: () => string;
  // Closes the dialog, then writes the content through the editor (one Undo) and saves it.
  apply: (markdown: string) => void;
  close: () => void;
}

export const EditorToolContext = createContext<EditorTool | null>(null);

// Tools render only inside the editor's ToolDialog, which provides the context.
export const useEditorTool = () => useContext(EditorToolContext)!;
