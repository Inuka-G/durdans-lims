-- =====================================================
-- Liquibase Migration Cleanup Script
-- Purpose: Clear failed migration state and allow retry
-- =====================================================

-- Step 1: Remove the failed changeset from history
-- This allows Liquibase to retry the migration
DELETE FROM databasechangelog 
WHERE id = 'add-soft-delete-to-patient-document' 
  AND filename LIKE '%202602172018_patient_document_file_hash.xml';

-- Step 2: Drop the file_hash column if it was partially created
-- This ensures a clean slate for the migration
ALTER TABLE patient_document 
DROP COLUMN IF EXISTS file_hash;

-- Step 3: Verify cleanup
SELECT * FROM databasechangelog 
WHERE filename LIKE '%file_hash%'
ORDER BY dateexecuted DESC;

-- =====================================================
-- Instructions:
-- 1. Connect to your PostgreSQL database
-- 2. Execute this script
-- 3. Restart your Spring Boot application
-- 4. The migration will run with the fixed changeset
-- =====================================================
