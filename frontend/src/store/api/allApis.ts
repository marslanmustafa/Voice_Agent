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
    getCampaigns: b.query<{ campaigns: any[]; total: number }, void>({
      query: () => "/campaigns",
      providesTags: ["Campaigns"],
    }),
    getCampaign: b.query<any, string>({
      query: (id) => `/campaigns/${id}`,
      providesTags: ["Campaigns"],
    }),
    getPhoneNumbers: b.query<any[], void>({
      query: () => "/campaigns/phone-numbers",
      providesTags: ["Campaigns"],
    }),
    createCampaign: b.mutation<any, any>({
      query: (body) => ({ url: "/campaigns/create", method: "POST", body }),
      invalidatesTags: ["Campaigns"],
    }),
    updateCampaign: b.mutation<any, { id: string; data: any }>({
      query: ({ id, data }) => ({ url: `/campaigns/${id}`, method: "PATCH", body: data }),
      invalidatesTags: ["Campaigns"],
    }),
    addCampaignContacts: b.mutation<{ ok: boolean; message: string }, { campaignId: string; customers: any[] }>({
      query: ({ campaignId, customers }) => ({ url: `/campaigns/${campaignId}/contacts`, method: "POST", body: customers }),
      invalidatesTags: ["Campaigns"],
    }),
    startCampaign: b.mutation<{ ok: boolean; message: string }, { campaignId: string; customers?: any[] }>({
      query: ({ campaignId, customers }) => ({ url: `/campaigns/${campaignId}/start`, method: "POST", body: customers || [] }),
      invalidatesTags: ["Campaigns"],
    }),
    controlCampaign: b.mutation<{ ok: boolean; message: string }, { campaignId: string; action: string }>({
      query: ({ campaignId, action }) => ({ url: `/campaigns/${campaignId}/control?action=${action}`, method: "PATCH" }),
      invalidatesTags: ["Campaigns"],
    }),
    deleteCampaign: b.mutation<void, string>({
      query: (campaignId) => ({ url: `/campaigns/${campaignId}`, method: "DELETE" }),
      invalidatesTags: ["Campaigns"],
    }),
  }),
});

export const {
  useGetCampaignsQuery,
  useGetCampaignQuery,
  useGetPhoneNumbersQuery,
  useCreateCampaignMutation,
  useUpdateCampaignMutation,
  useAddCampaignContactsMutation,
  useStartCampaignMutation,
  useControlCampaignMutation,
  useDeleteCampaignMutation,
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
    dialCall: b.mutation<{ ok: boolean; call_id: string; listen_url?: string; control_url?: string }, { phone_to: string; phone_number_id?: string; system_prompt?: string; first_message?: string }>({
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
