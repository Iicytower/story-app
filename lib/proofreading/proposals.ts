import { Extension } from "@tiptap/core";
import type { EditorState, Transaction } from "@tiptap/pm/state";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";
import { dictionaryMatcher } from "./dictionary";
import type { ProofreadIssue } from "./languagetool";
import type { DocIssue } from "./map";

// LT's offsets are left out: they stop fitting after the first edit.
export type IssueInfo = Omit<ProofreadIssue, "offset" | "length">;

// A placed issue waiting for a decision; `choice` is the suggestion shown as the insertion.
export interface Proposal {
  id: number;
  from: number;
  to: number;
  original: string;
  issue: IssueInfo;
  choice: number;
}

export interface ProposalsState {
  proposals: Proposal[];
  selected: number | null;
}

const EMPTY: ProposalsState = { proposals: [], selected: null };

type Action =
  | { type: "load"; proposals: Proposal[]; selected: number | null }
  | { type: "remove"; ids: number[] }
  | { type: "apply"; id: number }
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
      return { proposals: action.proposals, selected: action.selected };
    case "apply":
      return reduce(state, { type: "remove", ids: [action.id] });
    case "remove":
      return action.ids.reduce((current, removed) => {
        const index = current.proposals.findIndex(({ id }) => id === removed);
        if (index === -1) return current;
        const proposals = current.proposals.toSpliced(index, 1);
        // The next one in the text becomes current, so decisions go top to bottom.
        const next = proposals[Math.min(index, proposals.length - 1)];
        return {
          ...current,
          proposals,
          selected:
            current.selected === removed
              ? (next?.id ?? null)
              : current.selected,
        };
      }, state);
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

// Not an edit: Undo must not take the proposals away.
function load(
  view: EditorView,
  proposals: Proposal[],
  selected: number | null,
) {
  act(
    view,
    { type: "load", proposals, selected },
    view.state.tr.setMeta("addToHistory", false),
  );
}

export function loadProposals(view: EditorView, issues: DocIssue[]) {
  load(
    view,
    issues.map(({ id, from, to, original, issue }) => ({
      id,
      from,
      to,
      original,
      issue: {
        kind: issue.kind,
        message: issue.message,
        replacements: issue.replacements,
        ruleId: issue.ruleId,
      },
      choice: 0,
    })),
    issues[0]?.id ?? null,
  );
}

// Proposals kept with the chapter, placed again (task 55).
export function restoreProposals(
  view: EditorView,
  proposals: Proposal[],
  selected: number | null,
) {
  load(view, proposals, selected);
}

// "Finish proofreading": the proposals left go, the text stays.
export function clearProposals(view: EditorView) {
  load(view, [], null);
}

export function selectProposal(view: EditorView, id: number) {
  act(view, { type: "select", id });
}

export function chooseSuggestion(view: EditorView, id: number, choice: number) {
  act(view, { type: "choose", id, choice });
}

export function rejectProposal(view: EditorView, id: number) {
  act(view, { type: "remove", ids: [id] });
}

// After "Add to dictionary": every pending spelling proposal of the word goes at once.
export function dismissWord(view: EditorView, word: string) {
  const accepts = dictionaryMatcher([word]);
  const ids = proposalsState(view.state)
    .proposals.filter(
      ({ issue, original }) => issue.kind === "spelling" && accepts(original),
    )
    .map(({ id }) => id);
  act(view, { type: "remove", ids });
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
  act(view, { type: "apply", id }, tr);
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

// `onPick` runs when a click lands on a proposal's text (the editor shows its details).
export function proposalsPlugin(
  labels: ProposalLabels,
  onPick?: (id: number) => void,
) {
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
          ? { ...before, proposals: mapProposals(before.proposals, tr) }
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
        if (proposal) {
          selectProposal(view, proposal.id);
          onPick?.(proposal.id);
        }
        return false;
      },
    },
  });
}

export const Proposals = Extension.create<{
  labels: ProposalLabels;
  onPick?: (id: number) => void;
}>({
  name: "proofreadProposals",
  addOptions: () => ({ labels: { apply: "Apply", reject: "Reject" } }),
  addProseMirrorPlugins() {
    return [proposalsPlugin(this.options.labels, this.options.onPick)];
  },
});
