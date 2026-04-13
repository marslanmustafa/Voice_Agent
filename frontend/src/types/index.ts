export interface User {
  id: string;
  email: string;
  name?: string;
  provider: string;
  avatar_url?: string;
  is_onboarded?: boolean;
}

export interface UserConfig {
  id: string;
  max_call_duration: number;
  retry_count: number;
  vapi_assistant_id?: string;
  updated_at?: string;
}

export interface Contact {
  id: string;
  name: string;
  phone: string;
  email?: string;
  tag?: string;
  notes?: string;
  created_at: string;
}

export interface Campaign {
  id: string;
  name: string;
  topic?: string;
  vapi_campaign_id?: string;
  status: "draft" | "created" | "queued" | "running" | "done" | "completed" | "cancelled" | "scheduled" | "unknown";
  created_at: string;
  contact_count: number;
  call_count: number;
  completed_count: number;
}

export interface Call {
  id: string;
  campaign_id?: string;
  contact_id?: string;
  vapi_call_id?: string;
  phone_to: string;
  phone_from: string;
  status: string;
  started_at?: string;
  ended_at?: string;
  duration_secs?: number;
  recording_url?: string;
  summary?: string;
  created_at: string;
}

export interface CallDetail extends Call {
  transcript: { speaker: string; text: string; timestamp?: number }[];
}

export type CallStatus = "idle" | "connecting" | "active" | "ended";
