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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admin_audit: {
        Row: {
          action: string
          actor: string
          created_at: string
          id: string
          target: string
        }
        Insert: {
          action: string
          actor: string
          created_at?: string
          id?: string
          target?: string
        }
        Update: {
          action?: string
          actor?: string
          created_at?: string
          id?: string
          target?: string
        }
        Relationships: []
      }
      agencies: {
        Row: {
          created_at: string
          created_by: string
          id: string
          image_path: string
          name: string
          owner_id: string
          slogan: string
          status: string
        }
        Insert: {
          created_at?: string
          created_by: string
          id?: string
          image_path?: string
          name?: string
          owner_id: string
          slogan?: string
          status?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          id?: string
          image_path?: string
          name?: string
          owner_id?: string
          slogan?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "agencies_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      agency_hosts: {
        Row: {
          agency_id: string
          user_id: string
        }
        Insert: {
          agency_id: string
          user_id: string
        }
        Update: {
          agency_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agency_hosts_agency_id_fkey"
            columns: ["agency_id"]
            isOneToOne: false
            referencedRelation: "agencies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "agency_hosts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_assets: {
        Row: {
          id: string
          asset_key: string
          title: string
          category: string
          storage_path: string
          mime_type: string | null
          metadata: Json
          is_active: boolean
          sort_order: number
          created_by: string | null
          created_at: string
          updated_at: string
          section: string
          name: string
          path: string
          mime: string | null
        }
        Insert: {
          id?: string
          asset_key: string
          title: string
          category?: string
          storage_path: string
          mime_type?: string | null
          metadata?: Json
          is_active?: boolean
          sort_order?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
          section?: string
          name: string
          path: string
          mime?: string | null
        }
        Update: {
          id?: string
          asset_key?: string
          title?: string
          category?: string
          storage_path?: string
          mime_type?: string | null
          metadata?: Json
          is_active?: boolean
          sort_order?: number
          created_by?: string | null
          created_at?: string
          updated_at?: string
          section?: string
          name?: string
          path?: string
          mime?: string | null
        }
        Relationships: []
      }
      app_catalog: {
        Row: {
          asset_id: string | null
          created_at: string
          description: string
          duration_days: number
          enabled: boolean
          home: boolean
          id: string
          in_store: boolean
          kind: string
          link: string
          metadata: Json
          name: string
          position: number
          price: number
          publish_until: string | null
          rank: number
        }
        Insert: {
          asset_id?: string | null
          created_at?: string
          description?: string
          duration_days?: number
          enabled?: boolean
          home?: boolean
          id?: string
          in_store?: boolean
          kind: string
          link?: string
          metadata?: Json
          name: string
          position?: number
          price?: number
          publish_until?: string | null
          rank?: number
        }
        Update: {
          asset_id?: string | null
          created_at?: string
          description?: string
          duration_days?: number
          enabled?: boolean
          home?: boolean
          id?: string
          in_store?: boolean
          kind?: string
          link?: string
          metadata?: Json
          name?: string
          position?: number
          price?: number
          publish_until?: string | null
          rank?: number
        }
        Relationships: [
          {
            foreignKeyName: "app_catalog_asset_id_fkey"
            columns: ["asset_id"]
            isOneToOne: false
            referencedRelation: "app_assets"
            referencedColumns: ["id"]
          },
        ]
      }
      app_notifications: {
        Row: {
          body: string
          catalog_id: string | null
          coins: number
          created_at: string
          id: string
          kind: string
          title: string
          user_id: string | null
        }
        Insert: {
          body: string
          catalog_id?: string | null
          coins?: number
          created_at?: string
          id?: string
          kind?: string
          title: string
          user_id?: string | null
        }
        Update: {
          body?: string
          catalog_id?: string | null
          coins?: number
          created_at?: string
          id?: string
          kind?: string
          title?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "app_notifications_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "app_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "app_notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          key: string
          value: Json
        }
        Insert: {
          key: string
          value?: Json
        }
        Update: {
          key?: string
          value?: Json
        }
        Relationships: []
      }
      coin_ledger: {
        Row: {
          amount: number
          created_at: string
          id: string
          kind: string
          recipient_id: string
          sender_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          kind: string
          recipient_id: string
          sender_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          kind?: string
          recipient_id?: string
          sender_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          app_seconds: number
          avatar: string | null
          avatar_url: string | null
          banned: boolean
          bio: string
          coins: number
          daily_at: string | null
          daily_day: number
          diamonds: number
          gift_value: number
          id: string
          id_color: string | null
          last_app_at: string | null
          last_mic_at: string | null
          level: number
          mic_seconds: number
          name: string
          name_color: string | null
          special_id: string | null
          uid: number
          vip: number
          vip_until: string | null
        }
        Insert: {
          app_seconds?: number
          avatar?: string | null
          avatar_url?: string | null
          banned?: boolean
          bio?: string
          coins?: number
          daily_at?: string | null
          daily_day?: number
          diamonds?: number
          gift_value?: number
          id: string
          id_color?: string | null
          last_app_at?: string | null
          last_mic_at?: string | null
          level?: number
          mic_seconds?: number
          name?: string
          name_color?: string | null
          special_id?: string | null
          uid?: never
          vip?: number
          vip_until?: string | null
        }
        Update: {
          app_seconds?: number
          avatar?: string | null
          banned?: boolean
          bio?: string
          coins?: number
          daily_at?: string | null
          daily_day?: number
          diamonds?: number
          gift_value?: number
          id?: string
          id_color?: string | null
          last_app_at?: string | null
          last_mic_at?: string | null
          level?: number
          mic_seconds?: number
          name?: string
          name_color?: string | null
          special_id?: string | null
          uid?: never
          vip?: number
          vip_until?: string | null
        }
        Relationships: []
      }
      recharge_requests: {
        Row: {
          admin_note: string
          coins: number
          created_at: string
          decided_at: string | null
          decided_by: string | null
          id: string
          note: string
          price: string
          status: string
          user_id: string
        }
        Insert: {
          admin_note?: string
          coins: number
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          note?: string
          price?: string
          status?: string
          user_id: string
        }
        Update: {
          admin_note?: string
          coins?: number
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          id?: string
          note?: string
          price?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "recharge_requests_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      room_controls: {
        Row: {
          banned: boolean
          frame_id: string | null
          room_id: string
        }
        Insert: {
          banned?: boolean
          frame_id?: string | null
          room_id: string
        }
        Update: {
          banned?: boolean
          frame_id?: string | null
          room_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_controls_frame_id_fkey"
            columns: ["frame_id"]
            isOneToOne: false
            referencedRelation: "app_catalog"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          cover: string | null
          created_at: string
          id: string
          name: string
          notice: string
          owner_id: string
          room_uid: number
        }
        Insert: {
          cover?: string | null
          created_at?: string
          id?: string
          name: string
          notice?: string
          owner_id: string
          room_uid: number
        }
        Update: {
          cover?: string | null
          created_at?: string
          id?: string
          name?: string
          notice?: string
          owner_id?: string
          room_uid?: number
        }
        Relationships: [
          {
            foreignKeyName: "rooms_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_items: {
        Row: {
          catalog_id: string
          equipped: boolean
          expires_at: string | null
          id: string
          user_id: string
        }
        Insert: {
          catalog_id: string
          equipped?: boolean
          expires_at?: string | null
          id?: string
          user_id: string
        }
        Update: {
          catalog_id?: string
          equipped?: boolean
          expires_at?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_items_catalog_id_fkey"
            columns: ["catalog_id"]
            isOneToOne: false
            referencedRelation: "app_catalog"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_items_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: string
          user_id: string
        }
        Insert: {
          id?: string
          role: string
          user_id: string
        }
        Update: {
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      app_action: { Args: { action: string; payload: Json }; Returns: Json }
      app_action_internal: {
        Args: { action: string; payload: Json }
        Returns: Json
      }
      has_role: { Args: { _role: string; _user_id: string }; Returns: boolean }
    }
    Enums: {
      [_ in never]: never
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
