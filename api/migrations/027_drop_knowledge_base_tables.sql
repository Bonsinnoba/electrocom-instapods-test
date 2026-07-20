-- Migration: Drop knowledge base tables
-- Description: Removes knowledge base tables after removing live chat feature
-- Created: 2026-05-27

-- Drop question_attempts table
DROP TABLE IF EXISTS question_attempts;

-- Drop knowledge_base table
DROP TABLE IF EXISTS knowledge_base;
