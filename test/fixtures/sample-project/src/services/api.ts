// API service for making HTTP requests
import { HttpMethod } from "../types.js";
import type { ApiResponse, User } from "../types.js";

export class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  async request<T>(method: HttpMethod, path: string, body?: unknown): Promise<ApiResponse<T>> {
    const url = `${this.baseUrl}${path}`;
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await response.json() as T;
    return {
      data,
      status: response.status,
      message: response.statusText,
    };
  }

  async getUsers(): Promise<ApiResponse<User[]>> {
    return this.request<User[]>(HttpMethod.GET, "/users");
  }

  async getUserById(id: string): Promise<ApiResponse<User>> {
    return this.request<User>(HttpMethod.GET, `/users/${id}`);
  }
}

export function createApiClient(baseUrl: string): ApiClient {
  return new ApiClient(baseUrl);
}
