import { initFriendshipTable } from "./friendshipInit";
import { initAccountsTable } from "./accountsinit";

export async function runAllMigrations() {
    await initFriendshipTable();
    await initAccountsTable();
}

