export const id = "001-baseline";
// No data changes: makes the first build with migrations take backups and hand indexes over to syncIndexes().
export const collections = ["stories", "users"];

export async function up(): Promise<void> {}
