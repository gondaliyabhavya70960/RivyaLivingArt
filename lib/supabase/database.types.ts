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
      analytics_snapshots: {
        Row: {
          id: string
          metric_id: string
          dimension: string
          as_of: string
          value: Json
          n: number | null
          denominator: number | null
          availability: string
          unavailable_reason: string | null
          computed_at: string
          computed_by: string | null
        }
        Insert: {
          id?: string
          metric_id: string
          dimension: string
          as_of: string
          value?: Json
          n?: number | null
          denominator?: number | null
          availability: string
          unavailable_reason?: string | null
          computed_at?: string
          computed_by?: string | null
        }
        Update: {
          id?: string
          metric_id?: string
          dimension?: string
          as_of?: string
          value?: Json
          n?: number | null
          denominator?: number | null
          availability?: string
          unavailable_reason?: string | null
          computed_at?: string
          computed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'analytics_snapshots_computed_by_fkey'
            columns: ['computed_by']
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
      bulk_import_rows: {
        Row: {
          id: string
          import_id: string
          row_number: number
          raw: Json
          mapped: Json
          issues: Json
          action: string
          target_entity_id: string | null
          applied: boolean
          created_at: string
        }
        Insert: {
          id?: string
          import_id: string
          row_number: number
          raw: Json
          mapped?: Json
          issues?: Json
          action?: string
          target_entity_id?: string | null
          applied?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          import_id?: string
          row_number?: number
          raw?: Json
          mapped?: Json
          issues?: Json
          action?: string
          target_entity_id?: string | null
          applied?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'bulk_import_rows_import_id_fkey'
            columns: ['import_id']
            isOneToOne: false
            referencedRelation: 'bulk_imports'
            referencedColumns: ['id']
          },
        ]
      }
      bulk_imports: {
        Row: {
          id: string
          operation_id: string | null
          filename: string
          checksum: string
          delimiter: string
          column_map: Json
          row_count: number
          valid_count: number
          invalid_count: number
          status: string
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          operation_id?: string | null
          filename: string
          checksum: string
          delimiter?: string
          column_map?: Json
          row_count?: number
          valid_count?: number
          invalid_count?: number
          status?: string
          created_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          operation_id?: string | null
          filename?: string
          checksum?: string
          delimiter?: string
          column_map?: Json
          row_count?: number
          valid_count?: number
          invalid_count?: number
          status?: string
          created_at?: string
          created_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'bulk_imports_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'bulk_imports_operation_id_fkey'
            columns: ['operation_id']
            isOneToOne: false
            referencedRelation: 'bulk_operations'
            referencedColumns: ['id']
          },
        ]
      }
      bulk_operation_items: {
        Row: {
          id: string
          operation_id: string
          entity_id: string
          result: string
          reason: string | null
          before: Json | null
          after: Json | null
          row_version_before: string | null
          error: string | null
        }
        Insert: {
          id?: string
          operation_id: string
          entity_id: string
          result: string
          reason?: string | null
          before?: Json | null
          after?: Json | null
          row_version_before?: string | null
          error?: string | null
        }
        Update: {
          id?: string
          operation_id?: string
          entity_id?: string
          result?: string
          reason?: string | null
          before?: Json | null
          after?: Json | null
          row_version_before?: string | null
          error?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'bulk_operation_items_operation_id_fkey'
            columns: ['operation_id']
            isOneToOne: false
            referencedRelation: 'bulk_operations'
            referencedColumns: ['id']
          },
        ]
      }
      bulk_operations: {
        Row: {
          id: string
          kind: string
          target_entity: string
          status: string
          is_destructive: boolean
          selection: Json
          params: Json
          counts: Json
          confirmation_token: string | null
          confirmed_at: string | null
          actor_user_id: string | null
          actor_role: Database['public']['Enums']['user_role'] | null
          requested_at: string
          started_at: string | null
          finished_at: string | null
          undo_deadline_at: string | null
          undone_at: string | null
          undone_by: string | null
          undo_of_operation_id: string | null
        }
        Insert: {
          id?: string
          kind: string
          target_entity: string
          status?: string
          is_destructive?: boolean
          selection: Json
          params?: Json
          counts?: Json
          confirmation_token?: string | null
          confirmed_at?: string | null
          actor_user_id?: string | null
          actor_role?: Database['public']['Enums']['user_role'] | null
          requested_at?: string
          started_at?: string | null
          finished_at?: string | null
          undo_deadline_at?: string | null
          undone_at?: string | null
          undone_by?: string | null
          undo_of_operation_id?: string | null
        }
        Update: {
          id?: string
          kind?: string
          target_entity?: string
          status?: string
          is_destructive?: boolean
          selection?: Json
          params?: Json
          counts?: Json
          confirmation_token?: string | null
          confirmed_at?: string | null
          actor_user_id?: string | null
          actor_role?: Database['public']['Enums']['user_role'] | null
          requested_at?: string
          started_at?: string | null
          finished_at?: string | null
          undo_deadline_at?: string | null
          undone_at?: string | null
          undone_by?: string | null
          undo_of_operation_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'bulk_operations_actor_user_id_fkey'
            columns: ['actor_user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'bulk_operations_undo_of_operation_id_fkey'
            columns: ['undo_of_operation_id']
            isOneToOne: false
            referencedRelation: 'bulk_operations'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'bulk_operations_undone_by_fkey'
            columns: ['undone_by']
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
      content_relations: {
        Row: {
          id: string
          source_type: string
          source_id: string
          target_type: string
          target_id: string
          relation_type: string
          sort_order: number
          origin: Database['public']['Enums']['relation_origin']
          rule_key: string | null
          note: string | null
          paired_relation_id: string | null
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          source_type: string
          source_id: string
          target_type: string
          target_id: string
          relation_type: string
          sort_order?: number
          origin?: Database['public']['Enums']['relation_origin']
          rule_key?: string | null
          note?: string | null
          paired_relation_id?: string | null
          created_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          source_type?: string
          source_id?: string
          target_type?: string
          target_id?: string
          relation_type?: string
          sort_order?: number
          origin?: Database['public']['Enums']['relation_origin']
          rule_key?: string | null
          note?: string | null
          paired_relation_id?: string | null
          created_at?: string
          created_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'content_relations_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'content_relations_paired_relation_id_fkey'
            columns: ['paired_relation_id']
            isOneToOne: false
            referencedRelation: 'content_relations'
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
      media_asset_hashes: {
        Row: {
          id: string
          media_asset_id: string
          kind: string
          checksum: string
          phash: unknown | null
          dhash: unknown | null
          computed_at: string
        }
        Insert: {
          id?: string
          media_asset_id: string
          kind: string
          checksum: string
          phash?: unknown | null
          dhash?: unknown | null
          computed_at?: string
        }
        Update: {
          id?: string
          media_asset_id?: string
          kind?: string
          checksum?: string
          phash?: unknown | null
          dhash?: unknown | null
          computed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'media_asset_hashes_media_asset_id_fkey'
            columns: ['media_asset_id']
            isOneToOne: true
            referencedRelation: 'media_assets'
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
      merchandising_entries: {
        Row: {
          id: string
          slot_id: string
          entity_type: Database['public']['Enums']['relation_entity']
          entity_id: string
          position: number
          is_pinned: boolean
          publish_at: string | null
          unpublish_at: string | null
          window_state: string
          status: Database['public']['Enums']['content_status']
          note: string | null
          published_at: string | null
          published_by: string | null
          created_at: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          slot_id: string
          entity_type: Database['public']['Enums']['relation_entity']
          entity_id: string
          position: number
          is_pinned?: boolean
          publish_at?: string | null
          unpublish_at?: string | null
          window_state?: string
          status?: Database['public']['Enums']['content_status']
          note?: string | null
          published_at?: string | null
          published_by?: string | null
          created_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          slot_id?: string
          entity_type?: Database['public']['Enums']['relation_entity']
          entity_id?: string
          position?: number
          is_pinned?: boolean
          publish_at?: string | null
          unpublish_at?: string | null
          window_state?: string
          status?: Database['public']['Enums']['content_status']
          note?: string | null
          published_at?: string | null
          published_by?: string | null
          created_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'merchandising_entries_published_by_fkey'
            columns: ['published_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'merchandising_entries_slot_id_fkey'
            columns: ['slot_id']
            isOneToOne: false
            referencedRelation: 'merchandising_slots'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'merchandising_entries_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      merchandising_slots: {
        Row: {
          id: string
          key: string
          name: string
          description: string | null
          surface: string
          owning_studio_route: string
          allowed_entity_types: Database['public']['Enums']['relation_entity'][]
          min_items: number
          max_items: number
          auto_fill: boolean
          auto_fill_rule: string | null
          fallback_mode: Database['public']['Enums']['merch_fallback']
          fallback_section_id: string | null
          status: Database['public']['Enums']['content_status']
          created_at: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          key: string
          name: string
          description?: string | null
          surface: string
          owning_studio_route: string
          allowed_entity_types: Database['public']['Enums']['relation_entity'][]
          min_items?: number
          max_items?: number
          auto_fill?: boolean
          auto_fill_rule?: string | null
          fallback_mode: Database['public']['Enums']['merch_fallback']
          fallback_section_id?: string | null
          status?: Database['public']['Enums']['content_status']
          created_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          key?: string
          name?: string
          description?: string | null
          surface?: string
          owning_studio_route?: string
          allowed_entity_types?: Database['public']['Enums']['relation_entity'][]
          min_items?: number
          max_items?: number
          auto_fill?: boolean
          auto_fill_rule?: string | null
          fallback_mode?: Database['public']['Enums']['merch_fallback']
          fallback_section_id?: string | null
          status?: Database['public']['Enums']['content_status']
          created_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'merchandising_slots_fallback_section_id_fkey'
            columns: ['fallback_section_id']
            isOneToOne: false
            referencedRelation: 'page_sections'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'merchandising_slots_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
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
      product_attribute_terms: {
        Row: {
          id: string
          taxonomy: Database['public']['Enums']['attribute_taxonomy']
          slug: string
          name: string
          description: string | null
          sort_order: number
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
          taxonomy: Database['public']['Enums']['attribute_taxonomy']
          slug: string
          name: string
          description?: string | null
          sort_order?: number
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
          taxonomy?: Database['public']['Enums']['attribute_taxonomy']
          slug?: string
          name?: string
          description?: string | null
          sort_order?: number
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
            foreignKeyName: 'product_attribute_terms_published_by_fkey'
            columns: ['published_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'product_attribute_terms_updated_by_fkey'
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
          origin: Database['public']['Enums']['relation_origin']
          rule_key: string | null
          note: string | null
          paired_relation_id: string | null
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
          origin?: Database['public']['Enums']['relation_origin']
          rule_key?: string | null
          note?: string | null
          paired_relation_id?: string | null
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
          origin?: Database['public']['Enums']['relation_origin']
          rule_key?: string | null
          note?: string | null
          paired_relation_id?: string | null
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
            foreignKeyName: 'product_relations_paired_relation_id_fkey'
            columns: ['paired_relation_id']
            isOneToOne: false
            referencedRelation: 'product_relations'
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
      relation_suppressions: {
        Row: {
          id: string
          source_type: string
          source_id: string
          target_type: string
          target_id: string
          rule_key: string
          reason: string | null
          suppressed_by: string | null
          suppressed_at: string
        }
        Insert: {
          id?: string
          source_type: string
          source_id: string
          target_type: string
          target_id: string
          rule_key: string
          reason?: string | null
          suppressed_by?: string | null
          suppressed_at?: string
        }
        Update: {
          id?: string
          source_type?: string
          source_id?: string
          target_type?: string
          target_id?: string
          rule_key?: string
          reason?: string | null
          suppressed_by?: string | null
          suppressed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'relation_suppressions_suppressed_by_fkey'
            columns: ['suppressed_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      research_adapter_runs: {
        Row: {
          id: string
          run_id: string
          source_id: string
          adapter_key: string
          adapter_version: string
          status: string
          items_seen: number
          items_extracted: number
          items_failed: number
          first_errors: Json
          duration_ms: number
          started_at: string
          finished_at: string | null
        }
        Insert: {
          id?: string
          run_id: string
          source_id: string
          adapter_key: string
          adapter_version: string
          status?: string
          items_seen?: number
          items_extracted?: number
          items_failed?: number
          first_errors?: Json
          duration_ms?: number
          started_at?: string
          finished_at?: string | null
        }
        Update: {
          id?: string
          run_id?: string
          source_id?: string
          adapter_key?: string
          adapter_version?: string
          status?: string
          items_seen?: number
          items_extracted?: number
          items_failed?: number
          first_errors?: Json
          duration_ms?: number
          started_at?: string
          finished_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'research_adapter_runs_run_id_fkey'
            columns: ['run_id']
            isOneToOne: false
            referencedRelation: 'research_runs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_adapter_runs_source_id_fkey'
            columns: ['source_id']
            isOneToOne: false
            referencedRelation: 'research_sources'
            referencedColumns: ['id']
          },
        ]
      }
      research_analytics_snapshots: {
        Row: {
          id: string
          scope_type: string
          scope_id: string | null
          metric_family: string
          currency: string | null
          payload: Json
          row_count: number
          computed_at: string
          computed_by: string | null
          input_run_max_id: string | null
        }
        Insert: {
          id?: string
          scope_type: string
          scope_id?: string | null
          metric_family: string
          currency?: string | null
          payload: Json
          row_count: number
          computed_at?: string
          computed_by?: string | null
          input_run_max_id?: string | null
        }
        Update: {
          id?: string
          scope_type?: string
          scope_id?: string | null
          metric_family?: string
          currency?: string | null
          payload?: Json
          row_count?: number
          computed_at?: string
          computed_by?: string | null
          input_run_max_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'research_analytics_snapshots_computed_by_fkey'
            columns: ['computed_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_analytics_snapshots_input_run_max_id_fkey'
            columns: ['input_run_max_id']
            isOneToOne: false
            referencedRelation: 'research_runs'
            referencedColumns: ['id']
          },
        ]
      }
      research_change_digests: {
        Row: {
          id: string
          digest_date: string
          stats: Json
          generated_at: string
        }
        Insert: {
          id?: string
          digest_date: string
          stats: Json
          generated_at?: string
        }
        Update: {
          id?: string
          digest_date?: string
          stats?: Json
          generated_at?: string
        }
        Relationships: []
      }
      research_change_rules: {
        Row: {
          id: string
          source_id: string | null
          field: string
          material_threshold: number | null
          minor_threshold: number | null
          is_enabled: boolean
          status: Database['public']['Enums']['content_status']
          created_at: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          source_id?: string | null
          field: string
          material_threshold?: number | null
          minor_threshold?: number | null
          is_enabled?: boolean
          status?: Database['public']['Enums']['content_status']
          created_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          source_id?: string | null
          field?: string
          material_threshold?: number | null
          minor_threshold?: number | null
          is_enabled?: boolean
          status?: Database['public']['Enums']['content_status']
          created_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'research_change_rules_source_id_fkey'
            columns: ['source_id']
            isOneToOne: false
            referencedRelation: 'research_sources'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_change_rules_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      research_changes: {
        Row: {
          id: string
          research_product_id: string
          source_id: string
          field: string
          change_kind: string
          materiality: string
          before: Json | null
          after: Json | null
          version_before_id: string | null
          version_after_id: string
          run_id: string | null
          snapshot_before_key: string | null
          snapshot_after_key: string | null
          detected_at: string
          decided_action: string | null
          decided_by: string | null
          decided_at: string | null
        }
        Insert: {
          id?: string
          research_product_id: string
          source_id: string
          field: string
          change_kind: string
          materiality: string
          before?: Json | null
          after?: Json | null
          version_before_id?: string | null
          version_after_id: string
          run_id?: string | null
          snapshot_before_key?: string | null
          snapshot_after_key?: string | null
          detected_at?: string
          decided_action?: string | null
          decided_by?: string | null
          decided_at?: string | null
        }
        Update: {
          id?: string
          research_product_id?: string
          source_id?: string
          field?: string
          change_kind?: string
          materiality?: string
          before?: Json | null
          after?: Json | null
          version_before_id?: string | null
          version_after_id?: string
          run_id?: string | null
          snapshot_before_key?: string | null
          snapshot_after_key?: string | null
          detected_at?: string
          decided_action?: string | null
          decided_by?: string | null
          decided_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'research_changes_decided_by_fkey'
            columns: ['decided_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_changes_research_product_id_fkey'
            columns: ['research_product_id']
            isOneToOne: false
            referencedRelation: 'research_products'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_changes_run_id_fkey'
            columns: ['run_id']
            isOneToOne: false
            referencedRelation: 'research_runs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_changes_source_id_fkey'
            columns: ['source_id']
            isOneToOne: false
            referencedRelation: 'research_sources'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_changes_version_after_id_fkey'
            columns: ['version_after_id']
            isOneToOne: false
            referencedRelation: 'research_product_versions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_changes_version_before_id_fkey'
            columns: ['version_before_id']
            isOneToOne: false
            referencedRelation: 'research_product_versions'
            referencedColumns: ['id']
          },
        ]
      }
      research_comparison_members: {
        Row: {
          id: string
          set_id: string
          member_type: string
          source_id: string | null
          research_product_id: string | null
          position: number
          note: string | null
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          set_id: string
          member_type: string
          source_id?: string | null
          research_product_id?: string | null
          position?: number
          note?: string | null
          created_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          set_id?: string
          member_type?: string
          source_id?: string | null
          research_product_id?: string | null
          position?: number
          note?: string | null
          created_at?: string
          created_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'research_comparison_members_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_comparison_members_research_product_id_fkey'
            columns: ['research_product_id']
            isOneToOne: false
            referencedRelation: 'research_products'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_comparison_members_set_id_fkey'
            columns: ['set_id']
            isOneToOne: false
            referencedRelation: 'research_comparison_sets'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_comparison_members_source_id_fkey'
            columns: ['source_id']
            isOneToOne: false
            referencedRelation: 'research_sources'
            referencedColumns: ['id']
          },
        ]
      }
      research_comparison_sets: {
        Row: {
          id: string
          name: string
          slug: string
          description: string | null
          scope_note: string | null
          band_rule: string
          band_edges: number[] | null
          last_computed_at: string | null
          status: Database['public']['Enums']['content_status']
          created_at: string
          created_by: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          name: string
          slug: string
          description?: string | null
          scope_note?: string | null
          band_rule?: string
          band_edges?: number[] | null
          last_computed_at?: string | null
          status?: Database['public']['Enums']['content_status']
          created_at?: string
          created_by: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          name?: string
          slug?: string
          description?: string | null
          scope_note?: string | null
          band_rule?: string
          band_edges?: number[] | null
          last_computed_at?: string | null
          status?: Database['public']['Enums']['content_status']
          created_at?: string
          created_by?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'research_comparison_sets_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_comparison_sets_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      research_confirmations: {
        Row: {
          id: string
          research_product_id: string
          decision_note: string
          brief_id: string | null
          confirmed_at: string
          confirmed_by: string
          created_product_id: string | null
          product_started_at: string | null
          product_started_by: string | null
          archived_at: string | null
          archived_reason: string | null
        }
        Insert: {
          id?: string
          research_product_id: string
          decision_note: string
          brief_id?: string | null
          confirmed_at?: string
          confirmed_by: string
          created_product_id?: string | null
          product_started_at?: string | null
          product_started_by?: string | null
          archived_at?: string | null
          archived_reason?: string | null
        }
        Update: {
          id?: string
          research_product_id?: string
          decision_note?: string
          brief_id?: string | null
          confirmed_at?: string
          confirmed_by?: string
          created_product_id?: string | null
          product_started_at?: string | null
          product_started_by?: string | null
          archived_at?: string | null
          archived_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'research_confirmations_brief_id_fkey'
            columns: ['brief_id']
            isOneToOne: false
            referencedRelation: 'research_direction_briefs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_confirmations_confirmed_by_fkey'
            columns: ['confirmed_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_confirmations_product_started_by_fkey'
            columns: ['product_started_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_confirmations_research_product_id_fkey'
            columns: ['research_product_id']
            isOneToOne: false
            referencedRelation: 'research_products'
            referencedColumns: ['id']
          },
        ]
      }
      research_direction_brief_evidence: {
        Row: {
          id: string
          brief_id: string
          evidence_type: string
          evidence_id: string
          captured: Json
          rationale: string
          position: number
          created_at: string
          created_by: string
        }
        Insert: {
          id?: string
          brief_id: string
          evidence_type: string
          evidence_id: string
          captured?: Json
          rationale: string
          position?: number
          created_at?: string
          created_by: string
        }
        Update: {
          id?: string
          brief_id?: string
          evidence_type?: string
          evidence_id?: string
          captured?: Json
          rationale?: string
          position?: number
          created_at?: string
          created_by?: string
        }
        Relationships: [
          {
            foreignKeyName: 'research_direction_brief_evidence_brief_id_fkey'
            columns: ['brief_id']
            isOneToOne: false
            referencedRelation: 'research_direction_briefs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_direction_brief_evidence_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      research_direction_brief_revisions: {
        Row: {
          id: string
          brief_id: string
          revision: number
          action: string
          body: Json
          note: string | null
          created_at: string
          created_by: string | null
        }
        Insert: {
          id?: string
          brief_id: string
          revision: number
          action: string
          body: Json
          note?: string | null
          created_at?: string
          created_by?: string | null
        }
        Update: {
          id?: string
          brief_id?: string
          revision?: number
          action?: string
          body?: Json
          note?: string | null
          created_at?: string
          created_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'research_direction_brief_revisions_brief_id_fkey'
            columns: ['brief_id']
            isOneToOne: false
            referencedRelation: 'research_direction_briefs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_direction_brief_revisions_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      research_direction_briefs: {
        Row: {
          id: string
          slug: string
          title: string
          intent: string | null
          scale_intent: string | null
          form_language: string | null
          material_direction: string | null
          finish_direction: string | null
          constraints: string | null
          open_questions: string | null
          not_doing: string | null
          target_category_slug: string | null
          status: Database['public']['Enums']['content_status']
          owner_verification: Database['public']['Enums']['owner_verification']
          fact_classification: Database['public']['Enums']['fact_classification']
          approved_at: string | null
          approved_by: string | null
          created_at: string
          created_by: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          slug: string
          title: string
          intent?: string | null
          scale_intent?: string | null
          form_language?: string | null
          material_direction?: string | null
          finish_direction?: string | null
          constraints?: string | null
          open_questions?: string | null
          not_doing?: string | null
          target_category_slug?: string | null
          status?: Database['public']['Enums']['content_status']
          owner_verification?: Database['public']['Enums']['owner_verification']
          fact_classification?: Database['public']['Enums']['fact_classification']
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          slug?: string
          title?: string
          intent?: string | null
          scale_intent?: string | null
          form_language?: string | null
          material_direction?: string | null
          finish_direction?: string | null
          constraints?: string | null
          open_questions?: string | null
          not_doing?: string | null
          target_category_slug?: string | null
          status?: Database['public']['Enums']['content_status']
          owner_verification?: Database['public']['Enums']['owner_verification']
          fact_classification?: Database['public']['Enums']['fact_classification']
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          created_by?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'research_direction_briefs_approved_by_fkey'
            columns: ['approved_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_direction_briefs_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_direction_briefs_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      research_fetches: {
        Row: {
          id: string
          run_id: string | null
          source_id: string
          work_item_id: string | null
          url: string
          final_url: string | null
          http_status: number | null
          robots_decision: string
          content_hash: string | null
          bytes: number | null
          duration_ms: number | null
          storage_key: string | null
          fetched_at: string
          error: string | null
        }
        Insert: {
          id?: string
          run_id?: string | null
          source_id: string
          work_item_id?: string | null
          url: string
          final_url?: string | null
          http_status?: number | null
          robots_decision: string
          content_hash?: string | null
          bytes?: number | null
          duration_ms?: number | null
          storage_key?: string | null
          fetched_at?: string
          error?: string | null
        }
        Update: {
          id?: string
          run_id?: string | null
          source_id?: string
          work_item_id?: string | null
          url?: string
          final_url?: string | null
          http_status?: number | null
          robots_decision?: string
          content_hash?: string | null
          bytes?: number | null
          duration_ms?: number | null
          storage_key?: string | null
          fetched_at?: string
          error?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'research_fetches_run_id_fkey'
            columns: ['run_id']
            isOneToOne: false
            referencedRelation: 'research_runs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_fetches_source_id_fkey'
            columns: ['source_id']
            isOneToOne: false
            referencedRelation: 'research_sources'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_fetches_work_item_fk'
            columns: ['work_item_id']
            isOneToOne: false
            referencedRelation: 'research_work_items'
            referencedColumns: ['id']
          },
        ]
      }
      research_image_hashes: {
        Row: {
          id: string
          research_product_id: string
          source_id: string
          source_image_url: string
          source_image_key: string
          position: number
          checksum: string
          phash: unknown
          dhash: unknown
          fetch_id: string | null
          computed_at: string
        }
        Insert: {
          id?: string
          research_product_id: string
          source_id: string
          source_image_url: string
          source_image_key: string
          position?: number
          checksum: string
          phash: unknown
          dhash: unknown
          fetch_id?: string | null
          computed_at?: string
        }
        Update: {
          id?: string
          research_product_id?: string
          source_id?: string
          source_image_url?: string
          source_image_key?: string
          position?: number
          checksum?: string
          phash?: unknown
          dhash?: unknown
          fetch_id?: string | null
          computed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'research_image_hashes_fetch_id_fkey'
            columns: ['fetch_id']
            isOneToOne: false
            referencedRelation: 'research_fetches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_image_hashes_research_product_id_fkey'
            columns: ['research_product_id']
            isOneToOne: false
            referencedRelation: 'research_products'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_image_hashes_source_id_fkey'
            columns: ['source_id']
            isOneToOne: false
            referencedRelation: 'research_sources'
            referencedColumns: ['id']
          },
        ]
      }
      research_jobs: {
        Row: {
          id: string
          source_id: string
          job_type: Database['public']['Enums']['research_job_type']
          name: string
          scope: Json
          cron_expression: string | null
          next_run_at: string | null
          is_enabled: boolean
          max_urls: number | null
          status: Database['public']['Enums']['content_status']
          created_at: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          source_id: string
          job_type: Database['public']['Enums']['research_job_type']
          name: string
          scope?: Json
          cron_expression?: string | null
          next_run_at?: string | null
          is_enabled?: boolean
          max_urls?: number | null
          status?: Database['public']['Enums']['content_status']
          created_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          source_id?: string
          job_type?: Database['public']['Enums']['research_job_type']
          name?: string
          scope?: Json
          cron_expression?: string | null
          next_run_at?: string | null
          is_enabled?: boolean
          max_urls?: number | null
          status?: Database['public']['Enums']['content_status']
          created_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'research_jobs_source_id_fkey'
            columns: ['source_id']
            isOneToOne: false
            referencedRelation: 'research_sources'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_jobs_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      research_large_format_rules: {
        Row: {
          id: string
          priority: number
          predicate: Json
          result_band: string | null
          result_is_large: boolean | null
          is_enabled: boolean
          notes: string | null
          status: Database['public']['Enums']['content_status']
          created_at: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          priority: number
          predicate: Json
          result_band?: string | null
          result_is_large?: boolean | null
          is_enabled?: boolean
          notes?: string | null
          status?: Database['public']['Enums']['content_status']
          created_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          priority?: number
          predicate?: Json
          result_band?: string | null
          result_is_large?: boolean | null
          is_enabled?: boolean
          notes?: string | null
          status?: Database['public']['Enums']['content_status']
          created_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'research_large_format_rules_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      research_match_candidates: {
        Row: {
          id: string
          research_product_id: string
          candidate_id: string
          method: string
          score: number
          evidence: Json
          decided: string
          decided_by: string | null
          decided_at: string | null
          created_at: string
        }
        Insert: {
          id?: string
          research_product_id: string
          candidate_id: string
          method: string
          score: number
          evidence?: Json
          decided?: string
          decided_by?: string | null
          decided_at?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          research_product_id?: string
          candidate_id?: string
          method?: string
          score?: number
          evidence?: Json
          decided?: string
          decided_by?: string | null
          decided_at?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'research_match_candidates_candidate_id_fkey'
            columns: ['candidate_id']
            isOneToOne: false
            referencedRelation: 'research_products'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_match_candidates_decided_by_fkey'
            columns: ['decided_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_match_candidates_research_product_id_fkey'
            columns: ['research_product_id']
            isOneToOne: false
            referencedRelation: 'research_products'
            referencedColumns: ['id']
          },
        ]
      }
      research_material_lexicon: {
        Row: {
          id: string
          token: string
          patterns: string[]
          family: string | null
          is_enabled: boolean
          status: Database['public']['Enums']['content_status']
          created_at: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          token: string
          patterns: string[]
          family?: string | null
          is_enabled?: boolean
          status?: Database['public']['Enums']['content_status']
          created_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          token?: string
          patterns?: string[]
          family?: string | null
          is_enabled?: boolean
          status?: Database['public']['Enums']['content_status']
          created_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'research_material_lexicon_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      research_metric_coverage: {
        Row: {
          id: string
          snapshot_id: string
          metric_key: string
          n: number
          denominator: number
          coverage_pct: number | null
          excluded_reasons: Json
          as_of: string
        }
        Insert: {
          id?: string
          snapshot_id: string
          metric_key: string
          n: number
          denominator: number
          coverage_pct?: number | null
          excluded_reasons?: Json
          as_of: string
        }
        Update: {
          id?: string
          snapshot_id?: string
          metric_key?: string
          n?: number
          denominator?: number
          coverage_pct?: number | null
          excluded_reasons?: Json
          as_of?: string
        }
        Relationships: [
          {
            foreignKeyName: 'research_metric_coverage_snapshot_id_fkey'
            columns: ['snapshot_id']
            isOneToOne: false
            referencedRelation: 'research_analytics_snapshots'
            referencedColumns: ['id']
          },
        ]
      }
      research_notes: {
        Row: {
          id: string
          research_product_id: string
          body: string
          author_user_id: string | null
          created_at: string
          superseded_by: string | null
        }
        Insert: {
          id?: string
          research_product_id: string
          body: string
          author_user_id?: string | null
          created_at?: string
          superseded_by?: string | null
        }
        Update: {
          id?: string
          research_product_id?: string
          body?: string
          author_user_id?: string | null
          created_at?: string
          superseded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'research_notes_author_user_id_fkey'
            columns: ['author_user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_notes_research_product_id_fkey'
            columns: ['research_product_id']
            isOneToOne: false
            referencedRelation: 'research_products'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_notes_superseded_by_fkey'
            columns: ['superseded_by']
            isOneToOne: false
            referencedRelation: 'research_notes'
            referencedColumns: ['id']
          },
        ]
      }
      research_opportunity_components: {
        Row: {
          id: string
          score_id: string
          signal_key: string
          raw_input: string | null
          normalised: number | null
          weight: number
          contribution: number | null
          included: boolean
          exclusion_reason: string | null
        }
        Insert: {
          id?: string
          score_id: string
          signal_key: string
          raw_input?: string | null
          normalised?: number | null
          weight: number
          contribution?: number | null
          included: boolean
          exclusion_reason?: string | null
        }
        Update: {
          id?: string
          score_id?: string
          signal_key?: string
          raw_input?: string | null
          normalised?: number | null
          weight?: number
          contribution?: number | null
          included?: boolean
          exclusion_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'research_opportunity_components_score_id_fkey'
            columns: ['score_id']
            isOneToOne: false
            referencedRelation: 'research_opportunity_scores'
            referencedColumns: ['id']
          },
        ]
      }
      research_opportunity_scores: {
        Row: {
          id: string
          research_product_id: string
          model_id: string
          model_version: string
          score: number | null
          raw: number | null
          confidence: number
          completeness: number
          state: string
          analytics_snapshot_id: string | null
          computed_at: string
          computed_by: string | null
        }
        Insert: {
          id?: string
          research_product_id: string
          model_id: string
          model_version: string
          score?: number | null
          raw?: number | null
          confidence: number
          completeness: number
          state: string
          analytics_snapshot_id?: string | null
          computed_at?: string
          computed_by?: string | null
        }
        Update: {
          id?: string
          research_product_id?: string
          model_id?: string
          model_version?: string
          score?: number | null
          raw?: number | null
          confidence?: number
          completeness?: number
          state?: string
          analytics_snapshot_id?: string | null
          computed_at?: string
          computed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'research_opportunity_scores_analytics_snapshot_id_fkey'
            columns: ['analytics_snapshot_id']
            isOneToOne: false
            referencedRelation: 'research_analytics_snapshots'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_opportunity_scores_computed_by_fkey'
            columns: ['computed_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_opportunity_scores_model_id_fkey'
            columns: ['model_id']
            isOneToOne: false
            referencedRelation: 'research_scoring_models'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_opportunity_scores_research_product_id_fkey'
            columns: ['research_product_id']
            isOneToOne: false
            referencedRelation: 'research_products'
            referencedColumns: ['id']
          },
        ]
      }
      research_pipeline_events: {
        Row: {
          id: string
          entity_type: string
          entity_id: string
          from_stage: Database['public']['Enums']['research_stage'] | null
          to_stage: Database['public']['Enums']['research_stage'] | null
          actor_user_id: string | null
          actor_kind: string
          reason: string | null
          occurred_at: string
        }
        Insert: {
          id?: string
          entity_type: string
          entity_id: string
          from_stage?: Database['public']['Enums']['research_stage'] | null
          to_stage?: Database['public']['Enums']['research_stage'] | null
          actor_user_id?: string | null
          actor_kind: string
          reason?: string | null
          occurred_at?: string
        }
        Update: {
          id?: string
          entity_type?: string
          entity_id?: string
          from_stage?: Database['public']['Enums']['research_stage'] | null
          to_stage?: Database['public']['Enums']['research_stage'] | null
          actor_user_id?: string | null
          actor_kind?: string
          reason?: string | null
          occurred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'research_pipeline_events_actor_user_id_fkey'
            columns: ['actor_user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      research_product_tags: {
        Row: {
          research_product_id: string
          tag_id: string
          assigned_by: string | null
          assigned_at: string
        }
        Insert: {
          research_product_id: string
          tag_id: string
          assigned_by?: string | null
          assigned_at?: string
        }
        Update: {
          research_product_id?: string
          tag_id?: string
          assigned_by?: string | null
          assigned_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'research_product_tags_assigned_by_fkey'
            columns: ['assigned_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_product_tags_research_product_id_fkey'
            columns: ['research_product_id']
            isOneToOne: false
            referencedRelation: 'research_products'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_product_tags_tag_id_fkey'
            columns: ['tag_id']
            isOneToOne: false
            referencedRelation: 'research_tags'
            referencedColumns: ['id']
          },
        ]
      }
      research_product_versions: {
        Row: {
          id: string
          research_product_id: string
          run_id: string | null
          fetch_id: string | null
          raw: Json
          normalized: Json | null
          normalizer_version: string | null
          content_hash: string
          storage_key: string | null
          adapter_key: string
          adapter_version: string
          observed_at: string
        }
        Insert: {
          id?: string
          research_product_id: string
          run_id?: string | null
          fetch_id?: string | null
          raw: Json
          normalized?: Json | null
          normalizer_version?: string | null
          content_hash: string
          storage_key?: string | null
          adapter_key: string
          adapter_version: string
          observed_at?: string
        }
        Update: {
          id?: string
          research_product_id?: string
          run_id?: string | null
          fetch_id?: string | null
          raw?: Json
          normalized?: Json | null
          normalizer_version?: string | null
          content_hash?: string
          storage_key?: string | null
          adapter_key?: string
          adapter_version?: string
          observed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'research_product_versions_fetch_id_fkey'
            columns: ['fetch_id']
            isOneToOne: false
            referencedRelation: 'research_fetches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_product_versions_research_product_id_fkey'
            columns: ['research_product_id']
            isOneToOne: false
            referencedRelation: 'research_products'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_product_versions_run_id_fkey'
            columns: ['run_id']
            isOneToOne: false
            referencedRelation: 'research_runs'
            referencedColumns: ['id']
          },
        ]
      }
      research_products: {
        Row: {
          id: string
          source_id: string
          source_url: string
          source_external_id: string | null
          stage: Database['public']['Enums']['research_stage']
          disposition: Database['public']['Enums']['research_disposition']
          first_seen_at: string
          last_seen_at: string
          first_seen_run_id: string | null
          last_seen_run_id: string | null
          current_version_id: string | null
          status: Database['public']['Enums']['content_status']
          created_at: string
          updated_at: string
          updated_by: string | null
          title_normalized: string | null
          brand_text: string | null
          currency: string | null
          price_state: string | null
          price_min_minor: number | null
          price_max_minor: number | null
          dimensions_mm: Json | null
          dimension_parse_state: string | null
          material_tokens: string[]
          availability: string | null
          lead_time_days_min: number | null
          lead_time_days_max: number | null
          variant_count: number | null
          image_urls: string[]
          category_labels: string[]
          matched_category_id: string | null
          match_confidence: number | null
          match_method: string | null
          duplicate_of_id: string | null
          normalized_overrides: Json
          override_by: string | null
          override_at: string | null
          scale_band: string | null
          is_large_format: boolean | null
          longest_axis_mm: number | null
          large_format_source: string | null
          classified_at: string | null
          classified_rule_id: string | null
        }
        Insert: {
          id?: string
          source_id: string
          source_url: string
          source_external_id?: string | null
          stage?: Database['public']['Enums']['research_stage']
          disposition?: Database['public']['Enums']['research_disposition']
          first_seen_at?: string
          last_seen_at?: string
          first_seen_run_id?: string | null
          last_seen_run_id?: string | null
          current_version_id?: string | null
          status?: Database['public']['Enums']['content_status']
          created_at?: string
          updated_at?: string
          updated_by?: string | null
          title_normalized?: string | null
          brand_text?: string | null
          currency?: string | null
          price_state?: string | null
          price_min_minor?: number | null
          price_max_minor?: number | null
          dimensions_mm?: Json | null
          dimension_parse_state?: string | null
          material_tokens?: string[]
          availability?: string | null
          lead_time_days_min?: number | null
          lead_time_days_max?: number | null
          variant_count?: number | null
          image_urls?: string[]
          category_labels?: string[]
          matched_category_id?: string | null
          match_confidence?: number | null
          match_method?: string | null
          duplicate_of_id?: string | null
          normalized_overrides?: Json
          override_by?: string | null
          override_at?: string | null
          scale_band?: string | null
          is_large_format?: boolean | null
          longest_axis_mm?: number | null
          large_format_source?: string | null
          classified_at?: string | null
          classified_rule_id?: string | null
        }
        Update: {
          id?: string
          source_id?: string
          source_url?: string
          source_external_id?: string | null
          stage?: Database['public']['Enums']['research_stage']
          disposition?: Database['public']['Enums']['research_disposition']
          first_seen_at?: string
          last_seen_at?: string
          first_seen_run_id?: string | null
          last_seen_run_id?: string | null
          current_version_id?: string | null
          status?: Database['public']['Enums']['content_status']
          created_at?: string
          updated_at?: string
          updated_by?: string | null
          title_normalized?: string | null
          brand_text?: string | null
          currency?: string | null
          price_state?: string | null
          price_min_minor?: number | null
          price_max_minor?: number | null
          dimensions_mm?: Json | null
          dimension_parse_state?: string | null
          material_tokens?: string[]
          availability?: string | null
          lead_time_days_min?: number | null
          lead_time_days_max?: number | null
          variant_count?: number | null
          image_urls?: string[]
          category_labels?: string[]
          matched_category_id?: string | null
          match_confidence?: number | null
          match_method?: string | null
          duplicate_of_id?: string | null
          normalized_overrides?: Json
          override_by?: string | null
          override_at?: string | null
          scale_band?: string | null
          is_large_format?: boolean | null
          longest_axis_mm?: number | null
          large_format_source?: string | null
          classified_at?: string | null
          classified_rule_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'research_products_current_version_fk'
            columns: ['current_version_id']
            isOneToOne: false
            referencedRelation: 'research_product_versions'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_products_duplicate_fk'
            columns: ['duplicate_of_id']
            isOneToOne: false
            referencedRelation: 'research_products'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_products_first_seen_run_id_fkey'
            columns: ['first_seen_run_id']
            isOneToOne: false
            referencedRelation: 'research_runs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_products_last_seen_run_id_fkey'
            columns: ['last_seen_run_id']
            isOneToOne: false
            referencedRelation: 'research_runs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_products_matched_category_fk'
            columns: ['matched_category_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_products_override_by_fkey'
            columns: ['override_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_products_source_id_fkey'
            columns: ['source_id']
            isOneToOne: false
            referencedRelation: 'research_sources'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_products_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      research_raw_items: {
        Row: {
          id: string
          run_id: string | null
          source_id: string
          fetch_id: string | null
          source_url: string
          source_external_id: string | null
          raw: Json
          content_hash: string | null
          adapter_key: string
          adapter_version: string | null
          extracted_at: string
        }
        Insert: {
          id?: string
          run_id?: string | null
          source_id: string
          fetch_id?: string | null
          source_url: string
          source_external_id?: string | null
          raw: Json
          content_hash?: string | null
          adapter_key?: string
          adapter_version?: string | null
          extracted_at?: string
        }
        Update: {
          id?: string
          run_id?: string | null
          source_id?: string
          fetch_id?: string | null
          source_url?: string
          source_external_id?: string | null
          raw?: Json
          content_hash?: string | null
          adapter_key?: string
          adapter_version?: string | null
          extracted_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'research_raw_items_fetch_id_fkey'
            columns: ['fetch_id']
            isOneToOne: false
            referencedRelation: 'research_fetches'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_raw_items_run_id_fkey'
            columns: ['run_id']
            isOneToOne: false
            referencedRelation: 'research_runs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_raw_items_source_id_fkey'
            columns: ['source_id']
            isOneToOne: false
            referencedRelation: 'research_sources'
            referencedColumns: ['id']
          },
        ]
      }
      research_review_actions: {
        Row: {
          id: string
          research_product_id: string
          change_id: string | null
          action: string
          reason: string | null
          actor_user_id: string | null
          actor_role: string
          occurred_at: string
          undone_by_action_id: string | null
        }
        Insert: {
          id?: string
          research_product_id: string
          change_id?: string | null
          action: string
          reason?: string | null
          actor_user_id?: string | null
          actor_role: string
          occurred_at?: string
          undone_by_action_id?: string | null
        }
        Update: {
          id?: string
          research_product_id?: string
          change_id?: string | null
          action?: string
          reason?: string | null
          actor_user_id?: string | null
          actor_role?: string
          occurred_at?: string
          undone_by_action_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'research_review_actions_actor_user_id_fkey'
            columns: ['actor_user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_review_actions_change_id_fkey'
            columns: ['change_id']
            isOneToOne: false
            referencedRelation: 'research_changes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_review_actions_research_product_id_fkey'
            columns: ['research_product_id']
            isOneToOne: false
            referencedRelation: 'research_products'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_review_actions_undone_by_action_id_fkey'
            columns: ['undone_by_action_id']
            isOneToOne: false
            referencedRelation: 'research_review_actions'
            referencedColumns: ['id']
          },
        ]
      }
      research_robots_cache: {
        Row: {
          id: string
          host: string
          body: string | null
          fetched_at: string
          expires_at: string
          crawl_delay_s: number | null
        }
        Insert: {
          id?: string
          host: string
          body?: string | null
          fetched_at?: string
          expires_at: string
          crawl_delay_s?: number | null
        }
        Update: {
          id?: string
          host?: string
          body?: string | null
          fetched_at?: string
          expires_at?: string
          crawl_delay_s?: number | null
        }
        Relationships: []
      }
      research_runs: {
        Row: {
          id: string
          job_id: string | null
          source_id: string
          status: Database['public']['Enums']['research_run_status']
          trigger: Database['public']['Enums']['research_trigger']
          requested_by: string | null
          queued_at: string
          started_at: string | null
          finished_at: string | null
          stats: Json
          error_summary: string | null
          is_dry_run: boolean
        }
        Insert: {
          id?: string
          job_id?: string | null
          source_id: string
          status?: Database['public']['Enums']['research_run_status']
          trigger?: Database['public']['Enums']['research_trigger']
          requested_by?: string | null
          queued_at?: string
          started_at?: string | null
          finished_at?: string | null
          stats?: Json
          error_summary?: string | null
          is_dry_run?: boolean
        }
        Update: {
          id?: string
          job_id?: string | null
          source_id?: string
          status?: Database['public']['Enums']['research_run_status']
          trigger?: Database['public']['Enums']['research_trigger']
          requested_by?: string | null
          queued_at?: string
          started_at?: string | null
          finished_at?: string | null
          stats?: Json
          error_summary?: string | null
          is_dry_run?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'research_runs_job_id_fkey'
            columns: ['job_id']
            isOneToOne: false
            referencedRelation: 'research_jobs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_runs_requested_by_fkey'
            columns: ['requested_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_runs_source_id_fkey'
            columns: ['source_id']
            isOneToOne: false
            referencedRelation: 'research_sources'
            referencedColumns: ['id']
          },
        ]
      }
      research_saved_views: {
        Row: {
          id: string
          surface: string
          name: string
          filters: Json
          sort: Json | null
          columns: string[] | null
          is_shared: boolean
          owner_user_id: string
          status: Database['public']['Enums']['content_status']
          created_at: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          surface: string
          name: string
          filters: Json
          sort?: Json | null
          columns?: string[] | null
          is_shared?: boolean
          owner_user_id: string
          status?: Database['public']['Enums']['content_status']
          created_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          surface?: string
          name?: string
          filters?: Json
          sort?: Json | null
          columns?: string[] | null
          is_shared?: boolean
          owner_user_id?: string
          status?: Database['public']['Enums']['content_status']
          created_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'research_saved_views_owner_user_id_fkey'
            columns: ['owner_user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_saved_views_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      research_scoring_models: {
        Row: {
          id: string
          version: string
          name: string
          description: string | null
          signals: Json
          weights_total: number
          min_confidence: number
          lifecycle: string
          activated_at: string | null
          activated_by: string | null
          retired_at: string | null
          created_at: string
          created_by: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          version: string
          name: string
          description?: string | null
          signals: Json
          weights_total: number
          min_confidence?: number
          lifecycle?: string
          activated_at?: string | null
          activated_by?: string | null
          retired_at?: string | null
          created_at?: string
          created_by?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          version?: string
          name?: string
          description?: string | null
          signals?: Json
          weights_total?: number
          min_confidence?: number
          lifecycle?: string
          activated_at?: string | null
          activated_by?: string | null
          retired_at?: string | null
          created_at?: string
          created_by?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'research_scoring_models_activated_by_fkey'
            columns: ['activated_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_scoring_models_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_scoring_models_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      research_search_documents: {
        Row: {
          id: string
          entity_type: string
          entity_id: string
          visibility: Database['public']['Enums']['search_visibility']
          status: string
          url_path: string | null
          title: string
          subtitle: string | null
          body: string | null
          keywords: string[]
          source_url: string | null
          search_vector: unknown | null
          indexed_at: string
        }
        Insert: {
          id?: string
          entity_type: string
          entity_id: string
          visibility?: Database['public']['Enums']['search_visibility']
          status: string
          url_path?: string | null
          title: string
          subtitle?: string | null
          body?: string | null
          keywords?: string[]
          source_url?: string | null
          search_vector?: unknown | null
          indexed_at?: string
        }
        Update: {
          id?: string
          entity_type?: string
          entity_id?: string
          visibility?: Database['public']['Enums']['search_visibility']
          status?: string
          url_path?: string | null
          title?: string
          subtitle?: string | null
          body?: string | null
          keywords?: string[]
          source_url?: string | null
          search_vector?: unknown | null
          indexed_at?: string
        }
        Relationships: []
      }
      research_shortlist_entries: {
        Row: {
          id: string
          research_product_id: string
          reason: string
          captured: Json
          brief_id: string | null
          opened_at: string
          opened_by: string
          closed_at: string | null
          closed_reason: string | null
          closed_by: string | null
        }
        Insert: {
          id?: string
          research_product_id: string
          reason: string
          captured?: Json
          brief_id?: string | null
          opened_at?: string
          opened_by: string
          closed_at?: string | null
          closed_reason?: string | null
          closed_by?: string | null
        }
        Update: {
          id?: string
          research_product_id?: string
          reason?: string
          captured?: Json
          brief_id?: string | null
          opened_at?: string
          opened_by?: string
          closed_at?: string | null
          closed_reason?: string | null
          closed_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'research_shortlist_entries_brief_id_fkey'
            columns: ['brief_id']
            isOneToOne: false
            referencedRelation: 'research_direction_briefs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_shortlist_entries_closed_by_fkey'
            columns: ['closed_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_shortlist_entries_opened_by_fkey'
            columns: ['opened_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_shortlist_entries_research_product_id_fkey'
            columns: ['research_product_id']
            isOneToOne: false
            referencedRelation: 'research_products'
            referencedColumns: ['id']
          },
        ]
      }
      research_similarity_pairs: {
        Row: {
          id: string
          run_id: string
          left_hash_id: string
          right_hash_id: string
          method: string
          distance: number | null
          cosine: number | null
          band: Database['public']['Enums']['similarity_band']
          created_at: string
        }
        Insert: {
          id?: string
          run_id: string
          left_hash_id: string
          right_hash_id: string
          method: string
          distance?: number | null
          cosine?: number | null
          band: Database['public']['Enums']['similarity_band']
          created_at?: string
        }
        Update: {
          id?: string
          run_id?: string
          left_hash_id?: string
          right_hash_id?: string
          method?: string
          distance?: number | null
          cosine?: number | null
          band?: Database['public']['Enums']['similarity_band']
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'research_similarity_pairs_left_hash_id_fkey'
            columns: ['left_hash_id']
            isOneToOne: false
            referencedRelation: 'research_image_hashes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_similarity_pairs_right_hash_id_fkey'
            columns: ['right_hash_id']
            isOneToOne: false
            referencedRelation: 'research_image_hashes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_similarity_pairs_run_id_fkey'
            columns: ['run_id']
            isOneToOne: false
            referencedRelation: 'research_similarity_runs'
            referencedColumns: ['id']
          },
        ]
      }
      research_similarity_runs: {
        Row: {
          id: string
          scope_type: string
          scope_id: string | null
          method: string
          model_name: string | null
          status: string
          images_fetched: number
          images_hashed: number
          sources_skipped: Json
          pairs_considered: number
          pairs_stored: number
          pairs_exact: number
          started_at: string
          finished_at: string | null
          error_code: string | null
          created_by: string | null
        }
        Insert: {
          id?: string
          scope_type: string
          scope_id?: string | null
          method: string
          model_name?: string | null
          status?: string
          images_fetched?: number
          images_hashed?: number
          sources_skipped?: Json
          pairs_considered?: number
          pairs_stored?: number
          pairs_exact?: number
          started_at?: string
          finished_at?: string | null
          error_code?: string | null
          created_by?: string | null
        }
        Update: {
          id?: string
          scope_type?: string
          scope_id?: string | null
          method?: string
          model_name?: string | null
          status?: string
          images_fetched?: number
          images_hashed?: number
          sources_skipped?: Json
          pairs_considered?: number
          pairs_stored?: number
          pairs_exact?: number
          started_at?: string
          finished_at?: string | null
          error_code?: string | null
          created_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'research_similarity_runs_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      research_similarity_suppressions: {
        Row: {
          id: string
          left_hash_id: string
          right_hash_id: string
          reason: string
          created_at: string
          created_by: string
        }
        Insert: {
          id?: string
          left_hash_id: string
          right_hash_id: string
          reason: string
          created_at?: string
          created_by: string
        }
        Update: {
          id?: string
          left_hash_id?: string
          right_hash_id?: string
          reason?: string
          created_at?: string
          created_by?: string
        }
        Relationships: [
          {
            foreignKeyName: 'research_similarity_suppressions_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_similarity_suppressions_left_hash_id_fkey'
            columns: ['left_hash_id']
            isOneToOne: false
            referencedRelation: 'research_image_hashes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_similarity_suppressions_right_hash_id_fkey'
            columns: ['right_hash_id']
            isOneToOne: false
            referencedRelation: 'research_image_hashes'
            referencedColumns: ['id']
          },
        ]
      }
      research_source_category_map: {
        Row: {
          id: string
          source_id: string
          source_label: string
          source_path: string | null
          category_id: string | null
          is_ignored: boolean
          mapping_state: string
          status: Database['public']['Enums']['content_status']
          created_at: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          source_id: string
          source_label: string
          source_path?: string | null
          category_id?: string | null
          is_ignored?: boolean
          mapping_state: string
          status?: Database['public']['Enums']['content_status']
          created_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          source_id?: string
          source_label?: string
          source_path?: string | null
          category_id?: string | null
          is_ignored?: boolean
          mapping_state?: string
          status?: Database['public']['Enums']['content_status']
          created_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'research_source_category_map_category_fk'
            columns: ['category_id']
            isOneToOne: false
            referencedRelation: 'categories'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_source_category_map_source_id_fkey'
            columns: ['source_id']
            isOneToOne: false
            referencedRelation: 'research_sources'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_source_category_map_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      research_source_schedules: {
        Row: {
          id: string
          source_id: string
          job_type: Database['public']['Enums']['research_job_type']
          cron_expression: string
          timezone: string
          is_enabled: boolean
          next_run_at: string | null
          status: Database['public']['Enums']['content_status']
          created_at: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          source_id: string
          job_type: Database['public']['Enums']['research_job_type']
          cron_expression: string
          timezone?: string
          is_enabled?: boolean
          next_run_at?: string | null
          status?: Database['public']['Enums']['content_status']
          created_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          source_id?: string
          job_type?: Database['public']['Enums']['research_job_type']
          cron_expression?: string
          timezone?: string
          is_enabled?: boolean
          next_run_at?: string | null
          status?: Database['public']['Enums']['content_status']
          created_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'research_source_schedules_source_id_fkey'
            columns: ['source_id']
            isOneToOne: false
            referencedRelation: 'research_sources'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_source_schedules_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      research_source_url_patterns: {
        Row: {
          id: string
          source_id: string
          kind: string
          pattern: string
          is_regex: boolean
          priority: number
          notes: string | null
          status: Database['public']['Enums']['content_status']
          created_at: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          source_id: string
          kind: string
          pattern: string
          is_regex?: boolean
          priority?: number
          notes?: string | null
          status?: Database['public']['Enums']['content_status']
          created_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          source_id?: string
          kind?: string
          pattern?: string
          is_regex?: boolean
          priority?: number
          notes?: string | null
          status?: Database['public']['Enums']['content_status']
          created_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'research_source_url_patterns_source_id_fkey'
            columns: ['source_id']
            isOneToOne: false
            referencedRelation: 'research_sources'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_source_url_patterns_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      research_sources: {
        Row: {
          id: string
          slug: string
          name: string
          base_url: string
          region: string | null
          currency: string | null
          source_type: Database['public']['Enums']['research_source_type'] | null
          is_enabled: boolean
          adapter_key: string
          rate_limit_rpm: number
          request_delay_ms: number
          concurrency: number
          next_fetch_not_before: string | null
          in_flight_count: number
          consecutive_failures: number
          circuit_open_until: string | null
          policy_status: Database['public']['Enums']['research_policy_status']
          policy_reviewed_by: string | null
          policy_reviewed_at: string | null
          policy_notes: string | null
          status: Database['public']['Enums']['content_status']
          created_at: string
          updated_at: string
          updated_by: string | null
          analytics_league: Database['public']['Enums']['research_analytics_league'] | null
          collection_mode: Database['public']['Enums']['research_collection_mode']
          image_extraction_mode: Database['public']['Enums']['research_image_extraction_mode']
          price_extraction: Json
          sku_extraction: Json
          attribute_extraction: Json
          notes: string | null
          readiness: string
          image_hashing_enabled: boolean
        }
        Insert: {
          id?: string
          slug: string
          name: string
          base_url: string
          region?: string | null
          currency?: string | null
          source_type?: Database['public']['Enums']['research_source_type'] | null
          is_enabled?: boolean
          adapter_key?: string
          rate_limit_rpm?: number
          request_delay_ms?: number
          concurrency?: number
          next_fetch_not_before?: string | null
          in_flight_count?: number
          consecutive_failures?: number
          circuit_open_until?: string | null
          policy_status?: Database['public']['Enums']['research_policy_status']
          policy_reviewed_by?: string | null
          policy_reviewed_at?: string | null
          policy_notes?: string | null
          status?: Database['public']['Enums']['content_status']
          created_at?: string
          updated_at?: string
          updated_by?: string | null
          analytics_league?: Database['public']['Enums']['research_analytics_league'] | null
          collection_mode?: Database['public']['Enums']['research_collection_mode']
          image_extraction_mode?: Database['public']['Enums']['research_image_extraction_mode']
          price_extraction?: Json
          sku_extraction?: Json
          attribute_extraction?: Json
          notes?: string | null
          readiness?: string
          image_hashing_enabled?: boolean
        }
        Update: {
          id?: string
          slug?: string
          name?: string
          base_url?: string
          region?: string | null
          currency?: string | null
          source_type?: Database['public']['Enums']['research_source_type'] | null
          is_enabled?: boolean
          adapter_key?: string
          rate_limit_rpm?: number
          request_delay_ms?: number
          concurrency?: number
          next_fetch_not_before?: string | null
          in_flight_count?: number
          consecutive_failures?: number
          circuit_open_until?: string | null
          policy_status?: Database['public']['Enums']['research_policy_status']
          policy_reviewed_by?: string | null
          policy_reviewed_at?: string | null
          policy_notes?: string | null
          status?: Database['public']['Enums']['content_status']
          created_at?: string
          updated_at?: string
          updated_by?: string | null
          analytics_league?: Database['public']['Enums']['research_analytics_league'] | null
          collection_mode?: Database['public']['Enums']['research_collection_mode']
          image_extraction_mode?: Database['public']['Enums']['research_image_extraction_mode']
          price_extraction?: Json
          sku_extraction?: Json
          attribute_extraction?: Json
          notes?: string | null
          readiness?: string
          image_hashing_enabled?: boolean
        }
        Relationships: [
          {
            foreignKeyName: 'research_sources_policy_reviewed_by_fkey'
            columns: ['policy_reviewed_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_sources_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      research_tags: {
        Row: {
          id: string
          slug: string
          label: string
          colour: string | null
          is_enabled: boolean
          status: Database['public']['Enums']['content_status']
          created_at: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          slug: string
          label: string
          colour?: string | null
          is_enabled?: boolean
          status?: Database['public']['Enums']['content_status']
          created_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          slug?: string
          label?: string
          colour?: string | null
          is_enabled?: boolean
          status?: Database['public']['Enums']['content_status']
          created_at?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'research_tags_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      research_validation_issues: {
        Row: {
          id: string
          research_product_id: string
          version_id: string | null
          rule: string
          severity: string
          field: string | null
          detail: string | null
          is_dismissed: boolean
          dismissed_by: string | null
          dismissed_at: string | null
          dismiss_reason: string | null
          detected_at: string
        }
        Insert: {
          id?: string
          research_product_id: string
          version_id?: string | null
          rule: string
          severity: string
          field?: string | null
          detail?: string | null
          is_dismissed?: boolean
          dismissed_by?: string | null
          dismissed_at?: string | null
          dismiss_reason?: string | null
          detected_at?: string
        }
        Update: {
          id?: string
          research_product_id?: string
          version_id?: string | null
          rule?: string
          severity?: string
          field?: string | null
          detail?: string | null
          is_dismissed?: boolean
          dismissed_by?: string | null
          dismissed_at?: string | null
          dismiss_reason?: string | null
          detected_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'research_validation_issues_dismissed_by_fkey'
            columns: ['dismissed_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_validation_issues_research_product_id_fkey'
            columns: ['research_product_id']
            isOneToOne: false
            referencedRelation: 'research_products'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_validation_issues_version_id_fkey'
            columns: ['version_id']
            isOneToOne: false
            referencedRelation: 'research_product_versions'
            referencedColumns: ['id']
          },
        ]
      }
      research_work_items: {
        Row: {
          id: string
          run_id: string
          source_id: string
          url: string
          depth: number
          state: string
          lease_until: string | null
          attempts: number
          not_before_at: string
          last_error: string | null
          created_at: string
        }
        Insert: {
          id?: string
          run_id: string
          source_id: string
          url: string
          depth?: number
          state?: string
          lease_until?: string | null
          attempts?: number
          not_before_at?: string
          last_error?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          run_id?: string
          source_id?: string
          url?: string
          depth?: number
          state?: string
          lease_until?: string | null
          attempts?: number
          not_before_at?: string
          last_error?: string | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'research_work_items_run_id_fkey'
            columns: ['run_id']
            isOneToOne: false
            referencedRelation: 'research_runs'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'research_work_items_source_id_fkey'
            columns: ['source_id']
            isOneToOne: false
            referencedRelation: 'research_sources'
            referencedColumns: ['id']
          },
        ]
      }
      search_documents: {
        Row: {
          id: string
          entity_type: string
          entity_id: string
          visibility: Database['public']['Enums']['search_visibility']
          status: string
          url_path: string | null
          title: string
          subtitle: string | null
          body: string | null
          keywords: string[]
          image_media_id: string | null
          category_slug: string | null
          search_vector: unknown | null
          indexed_at: string
        }
        Insert: {
          id?: string
          entity_type: string
          entity_id: string
          visibility: Database['public']['Enums']['search_visibility']
          status: string
          url_path?: string | null
          title: string
          subtitle?: string | null
          body?: string | null
          keywords?: string[]
          image_media_id?: string | null
          category_slug?: string | null
          search_vector?: unknown | null
          indexed_at?: string
        }
        Update: {
          id?: string
          entity_type?: string
          entity_id?: string
          visibility?: Database['public']['Enums']['search_visibility']
          status?: string
          url_path?: string | null
          title?: string
          subtitle?: string | null
          body?: string | null
          keywords?: string[]
          image_media_id?: string | null
          category_slug?: string | null
          search_vector?: unknown | null
          indexed_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'search_documents_image_media_id_fkey'
            columns: ['image_media_id']
            isOneToOne: false
            referencedRelation: 'media_assets'
            referencedColumns: ['id']
          },
        ]
      }
      search_queries: {
        Row: {
          id: string
          query_text: string
          normalized_query: string
          scope: string
          result_count: number
          staff_user_id: string | null
          occurred_at: string
        }
        Insert: {
          id?: string
          query_text: string
          normalized_query: string
          scope: string
          result_count: number
          staff_user_id?: string | null
          occurred_at?: string
        }
        Update: {
          id?: string
          query_text?: string
          normalized_query?: string
          scope?: string
          result_count?: number
          staff_user_id?: string | null
          occurred_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'search_queries_staff_user_id_fkey'
            columns: ['staff_user_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
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
          structured_data_type: string | null
          noindex: boolean
          nofollow: boolean
          derived: boolean
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
          structured_data_type?: string | null
          noindex?: boolean
          nofollow?: boolean
          derived?: boolean
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
          structured_data_type?: string | null
          noindex?: boolean
          nofollow?: boolean
          derived?: boolean
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
      seo_keyword_themes: {
        Row: {
          id: string
          theme: string
          normalized_theme: string
          mapped_path: string | null
          research_status: string
          notes: string | null
          evidence_url: string | null
          researched_by: string | null
          researched_at: string | null
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
          theme: string
          normalized_theme: string
          mapped_path?: string | null
          research_status?: string
          notes?: string | null
          evidence_url?: string | null
          researched_by?: string | null
          researched_at?: string | null
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
          theme?: string
          normalized_theme?: string
          mapped_path?: string | null
          research_status?: string
          notes?: string | null
          evidence_url?: string | null
          researched_by?: string | null
          researched_at?: string | null
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
            foreignKeyName: 'seo_keyword_themes_published_by_fkey'
            columns: ['published_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'seo_keyword_themes_researched_by_fkey'
            columns: ['researched_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'seo_keyword_themes_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      seo_redirects: {
        Row: {
          id: string
          from_path: string
          to_path: string
          status_code: number
          reason: string | null
          hit_count: number
          last_hit_at: string | null
          created_by: string | null
          status: Database['public']['Enums']['content_status']
          owner_verification: Database['public']['Enums']['owner_verification']
          fact_classification: Database['public']['Enums']['fact_classification']
          created_at: string
          updated_at: string
          updated_by: string | null
          published_at: string | null
          published_by: string | null
        }
        Insert: {
          id?: string
          from_path: string
          to_path: string
          status_code?: number
          reason?: string | null
          hit_count?: number
          last_hit_at?: string | null
          created_by?: string | null
          status?: Database['public']['Enums']['content_status']
          owner_verification?: Database['public']['Enums']['owner_verification']
          fact_classification?: Database['public']['Enums']['fact_classification']
          created_at?: string
          updated_at?: string
          updated_by?: string | null
          published_at?: string | null
          published_by?: string | null
        }
        Update: {
          id?: string
          from_path?: string
          to_path?: string
          status_code?: number
          reason?: string | null
          hit_count?: number
          last_hit_at?: string | null
          created_by?: string | null
          status?: Database['public']['Enums']['content_status']
          owner_verification?: Database['public']['Enums']['owner_verification']
          fact_classification?: Database['public']['Enums']['fact_classification']
          created_at?: string
          updated_at?: string
          updated_by?: string | null
          published_at?: string | null
          published_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'seo_redirects_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'seo_redirects_published_by_fkey'
            columns: ['published_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'seo_redirects_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      sheets_export_definitions: {
        Row: {
          id: string
          slug: string
          name: string
          entity: string
          scope_id: string | null
          columns: string[]
          filter: Json
          spreadsheet_id: string | null
          tab_name: string
          schedule: string
          includes_pii: boolean
          is_enabled: boolean
          paused_at: string | null
          paused_reason: string | null
          consecutive_failures: number
          last_run_at: string | null
          last_status: string | null
          created_at: string
          created_by: string | null
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          id?: string
          slug: string
          name: string
          entity: string
          scope_id?: string | null
          columns: string[]
          filter?: Json
          spreadsheet_id?: string | null
          tab_name: string
          schedule?: string
          includes_pii?: boolean
          is_enabled?: boolean
          paused_at?: string | null
          paused_reason?: string | null
          consecutive_failures?: number
          last_run_at?: string | null
          last_status?: string | null
          created_at?: string
          created_by?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          id?: string
          slug?: string
          name?: string
          entity?: string
          scope_id?: string | null
          columns?: string[]
          filter?: Json
          spreadsheet_id?: string | null
          tab_name?: string
          schedule?: string
          includes_pii?: boolean
          is_enabled?: boolean
          paused_at?: string | null
          paused_reason?: string | null
          consecutive_failures?: number
          last_run_at?: string | null
          last_status?: string | null
          created_at?: string
          created_by?: string | null
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'sheets_export_definitions_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sheets_export_definitions_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
        ]
      }
      sheets_sync_runs: {
        Row: {
          id: string
          definition_id: string
          status: string
          trigger: string
          row_count: number
          cell_count: number
          attempts: number
          error_code: string | null
          duration_ms: number | null
          started_at: string
          finished_at: string | null
          actor_id: string | null
        }
        Insert: {
          id?: string
          definition_id: string
          status: string
          trigger: string
          row_count?: number
          cell_count?: number
          attempts?: number
          error_code?: string | null
          duration_ms?: number | null
          started_at?: string
          finished_at?: string | null
          actor_id?: string | null
        }
        Update: {
          id?: string
          definition_id?: string
          status?: string
          trigger?: string
          row_count?: number
          cell_count?: number
          attempts?: number
          error_code?: string | null
          duration_ms?: number | null
          started_at?: string
          finished_at?: string | null
          actor_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'sheets_sync_runs_actor_id_fkey'
            columns: ['actor_id']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'sheets_sync_runs_definition_id_fkey'
            columns: ['definition_id']
            isOneToOne: false
            referencedRelation: 'sheets_export_definitions'
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
      system_logs: {
        Row: {
          id: string
          level: Database['public']['Enums']['log_level']
          channel: Database['public']['Enums']['log_channel']
          event: string
          message: string
          context: Json
          actor_id: string | null
          actor_role: Database['public']['Enums']['user_role'] | null
          request_id: string | null
          workflow_run_id: string | null
          research_source_id: string | null
          entity_type: string | null
          entity_id: string | null
          dedupe_key: string
          occurrence_count: number
          first_occurred_at: string
          occurred_at: string
          first_minute: number
        }
        Insert: {
          id?: string
          level: Database['public']['Enums']['log_level']
          channel: Database['public']['Enums']['log_channel']
          event: string
          message: string
          context?: Json
          actor_id?: string | null
          actor_role?: Database['public']['Enums']['user_role'] | null
          request_id?: string | null
          workflow_run_id?: string | null
          research_source_id?: string | null
          entity_type?: string | null
          entity_id?: string | null
          dedupe_key: string
          occurrence_count?: number
          first_occurred_at?: string
          occurred_at?: string
          first_minute?: number
        }
        Update: {
          id?: string
          level?: Database['public']['Enums']['log_level']
          channel?: Database['public']['Enums']['log_channel']
          event?: string
          message?: string
          context?: Json
          actor_id?: string | null
          actor_role?: Database['public']['Enums']['user_role'] | null
          request_id?: string | null
          workflow_run_id?: string | null
          research_source_id?: string | null
          entity_type?: string | null
          entity_id?: string | null
          dedupe_key?: string
          occurrence_count?: number
          first_occurred_at?: string
          occurred_at?: string
          first_minute?: number
        }
        Relationships: [
          {
            foreignKeyName: 'system_logs_actor_id_fkey'
            columns: ['actor_id']
            isOneToOne: false
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
      web_vitals_samples: {
        Row: {
          id: string
          route_pattern: string
          metric: string
          value: number
          rating: string
          nav_type: string | null
          effective_type: string | null
          device_memory_bucket: string | null
          viewport_bucket: string | null
          occurred_at: string
        }
        Insert: {
          id?: string
          route_pattern: string
          metric: string
          value: number
          rating: string
          nav_type?: string | null
          effective_type?: string | null
          device_memory_bucket?: string | null
          viewport_bucket?: string | null
          occurred_at?: string
        }
        Update: {
          id?: string
          route_pattern?: string
          metric?: string
          value?: number
          rating?: string
          nav_type?: string | null
          effective_type?: string | null
          device_memory_bucket?: string | null
          viewport_bucket?: string | null
          occurred_at?: string
        }
        Relationships: []
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
      has_no_blank_pattern: {
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
      is_relation_target: {
        Args: Record<string, unknown>
        Returns: Json
      }
      is_relation_type: {
        Args: Record<string, unknown>
        Returns: Json
      }
      is_sane_research_dimensions: {
        Args: Record<string, unknown>
        Returns: Json
      }
      is_staff: {
        Args: Record<string, unknown>
        Returns: Json
      }
      is_strictly_ascending_bigint_array: {
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
      merch_move_entry: {
        Args: Record<string, unknown>
        Returns: Json
      }
      merch_run_schedule: {
        Args: Record<string, unknown>
        Returns: Json
      }
      merchandising_category_slot_key: {
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
      refresh_research_search_document: {
        Args: Record<string, unknown>
        Returns: Json
      }
      refresh_search_document: {
        Args: Record<string, unknown>
        Returns: Json
      }
      research_cron_field_values: {
        Args: Record<string, unknown>
        Returns: Json
      }
      research_cron_min_interval_minutes: {
        Args: Record<string, unknown>
        Returns: Json
      }
      research_lease_work_items: {
        Args: Record<string, unknown>
        Returns: Json
      }
      research_min_circular_gap: {
        Args: Record<string, unknown>
        Returns: Json
      }
      research_reclaim_expired_leases: {
        Args: Record<string, unknown>
        Returns: Json
      }
      research_restore_brief_revision: {
        Args: Record<string, unknown>
        Returns: Json
      }
      research_write_stage: {
        Args: Record<string, unknown>
        Returns: Json
      }
      rivya_slugify: {
        Args: Record<string, unknown>
        Returns: Json
      }
      rv_keyword_text: {
        Args: Record<string, unknown>
        Returns: Json
      }
      rv_unaccent: {
        Args: Record<string, unknown>
        Returns: Json
      }
      search_documents_count: {
        Args: Record<string, unknown>
        Returns: Json
      }
      search_documents_query: {
        Args: Record<string, unknown>
        Returns: Json
      }
      set_model_association: {
        Args: Record<string, unknown>
        Returns: Json
      }
      system_log_write: {
        Args: Record<string, unknown>
        Returns: Json
      }
    }
    Enums: {
      attribute_taxonomy: 'DESIGN_FAMILY' | 'RESIN_STYLE' | 'WOOD_SPECIES'
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
      log_channel:
        'WORKFLOW' | 'SCRAPER' | 'MEDIA' | 'CONTENT' | 'AUTH' | 'SHEETS' | 'ANALYTICS' | 'SYSTEM'
      log_level: 'INFO' | 'WARNING' | 'ERROR' | 'SECURITY'
      media_kind: 'IMAGE' | 'VIDEO' | 'MODEL_3D' | 'DOCUMENT' | 'BRAND'
      media_source: 'REAL' | 'USER_UPLOAD' | 'HIGGSFIELD' | 'RENDER' | 'FALLBACK'
      merch_fallback: 'EDITORIAL_BLOCK' | 'HIDE_SECTION' | 'SHOW_EMPTY_STATE'
      owner_verification: 'NOT_REQUIRED' | 'OWNER_VERIFICATION_REQUIRED' | 'VERIFIED'
      price_state: 'STARTING_FROM' | 'REQUEST_QUOTE' | 'PRICE_ON_REQUEST' | 'FIXED'
      relation_entity:
        'PRODUCT' | 'COLLECTION' | 'CATEGORY' | 'PORTFOLIO_PROJECT' | 'JOURNAL_ARTICLE' | 'MATERIAL'
      relation_kind: 'RELATED' | 'FEATURES' | 'REFERENCES' | 'USES_MATERIAL' | 'PART_OF'
      relation_origin: 'EDITOR' | 'RULE_ACCEPTED'
      research_analytics_league: 'PEER' | 'ASPIRATIONAL' | 'ADJACENT' | 'MASS'
      research_collection_mode: 'SITEMAP' | 'CATEGORY_CRAWL' | 'SEED_URLS' | 'FEED'
      research_disposition: 'NONE' | 'IGNORED' | 'REJECTED' | 'DUPLICATE'
      research_image_extraction_mode: 'NONE' | 'URL_ONLY' | 'URL_AND_DIMENSIONS'
      research_job_type: 'DISCOVERY' | 'DETAIL' | 'REFRESH'
      research_policy_status: 'UNREVIEWED' | 'APPROVED' | 'RESTRICTED' | 'BLOCKED'
      research_run_status: 'QUEUED' | 'RUNNING' | 'SUCCEEDED' | 'PARTIAL' | 'FAILED' | 'CANCELLED'
      research_source_type:
        'BRAND' | 'RETAILER' | 'MARKETPLACE' | 'GALLERY' | 'ARTISAN' | 'DIRECTORY'
      research_stage:
        'RAW' | 'NORMALIZED' | 'VALIDATED' | 'MATCHED' | 'REVIEW' | 'SHORTLISTED' | 'CONFIRMED'
      research_trigger: 'MANUAL' | 'SCHEDULED'
      search_visibility: 'PUBLIC' | 'STAFF'
      similarity_band: 'NEAR_DUPLICATE' | 'PROBABLE_VARIANT' | 'WEAK' | 'FORM_SIMILAR'
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
