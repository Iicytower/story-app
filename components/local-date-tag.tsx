import { LocalDate } from "@/components/local-date";

// A `<date></date>` tag of t.rich: the date and time in the viewer's time zone.
export function localDateTag(iso: string) {
  return function LocalDateTag() {
    return <LocalDate iso={iso} withTime />;
  };
}
