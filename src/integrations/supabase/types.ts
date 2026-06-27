export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      candidate_lp_enrollments: {
        Row: {
          candidate_id: string
          completed_at: string | null
          created_at: string
          id: string
          last_activity_at: string
          last_video_id: string | null
          path_id: string
        }
        Insert: {
          candidate_id: string
          completed_at?: string | null
          created_at?: string
          id?: string
          last_activity_at?: string
          last_video_id?: string | null
          path_id: string
        }
        Update: {
          candidate_id?: string
          completed_at?: string | null
          created_at?: string
          id?: string
          last_activity_at?: string
          last_video_id?: string | null
          path_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_lp_enrollments_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_lp_enrollments_path_id_fkey"
            columns: ["path_id"]
            isOneToOne: false
            referencedRelation: "learning_paths_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_lp_video_progress: {
        Row: {
          candidate_id: string
          completed: boolean
          completed_at: string | null
          duration_sec: number | null
          id: string
          path_id: string
          updated_at: string
          video_id: string
          watched_sec: number
        }
        Insert: {
          candidate_id: string
          completed?: boolean
          completed_at?: string | null
          duration_sec?: number | null
          id?: string
          path_id: string
          updated_at?: string
          video_id: string
          watched_sec?: number
        }
        Update: {
          candidate_id?: string
          completed?: boolean
          completed_at?: string | null
          duration_sec?: number | null
          id?: string
          path_id?: string
          updated_at?: string
          video_id?: string
          watched_sec?: number
        }
        Relationships: [
          {
            foreignKeyName: "candidate_lp_video_progress_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "candidate_lp_video_progress_path_id_fkey"
            columns: ["path_id"]
            isOneToOne: false
            referencedRelation: "learning_paths_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_mentor_memory: {
        Row: {
          candidate_id: string
          last_seen_at: string | null
          last_streak_mention_on: string | null
          last_topics: Json
          mood_last: string | null
          streak_days: number
          summary: string | null
          target_company: string | null
          target_role: string | null
          updated_at: string
          weak_topics: Json
        }
        Insert: {
          candidate_id: string
          last_seen_at?: string | null
          last_streak_mention_on?: string | null
          last_topics?: Json
          mood_last?: string | null
          streak_days?: number
          summary?: string | null
          target_company?: string | null
          target_role?: string | null
          updated_at?: string
          weak_topics?: Json
        }
        Update: {
          candidate_id?: string
          last_seen_at?: string | null
          last_streak_mention_on?: string | null
          last_topics?: Json
          mood_last?: string | null
          streak_days?: number
          summary?: string | null
          target_company?: string | null
          target_role?: string | null
          updated_at?: string
          weak_topics?: Json
        }
        Relationships: [
          {
            foreignKeyName: "candidate_mentor_memory_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: true
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_mentor_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          session_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          session_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_mentor_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "candidate_mentor_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_mentor_sessions: {
        Row: {
          candidate_id: string
          created_at: string
          id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          candidate_id: string
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          candidate_id?: string
          created_at?: string
          id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "candidate_mentor_sessions_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidate_xp_events: {
        Row: {
          candidate_id: string
          created_at: string
          event_type: string
          id: string
          meta: Json
          xp: number
        }
        Insert: {
          candidate_id: string
          created_at?: string
          event_type: string
          id?: string
          meta?: Json
          xp: number
        }
        Update: {
          candidate_id?: string
          created_at?: string
          event_type?: string
          id?: string
          meta?: Json
          xp?: number
        }
        Relationships: [
          {
            foreignKeyName: "candidate_xp_events_candidate_id_fkey"
            columns: ["candidate_id"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      candidates: {
        Row: {
          avatar_url: string | null
          bio: string | null
          branch: string | null
          cgpa: number | null
          created_at: string
          email: string | null
          first_name: string | null
          full_name: string | null
          graduation_year: number | null
          headline: string | null
          id: string
          institution: string | null
          last_active_at: string | null
          last_active_on: string | null
          last_name: string | null
          location: string | null
          phone: string | null
          profile_completeness: number
          profile_extra: Json
          resume_filename: string | null
          resume_url: string | null
          skills: string[]
          skills_v4: Json
          streak_days: number
          stream: string | null
          updated_at: string
          user_id: string
          xp_total: number
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          branch?: string | null
          cgpa?: number | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          graduation_year?: number | null
          headline?: string | null
          id?: string
          institution?: string | null
          last_active_at?: string | null
          last_active_on?: string | null
          last_name?: string | null
          location?: string | null
          phone?: string | null
          profile_completeness?: number
          profile_extra?: Json
          resume_filename?: string | null
          resume_url?: string | null
          skills?: string[]
          skills_v4?: Json
          streak_days?: number
          stream?: string | null
          updated_at?: string
          user_id: string
          xp_total?: number
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          branch?: string | null
          cgpa?: number | null
          created_at?: string
          email?: string | null
          first_name?: string | null
          full_name?: string | null
          graduation_year?: number | null
          headline?: string | null
          id?: string
          institution?: string | null
          last_active_at?: string | null
          last_active_on?: string | null
          last_name?: string | null
          location?: string | null
          phone?: string | null
          profile_completeness?: number
          profile_extra?: Json
          resume_filename?: string | null
          resume_url?: string | null
          skills?: string[]
          skills_v4?: Json
          streak_days?: number
          stream?: string | null
          updated_at?: string
          user_id?: string
          xp_total?: number
        }
        Relationships: []
      }
      learning_paths_catalog: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          estimated_hours: number
          id: string
          is_published: boolean
          level: string
          modules: Json
          rating_avg: number
          rating_count: number
          skill_primary: string
          skills: string[]
          slug: string
          source: string
          stream: string[]
          tags: string[]
          title: string
          updated_at: string
          usage_count: number
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_hours?: number
          id?: string
          is_published?: boolean
          level?: string
          modules?: Json
          rating_avg?: number
          rating_count?: number
          skill_primary: string
          skills?: string[]
          slug: string
          source?: string
          stream?: string[]
          tags?: string[]
          title: string
          updated_at?: string
          usage_count?: number
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          estimated_hours?: number
          id?: string
          is_published?: boolean
          level?: string
          modules?: Json
          rating_avg?: number
          rating_count?: number
          skill_primary?: string
          skills?: string[]
          slug?: string
          source?: string
          stream?: string[]
          tags?: string[]
          title?: string
          updated_at?: string
          usage_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "learning_paths_catalog_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "candidates"
            referencedColumns: ["id"]
          },
        ]
      }
      llm_api_keys: {
        Row: {
          cooldown_until: string | null
          created_at: string
          enabled: boolean
          fail_count: number
          id: string
          key_ciphertext: string
          key_iv: string
          key_last4: string
          label: string
          last_used_at: string | null
          provider_id: string
          use_count: number
          weight: number
        }
        Insert: {
          cooldown_until?: string | null
          created_at?: string
          enabled?: boolean
          fail_count?: number
          id?: string
          key_ciphertext: string
          key_iv: string
          key_last4: string
          label: string
          last_used_at?: string | null
          provider_id: string
          use_count?: number
          weight?: number
        }
        Update: {
          cooldown_until?: string | null
          created_at?: string
          enabled?: boolean
          fail_count?: number
          id?: string
          key_ciphertext?: string
          key_iv?: string
          key_last4?: string
          label?: string
          last_used_at?: string | null
          provider_id?: string
          use_count?: number
          weight?: number
        }
        Relationships: [
          {
            foreignKeyName: "llm_api_keys_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: false
            referencedRelation: "llm_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      llm_cache: {
        Row: {
          cache_key: string
          created_at: string
          expires_at: string
          model: string | null
          response: Json
        }
        Insert: {
          cache_key: string
          created_at?: string
          expires_at: string
          model?: string | null
          response: Json
        }
        Update: {
          cache_key?: string
          created_at?: string
          expires_at?: string
          model?: string | null
          response?: Json
        }
        Relationships: []
      }
      llm_call_log: {
        Row: {
          cache_hit: boolean
          completion_tokens: number | null
          created_at: string
          error: string | null
          feature: string
          id: string
          key_id: string | null
          latency_ms: number | null
          model: string | null
          prompt_tokens: number | null
          provider_id: string | null
          status: number | null
          user_id: string | null
        }
        Insert: {
          cache_hit?: boolean
          completion_tokens?: number | null
          created_at?: string
          error?: string | null
          feature: string
          id?: string
          key_id?: string | null
          latency_ms?: number | null
          model?: string | null
          prompt_tokens?: number | null
          provider_id?: string | null
          status?: number | null
          user_id?: string | null
        }
        Update: {
          cache_hit?: boolean
          completion_tokens?: number | null
          created_at?: string
          error?: string | null
          feature?: string
          id?: string
          key_id?: string | null
          latency_ms?: number | null
          model?: string | null
          prompt_tokens?: number | null
          provider_id?: string | null
          status?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      llm_call_log_2026_06: {
        Row: {
          cache_hit: boolean
          completion_tokens: number | null
          created_at: string
          error: string | null
          feature: string
          id: string
          key_id: string | null
          latency_ms: number | null
          model: string | null
          prompt_tokens: number | null
          provider_id: string | null
          status: number | null
          user_id: string | null
        }
        Insert: {
          cache_hit?: boolean
          completion_tokens?: number | null
          created_at?: string
          error?: string | null
          feature: string
          id?: string
          key_id?: string | null
          latency_ms?: number | null
          model?: string | null
          prompt_tokens?: number | null
          provider_id?: string | null
          status?: number | null
          user_id?: string | null
        }
        Update: {
          cache_hit?: boolean
          completion_tokens?: number | null
          created_at?: string
          error?: string | null
          feature?: string
          id?: string
          key_id?: string | null
          latency_ms?: number | null
          model?: string | null
          prompt_tokens?: number | null
          provider_id?: string | null
          status?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      llm_call_log_2026_07: {
        Row: {
          cache_hit: boolean
          completion_tokens: number | null
          created_at: string
          error: string | null
          feature: string
          id: string
          key_id: string | null
          latency_ms: number | null
          model: string | null
          prompt_tokens: number | null
          provider_id: string | null
          status: number | null
          user_id: string | null
        }
        Insert: {
          cache_hit?: boolean
          completion_tokens?: number | null
          created_at?: string
          error?: string | null
          feature: string
          id?: string
          key_id?: string | null
          latency_ms?: number | null
          model?: string | null
          prompt_tokens?: number | null
          provider_id?: string | null
          status?: number | null
          user_id?: string | null
        }
        Update: {
          cache_hit?: boolean
          completion_tokens?: number | null
          created_at?: string
          error?: string | null
          feature?: string
          id?: string
          key_id?: string | null
          latency_ms?: number | null
          model?: string | null
          prompt_tokens?: number | null
          provider_id?: string | null
          status?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      llm_call_log_2026_08: {
        Row: {
          cache_hit: boolean
          completion_tokens: number | null
          created_at: string
          error: string | null
          feature: string
          id: string
          key_id: string | null
          latency_ms: number | null
          model: string | null
          prompt_tokens: number | null
          provider_id: string | null
          status: number | null
          user_id: string | null
        }
        Insert: {
          cache_hit?: boolean
          completion_tokens?: number | null
          created_at?: string
          error?: string | null
          feature: string
          id?: string
          key_id?: string | null
          latency_ms?: number | null
          model?: string | null
          prompt_tokens?: number | null
          provider_id?: string | null
          status?: number | null
          user_id?: string | null
        }
        Update: {
          cache_hit?: boolean
          completion_tokens?: number | null
          created_at?: string
          error?: string | null
          feature?: string
          id?: string
          key_id?: string | null
          latency_ms?: number | null
          model?: string | null
          prompt_tokens?: number | null
          provider_id?: string | null
          status?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      llm_call_log_2026_09: {
        Row: {
          cache_hit: boolean
          completion_tokens: number | null
          created_at: string
          error: string | null
          feature: string
          id: string
          key_id: string | null
          latency_ms: number | null
          model: string | null
          prompt_tokens: number | null
          provider_id: string | null
          status: number | null
          user_id: string | null
        }
        Insert: {
          cache_hit?: boolean
          completion_tokens?: number | null
          created_at?: string
          error?: string | null
          feature: string
          id?: string
          key_id?: string | null
          latency_ms?: number | null
          model?: string | null
          prompt_tokens?: number | null
          provider_id?: string | null
          status?: number | null
          user_id?: string | null
        }
        Update: {
          cache_hit?: boolean
          completion_tokens?: number | null
          created_at?: string
          error?: string | null
          feature?: string
          id?: string
          key_id?: string | null
          latency_ms?: number | null
          model?: string | null
          prompt_tokens?: number | null
          provider_id?: string | null
          status?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      llm_call_log_default: {
        Row: {
          cache_hit: boolean
          completion_tokens: number | null
          created_at: string
          error: string | null
          feature: string
          id: string
          key_id: string | null
          latency_ms: number | null
          model: string | null
          prompt_tokens: number | null
          provider_id: string | null
          status: number | null
          user_id: string | null
        }
        Insert: {
          cache_hit?: boolean
          completion_tokens?: number | null
          created_at?: string
          error?: string | null
          feature: string
          id?: string
          key_id?: string | null
          latency_ms?: number | null
          model?: string | null
          prompt_tokens?: number | null
          provider_id?: string | null
          status?: number | null
          user_id?: string | null
        }
        Update: {
          cache_hit?: boolean
          completion_tokens?: number | null
          created_at?: string
          error?: string | null
          feature?: string
          id?: string
          key_id?: string | null
          latency_ms?: number | null
          model?: string | null
          prompt_tokens?: number | null
          provider_id?: string | null
          status?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      llm_providers: {
        Row: {
          base_url: string | null
          config: Json
          created_at: string
          default_model: string | null
          display_name: string
          enabled: boolean
          id: string
          is_active: boolean
          slug: string
          updated_at: string
        }
        Insert: {
          base_url?: string | null
          config?: Json
          created_at?: string
          default_model?: string | null
          display_name: string
          enabled?: boolean
          id?: string
          is_active?: boolean
          slug: string
          updated_at?: string
        }
        Update: {
          base_url?: string | null
          config?: Json
          created_at?: string
          default_model?: string | null
          display_name?: string
          enabled?: boolean
          id?: string
          is_active?: boolean
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      llm_rr_cursor: {
        Row: {
          last_key_id: string | null
          provider_id: string
          updated_at: string
        }
        Insert: {
          last_key_id?: string | null
          provider_id: string
          updated_at?: string
        }
        Update: {
          last_key_id?: string | null
          provider_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "llm_rr_cursor_provider_id_fkey"
            columns: ["provider_id"]
            isOneToOne: true
            referencedRelation: "llm_providers"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      llm_cooldown_key: {
        Args: { _key_id: string; _minutes: number }
        Returns: undefined
      }
      llm_pick_next_key: {
        Args: never
        Returns: {
          base_url: string
          ciphertext: string
          config: Json
          default_model: string
          iv: string
          key_id: string
          provider_id: string
          provider_slug: string
        }[]
      }
      llm_record_call: {
        Args: {
          _cache_hit: boolean
          _completion_tokens: number
          _error: string
          _feature: string
          _key_id: string
          _latency_ms: number
          _model: string
          _prompt_tokens: number
          _provider_id: string
          _status: number
          _user_id: string
        }
        Returns: undefined
      }
      llm_set_active_provider: {
        Args: { _provider_id: string }
        Returns: undefined
      }
      show_limit: { Args: never; Returns: number }
      show_trgm: { Args: { "": string }; Returns: string[] }
    }
    Enums: {
      app_role: "admin" | "candidate"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "candidate"],
    },
  },
} as const
