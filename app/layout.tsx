// The real root layout is app/[locale]/layout.tsx; this one only lets app/not-found.tsx
// render for paths outside a locale.
export default function RootLayout({ children }: LayoutProps<"/">) {
  return children;
}
