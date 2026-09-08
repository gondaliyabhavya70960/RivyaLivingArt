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
            foreignKeyName: 'collections_published_by_fkey'
            columns: ['published_by']
            isOneToOne: false
            referencedRelation: 'users'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'collections_updated_by_fkey'
            columns: ['updated_by']
            isOneToOne: false
            referencedRelation: 'users'
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
        }
        Relationships: []
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cms_publish_section: {
        Args: Record<string, unknown>
        Returns: Json
      }
      cms_reorder_sections: {
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
      current_staff_role: {
        Args: Record<string, unknown>
        Returns: Json
      }
      has_role: {
        Args: Record<string, unknown>
        Returns: Json
      }
      is_staff: {
        Args: Record<string, unknown>
        Returns: Json
      }
      rivya_slugify: {
        Args: Record<string, unknown>
        Returns: Json
      }
    }
    Enums: {
      collection_concept_state: 'DRAFT_COLLECTION_CONCEPT'
      content_status: 'DRAFT' | 'REVIEW' | 'APPROVED' | 'PUBLISHED' | 'ARCHIVED'
      fact_classification:
        | 'BRAND_COPY'
        | 'EDITORIAL_COPY'
        | 'VERIFIED_BUSINESS_FACT'
        | 'PRODUCT_FACT'
        | 'SEO_COPY'
        | 'LEGAL_COPY'
      media_kind: 'IMAGE' | 'VIDEO' | 'MODEL_3D' | 'DOCUMENT' | 'BRAND'
      media_source: 'REAL' | 'USER_UPLOAD' | 'HIGGSFIELD' | 'RENDER' | 'FALLBACK'
      owner_verification: 'NOT_REQUIRED' | 'OWNER_VERIFICATION_REQUIRED' | 'VERIFIED'
      price_state: 'STARTING_FROM' | 'REQUEST_QUOTE' | 'PRICE_ON_REQUEST'
      user_role: 'owner' | 'admin' | 'editor' | 'merchandiser' | 'researcher' | 'viewer'
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
