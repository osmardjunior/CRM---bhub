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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      ai_automation_suggestions: {
        Row: {
          company_id: string
          contact_id: string | null
          conversation_id: string | null
          created_at: string | null
          id: string
          status: string | null
          suggestion_json: Json
        }
        Insert: {
          company_id: string
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          status?: string | null
          suggestion_json?: Json
        }
        Update: {
          company_id?: string
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          status?: string | null
          suggestion_json?: Json
        }
        Relationships: [
          {
            foreignKeyName: "ai_automation_suggestions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_automation_suggestions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_interactions: {
        Row: {
          company_id: string
          completion_tokens: number | null
          contact_id: string | null
          conversation_id: string | null
          cost_usd: number | null
          created_at: string | null
          id: string
          interaction_type: string
          model_used: string | null
          prompt_tokens: number | null
          user_id: string | null
        }
        Insert: {
          company_id: string
          completion_tokens?: number | null
          contact_id?: string | null
          conversation_id?: string | null
          cost_usd?: number | null
          created_at?: string | null
          id?: string
          interaction_type: string
          model_used?: string | null
          prompt_tokens?: number | null
          user_id?: string | null
        }
        Update: {
          company_id?: string
          completion_tokens?: number | null
          contact_id?: string | null
          conversation_id?: string | null
          cost_usd?: number | null
          created_at?: string | null
          id?: string
          interaction_type?: string
          model_used?: string | null
          prompt_tokens?: number | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_interactions_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_interactions_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      ai_reports: {
        Row: {
          company_id: string
          content_md: string
          created_at: string | null
          id: string
          metadata: Json | null
          period_end: string
          period_start: string
          user_id: string | null
        }
        Insert: {
          company_id: string
          content_md: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          period_end: string
          period_start: string
          user_id?: string | null
        }
        Update: {
          company_id?: string
          content_md?: string
          created_at?: string | null
          id?: string
          metadata?: Json | null
          period_end?: string
          period_start?: string
          user_id?: string | null
        }
        Relationships: []
      }
      annotations: {
        Row: {
          author_id: string
          body: string
          company_id: string
          conversation_id: string
          created_at: string
          id: string
        }
        Insert: {
          author_id: string
          body: string
          company_id: string
          conversation_id: string
          created_at?: string
          id?: string
        }
        Update: {
          author_id?: string
          body?: string
          company_id?: string
          conversation_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "annotations_author_id_fkey"
            columns: ["author_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annotations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "annotations_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance_history: {
        Row: {
          changed_by_user_id: string | null
          company_id: string
          contact_id: string | null
          conversation_id: string | null
          created_at: string | null
          duration_seconds: number | null
          from_status: string | null
          id: string
          to_status: string | null
        }
        Insert: {
          changed_by_user_id?: string | null
          company_id: string
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          from_status?: string | null
          id?: string
          to_status?: string | null
        }
        Update: {
          changed_by_user_id?: string | null
          company_id?: string
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          duration_seconds?: number | null
          from_status?: string | null
          id?: string
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_history_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_history_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      campaigns: {
        Row: {
          action_config: Json
          action_type: string
          company_id: string
          created_at: string
          deadline_at: string | null
          description: string | null
          filters: Json
          id: string
          name: string
          processed: number
          schedule_at: string | null
          send_window: Json
          skip_weekends: boolean
          status: string
          total_contacts: number
          updated_at: string
        }
        Insert: {
          action_config?: Json
          action_type?: string
          company_id: string
          created_at?: string
          deadline_at?: string | null
          description?: string | null
          filters?: Json
          id?: string
          name: string
          processed?: number
          schedule_at?: string | null
          send_window?: Json
          skip_weekends?: boolean
          status?: string
          total_contacts?: number
          updated_at?: string
        }
        Update: {
          action_config?: Json
          action_type?: string
          company_id?: string
          created_at?: string
          deadline_at?: string | null
          description?: string | null
          filters?: Json
          id?: string
          name?: string
          processed?: number
          schedule_at?: string | null
          send_window?: Json
          skip_weekends?: boolean
          status?: string
          total_contacts?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "campaigns_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_flows: {
        Row: {
          ai_instructions: string
          business_hours: Json
          channels: Json | null
          company_id: string
          created_at: string
          id: string
          is_active: boolean
          name: string
          offline_message: string
          timeout_minutes: number
          updated_at: string
        }
        Insert: {
          ai_instructions?: string
          business_hours?: Json
          channels?: Json | null
          company_id: string
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
          offline_message?: string
          timeout_minutes?: number
          updated_at?: string
        }
        Update: {
          ai_instructions?: string
          business_hours?: Json
          channels?: Json | null
          company_id?: string
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
          offline_message?: string
          timeout_minutes?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_flows_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      chatbot_nodes: {
        Row: {
          company_id: string
          config: Json
          created_at: string
          flow_id: string
          id: string
          node_type: Database["public"]["Enums"]["chatbot_node_type"]
          position: number
        }
        Insert: {
          company_id: string
          config?: Json
          created_at?: string
          flow_id: string
          id?: string
          node_type?: Database["public"]["Enums"]["chatbot_node_type"]
          position?: number
        }
        Update: {
          company_id?: string
          config?: Json
          created_at?: string
          flow_id?: string
          id?: string
          node_type?: Database["public"]["Enums"]["chatbot_node_type"]
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "chatbot_nodes_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chatbot_nodes_flow_id_fkey"
            columns: ["flow_id"]
            isOneToOne: false
            referencedRelation: "chatbot_flows"
            referencedColumns: ["id"]
          },
        ]
      }
      companies: {
        Row: {
          created_at: string
          id: string
          name: string
          plan: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          plan?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          plan?: string
          updated_at?: string
        }
        Relationships: []
      }
      contact_assignees: {
        Row: {
          assigned_at: string | null
          company_id: string
          contact_id: string
          user_id: string
        }
        Insert: {
          assigned_at?: string | null
          company_id: string
          contact_id: string
          user_id: string
        }
        Update: {
          assigned_at?: string | null
          company_id?: string
          contact_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_assignees_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_funnel_stages: {
        Row: {
          company_id: string
          contact_id: string
          funnel_id: string
          id: string
          stage_id: string
          updated_at: string | null
        }
        Insert: {
          company_id: string
          contact_id: string
          funnel_id: string
          id?: string
          stage_id: string
          updated_at?: string | null
        }
        Update: {
          company_id?: string
          contact_id?: string
          funnel_id?: string
          id?: string
          stage_id?: string
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_funnel_stages_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_funnel_stages_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_funnel_stages_stage_id_fkey"
            columns: ["stage_id"]
            isOneToOne: false
            referencedRelation: "funnel_stages"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_tags: {
        Row: {
          company_id: string
          contact_id: string
          created_at: string | null
          tag_id: string
        }
        Insert: {
          company_id: string
          contact_id: string
          created_at?: string | null
          tag_id: string
        }
        Update: {
          company_id?: string
          contact_id?: string
          created_at?: string | null
          tag_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contact_tags_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contact_tags_tag_id_fkey"
            columns: ["tag_id"]
            isOneToOne: false
            referencedRelation: "tags"
            referencedColumns: ["id"]
          },
        ]
      }
      contacts: {
        Row: {
          attendance_status: string | null
          avatar_url: string | null
          chatbot_enabled: boolean | null
          company_id: string
          created_at: string
          email: string | null
          has_unread: boolean | null
          id: string
          is_archived: boolean | null
          is_favorite: boolean | null
          is_group: boolean | null
          last_contact_at: string | null
          name: string
          notes: string | null
          origin_device_id: string | null
          phone: string | null
          responsible_user_id: string | null
          source: string | null
          tags: Json | null
          updated_at: string
        }
        Insert: {
          attendance_status?: string | null
          avatar_url?: string | null
          chatbot_enabled?: boolean | null
          company_id: string
          created_at?: string
          email?: string | null
          has_unread?: boolean | null
          id?: string
          is_archived?: boolean | null
          is_favorite?: boolean | null
          is_group?: boolean | null
          last_contact_at?: string | null
          name: string
          notes?: string | null
          origin_device_id?: string | null
          phone?: string | null
          responsible_user_id?: string | null
          source?: string | null
          tags?: Json | null
          updated_at?: string
        }
        Update: {
          attendance_status?: string | null
          avatar_url?: string | null
          chatbot_enabled?: boolean | null
          company_id?: string
          created_at?: string
          email?: string | null
          has_unread?: boolean | null
          id?: string
          is_archived?: boolean | null
          is_favorite?: boolean | null
          is_group?: boolean | null
          last_contact_at?: string | null
          name?: string
          notes?: string | null
          origin_device_id?: string | null
          phone?: string | null
          responsible_user_id?: string | null
          source?: string | null
          tags?: Json | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "contacts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "contacts_responsible_user_id_fkey"
            columns: ["responsible_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      conversation_reads: {
        Row: {
          company_id: string
          conversation_id: string
          id: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          conversation_id: string
          id?: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          conversation_id?: string
          id?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversation_reads_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversation_reads_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          assigned_user_id: string | null
          channel: Database["public"]["Enums"]["conversation_channel"]
          chatbot_active: boolean
          chatbot_current_node: string | null
          close_reason: string | null
          company_id: string
          contact_id: string
          created_at: string
          id: string
          last_message_at: string | null
          status: Database["public"]["Enums"]["conversation_status"]
          updated_at: string
        }
        Insert: {
          assigned_user_id?: string | null
          channel?: Database["public"]["Enums"]["conversation_channel"]
          chatbot_active?: boolean
          chatbot_current_node?: string | null
          close_reason?: string | null
          company_id: string
          contact_id: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          status?: Database["public"]["Enums"]["conversation_status"]
          updated_at?: string
        }
        Update: {
          assigned_user_id?: string | null
          channel?: Database["public"]["Enums"]["conversation_channel"]
          chatbot_active?: boolean
          chatbot_current_node?: string | null
          close_reason?: string | null
          company_id?: string
          contact_id?: string
          created_at?: string
          id?: string
          last_message_at?: string | null
          status?: Database["public"]["Enums"]["conversation_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_chatbot_current_node_fkey"
            columns: ["chatbot_current_node"]
            isOneToOne: false
            referencedRelation: "chatbot_nodes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_field_definitions: {
        Row: {
          company_id: string
          created_at: string | null
          field_type: string
          id: string
          name: string
          position: number | null
          slug: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          field_type?: string
          id?: string
          name: string
          position?: number | null
          slug: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          field_type?: string
          id?: string
          name?: string
          position?: number | null
          slug?: string
        }
        Relationships: []
      }
      custom_field_values: {
        Row: {
          company_id: string
          contact_id: string
          field_definition_id: string
          id: string
          updated_at: string | null
          value: string | null
        }
        Insert: {
          company_id: string
          contact_id: string
          field_definition_id: string
          id?: string
          updated_at?: string | null
          value?: string | null
        }
        Update: {
          company_id?: string
          contact_id?: string
          field_definition_id?: string
          id?: string
          updated_at?: string | null
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_values_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "custom_field_values_field_definition_id_fkey"
            columns: ["field_definition_id"]
            isOneToOne: false
            referencedRelation: "custom_field_definitions"
            referencedColumns: ["id"]
          },
        ]
      }
      deals: {
        Row: {
          assigned_user_id: string | null
          company_id: string
          contact_id: string | null
          created_at: string
          id: string
          notes: string | null
          probability: number
          stage: Database["public"]["Enums"]["deal_stage"]
          title: string
          updated_at: string
          value: number
        }
        Insert: {
          assigned_user_id?: string | null
          company_id: string
          contact_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          probability?: number
          stage?: Database["public"]["Enums"]["deal_stage"]
          title: string
          updated_at?: string
          value?: number
        }
        Update: {
          assigned_user_id?: string | null
          company_id?: string
          contact_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          probability?: number
          stage?: Database["public"]["Enums"]["deal_stage"]
          title?: string
          updated_at?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "deals_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "deals_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
        ]
      }
      delegation_history: {
        Row: {
          action: string
          actor_id: string | null
          company_id: string
          contact_id: string | null
          conversation_id: string | null
          created_at: string | null
          id: string
          is_automatic: boolean | null
          user_id: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          company_id: string
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          is_automatic?: boolean | null
          user_id?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          company_id?: string
          contact_id?: string | null
          conversation_id?: string | null
          created_at?: string | null
          id?: string
          is_automatic?: boolean | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "delegation_history_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "delegation_history_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      departments: {
        Row: {
          company_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "departments_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      funnel_stages: {
        Row: {
          company_id: string
          created_at: string
          funnel_id: string
          id: string
          label: string
          position: number
        }
        Insert: {
          company_id: string
          created_at?: string
          funnel_id: string
          id?: string
          label: string
          position?: number
        }
        Update: {
          company_id?: string
          created_at?: string
          funnel_id?: string
          id?: string
          label?: string
          position?: number
        }
        Relationships: [
          {
            foreignKeyName: "funnel_stages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "funnel_stages_funnel_id_fkey"
            columns: ["funnel_id"]
            isOneToOne: false
            referencedRelation: "funnels"
            referencedColumns: ["id"]
          },
        ]
      }
      funnels: {
        Row: {
          company_id: string
          created_at: string
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "funnels_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      integrations: {
        Row: {
          channel: string
          company_id: string
          config: Json
          created_at: string
          device_name: string | null
          id: string
          phone_number: string | null
          provider: string
          restrict_users: string[] | null
          status: string
          updated_at: string
        }
        Insert: {
          channel: string
          company_id: string
          config?: Json
          created_at?: string
          device_name?: string | null
          id?: string
          phone_number?: string | null
          provider?: string
          restrict_users?: string[] | null
          status?: string
          updated_at?: string
        }
        Update: {
          channel?: string
          company_id?: string
          config?: Json
          created_at?: string
          device_name?: string | null
          id?: string
          phone_number?: string | null
          provider?: string
          restrict_users?: string[] | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "integrations_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      message_reactions: {
        Row: {
          company_id: string
          created_at: string | null
          emoji: string
          id: string
          message_id: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string | null
          emoji: string
          id?: string
          message_id: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string | null
          emoji?: string
          id?: string
          message_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "message_reactions_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          body: string
          client_timestamp: string | null
          company_id: string
          conversation_id: string
          created_at: string
          delivery_status: string | null
          direction: string | null
          external_message_id: string | null
          id: string
          is_annotation: boolean | null
          media_file_id: string | null
          media_url: string | null
          processed_by_bot: boolean | null
          reply_to_message_id: string | null
          sender_id: string | null
          sender_name: string | null
          sender_type: Database["public"]["Enums"]["message_sender_type"]
          sent_by: string | null
          server_timestamp: string | null
          type: string | null
        }
        Insert: {
          body: string
          client_timestamp?: string | null
          company_id: string
          conversation_id: string
          created_at?: string
          delivery_status?: string | null
          direction?: string | null
          external_message_id?: string | null
          id?: string
          is_annotation?: boolean | null
          media_file_id?: string | null
          media_url?: string | null
          processed_by_bot?: boolean | null
          reply_to_message_id?: string | null
          sender_id?: string | null
          sender_name?: string | null
          sender_type?: Database["public"]["Enums"]["message_sender_type"]
          sent_by?: string | null
          server_timestamp?: string | null
          type?: string | null
        }
        Update: {
          body?: string
          client_timestamp?: string | null
          company_id?: string
          conversation_id?: string
          created_at?: string
          delivery_status?: string | null
          direction?: string | null
          external_message_id?: string | null
          id?: string
          is_annotation?: boolean | null
          media_file_id?: string | null
          media_url?: string | null
          processed_by_bot?: boolean | null
          reply_to_message_id?: string | null
          sender_id?: string | null
          sender_name?: string | null
          sender_type?: Database["public"]["Enums"]["message_sender_type"]
          sent_by?: string | null
          server_timestamp?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "messages_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
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
      profiles: {
        Row: {
          avatar_url: string | null
          company_id: string
          created_at: string
          email: string
          id: string
          name: string
          status: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          company_id: string
          created_at?: string
          email: string
          id: string
          name: string
          status?: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          company_id?: string
          created_at?: string
          email?: string
          id?: string
          name?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      quick_replies: {
        Row: {
          company_id: string
          created_at: string
          id: string
          message: string
          shortcut: string
          updated_at: string
          user_id: string
        }
        Insert: {
          company_id: string
          created_at?: string
          id?: string
          message: string
          shortcut: string
          updated_at?: string
          user_id: string
        }
        Update: {
          company_id?: string
          created_at?: string
          id?: string
          message?: string
          shortcut?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      satisfaction_surveys: {
        Row: {
          answered_at: string | null
          assigned_user_id: string | null
          comment: string | null
          company_id: string
          contact_id: string
          conversation_id: string
          created_at: string
          id: string
          score: number | null
          sent_at: string
        }
        Insert: {
          answered_at?: string | null
          assigned_user_id?: string | null
          comment?: string | null
          company_id: string
          contact_id: string
          conversation_id: string
          created_at?: string
          id?: string
          score?: number | null
          sent_at?: string
        }
        Update: {
          answered_at?: string | null
          assigned_user_id?: string | null
          comment?: string | null
          company_id?: string
          contact_id?: string
          conversation_id?: string
          created_at?: string
          id?: string
          score?: number | null
          sent_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "satisfaction_surveys_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "satisfaction_surveys_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "satisfaction_surveys_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "satisfaction_surveys_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_reports: {
        Row: {
          company_id: string
          created_at: string
          created_by: string
          filters: Json
          id: string
          name: string
          report_type: string
          show_on_home: boolean
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          created_by: string
          filters?: Json
          id?: string
          name: string
          report_type?: string
          show_on_home?: boolean
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          created_by?: string
          filters?: Json
          id?: string
          name?: string
          report_type?: string
          show_on_home?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      scheduled_messages: {
        Row: {
          cancelled_at: string | null
          company_id: string
          content: string
          conversation_id: string
          created_at: string | null
          created_by: string | null
          id: string
          media_url: string | null
          scheduled_at: string
          sent_at: string | null
          type: string | null
        }
        Insert: {
          cancelled_at?: string | null
          company_id: string
          content: string
          conversation_id: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          media_url?: string | null
          scheduled_at: string
          sent_at?: string | null
          type?: string | null
        }
        Update: {
          cancelled_at?: string | null
          company_id?: string
          content?: string
          conversation_id?: string
          created_at?: string | null
          created_by?: string | null
          id?: string
          media_url?: string | null
          scheduled_at?: string
          sent_at?: string | null
          type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "scheduled_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      tags: {
        Row: {
          color: string
          company_id: string
          created_at: string
          id: string
          name: string
        }
        Insert: {
          color?: string
          company_id: string
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          color?: string
          company_id?: string
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: [
          {
            foreignKeyName: "tags_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_user_id: string | null
          company_id: string
          contact_id: string | null
          created_at: string
          deal_id: string | null
          description: string | null
          due_date: string | null
          id: string
          priority: Database["public"]["Enums"]["task_priority"]
          status: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at: string
        }
        Insert: {
          assigned_user_id?: string | null
          company_id: string
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          updated_at?: string
        }
        Update: {
          assigned_user_id?: string | null
          company_id?: string
          contact_id?: string | null
          created_at?: string
          deal_id?: string | null
          description?: string | null
          due_date?: string | null
          id?: string
          priority?: Database["public"]["Enums"]["task_priority"]
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_user_id_fkey"
            columns: ["assigned_user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_contact_id_fkey"
            columns: ["contact_id"]
            isOneToOne: false
            referencedRelation: "contacts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_deal_id_fkey"
            columns: ["deal_id"]
            isOneToOne: false
            referencedRelation: "deals"
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
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
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
      current_company_id: { Args: never; Returns: string }
      get_agent_metrics: {
        Args: { date_from: string; date_to: string }
        Returns: {
          agent_id: string
          agent_name: string
          avg_first_response_seconds: number
          avg_nps: number
          avg_resolution_seconds: number
          conversations_handled: number
        }[]
      }
      get_user_company_id: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "supervisor" | "agent"
      chatbot_node_type:
        | "message"
        | "menu"
        | "collect_data"
        | "ai_response"
        | "transfer"
        | "condition"
        | "apply_tag"
        | "move_to_funnel"
        | "delegate"
        | "close_chat"
        | "delay"
        | "webhook"
      conversation_channel: "whatsapp" | "instagram" | "webchat"
      conversation_status: "open" | "pending" | "closed"
      deal_stage:
        | "novo_lead"
        | "em_contato"
        | "proposta"
        | "fechamento"
        | "ganho"
        | "perdido"
      message_sender_type: "user" | "agent" | "system"
      task_priority: "alta" | "media" | "baixa"
      task_status: "pendente" | "em_progresso" | "concluida"
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
      chatbot_node_type: [
        "message",
        "menu",
        "collect_data",
        "ai_response",
        "transfer",
        "condition",
        "apply_tag",
        "move_to_funnel",
        "delegate",
        "close_chat",
        "delay",
        "webhook",
      ],
      conversation_channel: ["whatsapp", "instagram", "webchat"],
      conversation_status: ["open", "pending", "closed"],
      deal_stage: [
        "novo_lead",
        "em_contato",
        "proposta",
        "fechamento",
        "ganho",
        "perdido",
      ],
      message_sender_type: ["user", "agent", "system"],
      task_priority: ["alta", "media", "baixa"],
      task_status: ["pendente", "em_progresso", "concluida"],
    },
  },
} as const
