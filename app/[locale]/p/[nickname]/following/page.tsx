import type { Metadata } from "next";
import { FollowList, followListMetadata } from "../follow-list";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/p/[nickname]/following">): Promise<Metadata> {
  const { nickname } = await params;
  return followListMetadata(nickname, "following");
}

export default async function FollowingPage({
  params,
  searchParams,
}: PageProps<"/[locale]/p/[nickname]/following">) {
  const [{ nickname }, { page }] = await Promise.all([params, searchParams]);
  return <FollowList nickname={nickname} side="following" page={page} />;
}
