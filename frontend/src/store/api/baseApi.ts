import { createApi, fetchBaseQuery } from "@reduxjs/toolkit/query/react";

export const baseApi = createApi({
  reducerPath: "api",
  baseQuery: fetchBaseQuery({
    baseUrl: process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000",
  }),
  tagTypes: ["User", "Config", "Contacts", "Campaigns", "Calls"],
  endpoints: () => ({}),
});
