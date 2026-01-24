"""
Migration Script: V1 -> V2 (Weekly Quiz System)

This script migrates existing user data to the new weekly structure.
It is NON-DESTRUCTIVE: original data is preserved, new fields are added.

Usage:
    python migrate_v1_to_v2.py --backup          # Export current data to JSON
    python migrate_v1_to_v2.py --migrate         # Run migration (dry run by default)
    python migrate_v1_to_v2.py --migrate --execute  # Actually execute migration
    python migrate_v1_to_v2.py --validate        # Validate migration was successful

Safety Features:
    - Backup creates a timestamped JSON file of all user data
    - Dry run mode shows what would change without making changes
    - Validation confirms all users have been migrated correctly
    - Original fields (score, answers, etc.) are NEVER deleted
"""

import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv
import os
import json
import argparse
from datetime import datetime

load_dotenv()

# Initialize Firebase (Standalone script)
try:
    if not firebase_admin._apps:
        cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        if cred_path:
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
        else:
            firebase_admin.initialize_app()
except Exception as e:
    print(f"❌ Failed to initialize Firebase: {e}")
    exit(1)

DB_NAME = os.getenv("DB_NAME")
db = firestore.Client(database=DB_NAME)

# Configuration
LEGACY_WEEK_ID = "2025-W51"  # The week ID for existing data (Week 52 of 2025)


def backup_data():
    """Export all user and question data to a JSON file for safety."""
    print("📦 Starting Backup...")
    
    backup_data = {
        "backup_timestamp": datetime.now().isoformat(),
        "database": DB_NAME,
        "users": [],
        "questions": []
    }
    
    # Backup Users
    users_ref = db.collection("users")
    for doc in users_ref.stream():
        user_data = doc.to_dict()
        user_data["_id"] = doc.id
        
        # Also backup any existing submissions
        submissions = []
        for sub_doc in doc.reference.collection("submissions").stream():
            sub_data = sub_doc.to_dict()
            sub_data["_id"] = sub_doc.id
            submissions.append(sub_data)
        user_data["_submissions"] = submissions
        
        backup_data["users"].append(user_data)
    
    # Backup Questions
    questions_ref = db.collection("questions")
    for doc in questions_ref.stream():
        q_data = doc.to_dict()
        q_data["_id"] = doc.id
        backup_data["questions"].append(q_data)
    
    # Write to file
    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    filename = f"backup_{DB_NAME}_{timestamp}.json"
    
    with open(filename, 'w') as f:
        json.dump(backup_data, f, indent=2, default=str)
    
    print(f"✅ Backup complete!")
    print(f"   - {len(backup_data['users'])} users backed up")
    print(f"   - {len(backup_data['questions'])} questions backed up")
    print(f"   - Saved to: {filename}")
    return filename


def migrate_v1_to_v2(dry_run=True):
    """
    Migrate user data to the new weekly structure.
    
    What this does:
    1. Adds 'cumulative_score' field to each user (copy of current score)
    2. Creates a submission record for the legacy week (if user submitted)
    3. Adds 'week_id' to existing questions
    
    What this does NOT do:
    - Delete any existing fields
    - Overwrite any existing data
    """
    mode = "🔍 DRY RUN" if dry_run else "🚀 EXECUTING"
    print(f"\n{mode}: Migration V1 -> V2")
    print(f"Legacy Week ID: {LEGACY_WEEK_ID}")
    print("-" * 50)
    
    users_ref = db.collection("users")
    docs = list(users_ref.stream())  # Convert to list to get count
    
    stats = {
        "total_users": len(docs),
        "already_migrated": 0,
        "users_migrated": 0,
        "submissions_created": 0,
        "questions_migrated": 0
    }
    
    for doc in docs:
        user_data = doc.to_dict()
        user_id = doc.id
        
        # Check if already migrated
        if "cumulative_score" in user_data:
            print(f"  ⏩ Skipping {user_id}: Already migrated")
            stats["already_migrated"] += 1
            continue
            
        current_score = user_data.get("score", 0)
        submitted = user_data.get("submitted", False)
        user_name = user_data.get("name", "Unknown")
        
        print(f"  📝 Migrating: {user_name} ({user_id}) - Score: {current_score}")
        
        # Count submissions that will be created (for both dry run and actual run)
        if submitted:
            stats["submissions_created"] += 1
        
        if not dry_run:
            batch = db.batch()
            
            # A. Add cumulative_score to user document
            batch.update(db.collection("users").document(user_id), {
                "cumulative_score": current_score,
            })
            
            # B. Create submission record for legacy week (if they submitted)
            if submitted:
                submission_ref = db.collection("users").document(user_id).collection("submissions").document(LEGACY_WEEK_ID)
                submission_data = {
                    "week_id": LEGACY_WEEK_ID,
                    "user_name": user_name,  # Denormalized for leaderboard queries
                    "score": current_score,
                    "answers": user_data.get("answers", {}),
                    "time_taken": user_data.get("time_taken", 0),
                    "submitted_at": user_data.get("submitted_at", firestore.SERVER_TIMESTAMP),
                    "migrated_at": firestore.SERVER_TIMESTAMP,
                    "migrated": True
                }
                batch.set(submission_ref, submission_data)
                
            batch.commit()
            
        stats["users_migrated"] += 1

    # Migrate Questions
    print("\n📚 Migrating Questions...")
    questions_ref = db.collection("questions")
    q_docs = list(questions_ref.stream())
    
    for q_doc in q_docs:
        q_data = q_doc.to_dict()
        if "week_id" not in q_data:
            print(f"  📝 Assigning {q_doc.id} to {LEGACY_WEEK_ID}")
            if not dry_run:
                db.collection("questions").document(q_doc.id).update({"week_id": LEGACY_WEEK_ID})
            stats["questions_migrated"] += 1
        else:
            print(f"  ⏩ Skipping {q_doc.id}: Already has week_id ({q_data['week_id']})")

    # Summary
    print("\n" + "=" * 50)
    print("📊 MIGRATION SUMMARY")
    print("=" * 50)
    print(f"  Total Users:        {stats['total_users']}")
    print(f"  Already Migrated:   {stats['already_migrated']}")
    print(f"  Users Migrated:     {stats['users_migrated']}")
    print(f"  Submissions Created:{stats['submissions_created']}")
    print(f"  Questions Migrated: {stats['questions_migrated']}")
    
    if dry_run:
        print("\n⚠️  This was a DRY RUN. No changes were made.")
        print("    Run with --execute to apply changes.")
    else:
        print("\n✅ Migration Complete!")
    
    return stats


def validate_migration():
    """
    Validate that the migration was successful.
    
    Checks:
    1. All users have cumulative_score field
    2. Users with submitted=True have a submission document
    3. Cumulative scores match original scores
    4. All questions have week_id
    """
    print("\n🔎 VALIDATING MIGRATION")
    print("-" * 50)
    
    issues = []
    validated = 0
    
    users_ref = db.collection("users")
    docs = list(users_ref.stream())
    
    print(f"Checking {len(docs)} users...")
    
    for doc in docs:
        user_data = doc.to_dict()
        user_id = doc.id
        user_name = user_data.get("name", "Unknown")
        
        # Check 1: cumulative_score exists
        if "cumulative_score" not in user_data:
            issues.append(f"❌ User {user_name} ({user_id}): Missing cumulative_score")
            continue
        
        # Check 2: cumulative_score matches original score (if score exists)
        original_score = user_data.get("score", 0)
        cumulative_score = user_data.get("cumulative_score", 0)
        if original_score != cumulative_score:
            issues.append(f"⚠️  User {user_name} ({user_id}): Score mismatch (original: {original_score}, cumulative: {cumulative_score})")
        
        # Check 3: If submitted, should have submission document
        if user_data.get("submitted", False):
            submissions = list(doc.reference.collection("submissions").stream())
            if len(submissions) == 0:
                issues.append(f"❌ User {user_name} ({user_id}): Submitted but no submission documents found")
            else:
                # Verify submission score matches
                for sub in submissions:
                    sub_data = sub.to_dict()
                    if sub_data.get("score") != original_score:
                        issues.append(f"⚠️  User {user_name} ({user_id}): Submission score mismatch in week {sub.id}")
        
        validated += 1
    
    # Check Questions
    print(f"\nChecking questions...")
    questions_ref = db.collection("questions")
    q_docs = list(questions_ref.stream())
    
    questions_without_week = []
    for q_doc in q_docs:
        q_data = q_doc.to_dict()
        if "week_id" not in q_data:
            questions_without_week.append(q_doc.id)
    
    if questions_without_week:
        issues.append(f"❌ Questions without week_id: {', '.join(questions_without_week)}")
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 VALIDATION SUMMARY")
    print("=" * 50)
    print(f"  Users Validated:    {validated}/{len(docs)}")
    print(f"  Questions Checked:  {len(q_docs)}")
    print(f"  Issues Found:       {len(issues)}")
    
    if issues:
        print("\n🚨 ISSUES DETECTED:")
        for issue in issues:
            print(f"  {issue}")
        return False
    else:
        print("\n✅ All validations passed! Migration is complete and correct.")
        return True


def check_database():
    """
    Check what week IDs currently exist in the database.
    Useful for diagnosing issues before/after migration.
    """
    print("\n🔍 DATABASE CHECK")
    print("-" * 50)
    
    # Check Users
    users_ref = db.collection("users")
    user_docs = list(users_ref.stream())
    
    print(f"\n👤 USERS: {len(user_docs)} total")
    
    users_with_cumulative = 0
    users_with_submissions = 0
    submission_week_ids = {}
    
    for doc in user_docs:
        user_data = doc.to_dict()
        if "cumulative_score" in user_data:
            users_with_cumulative += 1
        
        # Check submissions
        for sub_doc in doc.reference.collection("submissions").stream():
            users_with_submissions += 1
            week_id = sub_doc.id
            submission_week_ids[week_id] = submission_week_ids.get(week_id, 0) + 1
    
    print(f"   - With cumulative_score: {users_with_cumulative}")
    print(f"   - With submissions: {users_with_submissions}")
    
    if submission_week_ids:
        print(f"\n📅 SUBMISSION WEEK IDs FOUND:")
        for week_id, count in sorted(submission_week_ids.items()):
            print(f"   - {week_id}: {count} submissions")
    else:
        print("\n   No submission documents found.")
    
    # Check Questions
    questions_ref = db.collection("questions")
    q_docs = list(questions_ref.stream())
    
    print(f"\n❓ QUESTIONS: {len(q_docs)} total")
    
    question_week_ids = {}
    questions_without_week = 0
    
    for q_doc in q_docs:
        q_data = q_doc.to_dict()
        week_id = q_data.get("week_id")
        if week_id:
            question_week_ids[week_id] = question_week_ids.get(week_id, 0) + 1
        else:
            questions_without_week += 1
    
    if question_week_ids:
        print(f"   Week IDs found:")
        for week_id, count in sorted(question_week_ids.items()):
            print(f"   - {week_id}: {count} questions")
    
    if questions_without_week:
        print(f"   - Without week_id: {questions_without_week}")
    
    print("\n" + "=" * 50)
    return submission_week_ids, question_week_ids


def fix_week_ids(old_week_id: str, new_week_id: str, dry_run: bool = True):
    """
    Update all occurrences of old_week_id to new_week_id.
    Fixes both submissions and questions.
    """
    mode = "🔍 DRY RUN" if dry_run else "🚀 EXECUTING"
    print(f"\n{mode}: Fix Week IDs")
    print(f"   Changing: {old_week_id} → {new_week_id}")
    print("-" * 50)
    
    fixes = {"submissions": 0, "questions": 0}
    
    # Fix Submissions
    print("\n📝 Checking submissions...")
    users_ref = db.collection("users")
    for user_doc in users_ref.stream():
        sub_ref = user_doc.reference.collection("submissions").document(old_week_id)
        sub_doc = sub_ref.get()
        
        if sub_doc.exists:
            sub_data = sub_doc.to_dict()
            user_name = sub_data.get("user_name", user_doc.id)
            print(f"   📝 Fixing submission for {user_name}")
            
            if not dry_run:
                # Create new document with correct week_id
                new_sub_ref = user_doc.reference.collection("submissions").document(new_week_id)
                new_data = sub_data.copy()
                new_data["week_id"] = new_week_id
                new_data["fixed_from"] = old_week_id  # Track the fix
                new_sub_ref.set(new_data)
                
                # Delete old document
                sub_ref.delete()
            
            fixes["submissions"] += 1
    
    # Fix Questions
    print("\n❓ Checking questions...")
    questions_ref = db.collection("questions")
    for q_doc in questions_ref.stream():
        q_data = q_doc.to_dict()
        if q_data.get("week_id") == old_week_id:
            print(f"   📝 Fixing question {q_doc.id}")
            
            if not dry_run:
                q_doc.reference.update({"week_id": new_week_id})
            
            fixes["questions"] += 1
    
    # Summary
    print("\n" + "=" * 50)
    print("📊 FIX SUMMARY")
    print("=" * 50)
    print(f"   Submissions fixed: {fixes['submissions']}")
    print(f"   Questions fixed:   {fixes['questions']}")
    
    if dry_run:
        print("\n⚠️  This was a DRY RUN. No changes were made.")
        print("    Run with --execute to apply fixes.")
    else:
        print("\n✅ Week IDs fixed successfully!")
    
    return fixes


def main():
    parser = argparse.ArgumentParser(
        description="Migration script for Weekly Quiz System (V1 -> V2)",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  python migrate_v1_to_v2.py --backup              # Create backup first (recommended)
  python migrate_v1_to_v2.py --check               # See what's currently in the database
  python migrate_v1_to_v2.py --migrate             # Preview migration (dry run)
  python migrate_v1_to_v2.py --migrate --execute   # Execute the migration
  python migrate_v1_to_v2.py --validate            # Verify migration success
  python migrate_v1_to_v2.py --fix-week 2024-W51 2025-W52          # Fix wrong week IDs (dry run)
  python migrate_v1_to_v2.py --fix-week 2024-W51 2025-W52 --execute # Actually fix week IDs
  
Recommended workflow:
  1. Run --backup first
  2. Run --check to see current state
  3. Run --migrate to preview changes
  4. Run --migrate --execute to apply changes
  5. Run --validate to confirm everything is correct
        """
    )
    
    parser.add_argument("--backup", action="store_true", help="Export all data to JSON backup file")
    parser.add_argument("--check", action="store_true", help="Check what week IDs exist in database")
    parser.add_argument("--migrate", action="store_true", help="Run migration (dry run unless --execute is also specified)")
    parser.add_argument("--execute", action="store_true", help="Actually execute changes (use with --migrate or --fix-week)")
    parser.add_argument("--validate", action="store_true", help="Validate migration was successful")
    parser.add_argument("--fix-week", nargs=2, metavar=("OLD_WEEK", "NEW_WEEK"), help="Fix week IDs from OLD to NEW")
    
    args = parser.parse_args()
    
    # Show help if no arguments
    if not any([args.backup, args.check, args.migrate, args.validate, args.fix_week]):
        parser.print_help()
        print("\n💡 Start with: python migrate_v1_to_v2.py --check")
        return
    
    print("=" * 50)
    print("🔧 Migration Tool: Weekly Quiz System")
    print(f"   Database: {DB_NAME}")
    print(f"   Target Week ID: {LEGACY_WEEK_ID}")
    print("=" * 50)
    
    if args.backup:
        backup_data()
    
    if args.check:
        check_database()
    
    if args.migrate:
        dry_run = not args.execute
        migrate_v1_to_v2(dry_run=dry_run)
    
    if args.fix_week:
        old_week, new_week = args.fix_week
        dry_run = not args.execute
        fix_week_ids(old_week, new_week, dry_run=dry_run)
    
    if args.validate:
        validate_migration()


if __name__ == "__main__":
    main()
