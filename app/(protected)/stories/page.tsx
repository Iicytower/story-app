import type { Metadata } from "next";

export const metadata: Metadata = { title: "Stories – Story App" };

export default function StoriesPage() {
  return <h1 className="text-2xl font-semibold">Stories</h1>;
}
