#!/usr/bin/env python3
import requests
import json
import time

SERVICE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InFudXpjbWRqcGFmYnFub2ZwemZwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NzMzMzY4OSwiZXhwIjoyMDgyOTA5Njg5fQ.TfT4ibHQKUue-C2QssakD-IHmkHFKThiq3avc_nZj6k"
URL = "https://qnuzcmdjpafbqnofpzfp.supabase.co"

headers = {
    "apikey": SERVICE_KEY,
    "Authorization": f"Bearer {SERVICE_KEY}",
    "Content-Type": "application/json",
    "Prefer": "return=minimal"
}

# SQL para crear las tablas básicas
queries = [
    # Profiles
    """
    CREATE TABLE IF NOT EXISTS profiles (
      id UUID PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK (role IN ('admin', 'trainer', 'member')),
      avatar_url TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    """,
    
    # Invitation codes
    """
    CREATE TABLE IF NOT EXISTS invitation_codes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      code TEXT NOT NULL UNIQUE,
      trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      max_uses INTEGER NOT NULL DEFAULT 10,
      uses_count INTEGER NOT NULL DEFAULT 0,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      expires_at TIMESTAMP WITH TIME ZONE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    """,
    
    # Trainer members
    """
    CREATE TABLE IF NOT EXISTS trainer_members (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(member_id)
    );
    """,
    
    # Feed posts
    """
    CREATE TABLE IF NOT EXISTS feed_posts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      author_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      image_url TEXT,
      is_hidden BOOLEAN NOT NULL DEFAULT FALSE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    """,
    
    # Feed comments
    """
    CREATE TABLE IF NOT EXISTS feed_comments (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id UUID NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
      commenter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      content TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    """,
    
    # Feed likes
    """
    CREATE TABLE IF NOT EXISTS feed_likes (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id UUID NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(post_id, user_id)
    );
    """,
    
    # Feed reports
    """
    CREATE TABLE IF NOT EXISTS feed_reports (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      post_id UUID NOT NULL REFERENCES feed_posts(id) ON DELETE CASCADE,
      reporter_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      reason TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    """,
    
    # Workout templates
    """
    CREATE TABLE IF NOT EXISTS workout_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    """,
    
    # Member workouts
    """
    CREATE TABLE IF NOT EXISTS member_workouts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      member_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
      workout_template_id UUID NOT NULL REFERENCES workout_templates(id) ON DELETE CASCADE,
      assigned_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    """,
    
    # Diet templates
    """
    CREATE TABLE IF NOT EXISTS diet_templates (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      calories INTEGER NOT NULL,
      protein_g INTEGER NOT NULL,
      carbs_g INTEGER NOT NULL,
      fat_g INTEGER NOT NULL,
      content TEXT NOT NULL,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    """,
    
    # Member diets
    """
    CREATE TABLE IF NOT EXISTS member_diets (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      member_id UUID NOT NULL UNIQUE REFERENCES profiles(id) ON DELETE CASCADE,
      diet_template_id UUID NOT NULL REFERENCES diet_templates(id) ON DELETE CASCADE,
      assigned_by UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      assigned_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    """,
    
    # Progress records
    """
    CREATE TABLE IF NOT EXISTS progress_records (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
      weight_kg DECIMAL(5,2),
      chest_cm DECIMAL(5,2),
      waist_cm DECIMAL(5,2),
      hips_cm DECIMAL(5,2),
      arms_cm DECIMAL(5,2),
      legs_cm DECIMAL(5,2),
      notes TEXT,
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    """,
    
    # Trainer notices
    """
    CREATE TABLE IF NOT EXISTS trainer_notices (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      trainer_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      member_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      priority TEXT NOT NULL DEFAULT 'normal' CHECK (priority IN ('low', 'normal', 'high')),
      created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
    );
    """,
    
    # Notice reads
    """
    CREATE TABLE IF NOT EXISTS notice_reads (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      notice_id UUID NOT NULL REFERENCES trainer_notices(id) ON DELETE CASCADE,
      member_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
      read_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
      UNIQUE(notice_id, member_id)
    );
    """
]

print("🚀 Creando tablas en Supabase usando SQL directo...\n")
print("⚠️  NOTA: Debes ejecutar el SQL manualmente en Supabase SQL Editor")
print(f"   Ve a: {URL}/project/qnuzcmdjpafbqnofpzfp/sql\n")
print("=" * 80)
print("\nCopia y pega el siguiente SQL en el Editor:\n")
print("=" * 80)

full_sql = "\n\n".join(queries)
print(full_sql)

print("\n" + "=" * 80)
print("\n✅ Después de ejecutar el SQL, corre de nuevo setup-supabase.js")
print("   node setup-supabase.js\n")
