// GENERATED FILE — DO NOT EDIT BY HAND.
//
// Produced by `npm run db:types`, which introspects a live database. Every hand edit is reverted
// by the next run, and CI fails the build on any difference between this file and a fresh
// generation (`npm run db:check-types`). If a type here is wrong, the migration is wrong.
//
// Source of truth: supabase/migrations/**.

export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      activity_events: {
        Row: {
          id: string
          occurred_at: string
          actor_id: string | null
          actor_role: Database['public']['Enums']['user_role'] | null
          action: string
          entity_type: string | null
          entity_id: string | null
          entity_label: string | null
          summary: string | null
          metadata: Json
        }
        Insert: {
          id?: string
          occurred_at?: string
          actor_id?: string | null
          actor_role?: Database['public']['Enums']['user_role'] | null
          action: string
          entity_type?: string | null
          entity_id?: string | null
          entity_label?: string | null
          summary?: string | null
          metadata?: Json
        }
        Update: {
          id?: string
          occurred_at?: string
          actor_id?: string | null
          actor_role?: Database['public']['Enums']['user_role'] | null
          action?: string
          entity_type?: string | null
          entity_id?: string | null
          entity_label?: string | null
          summary?: string | null
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: 'activity_events_actor_id_fkey'
            columns: ['actor_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      audit_logs: {
        Row: {
          id: string
          occurred_at: string
          actor_user_id: string | null
          actor_role: Database['public']['Enums']['user_role'] | null
          action: string
          entity_type: string | null
          entity_id: string | null
          summary: string | null
          before: Json | null
          after: Json | null
          result: string
          request_id: string | null
          ip: unknown | null
          user_agent: string | null
        }
        Insert: {
          id?: string
          occurred_at?: string
          actor_user_id?: string | null
          actor_role?: Database['public']['Enums']['user_role'] | null
          action: string
          entity_type?: string | null
          entity_id?: string | null
          summary?: string | null
          before?: Json | null
          after?: Json | null
          result: string
          request_id?: string | null
          ip?: unknown | null
          user_agent?: string | null
        }
        Update: {
          id?: string
          occurred_at?: string
          actor_user_id?: string | null
          actor_role?: Database['public']['Enums']['user_role'] | null
          action?: string
          entity_type?: string | null
          entity_id?: string | null
          summary?: string | null
          before?: Json | null
          after?: Json | null
          result?: string
          request_id?: string | null
          ip?: unknown | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'audit_logs_actor_user_id_fkey'
            columns: ['actor_user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      categories: {
        Row: {
          id: string
          slug: string
          parent_id: string | null
          name: string
          subtitle: string | null
          description: string | null
          sort_order: number
          is_primary: boolean
          hero_media_id: string | null
          seo_title: string | null
          seo_description: string | null
          created_at: string
          updated_at: string
          updated_by: string | null
          status: Database['public']['Enums']['content_status']
          owner_verification: Database['public']['Enums']['owner_verification']
          fact_classification: Database['public']['Enums']['fact_classification'] | null
          published_at: string | null
          published_by: string | null
          seed_key: string | null
          content_seed_version: string | null
          seed_content_hash: string | null
          seed_last_applied_at: string | null
          owner_edited: boolean
        }
        Insert: {
          id?: string
          slug: string
          parent_id?: string | null
          name: string
          subtitle?: string | null
          description?: string | null
          sort_order?: number
          is_primary?: boolean
          hero_media_id?: string | null
          seo_title?: string | null
          seo_description?: string | null
          created_at?: string
          updated_at?: string
          updated_by?: string | null
          status?: Database['public']['Enums']['content_status']
          owner_verification?: Database['public']['Enums']['owner_verification']
          fact_classification?: Database['public']['Enums']['fact_classification'] | null
          published_at?: string | null
          published_by?: string | null
          seed_key?: string | null
          content_seed_version?: string | null
          seed_content_hash?: string | null
          seed_last_applied_at?: string | null
          owner_edited?: boolean
        }
        Update: {
          id?: string
          slug?: string
          parent_id?: string | null
          name?: string
          subtitle?: string | null
          description?: string | null
          sort_order?: number
          is_primary?: boolean
          hero_media_id?: string | null
          seo_title?: string | null
          seo_description?: string | null
          created_at?: string
          updated_at?: string
          updated_by?: string | null
          status?: Database['public']['Enums']['content_status']
          owner_verification?: Database['public']['Enums']['owner_verification']
          fact_classification?: Database['public']['Enums']['fact_classification'] | null
          published_at?: string | null
          published_by?: string | null
          seed_key?: string | null
          content_seed_version?: string | null
          seed_content_hash?: string | null
          seed_last_applied_at?: string | null
          owner_edited?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'categories_hero_media_id_fkey'
            columns: ['hero_media_id']
            isOneToOne: false
            referencedRelation: 'media_assets'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'categories_parent_id_fkey'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'categories_published_by_fkey'
            columns: ['published_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'categories_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      collections: {
        Row: {
          id: string
          slug: string
          name: string
          statement: string | null
          concept_state: Database['public']['Enums']['collection_concept_state']
          hero_media_id: string | null
          sort_order: number
          created_at: string
          updated_at: string
          updated_by: string | null
          status: Database['public']['Enums']['content_status']
          owner_verification: Database['public']['Enums']['owner_verification']
          fact_classification: Database['public']['Enums']['fact_classification'] | null
          published_at: string | null
          published_by: string | null
          seed_key: string | null
          content_seed_version: string | null
          seed_content_hash: string | null
          seed_last_applied_at: string | null
          owner_edited: boolean
          page_id: string | null
          subtitle: string | null
          statement_long: string | null
          signature_media_id: string | null
          video_media_id: string | null
          seo_entry_id: string | null
          owner_confirmed_at: string | null
          owner_confirmed_by: string | null
        }
        Insert: {
          id?: string
          slug: string
          name: string
          statement?: string | null
          concept_state?: Database['public']['Enums']['collection_concept_state']
          hero_media_id?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
          updated_by?: string | null
          status?: Database['public']['Enums']['content_status']
          owner_verification?: Database['public']['Enums']['owner_verification']
          fact_classification?: Database['public']['Enums']['fact_classification'] | null
          published_at?: string | null
          published_by?: string | null
          seed_key?: string | null
          content_seed_version?: string | null
          seed_content_hash?: string | null
          seed_last_applied_at?: string | null
          owner_edited?: boolean
          page_id?: string | null
          subtitle?: string | null
          statement_long?: string | null
          signature_media_id?: string | null
          video_media_id?: string | null
          seo_entry_id?: string | null
          owner_confirmed_at?: string | null
          owner_confirmed_by?: string | null
        }
        Update: {
          id?: string
          slug?: string
          name?: string
          statement?: string | null
          concept_state?: Database['public']['Enums']['collection_concept_state']
          hero_media_id?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
          updated_by?: string | null
          status?: Database['public']['Enums']['content_status']
          owner_verification?: Database['public']['Enums']['owner_verification']
          fact_classification?: Database['public']['Enums']['fact_classification'] | null
          published_at?: string | null
          published_by?: string | null
          seed_key?: string | null
          content_seed_version?: string | null
          seed_content_hash?: string | null
          seed_last_applied_at?: string | null
          owner_edited?: boolean
          page_id?: string | null
          subtitle?: string | null
          statement_long?: string | null
          signature_media_id?: string | null
          video_media_id?: string | null
          seo_entry_id?: string | null
          owner_confirmed_at?: string | null
          owner_confirmed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'collections_hero_media_id_fkey'
            columns: ['hero_media_id']
            isOneToOne: false
            referencedRelation: 'media_assets'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'collections_owner_confirmed_by_fkey'
            columns: ['owner_confirmed_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'collections_page_id_fkey'
            columns: ['page_id']
            isOneToOne: true
            referencedRelation: 'pages'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'collections_published_by_fkey'
            columns: ['published_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'collections_seo_entry_id_fkey'
            columns: ['seo_entry_id']
            isOneToOne: false
            referencedRelation: 'seo_entries'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'collections_signature_media_id_fkey'
            columns: ['signature_media_id']
            isOneToOne: false
            referencedRelation: 'media_assets'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'collections_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'collections_video_media_id_fkey'
            columns: ['video_media_id']
            isOneToOne: false
            referencedRelation: 'media_assets'
            referencedColumns: ['id']
          },
        ]
      }
      content_revisions: {
        Row: {
          id: string
          entity_type: string
          entity_id: string
          revision_no: number
          action: string
          snapshot: Json
          change_summary: string | null
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          entity_type: string
          entity_id: string
          revision_no: number
          action: string
          snapshot: Json
          change_summary?: string | null
          created_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          entity_type?: string
          entity_id?: string
          revision_no?: number
          action?: string
          snapshot?: Json
          change_summary?: string | null
          created_at?: string
          created_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'content_revisions_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      content_seed_runs: {
        Row: {
          id: string
          seed_version: string
          started_at: string
          finished_at: string | null
          actor: string | null
          is_dry_run: boolean
          inserted_count: number
          updated_count: number
          skipped_owner_edited_count: number
          failed_count: number
          report: Json
          deferred_count: number
        }
        Insert: {
          id?: string
          seed_version: string
          started_at?: string
          finished_at?: string | null
          actor?: string | null
          is_dry_run?: boolean
          inserted_count?: number
          updated_count?: number
          skipped_owner_edited_count?: number
          failed_count?: number
          report?: Json
          deferred_count?: number
        }
        Update: {
          id?: string
          seed_version?: string
          started_at?: string
          finished_at?: string | null
          actor?: string | null
          is_dry_run?: boolean
          inserted_count?: number
          updated_count?: number
          skipped_owner_edited_count?: number
          failed_count?: number
          report?: Json
          deferred_count?: number
        }
        Relationships: []
      }
      customization_form_fields: {
        Row: {
          id: string
          form_id: string
          step_id: string
          key: string
          label: string
          help_text: string | null
          placeholder: string | null
          field_type: Database['public']['Enums']['form_field_type']
          options: Json
          validation: Json
          is_enabled: boolean
          is_required: boolean
          position: number
          include_in_whatsapp: boolean
          seed_key: string | null
          content_seed_version: string | null
          seed_content_hash: string | null
          seed_last_applied_at: string | null
          owner_edited: boolean
          created_at: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          form_id: string
          step_id: string
          key: string
          label: string
          help_text?: string | null
          placeholder?: string | null
          field_type?: Database['public']['Enums']['form_field_type']
          options?: Json
          validation?: Json
          is_enabled?: boolean
          is_required?: boolean
          position?: number
          include_in_whatsapp?: boolean
          seed_key?: string | null
          content_seed_version?: string | null
          seed_content_hash?: string | null
          seed_last_applied_at?: string | null
          owner_edited?: boolean
          created_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          form_id?: string
          step_id?: string
          key?: string
          label?: string
          help_text?: string | null
          placeholder?: string | null
          field_type?: Database['public']['Enums']['form_field_type']
          options?: Json
          validation?: Json
          is_enabled?: boolean
          is_required?: boolean
          position?: number
          include_in_whatsapp?: boolean
          seed_key?: string | null
          content_seed_version?: string | null
          seed_content_hash?: string | null
          seed_last_applied_at?: string | null
          owner_edited?: boolean
          created_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'customization_form_fields_form_id_fkey'
            columns: ['form_id']
            isOneToOne: false
            referencedRelation: 'customization_forms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'customization_form_fields_step_fk'
            columns: ['step_id', 'form_id']
            isOneToOne: false
            referencedRelation: 'customization_form_steps'
            referencedColumns: ['id', 'form_id']
          },
          {
            foreignKeyName: 'customization_form_fields_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      customization_form_steps: {
        Row: {
          id: string
          form_id: string
          key: string
          title: string
          description: string | null
          position: number
          is_enabled: boolean
          is_required: boolean
          seed_key: string | null
          content_seed_version: string | null
          seed_content_hash: string | null
          seed_last_applied_at: string | null
          owner_edited: boolean
          created_at: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          form_id: string
          key: string
          title: string
          description?: string | null
          position?: number
          is_enabled?: boolean
          is_required?: boolean
          seed_key?: string | null
          content_seed_version?: string | null
          seed_content_hash?: string | null
          seed_last_applied_at?: string | null
          owner_edited?: boolean
          created_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          form_id?: string
          key?: string
          title?: string
          description?: string | null
          position?: number
          is_enabled?: boolean
          is_required?: boolean
          seed_key?: string | null
          content_seed_version?: string | null
          seed_content_hash?: string | null
          seed_last_applied_at?: string | null
          owner_edited?: boolean
          created_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'customization_form_steps_form_id_fkey'
            columns: ['form_id']
            isOneToOne: false
            referencedRelation: 'customization_forms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'customization_form_steps_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      customization_forms: {
        Row: {
          id: string
          slug: string
          name: string
          kind: Database['public']['Enums']['form_kind']
          description: string | null
          intro_heading: string | null
          intro_body: string | null
          submit_label_key: string | null
          is_default: boolean
          status: Database['public']['Enums']['content_status']
          owner_verification: Database['public']['Enums']['owner_verification']
          fact_classification: Database['public']['Enums']['fact_classification']
          seed_key: string | null
          content_seed_version: string | null
          seed_content_hash: string | null
          seed_last_applied_at: string | null
          owner_edited: boolean
          published_at: string | null
          published_by: string | null
          created_at: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          slug: string
          name: string
          kind?: Database['public']['Enums']['form_kind']
          description?: string | null
          intro_heading?: string | null
          intro_body?: string | null
          submit_label_key?: string | null
          is_default?: boolean
          status?: Database['public']['Enums']['content_status']
          owner_verification?: Database['public']['Enums']['owner_verification']
          fact_classification?: Database['public']['Enums']['fact_classification']
          seed_key?: string | null
          content_seed_version?: string | null
          seed_content_hash?: string | null
          seed_last_applied_at?: string | null
          owner_edited?: boolean
          published_at?: string | null
          published_by?: string | null
          created_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          slug?: string
          name?: string
          kind?: Database['public']['Enums']['form_kind']
          description?: string | null
          intro_heading?: string | null
          intro_body?: string | null
          submit_label_key?: string | null
          is_default?: boolean
          status?: Database['public']['Enums']['content_status']
          owner_verification?: Database['public']['Enums']['owner_verification']
          fact_classification?: Database['public']['Enums']['fact_classification']
          seed_key?: string | null
          content_seed_version?: string | null
          seed_content_hash?: string | null
          seed_last_applied_at?: string | null
          owner_edited?: boolean
          published_at?: string | null
          published_by?: string | null
          created_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'customization_forms_published_by_fkey'
            columns: ['published_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'customization_forms_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      entity_relations: {
        Row: {
          id: string
          source_type: Database['public']['Enums']['relation_entity']
          source_id: string
          target_type: Database['public']['Enums']['relation_entity']
          target_id: string
          relation_type: Database['public']['Enums']['relation_kind']
          note: string | null
          sort_order: number
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          source_type: Database['public']['Enums']['relation_entity']
          source_id: string
          target_type: Database['public']['Enums']['relation_entity']
          target_id: string
          relation_type: Database['public']['Enums']['relation_kind']
          note?: string | null
          sort_order?: number
          created_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          source_type?: Database['public']['Enums']['relation_entity']
          source_id?: string
          target_type?: Database['public']['Enums']['relation_entity']
          target_id?: string
          relation_type?: Database['public']['Enums']['relation_kind']
          note?: string | null
          sort_order?: number
          created_at?: string
          created_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'entity_relations_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      faqs: {
        Row: {
          id: string
          question: string
          answer: string
          category: string | null
          position: number
          status: Database['public']['Enums']['content_status']
          owner_verification: Database['public']['Enums']['owner_verification']
          fact_classification: Database['public']['Enums']['fact_classification']
          seed_key: string | null
          content_seed_version: string | null
          seed_content_hash: string | null
          seed_last_applied_at: string | null
          owner_edited: boolean
          created_at: string
          updated_at: string
          updated_by: string | null
          published_at: string | null
          published_by: string | null
        }
        Insert: {
          id?: string
          question: string
          answer: string
          category?: string | null
          position?: number
          status?: Database['public']['Enums']['content_status']
          owner_verification?: Database['public']['Enums']['owner_verification']
          fact_classification?: Database['public']['Enums']['fact_classification']
          seed_key?: string | null
          content_seed_version?: string | null
          seed_content_hash?: string | null
          seed_last_applied_at?: string | null
          owner_edited?: boolean
          created_at?: string
          updated_at?: string
          updated_by?: string | null
          published_at?: string | null
          published_by?: string | null
        }
        Update: {
          id?: string
          question?: string
          answer?: string
          category?: string | null
          position?: number
          status?: Database['public']['Enums']['content_status']
          owner_verification?: Database['public']['Enums']['owner_verification']
          fact_classification?: Database['public']['Enums']['fact_classification']
          seed_key?: string | null
          content_seed_version?: string | null
          seed_content_hash?: string | null
          seed_last_applied_at?: string | null
          owner_edited?: boolean
          created_at?: string
          updated_at?: string
          updated_by?: string | null
          published_at?: string | null
          published_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'faqs_published_by_fkey'
            columns: ['published_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'faqs_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      feature_flags: {
        Row: {
          key: string
          description: string | null
          is_enabled: boolean
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          key: string
          description?: string | null
          is_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          key?: string
          description?: string | null
          is_enabled?: boolean
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'feature_flags_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      global_content: {
        Row: {
          id: string
          group_key: string
          key: string
          label: string | null
          value: string
          description: string | null
          is_enabled: boolean
          fact_classification: Database['public']['Enums']['fact_classification']
          owner_verification: Database['public']['Enums']['owner_verification']
          status: Database['public']['Enums']['content_status']
          seed_key: string | null
          content_seed_version: string | null
          seed_content_hash: string | null
          seed_last_applied_at: string | null
          owner_edited: boolean
          created_at: string
          updated_at: string
          updated_by: string | null
          published_at: string | null
          published_by: string | null
        }
        Insert: {
          id?: string
          group_key: string
          key: string
          label?: string | null
          value: string
          description?: string | null
          is_enabled?: boolean
          fact_classification?: Database['public']['Enums']['fact_classification']
          owner_verification?: Database['public']['Enums']['owner_verification']
          status?: Database['public']['Enums']['content_status']
          seed_key?: string | null
          content_seed_version?: string | null
          seed_content_hash?: string | null
          seed_last_applied_at?: string | null
          owner_edited?: boolean
          created_at?: string
          updated_at?: string
          updated_by?: string | null
          published_at?: string | null
          published_by?: string | null
        }
        Update: {
          id?: string
          group_key?: string
          key?: string
          label?: string | null
          value?: string
          description?: string | null
          is_enabled?: boolean
          fact_classification?: Database['public']['Enums']['fact_classification']
          owner_verification?: Database['public']['Enums']['owner_verification']
          status?: Database['public']['Enums']['content_status']
          seed_key?: string | null
          content_seed_version?: string | null
          seed_content_hash?: string | null
          seed_last_applied_at?: string | null
          owner_edited?: boolean
          created_at?: string
          updated_at?: string
          updated_by?: string | null
          published_at?: string | null
          published_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'global_content_published_by_fkey'
            columns: ['published_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'global_content_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      higgsfield_migration_runs: {
        Row: {
          id: string
          started_at: string
          finished_at: string | null
          manifest_version: string
          requested_scope: string
          attempted: number
          migrated: number
          skipped: number
          failed: number
          dry_run: boolean
          run_by: string | null
          log: Json
        }
        Insert: {
          id?: string
          started_at?: string
          finished_at?: string | null
          manifest_version: string
          requested_scope?: string
          attempted?: number
          migrated?: number
          skipped?: number
          failed?: number
          dry_run?: boolean
          run_by?: string | null
          log?: Json
        }
        Update: {
          id?: string
          started_at?: string
          finished_at?: string | null
          manifest_version?: string
          requested_scope?: string
          attempted?: number
          migrated?: number
          skipped?: number
          failed?: number
          dry_run?: boolean
          run_by?: string | null
          log?: Json
        }
        Relationships: [
          {
            foreignKeyName: 'higgsfield_migration_runs_run_by_fkey'
            columns: ['run_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      inquiries: {
        Row: {
          id: string
          reference_code: string
          kind: Database['public']['Enums']['inquiry_kind']
          pipeline_status: Database['public']['Enums']['inquiry_status']
          source_path: string | null
          product_id: string | null
          collection_id: string | null
          customization_form_id: string | null
          name: string
          phone: string
          email: string | null
          city: string | null
          message: string | null
          answers: Json
          enquiry_type: string | null
          whatsapp_state: Database['public']['Enums']['whatsapp_state']
          whatsapp_shortened_at_level: number | null
          consent_contact: boolean
          referrer: string | null
          utm: Json | null
          ip_hash: string | null
          user_agent: string | null
          assigned_to: string | null
          created_at: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          reference_code: string
          kind: Database['public']['Enums']['inquiry_kind']
          pipeline_status?: Database['public']['Enums']['inquiry_status']
          source_path?: string | null
          product_id?: string | null
          collection_id?: string | null
          customization_form_id?: string | null
          name: string
          phone: string
          email?: string | null
          city?: string | null
          message?: string | null
          answers?: Json
          enquiry_type?: string | null
          whatsapp_state?: Database['public']['Enums']['whatsapp_state']
          whatsapp_shortened_at_level?: number | null
          consent_contact?: boolean
          referrer?: string | null
          utm?: Json | null
          ip_hash?: string | null
          user_agent?: string | null
          assigned_to?: string | null
          created_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          reference_code?: string
          kind?: Database['public']['Enums']['inquiry_kind']
          pipeline_status?: Database['public']['Enums']['inquiry_status']
          source_path?: string | null
          product_id?: string | null
          collection_id?: string | null
          customization_form_id?: string | null
          name?: string
          phone?: string
          email?: string | null
          city?: string | null
          message?: string | null
          answers?: Json
          enquiry_type?: string | null
          whatsapp_state?: Database['public']['Enums']['whatsapp_state']
          whatsapp_shortened_at_level?: number | null
          consent_contact?: boolean
          referrer?: string | null
          utm?: Json | null
          ip_hash?: string | null
          user_agent?: string | null
          assigned_to?: string | null
          created_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'inquiries_assigned_to_fkey'
            columns: ['assigned_to']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'inquiries_collection_id_fkey'
            columns: ['collection_id']
            isOneToOne: false
            referencedRelation: 'collections'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'inquiries_customization_form_id_fkey'
            columns: ['customization_form_id']
            isOneToOne: false
            referencedRelation: 'customization_forms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'inquiries_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'inquiries_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      inquiry_attachments: {
        Row: {
          inquiry_id: string
          media_asset_id: string
          position: number
          created_at: string
        }
        Insert: {
          inquiry_id: string
          media_asset_id: string
          position?: number
          created_at?: string
        }
        Update: {
          inquiry_id?: string
          media_asset_id?: string
          position?: number
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'inquiry_attachments_inquiry_id_fkey'
            columns: ['inquiry_id']
            isOneToOne: false
            referencedRelation: 'inquiries'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'inquiry_attachments_media_asset_id_fkey'
            columns: ['media_asset_id']
            isOneToOne: false
            referencedRelation: 'media_assets'
            referencedColumns: ['id']
          },
        ]
      }
      inquiry_events: {
        Row: {
          id: string
          inquiry_id: string
          event: Database['public']['Enums']['inquiry_event_kind']
          actor_id: string | null
          from_status: Database['public']['Enums']['inquiry_status'] | null
          to_status: Database['public']['Enums']['inquiry_status'] | null
          note: string | null
          metadata: Json
          occurred_at: string
        }
        Insert: {
          id?: string
          inquiry_id: string
          event: Database['public']['Enums']['inquiry_event_kind']
          actor_id?: string | null
          from_status?: Database['public']['Enums']['inquiry_status'] | null
          to_status?: Database['public']['Enums']['inquiry_status'] | null
          note?: string | null
          metadata?: Json
          occurred_at?: string
        }
        Update: {
          id?: string
          inquiry_id?: string
          event?: Database['public']['Enums']['inquiry_event_kind']
          actor_id?: string | null
          from_status?: Database['public']['Enums']['inquiry_status'] | null
          to_status?: Database['public']['Enums']['inquiry_status'] | null
          note?: string | null
          metadata?: Json
          occurred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'inquiry_events_actor_id_fkey'
            columns: ['actor_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'inquiry_events_inquiry_id_fkey'
            columns: ['inquiry_id']
            isOneToOne: false
            referencedRelation: 'inquiries'
            referencedColumns: ['id']
          },
        ]
      }
      journal_article_categories: {
        Row: {
          article_id: string
          category_id: string
          position: number
          created_at: string
          created_by: string | null
        }
        Insert: {
          article_id: string
          category_id: string
          position?: number
          created_at?: string
          created_by?: string | null
        }
        Update: {
          article_id?: string
          category_id?: string
          position?: number
          created_at?: string
          created_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'journal_article_categories_article_id_fkey'
            columns: ['article_id']
            isOneToOne: false
            referencedRelation: 'journal_articles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'journal_article_categories_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'journal_categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'journal_article_categories_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      journal_articles: {
        Row: {
          id: string
          slug: string
          page_id: string | null
          title: string
          standfirst: string | null
          excerpt: string | null
          angle_note: string | null
          primary_category_id: string | null
          cover_media_id: string | null
          cover_mobile_media_id: string | null
          byline: string
          reading_minutes: number | null
          seo_entry_id: string | null
          status: Database['public']['Enums']['content_status']
          owner_verification: Database['public']['Enums']['owner_verification']
          fact_classification: Database['public']['Enums']['fact_classification']
          seed_key: string | null
          content_seed_version: string | null
          seed_content_hash: string | null
          seed_last_applied_at: string | null
          owner_edited: boolean
          published_at: string | null
          published_by: string | null
          created_at: string
          updated_at: string
          updated_by: string | null
          is_demo: boolean
        }
        Insert: {
          id?: string
          slug: string
          page_id?: string | null
          title: string
          standfirst?: string | null
          excerpt?: string | null
          angle_note?: string | null
          primary_category_id?: string | null
          cover_media_id?: string | null
          cover_mobile_media_id?: string | null
          byline?: string
          reading_minutes?: number | null
          seo_entry_id?: string | null
          status?: Database['public']['Enums']['content_status']
          owner_verification?: Database['public']['Enums']['owner_verification']
          fact_classification?: Database['public']['Enums']['fact_classification']
          seed_key?: string | null
          content_seed_version?: string | null
          seed_content_hash?: string | null
          seed_last_applied_at?: string | null
          owner_edited?: boolean
          published_at?: string | null
          published_by?: string | null
          created_at?: string
          updated_at?: string
          updated_by?: string | null
          is_demo?: boolean
        }
        Update: {
          id?: string
          slug?: string
          page_id?: string | null
          title?: string
          standfirst?: string | null
          excerpt?: string | null
          angle_note?: string | null
          primary_category_id?: string | null
          cover_media_id?: string | null
          cover_mobile_media_id?: string | null
          byline?: string
          reading_minutes?: number | null
          seo_entry_id?: string | null
          status?: Database['public']['Enums']['content_status']
          owner_verification?: Database['public']['Enums']['owner_verification']
          fact_classification?: Database['public']['Enums']['fact_classification']
          seed_key?: string | null
          content_seed_version?: string | null
          seed_content_hash?: string | null
          seed_last_applied_at?: string | null
          owner_edited?: boolean
          published_at?: string | null
          published_by?: string | null
          created_at?: string
          updated_at?: string
          updated_by?: string | null
          is_demo?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'journal_articles_cover_media_id_fkey'
            columns: ['cover_media_id']
            isOneToOne: false
            referencedRelation: 'media_assets'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'journal_articles_cover_mobile_media_id_fkey'
            columns: ['cover_mobile_media_id']
            isOneToOne: false
            referencedRelation: 'media_assets'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'journal_articles_page_id_fkey'
            columns: ['page_id']
            isOneToOne: true
            referencedRelation: 'pages'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'journal_articles_primary_category_id_fkey'
            columns: ['primary_category_id']
            isOneToOne: false
            referencedRelation: 'journal_categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'journal_articles_published_by_fkey'
            columns: ['published_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'journal_articles_seo_entry_id_fkey'
            columns: ['seo_entry_id']
            isOneToOne: false
            referencedRelation: 'seo_entries'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'journal_articles_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      journal_categories: {
        Row: {
          id: string
          slug: string
          name: string
          description: string | null
          intro_heading: string | null
          position: number
          status: Database['public']['Enums']['content_status']
          owner_verification: Database['public']['Enums']['owner_verification']
          fact_classification: Database['public']['Enums']['fact_classification']
          seed_key: string | null
          content_seed_version: string | null
          seed_content_hash: string | null
          seed_last_applied_at: string | null
          owner_edited: boolean
          published_at: string | null
          published_by: string | null
          created_at: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          slug: string
          name: string
          description?: string | null
          intro_heading?: string | null
          position?: number
          status?: Database['public']['Enums']['content_status']
          owner_verification?: Database['public']['Enums']['owner_verification']
          fact_classification?: Database['public']['Enums']['fact_classification']
          seed_key?: string | null
          content_seed_version?: string | null
          seed_content_hash?: string | null
          seed_last_applied_at?: string | null
          owner_edited?: boolean
          published_at?: string | null
          published_by?: string | null
          created_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          slug?: string
          name?: string
          description?: string | null
          intro_heading?: string | null
          position?: number
          status?: Database['public']['Enums']['content_status']
          owner_verification?: Database['public']['Enums']['owner_verification']
          fact_classification?: Database['public']['Enums']['fact_classification']
          seed_key?: string | null
          content_seed_version?: string | null
          seed_content_hash?: string | null
          seed_last_applied_at?: string | null
          owner_edited?: boolean
          published_at?: string | null
          published_by?: string | null
          created_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'journal_categories_published_by_fkey'
            columns: ['published_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'journal_categories_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      materials: {
        Row: {
          id: string
          slug: string
          name: string
          family: string
          description: string | null
          created_at: string
          updated_at: string
          updated_by: string | null
          status: Database['public']['Enums']['content_status']
          owner_verification: Database['public']['Enums']['owner_verification']
          fact_classification: Database['public']['Enums']['fact_classification'] | null
          published_at: string | null
          published_by: string | null
          seed_key: string | null
          content_seed_version: string | null
          seed_content_hash: string | null
          seed_last_applied_at: string | null
          owner_edited: boolean
        }
        Insert: {
          id?: string
          slug: string
          name: string
          family: string
          description?: string | null
          created_at?: string
          updated_at?: string
          updated_by?: string | null
          status?: Database['public']['Enums']['content_status']
          owner_verification?: Database['public']['Enums']['owner_verification']
          fact_classification?: Database['public']['Enums']['fact_classification'] | null
          published_at?: string | null
          published_by?: string | null
          seed_key?: string | null
          content_seed_version?: string | null
          seed_content_hash?: string | null
          seed_last_applied_at?: string | null
          owner_edited?: boolean
        }
        Update: {
          id?: string
          slug?: string
          name?: string
          family?: string
          description?: string | null
          created_at?: string
          updated_at?: string
          updated_by?: string | null
          status?: Database['public']['Enums']['content_status']
          owner_verification?: Database['public']['Enums']['owner_verification']
          fact_classification?: Database['public']['Enums']['fact_classification'] | null
          published_at?: string | null
          published_by?: string | null
          seed_key?: string | null
          content_seed_version?: string | null
          seed_content_hash?: string | null
          seed_last_applied_at?: string | null
          owner_edited?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'materials_published_by_fkey'
            columns: ['published_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'materials_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      media_assets: {
        Row: {
          id: string
          provider: string
          resource_type: string
          public_id: string
          folder: string
          filename: string | null
          rivya_asset_id: string | null
          kind: Database['public']['Enums']['media_kind']
          alt_text: string
          is_ai_generated: boolean
          is_concept: boolean
          width: number | null
          height: number | null
          aspect_ratio: string | null
          duration_s: number | null
          uploaded_by: string | null
          created_at: string
          updated_at: string
          updated_by: string | null
          status: Database['public']['Enums']['content_status']
          owner_verification: Database['public']['Enums']['owner_verification']
          fact_classification: Database['public']['Enums']['fact_classification'] | null
          published_at: string | null
          published_by: string | null
          source: Database['public']['Enums']['media_source']
          title: string | null
          caption: string | null
          tags: string[]
          subject_tags: string[]
          mime_type: string | null
          bytes: number | null
          checksum: string | null
          poster_public_id: string | null
          model_format: string | null
          file_size_bytes: number | null
          poly_count: number | null
          texture_count: number | null
          model_thumbnail_id: string | null
          model_poster_id: string | null
          associated_product_id: string | null
          associated_project_id: string | null
          higgsfield_generation_id: string | null
          higgsfield_model: string | null
          higgsfield_prompt: string | null
          manifest_version: string | null
          migrated_at: string | null
          viewer_settings: Json
        }
        Insert: {
          id?: string
          provider?: string
          resource_type: string
          public_id: string
          folder: string
          filename?: string | null
          rivya_asset_id?: string | null
          kind: Database['public']['Enums']['media_kind']
          alt_text: string
          is_ai_generated: boolean
          is_concept: boolean
          width?: number | null
          height?: number | null
          aspect_ratio?: string | null
          duration_s?: number | null
          uploaded_by?: string | null
          created_at?: string
          updated_at?: string
          updated_by?: string | null
          status?: Database['public']['Enums']['content_status']
          owner_verification?: Database['public']['Enums']['owner_verification']
          fact_classification?: Database['public']['Enums']['fact_classification'] | null
          published_at?: string | null
          published_by?: string | null
          source: Database['public']['Enums']['media_source']
          title?: string | null
          caption?: string | null
          tags?: string[]
          subject_tags?: string[]
          mime_type?: string | null
          bytes?: number | null
          checksum?: string | null
          poster_public_id?: string | null
          model_format?: string | null
          file_size_bytes?: number | null
          poly_count?: number | null
          texture_count?: number | null
          model_thumbnail_id?: string | null
          model_poster_id?: string | null
          associated_product_id?: string | null
          associated_project_id?: string | null
          higgsfield_generation_id?: string | null
          higgsfield_model?: string | null
          higgsfield_prompt?: string | null
          manifest_version?: string | null
          migrated_at?: string | null
          viewer_settings?: Json
        }
        Update: {
          id?: string
          provider?: string
          resource_type?: string
          public_id?: string
          folder?: string
          filename?: string | null
          rivya_asset_id?: string | null
          kind?: Database['public']['Enums']['media_kind']
          alt_text?: string
          is_ai_generated?: boolean
          is_concept?: boolean
          width?: number | null
          height?: number | null
          aspect_ratio?: string | null
          duration_s?: number | null
          uploaded_by?: string | null
          created_at?: string
          updated_at?: string
          updated_by?: string | null
          status?: Database['public']['Enums']['content_status']
          owner_verification?: Database['public']['Enums']['owner_verification']
          fact_classification?: Database['public']['Enums']['fact_classification'] | null
          published_at?: string | null
          published_by?: string | null
          source?: Database['public']['Enums']['media_source']
          title?: string | null
          caption?: string | null
          tags?: string[]
          subject_tags?: string[]
          mime_type?: string | null
          bytes?: number | null
          checksum?: string | null
          poster_public_id?: string | null
          model_format?: string | null
          file_size_bytes?: number | null
          poly_count?: number | null
          texture_count?: number | null
          model_thumbnail_id?: string | null
          model_poster_id?: string | null
          associated_product_id?: string | null
          associated_project_id?: string | null
          higgsfield_generation_id?: string | null
          higgsfield_model?: string | null
          higgsfield_prompt?: string | null
          manifest_version?: string | null
          migrated_at?: string | null
          viewer_settings?: Json
        }
        Relationships: [
          {
            foreignKeyName: 'media_assets_associated_product_id_fkey'
            columns: ['associated_product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'media_assets_associated_project_fk'
            columns: ['associated_project_id']
            isOneToOne: false
            referencedRelation: 'portfolio_projects'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'media_assets_model_poster_id_fkey'
            columns: ['model_poster_id']
            isOneToOne: false
            referencedRelation: 'media_assets'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'media_assets_model_thumbnail_id_fkey'
            columns: ['model_thumbnail_id']
            isOneToOne: false
            referencedRelation: 'media_assets'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'media_assets_published_by_fkey'
            columns: ['published_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'media_assets_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'media_assets_uploaded_by_fkey'
            columns: ['uploaded_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      media_usages: {
        Row: {
          id: string
          media_id: string
          context_type: string
          context_id: string
          slot_key: string
          role: string
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          media_id: string
          context_type: string
          context_id: string
          slot_key: string
          role: string
          created_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          media_id?: string
          context_type?: string
          context_id?: string
          slot_key?: string
          role?: string
          created_at?: string
          created_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'media_usages_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'media_usages_media_id_fkey'
            columns: ['media_id']
            isOneToOne: false
            referencedRelation: 'media_assets'
            referencedColumns: ['id']
          },
        ]
      }
      model_variant_labels: {
        Row: {
          id: string
          media_asset_id: string
          variant_key: string
          label: string
          material_id: string | null
          position: number
          fact_classification: Database['public']['Enums']['fact_classification']
          owner_verification: Database['public']['Enums']['owner_verification']
          created_at: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          media_asset_id: string
          variant_key: string
          label: string
          material_id?: string | null
          position?: number
          fact_classification?: Database['public']['Enums']['fact_classification']
          owner_verification?: Database['public']['Enums']['owner_verification']
          created_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          media_asset_id?: string
          variant_key?: string
          label?: string
          material_id?: string | null
          position?: number
          fact_classification?: Database['public']['Enums']['fact_classification']
          owner_verification?: Database['public']['Enums']['owner_verification']
          created_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'model_variant_labels_material_id_fkey'
            columns: ['material_id']
            isOneToOne: false
            referencedRelation: 'materials'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'model_variant_labels_media_asset_id_fkey'
            columns: ['media_asset_id']
            isOneToOne: false
            referencedRelation: 'media_assets'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'model_variant_labels_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      navigation_items: {
        Row: {
          id: string
          menu: string
          parent_id: string | null
          label: string
          href: string
          position: number
          is_visible: boolean
          target: string
          status: Database['public']['Enums']['content_status']
          owner_verification: Database['public']['Enums']['owner_verification']
          fact_classification: Database['public']['Enums']['fact_classification']
          seed_key: string | null
          content_seed_version: string | null
          seed_content_hash: string | null
          seed_last_applied_at: string | null
          owner_edited: boolean
          created_at: string
          updated_at: string
          updated_by: string | null
          published_at: string | null
          published_by: string | null
        }
        Insert: {
          id?: string
          menu: string
          parent_id?: string | null
          label: string
          href: string
          position: number
          is_visible?: boolean
          target?: string
          status?: Database['public']['Enums']['content_status']
          owner_verification?: Database['public']['Enums']['owner_verification']
          fact_classification?: Database['public']['Enums']['fact_classification']
          seed_key?: string | null
          content_seed_version?: string | null
          seed_content_hash?: string | null
          seed_last_applied_at?: string | null
          owner_edited?: boolean
          created_at?: string
          updated_at?: string
          updated_by?: string | null
          published_at?: string | null
          published_by?: string | null
        }
        Update: {
          id?: string
          menu?: string
          parent_id?: string | null
          label?: string
          href?: string
          position?: number
          is_visible?: boolean
          target?: string
          status?: Database['public']['Enums']['content_status']
          owner_verification?: Database['public']['Enums']['owner_verification']
          fact_classification?: Database['public']['Enums']['fact_classification']
          seed_key?: string | null
          content_seed_version?: string | null
          seed_content_hash?: string | null
          seed_last_applied_at?: string | null
          owner_edited?: boolean
          created_at?: string
          updated_at?: string
          updated_by?: string | null
          published_at?: string | null
          published_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'navigation_items_parent_id_fkey'
            columns: ['parent_id']
            isOneToOne: false
            referencedRelation: 'navigation_items'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'navigation_items_published_by_fkey'
            columns: ['published_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'navigation_items_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      page_sections: {
        Row: {
          id: string
          page_id: string
          block_type: string
          position: number
          is_visible: boolean
          theme: string | null
          layout_variant: string | null
          eyebrow: string | null
          heading: string | null
          heading_highlight: string | null
          body: string | null
          supporting: string | null
          cta_label: string | null
          cta_url: string | null
          cta_secondary_label: string | null
          cta_secondary_url: string | null
          media_desktop_id: string | null
          media_mobile_id: string | null
          media_alt_override: string | null
          media_slot_key: string | null
          payload: Json
          fact_classification: Database['public']['Enums']['fact_classification']
          field_classifications: Json
          owner_verification: Database['public']['Enums']['owner_verification']
          status: Database['public']['Enums']['content_status']
          publish_at: string | null
          unpublish_at: string | null
          schedule_state: string
          schedule_attempts: number
          schedule_error: string | null
          schedule_last_attempt_at: string | null
          seed_key: string | null
          content_seed_version: string | null
          seed_content_hash: string | null
          seed_last_applied_at: string | null
          owner_edited: boolean
          created_at: string
          updated_at: string
          updated_by: string | null
          published_at: string | null
          published_by: string | null
          is_demo: boolean
        }
        Insert: {
          id?: string
          page_id: string
          block_type: string
          position: number
          is_visible?: boolean
          theme?: string | null
          layout_variant?: string | null
          eyebrow?: string | null
          heading?: string | null
          heading_highlight?: string | null
          body?: string | null
          supporting?: string | null
          cta_label?: string | null
          cta_url?: string | null
          cta_secondary_label?: string | null
          cta_secondary_url?: string | null
          media_desktop_id?: string | null
          media_mobile_id?: string | null
          media_alt_override?: string | null
          media_slot_key?: string | null
          payload?: Json
          fact_classification?: Database['public']['Enums']['fact_classification']
          field_classifications?: Json
          owner_verification?: Database['public']['Enums']['owner_verification']
          status?: Database['public']['Enums']['content_status']
          publish_at?: string | null
          unpublish_at?: string | null
          schedule_state?: string
          schedule_attempts?: number
          schedule_error?: string | null
          schedule_last_attempt_at?: string | null
          seed_key?: string | null
          content_seed_version?: string | null
          seed_content_hash?: string | null
          seed_last_applied_at?: string | null
          owner_edited?: boolean
          created_at?: string
          updated_at?: string
          updated_by?: string | null
          published_at?: string | null
          published_by?: string | null
          is_demo?: boolean
        }
        Update: {
          id?: string
          page_id?: string
          block_type?: string
          position?: number
          is_visible?: boolean
          theme?: string | null
          layout_variant?: string | null
          eyebrow?: string | null
          heading?: string | null
          heading_highlight?: string | null
          body?: string | null
          supporting?: string | null
          cta_label?: string | null
          cta_url?: string | null
          cta_secondary_label?: string | null
          cta_secondary_url?: string | null
          media_desktop_id?: string | null
          media_mobile_id?: string | null
          media_alt_override?: string | null
          media_slot_key?: string | null
          payload?: Json
          fact_classification?: Database['public']['Enums']['fact_classification']
          field_classifications?: Json
          owner_verification?: Database['public']['Enums']['owner_verification']
          status?: Database['public']['Enums']['content_status']
          publish_at?: string | null
          unpublish_at?: string | null
          schedule_state?: string
          schedule_attempts?: number
          schedule_error?: string | null
          schedule_last_attempt_at?: string | null
          seed_key?: string | null
          content_seed_version?: string | null
          seed_content_hash?: string | null
          seed_last_applied_at?: string | null
          owner_edited?: boolean
          created_at?: string
          updated_at?: string
          updated_by?: string | null
          published_at?: string | null
          published_by?: string | null
          is_demo?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'page_sections_media_desktop_id_fkey'
            columns: ['media_desktop_id']
            isOneToOne: false
            referencedRelation: 'media_assets'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'page_sections_media_mobile_id_fkey'
            columns: ['media_mobile_id']
            isOneToOne: false
            referencedRelation: 'media_assets'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'page_sections_page_id_fkey'
            columns: ['page_id']
            isOneToOne: false
            referencedRelation: 'pages'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'page_sections_published_by_fkey'
            columns: ['published_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'page_sections_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      pages: {
        Row: {
          id: string
          slug: string
          path: string | null
          kind: string
          title: string
          status: Database['public']['Enums']['content_status']
          publish_at: string | null
          unpublish_at: string | null
          seo_entry_id: string | null
          is_system: boolean
          seed_key: string | null
          content_seed_version: string | null
          seed_content_hash: string | null
          seed_last_applied_at: string | null
          owner_edited: boolean
          owner_verification: Database['public']['Enums']['owner_verification']
          fact_classification: Database['public']['Enums']['fact_classification']
          created_at: string
          updated_at: string
          updated_by: string | null
          published_at: string | null
          published_by: string | null
          is_demo: boolean
        }
        Insert: {
          id?: string
          slug: string
          path?: string | null
          kind?: string
          title: string
          status?: Database['public']['Enums']['content_status']
          publish_at?: string | null
          unpublish_at?: string | null
          seo_entry_id?: string | null
          is_system?: boolean
          seed_key?: string | null
          content_seed_version?: string | null
          seed_content_hash?: string | null
          seed_last_applied_at?: string | null
          owner_edited?: boolean
          owner_verification?: Database['public']['Enums']['owner_verification']
          fact_classification?: Database['public']['Enums']['fact_classification']
          created_at?: string
          updated_at?: string
          updated_by?: string | null
          published_at?: string | null
          published_by?: string | null
          is_demo?: boolean
        }
        Update: {
          id?: string
          slug?: string
          path?: string | null
          kind?: string
          title?: string
          status?: Database['public']['Enums']['content_status']
          publish_at?: string | null
          unpublish_at?: string | null
          seo_entry_id?: string | null
          is_system?: boolean
          seed_key?: string | null
          content_seed_version?: string | null
          seed_content_hash?: string | null
          seed_last_applied_at?: string | null
          owner_edited?: boolean
          owner_verification?: Database['public']['Enums']['owner_verification']
          fact_classification?: Database['public']['Enums']['fact_classification']
          created_at?: string
          updated_at?: string
          updated_by?: string | null
          published_at?: string | null
          published_by?: string | null
          is_demo?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'pages_published_by_fkey'
            columns: ['published_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'pages_seo_entry_id_fkey'
            columns: ['seo_entry_id']
            isOneToOne: false
            referencedRelation: 'seo_entries'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'pages_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      portfolio_project_media: {
        Row: {
          project_id: string
          media_asset_id: string
          role: string
          caption: string | null
          alt_override: string | null
          sort_order: number
          created_at: string
          created_by: string | null
        }
        Insert: {
          project_id: string
          media_asset_id: string
          role: string
          caption?: string | null
          alt_override?: string | null
          sort_order?: number
          created_at?: string
          created_by?: string | null
        }
        Update: {
          project_id?: string
          media_asset_id?: string
          role?: string
          caption?: string | null
          alt_override?: string | null
          sort_order?: number
          created_at?: string
          created_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'portfolio_project_media_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'portfolio_project_media_media_asset_id_fkey'
            columns: ['media_asset_id']
            isOneToOne: false
            referencedRelation: 'media_assets'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'portfolio_project_media_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'portfolio_projects'
            referencedColumns: ['id']
          },
        ]
      }
      portfolio_projects: {
        Row: {
          id: string
          slug: string
          page_id: string | null
          title: string
          subtitle: string | null
          summary: string | null
          project_type: string | null
          location_label: string | null
          completed_on: string | null
          is_client_project: boolean
          client_display_name: string | null
          client_consent: Database['public']['Enums']['client_consent_state']
          client_consent_reference: string | null
          client_consent_recorded_at: string | null
          client_consent_recorded_by: string | null
          evidence_note: string | null
          hero_media_id: string | null
          seo_entry_id: string | null
          sort_order: number
          status: Database['public']['Enums']['content_status']
          owner_verification: Database['public']['Enums']['owner_verification']
          fact_classification: Database['public']['Enums']['fact_classification']
          published_at: string | null
          published_by: string | null
          created_at: string
          updated_at: string
          updated_by: string | null
          is_demo: boolean
        }
        Insert: {
          id?: string
          slug: string
          page_id?: string | null
          title: string
          subtitle?: string | null
          summary?: string | null
          project_type?: string | null
          location_label?: string | null
          completed_on?: string | null
          is_client_project?: boolean
          client_display_name?: string | null
          client_consent?: Database['public']['Enums']['client_consent_state']
          client_consent_reference?: string | null
          client_consent_recorded_at?: string | null
          client_consent_recorded_by?: string | null
          evidence_note?: string | null
          hero_media_id?: string | null
          seo_entry_id?: string | null
          sort_order?: number
          status?: Database['public']['Enums']['content_status']
          owner_verification?: Database['public']['Enums']['owner_verification']
          fact_classification?: Database['public']['Enums']['fact_classification']
          published_at?: string | null
          published_by?: string | null
          created_at?: string
          updated_at?: string
          updated_by?: string | null
          is_demo?: boolean
        }
        Update: {
          id?: string
          slug?: string
          page_id?: string | null
          title?: string
          subtitle?: string | null
          summary?: string | null
          project_type?: string | null
          location_label?: string | null
          completed_on?: string | null
          is_client_project?: boolean
          client_display_name?: string | null
          client_consent?: Database['public']['Enums']['client_consent_state']
          client_consent_reference?: string | null
          client_consent_recorded_at?: string | null
          client_consent_recorded_by?: string | null
          evidence_note?: string | null
          hero_media_id?: string | null
          seo_entry_id?: string | null
          sort_order?: number
          status?: Database['public']['Enums']['content_status']
          owner_verification?: Database['public']['Enums']['owner_verification']
          fact_classification?: Database['public']['Enums']['fact_classification']
          published_at?: string | null
          published_by?: string | null
          created_at?: string
          updated_at?: string
          updated_by?: string | null
          is_demo?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'portfolio_projects_client_consent_recorded_by_fkey'
            columns: ['client_consent_recorded_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'portfolio_projects_hero_media_id_fkey'
            columns: ['hero_media_id']
            isOneToOne: false
            referencedRelation: 'media_assets'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'portfolio_projects_page_id_fkey'
            columns: ['page_id']
            isOneToOne: true
            referencedRelation: 'pages'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'portfolio_projects_published_by_fkey'
            columns: ['published_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'portfolio_projects_seo_entry_id_fkey'
            columns: ['seo_entry_id']
            isOneToOne: false
            referencedRelation: 'seo_entries'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'portfolio_projects_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      product_collections: {
        Row: {
          product_id: string
          collection_id: string
          sort_order: number
          created_at: string
          created_by: string | null
        }
        Insert: {
          product_id: string
          collection_id: string
          sort_order?: number
          created_at?: string
          created_by?: string | null
        }
        Update: {
          product_id?: string
          collection_id?: string
          sort_order?: number
          created_at?: string
          created_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'product_collections_collection_id_fkey'
            columns: ['collection_id']
            isOneToOne: false
            referencedRelation: 'collections'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'product_collections_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'product_collections_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
      product_customization_forms: {
        Row: {
          id: string
          form_id: string
          product_id: string | null
          category_id: string | null
          position: number
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          form_id: string
          product_id?: string | null
          category_id?: string | null
          position?: number
          created_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          form_id?: string
          product_id?: string | null
          category_id?: string | null
          position?: number
          created_at?: string
          created_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'product_customization_forms_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'product_customization_forms_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'product_customization_forms_form_id_fkey'
            columns: ['form_id']
            isOneToOne: false
            referencedRelation: 'customization_forms'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'product_customization_forms_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
      product_materials: {
        Row: {
          product_id: string
          material_id: string
          note: string | null
          created_at: string
          created_by: string | null
        }
        Insert: {
          product_id: string
          material_id: string
          note?: string | null
          created_at?: string
          created_by?: string | null
        }
        Update: {
          product_id?: string
          material_id?: string
          note?: string | null
          created_at?: string
          created_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'product_materials_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'product_materials_material_id_fkey'
            columns: ['material_id']
            isOneToOne: false
            referencedRelation: 'materials'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'product_materials_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
      product_media: {
        Row: {
          product_id: string
          media_asset_id: string
          role: string | null
          sort_order: number | null
          created_at: string
          created_by: string | null
        }
        Insert: {
          product_id: string
          media_asset_id: string
          role?: string | null
          sort_order?: number | null
          created_at?: string
          created_by?: string | null
        }
        Update: {
          product_id?: string
          media_asset_id?: string
          role?: string | null
          sort_order?: number | null
          created_at?: string
          created_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'product_media_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'product_media_media_asset_id_fkey'
            columns: ['media_asset_id']
            isOneToOne: false
            referencedRelation: 'media_assets'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'product_media_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
      product_relations: {
        Row: {
          id: string
          source_product_id: string
          target_type: string
          target_id: string
          relation_type: string
          sort_order: number
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          source_product_id: string
          target_type: string
          target_id: string
          relation_type: string
          sort_order?: number
          created_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          source_product_id?: string
          target_type?: string
          target_id?: string
          relation_type?: string
          sort_order?: number
          created_at?: string
          created_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'product_relations_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'product_relations_source_product_id_fkey'
            columns: ['source_product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
        ]
      }
      product_specs: {
        Row: {
          id: string
          product_id: string
          sort_order: number
          label: string
          value: string
          unit: string | null
          group_label: string | null
          status: Database['public']['Enums']['content_status']
          owner_verification: Database['public']['Enums']['owner_verification']
          fact_classification: Database['public']['Enums']['fact_classification']
          published_at: string | null
          published_by: string | null
          created_at: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          product_id: string
          sort_order?: number
          label: string
          value: string
          unit?: string | null
          group_label?: string | null
          status?: Database['public']['Enums']['content_status']
          owner_verification?: Database['public']['Enums']['owner_verification']
          fact_classification?: Database['public']['Enums']['fact_classification']
          published_at?: string | null
          published_by?: string | null
          created_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          product_id?: string
          sort_order?: number
          label?: string
          value?: string
          unit?: string | null
          group_label?: string | null
          status?: Database['public']['Enums']['content_status']
          owner_verification?: Database['public']['Enums']['owner_verification']
          fact_classification?: Database['public']['Enums']['fact_classification']
          published_at?: string | null
          published_by?: string | null
          created_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'product_specs_product_id_fkey'
            columns: ['product_id']
            isOneToOne: false
            referencedRelation: 'products'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'product_specs_published_by_fkey'
            columns: ['published_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'product_specs_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      products: {
        Row: {
          id: string
          slug: string
          sku: string | null
          title: string | null
          subtitle: string | null
          summary: string | null
          description: string | null
          category_id: string | null
          price_state: Database['public']['Enums']['price_state']
          price_from_minor: number | null
          currency: string | null
          is_large_format: boolean
          dimensions: Json | null
          hero_media_id: string | null
          model_media_id: string | null
          seo_title: string | null
          seo_description: string | null
          publication_readiness: Json
          created_at: string
          updated_at: string
          updated_by: string | null
          status: Database['public']['Enums']['content_status']
          owner_verification: Database['public']['Enums']['owner_verification']
          fact_classification: Database['public']['Enums']['fact_classification'] | null
          published_at: string | null
          published_by: string | null
          seed_key: string | null
          content_seed_version: string | null
          seed_content_hash: string | null
          seed_last_applied_at: string | null
          owner_edited: boolean
          price_minor: number | null
          availability_state: Database['public']['Enums']['availability_state'] | null
          edition_state: Database['public']['Enums']['edition_state'] | null
          edition_size: number | null
          is_customizable: boolean
          sort_order: number | null
          specifications_omitted: boolean
          is_demo: boolean
        }
        Insert: {
          id?: string
          slug: string
          sku?: string | null
          title?: string | null
          subtitle?: string | null
          summary?: string | null
          description?: string | null
          category_id?: string | null
          price_state: Database['public']['Enums']['price_state']
          price_from_minor?: number | null
          currency?: string | null
          is_large_format?: boolean
          dimensions?: Json | null
          hero_media_id?: string | null
          model_media_id?: string | null
          seo_title?: string | null
          seo_description?: string | null
          publication_readiness?: Json
          created_at?: string
          updated_at?: string
          updated_by?: string | null
          status?: Database['public']['Enums']['content_status']
          owner_verification?: Database['public']['Enums']['owner_verification']
          fact_classification?: Database['public']['Enums']['fact_classification'] | null
          published_at?: string | null
          published_by?: string | null
          seed_key?: string | null
          content_seed_version?: string | null
          seed_content_hash?: string | null
          seed_last_applied_at?: string | null
          owner_edited?: boolean
          price_minor?: number | null
          availability_state?: Database['public']['Enums']['availability_state'] | null
          edition_state?: Database['public']['Enums']['edition_state'] | null
          edition_size?: number | null
          is_customizable?: boolean
          sort_order?: number | null
          specifications_omitted?: boolean
          is_demo?: boolean
        }
        Update: {
          id?: string
          slug?: string
          sku?: string | null
          title?: string | null
          subtitle?: string | null
          summary?: string | null
          description?: string | null
          category_id?: string | null
          price_state?: Database['public']['Enums']['price_state']
          price_from_minor?: number | null
          currency?: string | null
          is_large_format?: boolean
          dimensions?: Json | null
          hero_media_id?: string | null
          model_media_id?: string | null
          seo_title?: string | null
          seo_description?: string | null
          publication_readiness?: Json
          created_at?: string
          updated_at?: string
          updated_by?: string | null
          status?: Database['public']['Enums']['content_status']
          owner_verification?: Database['public']['Enums']['owner_verification']
          fact_classification?: Database['public']['Enums']['fact_classification'] | null
          published_at?: string | null
          published_by?: string | null
          seed_key?: string | null
          content_seed_version?: string | null
          seed_content_hash?: string | null
          seed_last_applied_at?: string | null
          owner_edited?: boolean
          price_minor?: number | null
          availability_state?: Database['public']['Enums']['availability_state'] | null
          edition_state?: Database['public']['Enums']['edition_state'] | null
          edition_size?: number | null
          is_customizable?: boolean
          sort_order?: number | null
          specifications_omitted?: boolean
          is_demo?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'products_category_id_fkey'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'products_hero_media_id_fkey'
            columns: ['hero_media_id']
            isOneToOne: false
            referencedRelation: 'media_assets'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'products_model_media_id_fkey'
            columns: ['model_media_id']
            isOneToOne: false
            referencedRelation: 'media_assets'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'products_published_by_fkey'
            columns: ['published_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'products_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      rate_limit_buckets: {
        Row: {
          bucket_key: string
          window_start: string
          count: number
        }
        Insert: {
          bucket_key: string
          window_start: string
          count?: number
        }
        Update: {
          bucket_key?: string
          window_start?: string
          count?: number
        }
        Relationships: []
      }
      seo_entries: {
        Row: {
          id: string
          scope: string
          path: string | null
          entity_type: string | null
          entity_id: string | null
          title: string | null
          description: string | null
          social_title: string | null
          social_description: string | null
          og_media_id: string | null
          canonical_url: string | null
          robots: string | null
          status: Database['public']['Enums']['content_status']
          owner_verification: Database['public']['Enums']['owner_verification']
          fact_classification: Database['public']['Enums']['fact_classification']
          seed_key: string | null
          content_seed_version: string | null
          seed_content_hash: string | null
          seed_last_applied_at: string | null
          owner_edited: boolean
          created_at: string
          updated_at: string
          updated_by: string | null
          published_at: string | null
          published_by: string | null
        }
        Insert: {
          id?: string
          scope: string
          path?: string | null
          entity_type?: string | null
          entity_id?: string | null
          title?: string | null
          description?: string | null
          social_title?: string | null
          social_description?: string | null
          og_media_id?: string | null
          canonical_url?: string | null
          robots?: string | null
          status?: Database['public']['Enums']['content_status']
          owner_verification?: Database['public']['Enums']['owner_verification']
          fact_classification?: Database['public']['Enums']['fact_classification']
          seed_key?: string | null
          content_seed_version?: string | null
          seed_content_hash?: string | null
          seed_last_applied_at?: string | null
          owner_edited?: boolean
          created_at?: string
          updated_at?: string
          updated_by?: string | null
          published_at?: string | null
          published_by?: string | null
        }
        Update: {
          id?: string
          scope?: string
          path?: string | null
          entity_type?: string | null
          entity_id?: string | null
          title?: string | null
          description?: string | null
          social_title?: string | null
          social_description?: string | null
          og_media_id?: string | null
          canonical_url?: string | null
          robots?: string | null
          status?: Database['public']['Enums']['content_status']
          owner_verification?: Database['public']['Enums']['owner_verification']
          fact_classification?: Database['public']['Enums']['fact_classification']
          seed_key?: string | null
          content_seed_version?: string | null
          seed_content_hash?: string | null
          seed_last_applied_at?: string | null
          owner_edited?: boolean
          created_at?: string
          updated_at?: string
          updated_by?: string | null
          published_at?: string | null
          published_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'seo_entries_og_media_id_fkey'
            columns: ['og_media_id']
            isOneToOne: false
            referencedRelation: 'media_assets'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'seo_entries_published_by_fkey'
            columns: ['published_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'seo_entries_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      staff_profiles: {
        Row: {
          user_id: string
          email: string | null
          display_name: string | null
          role: Database['public']['Enums']['user_role']
          status: string
          last_seen_at: string | null
          created_at: string
          created_by: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          user_id: string
          email?: string | null
          display_name?: string | null
          role?: Database['public']['Enums']['user_role']
          status?: string
          last_seen_at?: string | null
          created_at?: string
          created_by?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          user_id?: string
          email?: string | null
          display_name?: string | null
          role?: Database['public']['Enums']['user_role']
          status?: string
          last_seen_at?: string | null
          created_at?: string
          created_by?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'staff_profiles_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'staff_profiles_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'staff_profiles_user_id_fkey'
            columns: ['user_id']
            isOneToOne: true
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      studio_preferences: {
        Row: {
          id: string
          user_id: string
          sidebar_collapsed: boolean
          pinned_routes: string[]
          dashboard_card_order: string[]
          created_at: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          user_id: string
          sidebar_collapsed?: boolean
          pinned_routes?: string[]
          dashboard_card_order?: string[]
          created_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          sidebar_collapsed?: boolean
          pinned_routes?: string[]
          dashboard_card_order?: string[]
          created_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'studio_preferences_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'studio_preferences_user_id_fkey'
            columns: ['user_id']
            isOneToOne: true
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      testimonials: {
        Row: {
          id: string
          attributed_to: string | null
          attribution_role: string | null
          quote: string
          project_id: string | null
          consent: Database['public']['Enums']['client_consent_state']
          consent_reference: string | null
          sort_order: number
          status: Database['public']['Enums']['content_status']
          owner_verification: Database['public']['Enums']['owner_verification']
          fact_classification: Database['public']['Enums']['fact_classification']
          published_at: string | null
          published_by: string | null
          created_at: string
          updated_at: string
          updated_by: string | null
          is_demo: boolean
        }
        Insert: {
          id?: string
          attributed_to?: string | null
          attribution_role?: string | null
          quote: string
          project_id?: string | null
          consent?: Database['public']['Enums']['client_consent_state']
          consent_reference?: string | null
          sort_order?: number
          status?: Database['public']['Enums']['content_status']
          owner_verification?: Database['public']['Enums']['owner_verification']
          fact_classification?: Database['public']['Enums']['fact_classification']
          published_at?: string | null
          published_by?: string | null
          created_at?: string
          updated_at?: string
          updated_by?: string | null
          is_demo?: boolean
        }
        Update: {
          id?: string
          attributed_to?: string | null
          attribution_role?: string | null
          quote?: string
          project_id?: string | null
          consent?: Database['public']['Enums']['client_consent_state']
          consent_reference?: string | null
          sort_order?: number
          status?: Database['public']['Enums']['content_status']
          owner_verification?: Database['public']['Enums']['owner_verification']
          fact_classification?: Database['public']['Enums']['fact_classification']
          published_at?: string | null
          published_by?: string | null
          created_at?: string
          updated_at?: string
          updated_by?: string | null
          is_demo?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'testimonials_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'portfolio_projects'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'testimonials_published_by_fkey'
            columns: ['published_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'testimonials_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      attach_inquiry_references: {
        Args: Record<string, unknown>
        Returns: Json
      }
      cms_duplicate_customization_form: {
        Args: Record<string, unknown>
        Returns: Json
      }
      cms_publish_section: {
        Args: Record<string, unknown>
        Returns: Json
      }
      cms_reorder_sections: {
        Args: Record<string, unknown>
        Returns: Json
      }
      cms_restore_revision: {
        Args: Record<string, unknown>
        Returns: Json
      }
      cms_run_content_schedule: {
        Args: Record<string, unknown>
        Returns: Json
      }
      cms_set_form_field_order: {
        Args: Record<string, unknown>
        Returns: Json
      }
      cms_set_form_step_order: {
        Args: Record<string, unknown>
        Returns: Json
      }
      cms_transition_allowed: {
        Args: Record<string, unknown>
        Returns: Json
      }
      cms_unpublish_media_asset: {
        Args: Record<string, unknown>
        Returns: Json
      }
      consume_rate_limit: {
        Args: Record<string, unknown>
        Returns: Json
      }
      current_staff_role: {
        Args: Record<string, unknown>
        Returns: Json
      }
      has_role: {
        Args: Record<string, unknown>
        Returns: Json
      }
      inquiry_is_fresh: {
        Args: Record<string, unknown>
        Returns: Json
      }
      inquiry_reference_code: {
        Args: Record<string, unknown>
        Returns: Json
      }
      is_staff: {
        Args: Record<string, unknown>
        Returns: Json
      }
      is_valid_dimensions: {
        Args: Record<string, unknown>
        Returns: Json
      }
      is_valid_model_camera: {
        Args: Record<string, unknown>
        Returns: Json
      }
      is_valid_viewer_settings: {
        Args: Record<string, unknown>
        Returns: Json
      }
      model_setting_number: {
        Args: Record<string, unknown>
        Returns: Json
      }
      model_setting_vec3: {
        Args: Record<string, unknown>
        Returns: Json
      }
      record_inquiry_handoff: {
        Args: Record<string, unknown>
        Returns: Json
      }
      rivya_slugify: {
        Args: Record<string, unknown>
        Returns: Json
      }
      set_model_association: {
        Args: Record<string, unknown>
        Returns: Json
      }
    }
    Enums: {
      availability_state: 'READY_STOCK' | 'MADE_TO_ORDER'
      client_consent_state: 'NOT_APPLICABLE' | 'PENDING' | 'GRANTED' | 'WITHDRAWN'
      collection_concept_state: 'DRAFT_COLLECTION_CONCEPT' | 'OWNER_CONFIRMED' | 'RETIRED'
      content_status: 'DRAFT' | 'REVIEW' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED'
      edition_state: 'ONE_OF_ONE' | 'LIMITED_EDITION' | 'OPEN_EDITION'
      fact_classification:
        | 'BRAND_COPY'
        | 'EDITORIAL_COPY'
        | 'VERIFIED_BUSINESS_FACT'
        | 'PRODUCT_FACT'
        | 'SEO_COPY'
        | 'LEGAL_COPY'
      form_field_type:
        | 'TEXT'
        | 'TEXTAREA'
        | 'NUMBER'
        | 'DIMENSION'
        | 'SELECT'
        | 'MULTISELECT'
        | 'RADIO'
        | 'CHECKBOX'
        | 'COLOUR_DIRECTION'
        | 'FILE'
        | 'CITY'
        | 'CONTACT_NAME'
        | 'CONTACT_PHONE'
        | 'CONTACT_EMAIL'
      form_kind: 'FURNITURE' | 'PRESERVATION' | 'THREE_D_RESIN' | 'CUSTOM'
      inquiry_event_kind:
        | 'CREATED'
        | 'WHATSAPP_REDIRECT'
        | 'VIEWED'
        | 'STATUS_CHANGED'
        | 'NOTE_ADDED'
        | 'ASSIGNED'
        | 'EXPORTED'
      inquiry_kind: 'PRODUCT' | 'COMMISSION' | 'CONSULTATION' | 'QUOTE' | 'GENERAL'
      inquiry_status:
        'NEW' | 'READ' | 'IN_CONVERSATION' | 'QUOTED' | 'WON' | 'LOST' | 'SPAM' | 'ARCHIVED'
      media_kind: 'IMAGE' | 'VIDEO' | 'MODEL_3D' | 'DOCUMENT' | 'BRAND'
      media_source: 'REAL' | 'USER_UPLOAD' | 'HIGGSFIELD' | 'RENDER' | 'FALLBACK'
      owner_verification: 'NOT_REQUIRED' | 'OWNER_VERIFICATION_REQUIRED' | 'VERIFIED'
      price_state: 'STARTING_FROM' | 'REQUEST_QUOTE' | 'PRICE_ON_REQUEST' | 'FIXED'
      relation_entity:
        'PRODUCT' | 'COLLECTION' | 'CATEGORY' | 'PORTFOLIO_PROJECT' | 'JOURNAL_ARTICLE' | 'MATERIAL'
      relation_kind: 'RELATED' | 'FEATURES' | 'REFERENCES' | 'USES_MATERIAL' | 'PART_OF'
      user_role: 'owner' | 'admin' | 'editor' | 'merchandiser' | 'researcher' | 'viewer'
      whatsapp_state: 'NOT_SENT' | 'REDIRECTED' | 'SHORTENED' | 'UNAVAILABLE'
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type PublicSchema = Database['public']

export type Tables<T extends keyof PublicSchema['Tables']> = PublicSchema['Tables'][T]['Row']
export type TablesInsert<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Insert']
export type TablesUpdate<T extends keyof PublicSchema['Tables']> =
  PublicSchema['Tables'][T]['Update']
export type Enums<T extends keyof PublicSchema['Enums']> = PublicSchema['Enums'][T]
export type TableName = keyof PublicSchema['Tables']
