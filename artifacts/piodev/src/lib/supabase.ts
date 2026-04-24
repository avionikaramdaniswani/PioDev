import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      daily_token_usage: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          prompt_tokens: number;
          completion_tokens: number;
          total_tokens: number;
          messages: number;
        };
        Insert: {
          id?: string;
          user_id: string;
          date: string;
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
          messages?: number;
        };
        Update: {
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
          messages?: number;
        };
      };
      conversations: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          title: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          updated_at?: string;
        };
      };
      messages: {
        Row: {
          id: string;
          conversation_id: string;
          role: "user" | "ai";
          content: string;
          created_at: string;
          prompt_tokens: number;
          completion_tokens: number;
          total_tokens: number;
        };
        Insert: {
          id?: string;
          conversation_id: string;
          role: "user" | "ai";
          content: string;
          created_at?: string;
          prompt_tokens?: number;
          completion_tokens?: number;
          total_tokens?: number;
        };
      };
    };
  };
};
