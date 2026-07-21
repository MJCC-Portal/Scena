// AUTO-GENERATED from the live Supabase project (zglbgqeccebqnijcqfkb) via
// `mcp__supabase__generate_typescript_types`. Do not hand-edit — regenerate
// instead so this never silently diverges from production.
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
      billing_customers: {
        Row: {
          created_at: string
          stripe_customer_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          stripe_customer_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          stripe_customer_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      billing_events: {
        Row: {
          error_message: string | null
          event_type: string
          livemode: boolean
          payload: Json
          processed_at: string | null
          processing_status: string
          received_at: string
          stripe_event_id: string
        }
        Insert: {
          error_message?: string | null
          event_type: string
          livemode: boolean
          payload: Json
          processed_at?: string | null
          processing_status?: string
          received_at?: string
          stripe_event_id: string
        }
        Update: {
          error_message?: string | null
          event_type?: string
          livemode?: boolean
          payload?: Json
          processed_at?: string | null
          processing_status?: string
          received_at?: string
          stripe_event_id?: string
        }
        Relationships: []
      }
      billing_notification_outbox: {
        Row: {
          attempt_count: number
          created_at: string
          id: string
          last_error: string | null
          notification_type: string
          org_id: string | null
          payload: Json
          send_after: string
          sent_at: string | null
          status: string
          stripe_event_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          attempt_count?: number
          created_at?: string
          id?: string
          last_error?: string | null
          notification_type: string
          org_id?: string | null
          payload?: Json
          send_after?: string
          sent_at?: string | null
          status?: string
          stripe_event_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          attempt_count?: number
          created_at?: string
          id?: string
          last_error?: string | null
          notification_type?: string
          org_id?: string | null
          payload?: Json
          send_after?: string
          sent_at?: string | null
          status?: string
          stripe_event_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_notification_outbox_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      checkout_sessions: {
        Row: {
          completed_at: string | null
          created_at: string
          expires_at: string | null
          id: string
          plan_code: string
          requested_team_name: string
          requested_team_slug: string
          status: string
          stripe_checkout_session_id: string
          stripe_customer_id: string
          stripe_subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          plan_code: string
          requested_team_name: string
          requested_team_slug: string
          status?: string
          stripe_checkout_session_id: string
          stripe_customer_id: string
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          expires_at?: string | null
          id?: string
          plan_code?: string
          requested_team_name?: string
          requested_team_slug?: string
          status?: string
          stripe_checkout_session_id?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "checkout_sessions_plan_code_fkey"
            columns: ["plan_code"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["plan_code"]
          },
        ]
      }
      display_automations: {
        Row: {
          action_type: string
          created_at: string
          created_by: string | null
          cron_expression: string | null
          id: string
          is_enabled: boolean
          last_run_at: string | null
          location_id: string
          name: string
          next_run_at: string | null
          org_id: string
          run_once_at: string | null
          schedule_type: string
          session_id: string
          target_display_mode: string | null
          target_layout_id: string | null
          target_session_screen_id: string | null
          timezone: string
          updated_at: string
        }
        Insert: {
          action_type: string
          created_at?: string
          created_by?: string | null
          cron_expression?: string | null
          id?: string
          is_enabled?: boolean
          last_run_at?: string | null
          location_id: string
          name: string
          next_run_at?: string | null
          org_id: string
          run_once_at?: string | null
          schedule_type: string
          session_id: string
          target_display_mode?: string | null
          target_layout_id?: string | null
          target_session_screen_id?: string | null
          timezone?: string
          updated_at?: string
        }
        Update: {
          action_type?: string
          created_at?: string
          created_by?: string | null
          cron_expression?: string | null
          id?: string
          is_enabled?: boolean
          last_run_at?: string | null
          location_id?: string
          name?: string
          next_run_at?: string | null
          org_id?: string
          run_once_at?: string | null
          schedule_type?: string
          session_id?: string
          target_display_mode?: string | null
          target_layout_id?: string | null
          target_session_screen_id?: string | null
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "display_automations_session_id_org_id_location_id_fkey"
            columns: ["session_id", "org_id", "location_id"]
            isOneToOne: false
            referencedRelation: "display_sessions"
            referencedColumns: ["id", "org_id", "location_id"]
          },
          {
            foreignKeyName: "display_automations_target_layout_id_org_id_location_id_fkey"
            columns: ["target_layout_id", "org_id", "location_id"]
            isOneToOne: false
            referencedRelation: "display_layouts"
            referencedColumns: ["id", "org_id", "location_id"]
          },
          {
            foreignKeyName: "display_automations_target_session_screen_id_org_id_locati_fkey"
            columns: [
              "target_session_screen_id",
              "org_id",
              "location_id",
              "session_id",
            ]
            isOneToOne: false
            referencedRelation: "display_session_screens"
            referencedColumns: ["id", "org_id", "location_id", "session_id"]
          },
        ]
      }
      display_layout_tiles: {
        Row: {
          config: Json
          created_at: string
          height_percent: number
          id: string
          is_visible: boolean
          layout_id: string
          location_id: string
          org_id: string
          scene_id: string
          updated_at: string
          width_percent: number
          x_percent: number
          y_percent: number
          z_index: number
        }
        Insert: {
          config?: Json
          created_at?: string
          height_percent?: number
          id?: string
          is_visible?: boolean
          layout_id: string
          location_id: string
          org_id: string
          scene_id: string
          updated_at?: string
          width_percent?: number
          x_percent?: number
          y_percent?: number
          z_index?: number
        }
        Update: {
          config?: Json
          created_at?: string
          height_percent?: number
          id?: string
          is_visible?: boolean
          layout_id?: string
          location_id?: string
          org_id?: string
          scene_id?: string
          updated_at?: string
          width_percent?: number
          x_percent?: number
          y_percent?: number
          z_index?: number
        }
        Relationships: [
          {
            foreignKeyName: "display_layout_tiles_layout_id_org_id_location_id_fkey"
            columns: ["layout_id", "org_id", "location_id"]
            isOneToOne: false
            referencedRelation: "display_layouts"
            referencedColumns: ["id", "org_id", "location_id"]
          },
          {
            foreignKeyName: "display_layout_tiles_scene_id_org_id_location_id_fkey"
            columns: ["scene_id", "org_id", "location_id"]
            isOneToOne: false
            referencedRelation: "scenes"
            referencedColumns: ["id", "org_id", "location_id"]
          },
        ]
      }
      display_layouts: {
        Row: {
          background_color: string
          canvas_height: number
          canvas_width: number
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          location_id: string
          name: string
          org_id: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          background_color?: string
          canvas_height?: number
          canvas_width?: number
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          location_id: string
          name: string
          org_id: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          background_color?: string
          canvas_height?: number
          canvas_width?: number
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          location_id?: string
          name?: string
          org_id?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "display_layouts_location_id_org_id_fkey"
            columns: ["location_id", "org_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      display_session_screens: {
        Row: {
          activated_at: string | null
          added_at: string
          added_by: string | null
          assignment_status: string
          id: string
          is_enabled: boolean
          is_primary: boolean
          layout_id: string | null
          location_id: string
          org_id: string
          removed_at: string | null
          removed_by: string | null
          rotation_degrees: number
          screen_id: string
          screen_order: number
          session_id: string
          viewport_height_percent: number
          viewport_width_percent: number
          viewport_x_percent: number
          viewport_y_percent: number
        }
        Insert: {
          activated_at?: string | null
          added_at?: string
          added_by?: string | null
          assignment_status?: string
          id?: string
          is_enabled?: boolean
          is_primary?: boolean
          layout_id?: string | null
          location_id: string
          org_id: string
          removed_at?: string | null
          removed_by?: string | null
          rotation_degrees?: number
          screen_id: string
          screen_order?: number
          session_id: string
          viewport_height_percent?: number
          viewport_width_percent?: number
          viewport_x_percent?: number
          viewport_y_percent?: number
        }
        Update: {
          activated_at?: string | null
          added_at?: string
          added_by?: string | null
          assignment_status?: string
          id?: string
          is_enabled?: boolean
          is_primary?: boolean
          layout_id?: string | null
          location_id?: string
          org_id?: string
          removed_at?: string | null
          removed_by?: string | null
          rotation_degrees?: number
          screen_id?: string
          screen_order?: number
          session_id?: string
          viewport_height_percent?: number
          viewport_width_percent?: number
          viewport_x_percent?: number
          viewport_y_percent?: number
        }
        Relationships: [
          {
            foreignKeyName: "display_session_screens_layout_id_org_id_location_id_fkey"
            columns: ["layout_id", "org_id", "location_id"]
            isOneToOne: false
            referencedRelation: "display_layouts"
            referencedColumns: ["id", "org_id", "location_id"]
          },
          {
            foreignKeyName: "display_session_screens_screen_id_org_id_location_id_fkey"
            columns: ["screen_id", "org_id", "location_id"]
            isOneToOne: false
            referencedRelation: "screens"
            referencedColumns: ["id", "org_id", "location_id"]
          },
          {
            foreignKeyName: "display_session_screens_session_id_org_id_location_id_fkey"
            columns: ["session_id", "org_id", "location_id"]
            isOneToOne: false
            referencedRelation: "display_sessions"
            referencedColumns: ["id", "org_id", "location_id"]
          },
        ]
      }
      display_sessions: {
        Row: {
          created_at: string
          created_by: string | null
          display_mode: string
          id: string
          location_id: string
          name: string
          org_id: string
          shared_layout_id: string | null
          started_at: string | null
          started_by: string | null
          status: string
          stopped_at: string | null
          stopped_by: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          display_mode?: string
          id?: string
          location_id: string
          name: string
          org_id: string
          shared_layout_id?: string | null
          started_at?: string | null
          started_by?: string | null
          status?: string
          stopped_at?: string | null
          stopped_by?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          display_mode?: string
          id?: string
          location_id?: string
          name?: string
          org_id?: string
          shared_layout_id?: string | null
          started_at?: string | null
          started_by?: string | null
          status?: string
          stopped_at?: string | null
          stopped_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "display_sessions_location_id_org_id_fkey"
            columns: ["location_id", "org_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "display_sessions_shared_layout_id_org_id_location_id_fkey"
            columns: ["shared_layout_id", "org_id", "location_id"]
            isOneToOne: false
            referencedRelation: "display_layouts"
            referencedColumns: ["id", "org_id", "location_id"]
          },
        ]
      }
      locations: {
        Row: {
          created_at: string
          id: string
          name: string
          org_id: string
          slug: string
          status: string
          timezone: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          org_id: string
          slug: string
          status?: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          org_id?: string
          slug?: string
          status?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "locations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      menu_items: {
        Row: {
          created_at: string
          description: string | null
          id: string
          image_url: string | null
          is_sold_out: boolean
          is_visible: boolean
          name: string
          org_id: string
          price: number
          section_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_sold_out?: boolean
          is_visible?: boolean
          name: string
          org_id: string
          price: number
          section_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          image_url?: string | null
          is_sold_out?: boolean
          is_visible?: boolean
          name?: string
          org_id?: string
          price?: number
          section_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_items_section_id_org_id_fkey"
            columns: ["section_id", "org_id"]
            isOneToOne: false
            referencedRelation: "menu_sections"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      menu_sections: {
        Row: {
          created_at: string
          id: string
          is_visible: boolean
          menu_id: string
          name: string
          org_id: string
          sort_order: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_visible?: boolean
          menu_id: string
          name: string
          org_id: string
          sort_order?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          is_visible?: boolean
          menu_id?: string
          name?: string
          org_id?: string
          sort_order?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menu_sections_menu_id_org_id_fkey"
            columns: ["menu_id", "org_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      menus: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          location_id: string
          name: string
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          location_id: string
          name: string
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          location_id?: string
          name?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "menus_location_id_org_id_fkey"
            columns: ["location_id", "org_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      organization_entitlements: {
        Row: {
          allow_display_groups: boolean
          allow_resource_access_controls: boolean
          allow_session_groups: boolean
          automation_tier: string
          max_boards: number
          max_concurrent_sessions: number
          max_displays: number
          max_displays_per_session: number
          max_members: number
          org_id: string
          plan_code: string
          updated_at: string
        }
        Insert: {
          allow_display_groups?: boolean
          allow_resource_access_controls?: boolean
          allow_session_groups?: boolean
          automation_tier?: string
          max_boards?: number
          max_concurrent_sessions?: number
          max_displays?: number
          max_displays_per_session?: number
          max_members?: number
          org_id: string
          plan_code: string
          updated_at?: string
        }
        Update: {
          allow_display_groups?: boolean
          allow_resource_access_controls?: boolean
          allow_session_groups?: boolean
          automation_tier?: string
          max_boards?: number
          max_concurrent_sessions?: number
          max_displays?: number
          max_displays_per_session?: number
          max_members?: number
          org_id?: string
          plan_code?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_entitlements_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          invited_by: string | null
          joined_at: string
          org_id: string
          role: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          invited_by?: string | null
          joined_at?: string
          org_id: string
          role?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          invited_by?: string | null
          joined_at?: string
          org_id?: string
          role?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_preferences: {
        Row: {
          branding: Json
          created_at: string
          default_session_settings: Json
          locale: string
          org_id: string
          timezone: string
          updated_at: string
        }
        Insert: {
          branding?: Json
          created_at?: string
          default_session_settings?: Json
          locale?: string
          org_id: string
          timezone?: string
          updated_at?: string
        }
        Update: {
          branding?: Json
          created_at?: string
          default_session_settings?: Json
          locale?: string
          org_id?: string
          timezone?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_preferences_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          name: string
          slug: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          name: string
          slug: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          name?: string
          slug?: string
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      plans: {
        Row: {
          billing_interval: string | null
          created_at: string
          currency: string | null
          is_active: boolean
          name: string
          plan_code: string
          stripe_price_id: string | null
          stripe_product_id: string
          unit_amount: number | null
          updated_at: string
        }
        Insert: {
          billing_interval?: string | null
          created_at?: string
          currency?: string | null
          is_active?: boolean
          name: string
          plan_code: string
          stripe_price_id?: string | null
          stripe_product_id: string
          unit_amount?: number | null
          updated_at?: string
        }
        Update: {
          billing_interval?: string | null
          created_at?: string
          currency?: string | null
          is_active?: boolean
          name?: string
          plan_code?: string
          stripe_price_id?: string | null
          stripe_product_id?: string
          unit_amount?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      presentation_assets: {
        Row: {
          checksum_sha256: string | null
          created_at: string
          error_message: string | null
          id: string
          lxc_manifest_key: string | null
          lxc_source_key: string | null
          mime_type: string
          org_id: string
          original_filename: string
          size_bytes: number | null
          slide_count: number | null
          status: string
          updated_at: string
          uploaded_by: string | null
        }
        Insert: {
          checksum_sha256?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          lxc_manifest_key?: string | null
          lxc_source_key?: string | null
          mime_type: string
          org_id: string
          original_filename: string
          size_bytes?: number | null
          slide_count?: number | null
          status?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Update: {
          checksum_sha256?: string | null
          created_at?: string
          error_message?: string | null
          id?: string
          lxc_manifest_key?: string | null
          lxc_source_key?: string | null
          mime_type?: string
          org_id?: string
          original_filename?: string
          size_bytes?: number | null
          slide_count?: number | null
          status?: string
          updated_at?: string
          uploaded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "presentation_assets_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          onboarding_state: string
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          onboarding_state?: string
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          onboarding_state?: string
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      scenes: {
        Row: {
          config: Json
          created_at: string
          created_by: string | null
          id: string
          is_active: boolean
          location_id: string
          menu_id: string | null
          name: string
          org_id: string
          presentation_asset_id: string | null
          scene_type: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          config?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          location_id: string
          menu_id?: string | null
          name: string
          org_id: string
          presentation_asset_id?: string | null
          scene_type: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          config?: Json
          created_at?: string
          created_by?: string | null
          id?: string
          is_active?: boolean
          location_id?: string
          menu_id?: string | null
          name?: string
          org_id?: string
          presentation_asset_id?: string | null
          scene_type?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scenes_location_id_org_id_fkey"
            columns: ["location_id", "org_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id", "org_id"]
          },
          {
            foreignKeyName: "scenes_menu_id_org_id_location_id_fkey"
            columns: ["menu_id", "org_id", "location_id"]
            isOneToOne: false
            referencedRelation: "menus"
            referencedColumns: ["id", "org_id", "location_id"]
          },
          {
            foreignKeyName: "scenes_presentation_asset_id_org_id_fkey"
            columns: ["presentation_asset_id", "org_id"]
            isOneToOne: false
            referencedRelation: "presentation_assets"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      screen_pairing_codes: {
        Row: {
          attempt_count: number
          code_hash: string
          consumed_at: string | null
          created_at: string
          expires_at: string
          locked_until: string | null
          screen_id: string
        }
        Insert: {
          attempt_count?: number
          code_hash: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          locked_until?: string | null
          screen_id: string
        }
        Update: {
          attempt_count?: number
          code_hash?: string
          consumed_at?: string | null
          created_at?: string
          expires_at?: string
          locked_until?: string | null
          screen_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "screen_pairing_codes_screen_id_fkey"
            columns: ["screen_id"]
            isOneToOne: true
            referencedRelation: "screens"
            referencedColumns: ["id"]
          },
        ]
      }
      screens: {
        Row: {
          claimed_at: string | null
          created_at: string
          device_token_hash: string
          id: string
          last_seen_at: string | null
          location_id: string | null
          name: string
          org_id: string | null
          revoked_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          claimed_at?: string | null
          created_at?: string
          device_token_hash: string
          id?: string
          last_seen_at?: string | null
          location_id?: string | null
          name?: string
          org_id?: string | null
          revoked_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          claimed_at?: string | null
          created_at?: string
          device_token_hash?: string
          id?: string
          last_seen_at?: string | null
          location_id?: string | null
          name?: string
          org_id?: string | null
          revoked_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "screens_location_id_org_id_fkey"
            columns: ["location_id", "org_id"]
            isOneToOne: false
            referencedRelation: "locations"
            referencedColumns: ["id", "org_id"]
          },
        ]
      }
      team_invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          org_id: string
          role: string
          status: string
          token_hash: string
          updated_at: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          org_id: string
          role?: string
          status?: string
          token_hash: string
          updated_at?: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          org_id?: string
          role?: string
          status?: string
          token_hash?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_invitations_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_preferences: {
        Row: {
          created_at: string
          last_org_id: string | null
          locale: string
          notifications: Json
          theme: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          last_org_id?: string | null
          locale?: string
          notifications?: Json
          theme?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          last_org_id?: string | null
          locale?: string
          notifications?: Json
          theme?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_preferences_last_org_id_fkey"
            columns: ["last_org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          cancelled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          org_id: string
          owner_user_id: string
          plan_code: string
          status: string
          stripe_customer_id: string
          stripe_price_id: string
          stripe_subscription_id: string
          updated_at: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          org_id: string
          owner_user_id: string
          plan_code: string
          status: string
          stripe_customer_id: string
          stripe_price_id: string
          stripe_subscription_id: string
          updated_at?: string
        }
        Update: {
          cancel_at_period_end?: boolean
          cancelled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          org_id?: string
          owner_user_id?: string
          plan_code?: string
          status?: string
          stripe_customer_id?: string
          stripe_price_id?: string
          stripe_subscription_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_subscriptions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_subscriptions_plan_code_fkey"
            columns: ["plan_code"]
            isOneToOne: false
            referencedRelation: "plans"
            referencedColumns: ["plan_code"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_team_invitation: {
        Args: { raw_token: string }
        Returns: {
          org_id: string
          role: string
        }[]
      }
      claimed_display_session_id: { Args: never; Returns: string }
      create_team_invitation: {
        Args: {
          expires_in_days?: number
          target_email: string
          target_org_id: string
          target_role?: string
        }
        Returns: {
          expires_at: string
          invitation_id: string
          token: string
        }[]
      }
      enqueue_billing_notification: {
        Args: {
          target_notification_type: string
          target_payload?: Json
          target_send_after?: string
          target_stripe_event_id: string
          target_stripe_subscription_id: string
        }
        Returns: string
      }
      finalize_paid_team_subscription: {
        Args: {
          target_cancel_at_period_end?: boolean
          target_period_end: string
          target_period_start: string
          target_plan_code: string
          target_status: string
          target_stripe_customer_id: string
          target_stripe_price_id: string
          target_stripe_subscription_id: string
          target_team_name: string
          target_team_slug: string
          target_user_id: string
        }
        Returns: string
      }
      provision_paid_team: {
        Args: {
          creator_user_id: string
          selected_plan: string
          team_name: string
          team_slug: string
        }
        Returns: {
          org_id: string
          plan_code: string
          team_slug_result: string
        }[]
      }
      revoke_team_invitation: {
        Args: { target_invitation_id: string }
        Returns: boolean
      }
      sync_paid_team_subscription: {
        Args: {
          target_cancel_at_period_end: boolean
          target_cancelled_at: string
          target_period_end: string
          target_period_start: string
          target_plan_code: string
          target_status: string
          target_stripe_price_id: string
          target_stripe_subscription_id: string
        }
        Returns: string
      }
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
    Enums: {},
  },
} as const
