export interface PurgedObjects {
  folderIds: string[];
  storyIds: string[];
}

// Hard deletion of a chapter or folder deletes its social data (D80); soft delete only hides
// it. Each social task adds the collections it owns.
const PURGES: ((objects: PurgedObjects) => Promise<unknown>)[] = [];

export async function purgeSocialData(objects: PurgedObjects): Promise<void> {
  await Promise.all(PURGES.map((purge) => purge(objects)));
}
