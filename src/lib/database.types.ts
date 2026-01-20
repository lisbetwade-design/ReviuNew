export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          email: string;
          full_name: string | null;
          created_at: string;
          updated_at: string;
          figma_token: string | null;
          slack_webhook_url: string | null;
          slack_channel: string | null;
          slack_access_token: string | null;
          slack_team_id: string | null;
          slack_team_name: string | null;
          slack_connected_at: string | null;
          slack_listening_channels: string | null;
        };
        Insert: {
          id: string;
          email: string;
          full_name?: string | null;
          created_at?: string;
          updated_at?: string;
          figma_token?: string | null;
          slack_webhook_url?: string | null;
          slack_channel?: string | null;
          slack_access_token?: string | null;
          slack_team_id?: string | null;
          slack_team_name?: string | null;
          slack_connected_at?: string | null;
          slack_listening_channels?: string | null;
        };
        Update: {
          id?: string;
          email?: string;
          full_name?: string | null;
          updated_at?: string;
          figma_token?: string | null;
          slack_webhook_url?: string | null;
          slack_channel?: string | null;
          slack_access_token?: string | null;
          slack_team_id?: string | null;
          slack_team_name?: string | null;
          slack_connected_at?: string | null;
          slack_listening_channels?: string | null;
        };
      };
      projects: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          description: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          description?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          description?: string;
          updated_at?: string;
        };
      };
      designs: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          source_type: string;
          source_url: string | null;
          image_url: string | null;
          shareable_token: string | null;
          folder_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          name: string;
          source_type?: string;
          source_url?: string | null;
          image_url?: string | null;
          shareable_token?: string | null;
          folder_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          source_type?: string;
          source_url?: string | null;
          image_url?: string | null;
          folder_id?: string | null;
          updated_at?: string;
        };
      };
      feedback: {
        Row: {
          id: string;
          design_id: string;
          stakeholder_name: string;
          stakeholder_email: string | null;
          stakeholder_role: string;
          content: string;
          rating: number | null;
          source_type: string;
          is_processed: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          design_id: string;
          stakeholder_name: string;
          stakeholder_email?: string | null;
          stakeholder_role?: string;
          content: string;
          rating?: number | null;
          source_type?: string;
          is_processed?: boolean;
          created_at?: string;
        };
        Update: {
          is_processed?: boolean;
        };
      };
      board_items: {
        Row: {
          id: string;
          user_id: string;
          project_id: string | null;
          design_id: string | null;
          title: string;
          description: string;
          status: string;
          priority: string;
          stakeholder_role: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          project_id?: string | null;
          design_id?: string | null;
          title: string;
          description?: string;
          status?: string;
          priority?: string;
          stakeholder_role?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          title?: string;
          description?: string;
          status?: string;
          priority?: string;
          stakeholder_role?: string | null;
          updated_at?: string;
        };
      };
      feedback_summaries: {
        Row: {
          id: string;
          project_id: string;
          design_id: string | null;
          summary_data: Record<string, unknown>;
          created_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          design_id?: string | null;
          summary_data: Record<string, unknown>;
          created_at?: string;
        };
        Update: {
          summary_data?: Record<string, unknown>;
        };
      };
      comments: {
        Row: {
          id: string;
          design_id: string;
          user_id: string | null;
          author_name: string;
          author_email: string;
          content: string;
          status: string;
          rating: number | null;
          x_position: number | null;
          y_position: number | null;
          page_url: string | null;
          element_selector: string | null;
          element_text: string | null;
          theme: string | null;
          viewed_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          design_id: string;
          user_id?: string | null;
          author_name?: string;
          author_email?: string;
          content: string;
          status?: string;
          rating?: number | null;
          x_position?: number | null;
          y_position?: number | null;
          page_url?: string | null;
          element_selector?: string | null;
          element_text?: string | null;
          theme?: string | null;
          viewed_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          content?: string;
          status?: string;
          rating?: number | null;
          page_url?: string | null;
          element_selector?: string | null;
          element_text?: string | null;
          theme?: string | null;
          viewed_at?: string | null;
          updated_at?: string;
        };
      };
      design_folders: {
        Row: {
          id: string;
          project_id: string;
          name: string;
          description: string | null;
          shareable_token: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          project_id: string;
          name: string;
          description?: string | null;
          shareable_token?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          name?: string;
          description?: string | null;
          updated_at?: string;
        };
      };
      figma_connections: {
        Row: {
          id: string;
          user_id: string;
          access_token: string;
          refresh_token: string;
          expires_at: string;
          figma_user_id: string;
          figma_user_email: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          access_token: string;
          refresh_token: string;
          expires_at: string;
          figma_user_id: string;
          figma_user_email?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          access_token?: string;
          refresh_token?: string;
          expires_at?: string;
          figma_user_id?: string;
          figma_user_email?: string | null;
          updated_at?: string;
        };
      };
      figma_tracked_files: {
        Row: {
          id: string;
          user_id: string;
          project_id: string | null;
          file_key: string;
          file_name: string;
          file_url: string;
          last_synced_at: string | null;
          sync_enabled: boolean;
          webhook_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          project_id?: string | null;
          file_key: string;
          file_name: string;
          file_url: string;
          last_synced_at?: string | null;
          sync_enabled?: boolean;
          webhook_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          project_id?: string | null;
          file_key?: string;
          file_name?: string;
          file_url?: string;
          last_synced_at?: string | null;
          sync_enabled?: boolean;
          webhook_id?: string | null;
          updated_at?: string;
        };
      };
      figma_sync_preferences: {
        Row: {
          id: string;
          user_id: string;
          tracked_file_id: string;
          sync_all_comments: boolean;
          sync_only_mentions: boolean;
          sync_unresolved_only: boolean;
          notification_channels: Record<string, unknown>;
          sync_frequency: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          tracked_file_id: string;
          sync_all_comments?: boolean;
          sync_only_mentions?: boolean;
          sync_unresolved_only?: boolean;
          notification_channels?: Record<string, unknown>;
          sync_frequency?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          sync_all_comments?: boolean;
          sync_only_mentions?: boolean;
          sync_unresolved_only?: boolean;
          notification_channels?: Record<string, unknown>;
          sync_frequency?: string;
          updated_at?: string;
        };
      };
    };
  };
}
