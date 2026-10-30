import { HouseIcon } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { AccountMenu } from "./account-menu";

export default function ProtectedLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      {/* Like AccountMenu: in the padding above page content, scrolling away with the page. */}
      <Button
        variant="ghost"
        size="icon-sm"
        asChild
        className="absolute top-1 left-1 z-40"
      >
        <Link href="/stories" aria-label="Home" title="Home">
          <HouseIcon />
        </Link>
      </Button>
      <AccountMenu />
      <main className="flex w-full flex-1 flex-col">{children}</main>
    </>
  );
}
