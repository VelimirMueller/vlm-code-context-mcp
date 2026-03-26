// Application entry point
import { formatDate, capitalize, DEFAULT_PAGE_SIZE } from "./utils/index.js";
import { ApiClient, createApiClient } from "./services/api.js";
import type { User, PaginatedResult } from "./types.js";

export function createApp(apiUrl: string) {
  const client = createApiClient(apiUrl);

  async function listUsers(page: number = 1): Promise<PaginatedResult<User>> {
    const response = await client.getUsers();
    return {
      items: response.data,
      total: response.data.length,
      page,
      pageSize: DEFAULT_PAGE_SIZE,
    };
  }

  function formatUserName(user: User): string {
    return capitalize(user.name);
  }

  function getUserJoinDate(user: User & { createdAt: Date }): string {
    return formatDate(user.createdAt);
  }

  return { listUsers, formatUserName, getUserJoinDate };
}

export const APP_VERSION = "0.1.0";
