declare module "pdfkit" {
  type TextOptions = {
    continued?: boolean;
    link?: string;
    underline?: boolean;
    align?: "left" | "center";
    indent?: number;
    width?: number;
    paragraphGap?: number;
  };

  export default class PDFDocument {
    constructor(options: {
      size: string;
      margin: number;
      font: null;
      info: { Title: string };
      bufferPages?: boolean;
      autoFirstPage?: boolean;
    });
    outline: { addItem(title: string): void };
    page: {
      width: number;
      height: number;
      margins: { left: number; right: number; top: number; bottom: number };
    };
    x: number;
    y: number;
    registerFont(name: string, source: Uint8Array): this;
    font(name: string): this;
    fontSize(size: number): this;
    text(text: string, options?: TextOptions): this;
    moveDown(lines?: number): this;
    addPage(): this;
    image(
      source: Uint8Array,
      x: number,
      y: number,
      options: {
        fit: [number, number];
        align?: "center";
        valign?: "center";
      },
    ): this;
    end(): void;
    on(event: "data", listener: (chunk: Uint8Array) => void): this;
    on(event: "end", listener: () => void): this;
  }
}
