import { notFound } from "next/navigation";

// Unmatched paths under a locale get the 404 inside the locale layout.
export default function CatchAllPage() {
  notFound();
}
