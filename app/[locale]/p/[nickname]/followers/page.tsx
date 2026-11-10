import type { Metadata } from "next";
import { FollowList, followListMetadata } from "../follow-list";

export async function generateMetadata({
  params,
}: PageProps<"/[locale]/p/[nickname]/followers">): Promise<Metadata> {
  const { nickname } = await params;
  return followListMetadata(nickname, "followers");
}

export default async function FollowersPage({
  params,
  searchParams,
}: PageProps<"/[locale]/p/[nickname]/followers">) {
  const [{ nickname }, { page }] = await Promise.all([params, searchParams]);
  return <FollowList nickname={nickname} side="followers" page={page} />;
}
