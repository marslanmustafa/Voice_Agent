import { baseApi } from "./baseApi";
import type { Contact, Campaign, Call, CallDetail, UserConfig } from "@/types";

// ── Contacts ──────────────────────────────────────────────────────────────────
export const contactsApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    getContacts: b.query<{ contacts: Contact[]; total: number; page: number; page_size: number }, { page?: number; search?: string; tag?: string }>({
      query: (p) => ({ url: "/contacts", params: p }),
      providesTags: ["Contacts"],
    }),
    createContact: b.mutation<Contact, Partial<Contact>>({
      query: (body) => ({ url: "/contacts", method: "POST", body }),
      invalidatesTags: ["Contacts"],
    }),
    updateContact: b.mutation<Contact, { id: string; data: Partial<Contact> }>({
      query: ({ id, data }) => ({ url: `/contacts/${id}`, method: "PUT", body: data }),
      invalidatesTags: ["Contacts"],
    }),
    deleteContact: b.mutation<void, string>({
      query: (id) => ({ url: `/contacts/${id}`, method: "DELETE" }),
      invalidatesTags: ["Contacts"],
    }),
    importCsv: b.mutation<{ imported: number; skipped: number; errors: string[] }, FormData>({
      query: (body) => ({ url: "/contacts/csv/upload", method: "POST", body }),
      invalidatesTags: ["Contacts"],
    }),
  }),
});

export const {
  useGetContactsQuery,
  useCreateContactMutation,
  useUpdateContactMutation,
  useDeleteContactMutation,
  useImportCsvMutation,
} = contactsApi;

// ── Campaigns ─────────────────────────────────────────────────────────────────
export const campaignsApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    getCampaigns: b.query<{ campaigns: Campaign[]; total: number }, { status?: string }>({
      query: (p) => ({ url: "/campaigns", params: p }),
      providesTags: ["Campaigns"],
    }),
    getCampaign: b.query<Campaign, string>({
      query: (id) => `/campaigns/${id}`,
    }),
    createCampaign: b.mutation<Campaign, Partial<Campaign> & { contact_ids?: string[] }>({
      query: (body) => ({ url: "/campaigns", method: "POST", body }),
      invalidatesTags: ["Campaigns"],
    }),
    updateCampaign: b.mutation<Campaign, { id: string; data: Partial<Campaign> }>({
      query: ({ id, data }) => ({ url: `/campaigns/${id}`, method: "PUT", body: data }),
      invalidatesTags: ["Campaigns"],
    }),
    deleteCampaign: b.mutation<void, string>({
      query: (id) => ({ url: `/campaigns/${id}`, method: "DELETE" }),
      invalidatesTags: ["Campaigns"],
    }),
    launchCampaign: b.mutation<{ ok: boolean; message: string }, string>({
      query: (id) => ({ url: `/campaigns/${id}/launch`, method: "POST" }),
      invalidatesTags: ["Campaigns"],
    }),
    cancelCampaign: b.mutation<{ ok: boolean; message: string }, string>({
      query: (id) => ({ url: `/campaigns/${id}/cancel`, method: "POST" }),
      invalidatesTags: ["Campaigns"],
    }),
  }),
});

export const {
  useGetCampaignsQuery,
  useGetCampaignQuery,
  useCreateCampaignMutation,
  useUpdateCampaignMutation,
  useDeleteCampaignMutation,
  useLaunchCampaignMutation,
  useCancelCampaignMutation,
} = campaignsApi;

// ── Calls ─────────────────────────────────────────────────────────────────────
export const callsApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    getCalls: b.query<{ calls: Call[]; total: number }, { status?: string; campaign_id?: string; page?: number }>({
      query: (p) => ({ url: "/calls", params: p }),
      providesTags: ["Calls"],
    }),
    getCall: b.query<CallDetail, string>({
      query: (id) => `/calls/${id}`,
    }),
    endCall: b.mutation<{ ok: boolean }, string>({
      query: (id) => ({ url: `/calls/${id}/end`, method: "POST" }),
      invalidatesTags: ["Calls"],
    }),
    dialCall: b.mutation<{ ok: boolean; call_id: string; listen_url?: string }, { phone_to: string; system_prompt?: string; first_message?: string }>({
      query: (body) => ({ url: "/calls/dial", method: "POST", body }),
      invalidatesTags: ["Calls"],
    }),
  }),
});

export const { useGetCallsQuery, useGetCallQuery, useEndCallMutation, useDialCallMutation } = callsApi;

// ── User Config ───────────────────────────────────────────────────────────────
export const usersApi = baseApi.injectEndpoints({
  endpoints: (b) => ({
    getConfig: b.query<UserConfig, void>({
      query: () => "/users/config",
      providesTags: ["Config"],
    }),
    updateConfig: b.mutation<UserConfig, Partial<UserConfig>>({
      query: (body) => ({ url: "/users/config", method: "PUT", body }),
      invalidatesTags: ["Config"],
    }),
  }),
});

export const { useGetConfigQuery, useUpdateConfigMutation } = usersApi;
