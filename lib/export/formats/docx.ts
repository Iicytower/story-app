import {
  AlignmentType,
  Document,
  ExternalHyperlink,
  HeadingLevel,
  LevelFormat,
  Packer,
  Paragraph,
  TextRun,
  type ParagraphChild,
} from "docx";
import type { Block, Span } from "../blocks";
import type { ExportDocument } from "../document";

const HEADINGS = [
  HeadingLevel.TITLE,
  HeadingLevel.HEADING_1,
  HeadingLevel.HEADING_2,
  HeadingLevel.HEADING_3,
  HeadingLevel.HEADING_4,
  HeadingLevel.HEADING_5,
];

const NUMBERED = "numbered";
const BULLETED = "bulleted";

function spanToChildren(span: Span): ParagraphChild[] {
  const run = new TextRun({
    text: span.text,
    bold: span.bold,
    italics: span.italic,
    style: span.href ? "Hyperlink" : undefined,
  });
  const linked = span.href
    ? new ExternalHyperlink({ link: span.href, children: [run] })
    : run;
  return span.lineBreak ? [linked, new TextRun({ break: 1 })] : [linked];
}

type Context = {
  headingOffset: number;
  indent: number;
  nextList: () => number;
};

function blocksToParagraphs(blocks: Block[], context: Context): Paragraph[] {
  return blocks.flatMap((block): Paragraph[] => {
    switch (block.type) {
      case "paragraph":
        return [
          new Paragraph({
            children: block.spans.flatMap(spanToChildren),
            indent: context.indent ? { left: context.indent } : undefined,
          }),
        ];
      case "heading":
        return [
          new Paragraph({
            heading: HEADINGS[block.level + context.headingOffset],
            children: block.spans.flatMap(spanToChildren),
          }),
        ];
      case "quote":
        return blocksToParagraphs(block.blocks, {
          ...context,
          indent: context.indent + 567,
        });
      case "list": {
        // Every list needs its own instance, or numbering continues across lists.
        const instance = context.nextList();
        const reference = block.ordered ? NUMBERED : BULLETED;
        return block.items.flatMap((item) =>
          item.flatMap((itemBlock) =>
            itemBlock.type === "paragraph"
              ? [
                  new Paragraph({
                    children: itemBlock.spans.flatMap(spanToChildren),
                    numbering: { reference, level: 0, instance },
                  }),
                ]
              : blocksToParagraphs([itemBlock], context),
          ),
        );
      }
      case "rule":
        return [
          new Paragraph({ text: "* * *", alignment: AlignmentType.CENTER }),
        ];
    }
  });
}

export async function buildDocx({
  title,
  sections,
}: ExportDocument): Promise<Uint8Array> {
  let lists = 0;
  const nextList = () => lists++;
  const children = [
    new Paragraph({ heading: HEADINGS[0], text: title }),
    ...sections.flatMap((section) => [
      ...(section.title
        ? [new Paragraph({ heading: HEADINGS[1], text: section.title })]
        : []),
      ...blocksToParagraphs(section.blocks, {
        headingOffset: section.title ? 1 : 0,
        indent: 0,
        nextList,
      }),
    ]),
  ];
  const document = new Document({
    title,
    numbering: {
      config: [
        {
          reference: NUMBERED,
          levels: [
            {
              level: 0,
              format: LevelFormat.DECIMAL,
              text: "%1.",
              alignment: AlignmentType.START,
            },
          ],
        },
        {
          reference: BULLETED,
          levels: [
            {
              level: 0,
              format: LevelFormat.BULLET,
              text: "•",
              alignment: AlignmentType.START,
            },
          ],
        },
      ],
    },
    sections: [{ children }],
  });
  return Packer.pack(document, "uint8array");
}
