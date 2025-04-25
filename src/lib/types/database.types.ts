
export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          operationName?: string
          query?: string
          variables?: Json
          extensions?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      collaborate_swalang_categories: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      collaborate_swalang_keywords: {
        Row: {
          category_id: string
          created_at: string
          created_by: string | null
          description: string | null
          english_keyword: string
          id: string
          updated_at: string
        }
        Insert: {
          category_id: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          english_keyword: string
          id?: string
          updated_at?: string
        }
        Update: {
          category_id?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          english_keyword?: string
          id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "collaborate_swalang_keywords_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "collaborate_swalang_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      collaborate_swalang_suggestion_votes: {
        Row: {
          created_at: string
          suggestion_id: string
          user_id: string
          vote: number
        }
        Insert: {
          created_at?: string
          suggestion_id: string
          user_id: string
          vote: number
        }
        Update: {
          created_at?: string
          suggestion_id?: string
          user_id?: string
          vote?: number
        }
        Relationships: [
          {
            foreignKeyName: "collaborate_swalang_suggestion_votes_suggestion_id_fkey"
            columns: ["suggestion_id"]
            isOneToOne: false
            referencedRelation: "collaborate_swalang_suggestions"
            referencedColumns: ["id"]
          },
        ]
      }
      collaborate_swalang_suggestions: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          description: string | null
          id: string
          is_approved: boolean
          keyword_id: string
          submitted_by: string
          swahili_word: string
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_approved?: boolean
          keyword_id: string
          submitted_by: string
          swahili_word: string
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          description?: string | null
          id?: string
          is_approved?: boolean
          keyword_id?: string
          submitted_by?: string
          swahili_word?: string
        }
        Relationships: [
          {
            foreignKeyName: "collaborate_swalang_suggestions_keyword_id_fkey"
            columns: ["keyword_id"]
            isOneToOne: false
            referencedRelation: "collaborate_swalang_keywords"
            referencedColumns: ["id"]
          },
        ]
      }
      collaborative_categories: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          name: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      collaborative_keywords: {
        Row: {
          category_id: string | null
          created_at: string | null
          description: string | null
          english_keyword: string
          id: string
        }
        Insert: {
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          english_keyword: string
          id?: string
        }
        Update: {
          category_id?: string | null
          created_at?: string | null
          description?: string | null
          english_keyword?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "collaborative_keywords_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "collaborative_categories"
            referencedColumns: ["id"]
          },
        ]
      }
      collaborative_suggestions: {
        Row: {
          created_at: string | null
          description: string | null
          id: string
          keyword_id: string | null
          submitted_by: string | null
          swahili_word: string
        }
        Insert: {
          created_at?: string | null
          description?: string | null
          id?: string
          keyword_id?: string | null
          submitted_by?: string | null
          swahili_word: string
        }
        Update: {
          created_at?: string | null
          description?: string | null
          id?: string
          keyword_id?: string | null
          submitted_by?: string | null
          swahili_word?: string
        }
        Relationships: [
          {
            foreignKeyName: "collaborative_suggestions_keyword_id_fkey"
            columns: ["keyword_id"]
            isOneToOne: false
            referencedRelation: "collaborative_keywords"
            referencedColumns: ["id"]
          },
        ]
      }
      files: {
        Row: {
          content: string | null
          created_at: string
          id: string
          is_folder: boolean
          name: string
          parent_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string | null
          created_at?: string
          id?: string
          is_folder?: boolean
          name: string
          parent_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string | null
          created_at?: string
          id?: string
          is_folder?: boolean
          name?: string
          parent_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "files_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "files"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      collaborate_swalang_fn_get_suggestion_votes: {
        Args: { p_suggestion_id: string }
        Returns: number
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

type DefaultSchema = Database[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? (Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      Database[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
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
    | { schema: keyof Database },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof Database }
  ? Database[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof Database },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
  }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends { schema: keyof Database }
  ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {},
  },
} as const
