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
      audit_log: {
        Row: {
          action: string
          admin_id: string
          created_at: string | null
          details: string | null
          id: string
          target_id: string | null
          target_type: string | null
        }
        Insert: {
          action: string
          admin_id: string
          created_at?: string | null
          details?: string | null
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Update: {
          action?: string
          admin_id?: string
          created_at?: string | null
          details?: string | null
          id?: string
          target_id?: string | null
          target_type?: string | null
        }
        Relationships: []
      }
      conversations: {
        Row: {
          id: string
          last_at: string
          last_message: string | null
          user_a: string
          user_b: string
        }
        Insert: {
          id?: string
          last_at?: string
          last_message?: string | null
          user_a: string
          user_b: string
        }
        Update: {
          id?: string
          last_at?: string
          last_message?: string | null
          user_a?: string
          user_b?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_user_a_fkey"
            columns: ["user_a"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_user_b_fkey"
            columns: ["user_b"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      device_accounts: {
        Row: {
          created_at: string
          device_hash: string
          user_id: string
        }
        Insert: {
          created_at?: string
          device_hash: string
          user_id: string
        }
        Update: {
          created_at?: string
          device_hash?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "device_accounts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      families: {
        Row: {
          created_at: string
          description: string | null
          emblem: string
          id: string
          member_count: number
          name: string
          owner_id: string
          points: number
        }
        Insert: {
          created_at?: string
          description?: string | null
          emblem?: string
          id?: string
          member_count?: number
          name: string
          owner_id: string
          points?: number
        }
        Update: {
          created_at?: string
          description?: string | null
          emblem?: string
          id?: string
          member_count?: number
          name?: string
          owner_id?: string
          points?: number
        }
        Relationships: [
          {
            foreignKeyName: "families_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      family_members: {
        Row: {
          family_id: string
          joined_at: string
          role: string
          status: string
          user_id: string
        }
        Insert: {
          family_id: string
          joined_at?: string
          role?: string
          status?: string
          user_id: string
        }
        Update: {
          family_id?: string
          joined_at?: string
          role?: string
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "family_members_family_id_fkey"
            columns: ["family_id"]
            isOneToOne: false
            referencedRelation: "families"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "family_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          created_at: string
          follower_id: string
          following_id: string
        }
        Insert: {
          created_at?: string
          follower_id: string
          following_id: string
        }
        Update: {
          created_at?: string
          follower_id?: string
          following_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_follower_id_fkey"
            columns: ["follower_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_following_id_fkey"
            columns: ["following_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gift_transactions: {
        Row: {
          created_at: string
          gift_id: string
          id: string
          quantity: number
          receiver_id: string
          room_id: string | null
          sender_id: string
          total_price: number
        }
        Insert: {
          created_at?: string
          gift_id: string
          id?: string
          quantity?: number
          receiver_id: string
          room_id?: string | null
          sender_id: string
          total_price: number
        }
        Update: {
          created_at?: string
          gift_id?: string
          id?: string
          quantity?: number
          receiver_id?: string
          room_id?: string | null
          sender_id?: string
          total_price?: number
        }
        Relationships: [
          {
            foreignKeyName: "gift_transactions_gift_id_fkey"
            columns: ["gift_id"]
            isOneToOne: false
            referencedRelation: "gifts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_transactions_receiver_id_fkey"
            columns: ["receiver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_transactions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "gift_transactions_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      gifts: {
        Row: {
          active: boolean
          emoji: string
          id: string
          name: string
          price: number
          sort: number
          tier: string
        }
        Insert: {
          active?: boolean
          emoji: string
          id?: string
          name: string
          price: number
          sort?: number
          tier?: string
        }
        Update: {
          active?: boolean
          emoji?: string
          id?: string
          name?: string
          price?: number
          sort?: number
          tier?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          body: string
          conversation_id: string
          created_at: string
          id: string
          read_at: string | null
          sender_id: string
        }
        Insert: {
          body: string
          conversation_id: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id: string
        }
        Update: {
          body?: string
          conversation_id?: string
          created_at?: string
          id?: string
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          body: string
          created_at: string
          id: string
          is_read: boolean
          kind: string
          ref_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          actor_id?: string | null
          body?: string
          created_at?: string
          id?: string
          is_read?: boolean
          kind: string
          ref_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          actor_id?: string | null
          body?: string
          created_at?: string
          id?: string
          is_read?: boolean
          kind?: string
          ref_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_comments: {
        Row: {
          body: string
          created_at: string
          id: string
          post_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          post_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_comments_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      post_likes: {
        Row: {
          post_id: string
          user_id: string
        }
        Insert: {
          post_id: string
          user_id: string
        }
        Update: {
          post_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "post_likes_post_id_fkey"
            columns: ["post_id"]
            isOneToOne: false
            referencedRelation: "posts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "post_likes_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      posts: {
        Row: {
          body: string
          comment_count: number
          created_at: string
          id: string
          image_url: string | null
          like_count: number
          user_id: string
        }
        Insert: {
          body?: string
          comment_count?: number
          created_at?: string
          id?: string
          image_url?: string | null
          like_count?: number
          user_id: string
        }
        Update: {
          body?: string
          comment_count?: number
          created_at?: string
          id?: string
          image_url?: string | null
          like_count?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_visits: {
        Row: {
          profile_id: string
          visited_at: string
          visitor_id: string
        }
        Insert: {
          profile_id: string
          visited_at?: string
          visitor_id: string
        }
        Update: {
          profile_id?: string
          visited_at?: string
          visitor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_visits_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "profile_visits_visitor_id_fkey"
            columns: ["visitor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          birth_date: string | null
          country: string | null
          created_at: string
          deletion_requested_at: string | null
          display_name: string
          display_no: number
          equipped_entry: string | null
          equipped_frame: string | null
          gender: string | null
          id: string
          level: number
          show_age: boolean
          show_gender: boolean
          vip_level: number
          xp: number
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          country?: string | null
          created_at?: string
          deletion_requested_at?: string | null
          display_name?: string
          display_no?: number
          equipped_entry?: string | null
          equipped_frame?: string | null
          gender?: string | null
          id: string
          level?: number
          show_age?: boolean
          show_gender?: boolean
          vip_level?: number
          xp?: number
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          country?: string | null
          created_at?: string
          deletion_requested_at?: string | null
          display_name?: string
          display_no?: number
          equipped_entry?: string | null
          equipped_frame?: string | null
          gender?: string | null
          id?: string
          level?: number
          show_age?: boolean
          show_gender?: boolean
          vip_level?: number
          xp?: number
        }
        Relationships: []
      }
      reports: {
        Row: {
          admin_reply: string | null
          category: string
          created_at: string
          details: string
          evidence: Json | null
          id: string
          reporter_id: string
          status: string
          target_id: string | null
          target_type: string
        }
        Insert: {
          admin_reply?: string | null
          category: string
          created_at?: string
          details?: string
          evidence?: Json | null
          id?: string
          reporter_id: string
          status?: string
          target_id?: string | null
          target_type: string
        }
        Update: {
          admin_reply?: string | null
          category?: string
          created_at?: string
          details?: string
          evidence?: Json | null
          id?: string
          reporter_id?: string
          status?: string
          target_id?: string | null
          target_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      room_bans: {
        Row: {
          banned_by: string
          created_at: string
          room_id: string
          user_id: string
        }
        Insert: {
          banned_by: string
          created_at?: string
          room_id: string
          user_id: string
        }
        Update: {
          banned_by?: string
          created_at?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_bans_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_bans_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      room_members: {
        Row: {
          joined_at: string
          last_seen: string
          room_id: string
          user_id: string
        }
        Insert: {
          joined_at?: string
          last_seen?: string
          room_id: string
          user_id: string
        }
        Update: {
          joined_at?: string
          last_seen?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_members_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      room_messages: {
        Row: {
          body: string
          created_at: string
          id: string
          kind: string
          room_id: string
          user_id: string
        }
        Insert: {
          body: string
          created_at?: string
          id?: string
          kind?: string
          room_id: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          kind?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      room_moderators: {
        Row: {
          room_id: string
          user_id: string
        }
        Insert: {
          room_id: string
          user_id: string
        }
        Update: {
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_moderators_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_moderators_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      room_seats: {
        Row: {
          is_locked: boolean
          is_muted: boolean
          room_id: string
          seat_index: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          is_locked?: boolean
          is_muted?: boolean
          room_id: string
          seat_index: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          is_locked?: boolean
          is_muted?: boolean
          room_id?: string
          seat_index?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "room_seats_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_seats_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      rooms: {
        Row: {
          category: string
          country: string
          cover_url: string | null
          created_at: string
          description: string | null
          id: string
          is_private: boolean
          member_count: number
          name: string
          owner_id: string
          room_no: number
          seat_count: number
        }
        Insert: {
          category?: string
          country?: string
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_private?: boolean
          member_count?: number
          name: string
          owner_id: string
          room_no?: number
          seat_count?: number
        }
        Update: {
          category?: string
          country?: string
          cover_url?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_private?: boolean
          member_count?: number
          name?: string
          owner_id?: string
          room_no?: number
          seat_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "rooms_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      store_items: {
        Row: {
          asset_key: string
          created_at: string | null
          description: string | null
          id: string
          kind: string
          name: string
          price: number
          sort_order: number | null
        }
        Insert: {
          asset_key: string
          created_at?: string | null
          description?: string | null
          id?: string
          kind: string
          name: string
          price: number
          sort_order?: number | null
        }
        Update: {
          asset_key?: string
          created_at?: string | null
          description?: string | null
          id?: string
          kind?: string
          name?: string
          price?: number
          sort_order?: number | null
        }
        Relationships: []
      }
      user_blocks: {
        Row: {
          blocked_id: string
          blocker_id: string
        }
        Insert: {
          blocked_id: string
          blocker_id: string
        }
        Update: {
          blocked_id?: string
          blocker_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_blocks_blocked_id_fkey"
            columns: ["blocked_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_blocks_blocker_id_fkey"
            columns: ["blocker_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_items: {
        Row: {
          acquired_at: string | null
          id: string
          item_id: string
          user_id: string
        }
        Insert: {
          acquired_at?: string | null
          id?: string
          item_id: string
          user_id: string
        }
        Update: {
          acquired_at?: string | null
          id?: string
          item_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_items_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "store_items"
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
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      wallet_transactions: {
        Row: {
          amount: number
          created_at: string
          currency: string
          id: string
          reason: string
          ref_id: string | null
          user_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          currency: string
          id?: string
          reason: string
          ref_id?: string | null
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          currency?: string
          id?: string
          reason?: string
          ref_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallet_transactions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      wallets: {
        Row: {
          coins: number
          diamonds: number
          updated_at: string
          user_id: string
        }
        Insert: {
          coins?: number
          diamonds?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          coins?: number
          diamonds?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "wallets_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      admin_broadcast: {
        Args: { _body: string; _title: string }
        Returns: number
      }
      admin_delete_post: { Args: { _post: string }; Returns: undefined }
      admin_delete_room: { Args: { _room: string }; Returns: undefined }
      admin_delete_store_item: { Args: { _id: string }; Returns: undefined }
      admin_grant_coins:
        | { Args: { _amount: number; _user: string }; Returns: number }
        | { Args: { _amount: number; _user: string }; Returns: undefined }
      admin_list_audit: {
        Args: { _limit?: number }
        Returns: {
          action: string
          admin_id: string
          admin_name: string
          created_at: string
          details: string
          id: string
          target_id: string
          target_type: string
        }[]
      }
      admin_list_gift_tx: {
        Args: { _limit?: number }
        Returns: {
          cost: number
          created_at: string
          gift_name: string
          receiver_id: string
          receiver_name: string
          sender_id: string
          sender_name: string
        }[]
      }
      admin_list_reports: {
        Args: { _status: string }
        Returns: {
          admin_reply: string
          category: string
          created_at: string
          details: string
          id: string
          reporter_id: string
          reporter_name: string
          status: string
          target_id: string
          target_type: string
        }[]
      }
      admin_list_users: {
        Args: { _q: string }
        Returns: {
          coins: number
          created_at: string
          display_name: string
          display_no: number
          id: string
          level: number
          roles: string[]
          vip_level: number
        }[]
      }
      admin_list_wallet_tx: {
        Args: { _limit?: number }
        Returns: {
          amount: number
          created_at: string
          display_name: string
          kind: string
          note: string
          user_id: string
        }[]
      }
      admin_resolve_report: {
        Args: { _reply: string; _report: string; _status: string }
        Returns: undefined
      }
      admin_save_store_item: {
        Args: {
          _asset_key: string
          _description: string
          _id: string
          _kind: string
          _name: string
          _price: number
          _sort_order: number
        }
        Returns: string
      }
      admin_set_role: {
        Args: {
          _grant: boolean
          _role: Database["public"]["Enums"]["app_role"]
          _user: string
        }
        Returns: undefined
      }
      admin_set_vip: {
        Args: { _user: string; _vip: number }
        Returns: undefined
      }
      admin_stats: { Args: never; Returns: Json }
      ban_user: { Args: { _room: string; _user: string }; Returns: undefined }
      buy_item: { Args: { _item_id: string }; Returns: number }
      buy_vip: { Args: { _level: number }; Returns: number }
      claim_daily_bonus: { Args: never; Returns: number }
      claim_first_admin: { Args: never; Returns: boolean }
      create_family: {
        Args: { _description: string; _emblem: string; _name: string }
        Returns: string
      }
      create_room: {
        Args: {
          _category: string
          _country: string
          _description: string
          _is_private: boolean
          _name: string
          _seat_count: number
        }
        Returns: string
      }
      delete_room: { Args: { _room: string }; Returns: undefined }
      equip_item: {
        Args: { _equip: boolean; _item_id: string }
        Returns: undefined
      }
      family_decide: {
        Args: { _accept: boolean; _family: string; _user: string }
        Returns: undefined
      }
      get_or_create_conversation: { Args: { _other: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: { _uid: string }; Returns: boolean }
      is_room_staff: { Args: { _room: string; _uid: string }; Returns: boolean }
      join_room: { Args: { _room: string }; Returns: undefined }
      leave_family: { Args: never; Returns: undefined }
      leave_room: { Args: { _room: string }; Returns: undefined }
      leave_seat: { Args: { _room: string }; Returns: undefined }
      mark_conv_read: { Args: { _conv: string }; Returns: undefined }
      notify: {
        Args: {
          _actor: string
          _body: string
          _kind: string
          _ref: string
          _title: string
          _user: string
        }
        Returns: undefined
      }
      register_device: { Args: { _device: string }; Returns: string }
      request_account_deletion: {
        Args: { _cancel: boolean }
        Returns: undefined
      }
      request_join_family: { Args: { _family: string }; Returns: undefined }
      send_dm: { Args: { _body: string; _conv: string }; Returns: undefined }
      send_gift: {
        Args: { _gift: string; _qty: number; _receiver: string; _room: string }
        Returns: undefined
      }
      send_room_message: {
        Args: { _body: string; _room: string }
        Returns: undefined
      }
      staff_seat_action: {
        Args: { _action: string; _room: string; _seat: number }
        Returns: undefined
      }
      submit_report: {
        Args: {
          _category: string
          _details: string
          _target: string
          _type: string
        }
        Returns: string
      }
      take_seat: { Args: { _room: string; _seat: number }; Returns: undefined }
      toggle_my_mute: { Args: { _room: string }; Returns: undefined }
      update_room: {
        Args: {
          _category: string
          _cover_url: string
          _description: string
          _is_private: boolean
          _name: string
          _room: string
        }
        Returns: undefined
      }
      visit_profile: { Args: { _profile: string }; Returns: undefined }
      write_audit: {
        Args: {
          _action: string
          _details?: string
          _target_id?: string
          _target_type?: string
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "super_admin" | "admin" | "moderator" | "user"
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
    Enums: {
      app_role: ["super_admin", "admin", "moderator", "user"],
    },
  },
} as const
