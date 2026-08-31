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
      api_keys_registry: {
        Row: {
          created_at: string | null
          id: string
          is_active: boolean | null
          label: string | null
          last_validated_at: string | null
          service_name: string
          updated_at: string | null
          user_id: string
          validation_status: string | null
          vault_secret_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          label?: string | null
          last_validated_at?: string | null
          service_name: string
          updated_at?: string | null
          user_id: string
          validation_status?: string | null
          vault_secret_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          is_active?: boolean | null
          label?: string | null
          last_validated_at?: string | null
          service_name?: string
          updated_at?: string | null
          user_id?: string
          validation_status?: string | null
          vault_secret_id?: string
        }
        Relationships: []
      }
      contact_lists: {
        Row: {
          contacts_count: number | null
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          contacts_count?: number | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          contacts_count?: number | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      contacts: {
        Row: {
          city: string | null
          company: string | null
          created_at: string
          custom_fields: Json | null
          email: string | null
          id: string
          instagram: string | null
          linkedin_url: string | null
          list_id: string | null
          name: string
          phone: string | null
          platform: string | null
          score: number | null
          source: string | null
          status: string | null
          tags: string[] | null
          title: string | null
          updated_at: string
        }
        Insert: {
          city?: string | null
          company?: string | null
          created_at?: string
          custom_fields?: Json | null
          email?: string | null
          id?: string
          instagram?: string | null
          linkedin_url?: string | null
          list_id?: string | null
          name?: string
          phone?: string | null
          platform?: string | null
          score?: number | null
          source?: string | null
          status?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string
        }
        Update: {
          city?: string | null
          company?: string | null
          created_at?: string
          custom_fields?: Json | null
          email?: string | null
          id?: string
          instagram?: string | null
          linkedin_url?: string | null
          list_id?: string | null
          name?: string
          phone?: string | null
          platform?: string | null
          score?: number | null
          source?: string | null
          status?: string | null
          tags?: string[] | null
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "contact_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      lead_searches: {
        Row: {
          completed_at: string | null
          config: Json | null
          contacts_found: number | null
          contacts_new: number | null
          created_at: string
          duration_ms: number | null
          id: string
          name: string
          result_data: Json | null
          source: string | null
          source_reports: Json
          started_at: string | null
          status: string | null
          target_list_id: string | null
        }
        Insert: {
          completed_at?: string | null
          config?: Json | null
          contacts_found?: number | null
          contacts_new?: number | null
          created_at?: string
          duration_ms?: number | null
          id?: string
          name: string
          result_data?: Json | null
          source?: string | null
          source_reports?: Json
          started_at?: string | null
          status?: string | null
          target_list_id?: string | null
        }
        Update: {
          completed_at?: string | null
          config?: Json | null
          contacts_found?: number | null
          contacts_new?: number | null
          created_at?: string
          duration_ms?: number | null
          id?: string
          name?: string
          result_data?: Json | null
          source?: string | null
          source_reports?: Json
          started_at?: string | null
          status?: string | null
          target_list_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lead_searches_target_list_id_fkey"
            columns: ["target_list_id"]
            isOneToOne: false
            referencedRelation: "contact_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      outreach_messages: {
        Row: {
          channel: string
          contact_id: string | null
          created_at: string | null
          direction: string
          id: string
          message_text: string
          metadata: Json | null
          provider: string | null
          provider_message_id: string | null
          sent_at: string | null
          status: string | null
        }
        Insert: {
          channel: string
          contact_id?: string | null
          created_at?: string | null
          direction?: string
          id?: string
          message_text: string
          metadata?: Json | null
          provider?: string | null
          provider_message_id?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Update: {
          channel?: string
          contact_id?: string | null
          created_at?: string | null
          direction?: string
          id?: string
          message_text?: string
          metadata?: Json | null
          provider?: string | null
          provider_message_id?: string | null
          sent_at?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "outreach_messages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string | null
          email: string
          full_name: string
          id: string
          is_active: boolean
          is_approved: boolean
          status: string | null
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string
          id: string
          is_active?: boolean
          is_approved?: boolean
          status?: string | null
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string | null
          email?: string
          full_name?: string
          id?: string
          is_active?: boolean
          is_approved?: boolean
          status?: string | null
          updated_at?: string | null
        }
        Relationships: []
      }
      project_config: {
        Row: {
          key: string
          updated_at: string | null
          value: string
        }
        Insert: {
          key: string
          updated_at?: string | null
          value: string
        }
        Update: {
          key?: string
          updated_at?: string | null
          value?: string
        }
        Relationships: []
      }
      scraping_jobs: {
        Row: {
          completed_at: string | null
          contacts_found: number | null
          contacts_valid: number | null
          created_at: string
          duration_ms: number | null
          error_message: string | null
          fields: string[] | null
          id: string
          result_data: Json | null
          started_at: string | null
          status: string | null
          target_list_id: string | null
          url: string
        }
        Insert: {
          completed_at?: string | null
          contacts_found?: number | null
          contacts_valid?: number | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          fields?: string[] | null
          id?: string
          result_data?: Json | null
          started_at?: string | null
          status?: string | null
          target_list_id?: string | null
          url: string
        }
        Update: {
          completed_at?: string | null
          contacts_found?: number | null
          contacts_valid?: number | null
          created_at?: string
          duration_ms?: number | null
          error_message?: string | null
          fields?: string[] | null
          id?: string
          result_data?: Json | null
          started_at?: string | null
          status?: string | null
          target_list_id?: string | null
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "scraping_jobs_target_list_id_fkey"
            columns: ["target_list_id"]
            isOneToOne: false
            referencedRelation: "contact_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      settings: {
        Row: {
          auto_enrich: boolean | null
          created_at: string | null
          default_country: string | null
          default_language: string | null
          default_volume: number | null
          evolution_api_url: string | null
          evolution_connected: boolean | null
          evolution_instance_name: string | null
          id: string
          onboarding_completed: boolean | null
          resend_from_email: string | null
          resend_from_name: string | null
          updated_at: string | null
          workspace_name: string | null
        }
        Insert: {
          auto_enrich?: boolean | null
          created_at?: string | null
          default_country?: string | null
          default_language?: string | null
          default_volume?: number | null
          evolution_api_url?: string | null
          evolution_connected?: boolean | null
          evolution_instance_name?: string | null
          id?: string
          onboarding_completed?: boolean | null
          resend_from_email?: string | null
          resend_from_name?: string | null
          updated_at?: string | null
          workspace_name?: string | null
        }
        Update: {
          auto_enrich?: boolean | null
          created_at?: string | null
          default_country?: string | null
          default_language?: string | null
          default_volume?: number | null
          evolution_api_url?: string | null
          evolution_connected?: boolean | null
          evolution_instance_name?: string | null
          id?: string
          onboarding_completed?: boolean | null
          resend_from_email?: string | null
          resend_from_name?: string | null
          updated_at?: string | null
          workspace_name?: string | null
        }
        Relationships: []
      }
      user_onboarding: {
        Row: {
          completed_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
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
      _remix_introspect: { Args: never; Returns: Json }
      delete_project_secret: {
        Args: { p_service_name: string }
        Returns: undefined
      }
      get_user_api_key: {
        Args: { p_service_name: string; p_user_id: string }
        Returns: string
      }
      get_vault_key: { Args: { p_service_name: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_workspace_ready: { Args: never; Returns: boolean }
      list_project_secrets: {
        Args: never
        Returns: {
          configured: boolean
          is_active: boolean
          label: string
          last_validated_at: string
          masked_value: string
          service_name: string
          updated_at: string
          validation_status: string
        }[]
      }
      set_project_secret: {
        Args: {
          p_label?: string
          p_secret: string
          p_service_name: string
          p_validation_status?: string
        }
        Returns: Json
      }
      upsert_lead_contact: {
        Args: {
          p_city: string
          p_company: string
          p_custom_fields: Json
          p_list_id: string
          p_name: string
          p_phone: string
          p_score: number
          p_source?: string
          p_tags: string[]
        }
        Returns: Json
      }
      vault_delete_secret: { Args: { p_secret_id: string }; Returns: undefined }
      vault_read_secret: { Args: { p_secret_id: string }; Returns: string }
      vault_store_secret: {
        Args: { p_description?: string; p_name: string; p_secret: string }
        Returns: string
      }
      vault_update_secret: {
        Args: { p_new_secret: string; p_secret_id: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "admin" | "supervisor" | "agent"
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
      app_role: ["admin", "supervisor", "agent"],
    },
  },
} as const
