import { createNavigation } from "next-intl/navigation";
import { routing } from "./routing";

const navigation = createNavigation(routing);

export const { Link, usePathname, useRouter, getPathname } = navigation;
// The explicit type lets TypeScript narrow after `redirect(...)`, as with Next's own.
export const redirect: typeof navigation.redirect = navigation.redirect;
