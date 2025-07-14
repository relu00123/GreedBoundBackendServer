import { initFriendshipTable } from "./friendshipInit";

export async function runAllMigrations() {
    await initFriendshipTable();
}

