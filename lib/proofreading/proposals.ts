import { Extension } from "@tiptap/core";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import type { DocIssue } from "./map";

// A placed issue waiting for a decision; `choice` is the suggestion shown as the insertion.
export interface Proposal extends DocIssue {
  choice: number;
}

// An applied suggestion in the markdown source's terms (LT offsets).
export interface SourceEdit {
  offset: number;
  length: number;
  text: string;
}

export interface ProposalsState {
  proposals: Proposal[];
  selected: number | null;
  applied: SourceEdit[];
  // Any change other than ✓ (typing, Undo): the source then can't be patched by offsets.
  edited: boolean;
}

const EMPTY: ProposalsState = {
  proposals: [],
  selected: null,
  applied: [],
  edited: false,
};

type Action =
  | { type: "load"; issues: DocIssue[] }
  | { type: "remove"; id: number }
  | { type: "apply"; id: number; text: string }
  | { type: "choose"; id: number; choice: number }
  | { type: "select"; id: number };

export const proposalsKey = new PluginKey<ProposalsState>("proofreadProposals");

export const REMOVED_CLASS = "rounded-xs bg-diff-removed";
export const NOTE_CLASS = "rounded-xs bg-proofread-note";
export const ADDED_CLASS = "rounded-xs bg-diff-added";
const SELECTED_CLASS = "ring-2 ring-ring";

export function suggestion(proposal: Proposal): string | undefined {
  return proposal.issue.replacements[proposal.choice];
}

// An edit inside a proposal's text drops it: the suggestion no longer fits.
function mapProposals(proposals: Proposal[], tr: Transaction): Proposal[] {
  return proposals.flatMap((proposal) => {
    const from = tr.mapping.map(proposal.from, 1);
    const to = tr.mapping.map(proposal.to, -1);
    if (to <= from || tr.doc.textBetween(from, to) !== proposal.original)
      return [];
    return [{ ...proposal, from, to }];
  });
}

function reduce(state: ProposalsState, action: Action): ProposalsState {
  switch (action.type) {
    case "load":
      return {
        ...EMPTY,
        proposals: action.issues.map((issue) => ({ ...issue, choice: 0 })),
        selected: action.issues[0]?.id ?? null,
      };
    case "apply": {
      const proposal = state.proposals.find(({ id }) => id === action.id);
      if (!proposal) return state;
      const { issue } = proposal;
      return {
        ...reduce(state, { type: "remove", id: action.id }),
        applied: [
          ...state.applied,
          { offset: issue.offset, length: issue.length, text: action.text },
        ],
      };
    }
    case "remove": {
      const index = state.proposals.findIndex(({ id }) => id === action.id);
      if (index === -1) return state;
      const proposals = state.proposals.toSpliced(index, 1);
      // The next one in the text becomes current, so decisions go top to bottom.
      const next = proposals[Math.min(index, proposals.length - 1)];
      return {
        ...state,
        proposals,
        selected:
          state.selected === action.id ? (next?.id ?? null) : state.selected,
      };
    }
    case "choose":
      return {
        ...state,
        proposals: state.proposals.map((proposal) =>
          proposal.id === action.id
            ? { ...proposal, choice: action.choice }
            : proposal,
        ),
      };
    case "select":
      return { ...state, selected: action.id };
  }
}

export function proposalsState(state: EditorState): ProposalsState {
  return proposalsKey.getState(state) ?? EMPTY;
}

// The proposal the panel shows: the selected one, or the first left after edits removed it.
export function currentProposal(state: ProposalsState): Proposal | undefined {
  return (
    state.proposals.find(({ id }) => id === state.selected) ??
    state.proposals[0]
  );
}

const act = (view: EditorView, action: Action, tr = view.state.tr) =>
  view.dispatch(tr.setMeta(proposalsKey, action));

export function loadProposals(view: EditorView, issues: DocIssue[]) {
  // Not an edit: Undo must not take the proposals away.
  act(
    view,
    { type: "load", issues },
    view.state.tr.setMeta("addToHistory", false),
  );
}

export function selectProposal(view: EditorView, id: number) {
  act(view, { type: "select", id });
}

export function chooseSuggestion(view: EditorView, id: number, choice: number) {
  act(view, { type: "choose", id, choice });
}

export function rejectProposal(view: EditorView, id: number) {
  act(view, { type: "remove", id });
}

// Replaces the text with the chosen suggestion, keeping the formatting of its first character.
export function applyProposal(view: EditorView, id: number) {
  const proposal = proposalsState(view.state).proposals.find(
    (item) => item.id === id,
  );
  const text = proposal && suggestion(proposal);
  if (!proposal || text === undefined) return;
  const { tr } = view.state;
  if (text)
    tr.replaceWith(
      proposal.from,
      proposal.to,
      tr.doc.type.schema.text(text, tr.doc.nodeAt(proposal.from)?.marks),
    );
  else tr.delete(proposal.from, proposal.to);
  act(view, { type: "apply", id, text }, tr);
}

// Markdown characters in a suggestion stay literal text.
const escapeMarkdown = (text: string) => text.replace(/[\\`*_[\]<~]/g, "\\$&");

// The source with the applied suggestions spliced in at LT's offsets, so the rest of the
// markdown stays byte for byte as it was (the editor's serializer would rewrite all of it).
export function patchSource(markdown: string, applied: SourceEdit[]): string {
  return applied
    .toSorted((a, b) => b.offset - a.offset)
    .reduce(
      (text, { offset, length, text: replacement }) =>
        text.slice(0, offset) +
        escapeMarkdown(replacement) +
        text.slice(offset + length),
      markdown,
    );
}

export interface ProposalLabels {
  apply: string;
  reject: string;
}

function button(
  view: EditorView,
  label: string,
  symbol: string,
  onClick: () => void,
) {
  const element = document.createElement("button");
  element.type = "button";
  element.textContent = symbol;
  element.setAttribute("aria-label", label);
  element.title = label;
  element.className =
    "hover:bg-muted mx-px inline-flex size-5 items-center justify-center rounded-sm border bg-background align-middle text-xs not-italic leading-none font-normal text-foreground";
  // Keeps the editor's focus and selection; the action runs on click.
  element.addEventListener("mousedown", (event) => event.preventDefault());
  element.addEventListener("click", (event) => {
    event.preventDefault();
    onClick();
    view.focus();
  });
  return element;
}

// The inserted text and the ✓/✗ buttons, after the proposal's text.
function widget(proposal: Proposal, labels: ProposalLabels) {
  return (view: EditorView) => {
    const root = document.createElement("span");
    root.contentEditable = "false";
    root.dataset.proposalWidget = String(proposal.id);
    root.className = "ml-0.5 whitespace-nowrap";
    const text = suggestion(proposal);
    if (text) {
      const inserted = document.createElement("ins");
      inserted.textContent = text;
      inserted.className = `${ADDED_CLASS} no-underline`;
      root.append(inserted);
    }
    if (text !== undefined)
      root.append(
        button(view, labels.apply, "✓", () => applyProposal(view, proposal.id)),
      );
    root.append(
      button(view, labels.reject, "✗", () => rejectProposal(view, proposal.id)),
    );
    return root;
  };
}

function decorations(editorState: EditorState, labels: ProposalLabels) {
  const state = proposalsState(editorState);
  const current = currentProposal(state)?.id;
  return DecorationSet.create(
    editorState.doc,
    state.proposals.flatMap((proposal) => {
      const selected = proposal.id === current;
      const base =
        suggestion(proposal) === undefined ? NOTE_CLASS : REMOVED_CLASS;
      return [
        Decoration.inline(proposal.from, proposal.to, {
          class: selected ? `${base} ${SELECTED_CLASS}` : base,
          "data-proposal": String(proposal.id),
          ...(selected && { "data-proposal-current": "" }),
        }),
        Decoration.widget(proposal.to, widget(proposal, labels), {
          side: 1,
          // Same key, same DOM: typing elsewhere does not redraw the buttons.
          key: `${proposal.id}:${proposal.choice}`,
          ignoreSelection: true,
          stopEvent: () => true,
        }),
      ];
    }),
  );
}

export function proposalsPlugin(labels: ProposalLabels) {
  return new Plugin<ProposalsState>({
    key: proposalsKey,
    state: {
      init: () => EMPTY,
      apply(tr, value) {
        const action = tr.getMeta(proposalsKey) as Action | undefined;
        // ✓ replaces the proposal's own text, so it goes before mapping would drop it.
        const applied = action?.type === "apply";
        const before = applied ? reduce(value, action) : value;
        const mapped = tr.docChanged
          ? {
              ...before,
              proposals: mapProposals(before.proposals, tr),
              // Appended by plugins (e.g. the trailing paragraph after a list), not typed.
              edited:
                before.edited ||
                (!applied && !tr.getMeta("appendedTransaction")),
            }
          : before;
        return action && !applied ? reduce(mapped, action) : mapped;
      },
    },
    props: {
      decorations: (editorState) => decorations(editorState, labels),
      // Clicking a proposal's text makes it the one the panel shows.
      handleClick(view, pos) {
        const proposal = proposalsState(view.state).proposals.find(
          ({ from, to }) => pos >= from && pos <= to,
        );
        if (proposal) selectProposal(view, proposal.id);
        return false;
      },
    },
  });
}

export const Proposals = Extension.create<{ labels: ProposalLabels }>({
  name: "proofreadProposals",
  addOptions: () => ({ labels: { apply: "Apply", reject: "Reject" } }),
  addProseMirrorPlugins() {
    return [proposalsPlugin(this.options.labels)];
  },
});
