#!/usr/bin/env python3
"""
Script to load phone whitelist from CSV file to Firestore.
Run this script to populate the phone_whitelist config document.

Usage:
    python seed_whitelist.py
"""

import csv
import os
import sys
from dotenv import load_dotenv
import firebase_admin
from firebase_admin import credentials, firestore

load_dotenv()

# Initialize Firebase Admin
def init_firebase():
    if not firebase_admin._apps:
        cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        if cred_path:
            print(f"Loading credentials from {cred_path}")
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
        else:
            print("No local credentials found. Using Application Default Credentials.")
            firebase_admin.initialize_app()

def normalize_phone(phone: str) -> str:
    """Normalize phone number by removing +91, spaces, dashes, and keeping only digits"""
    phone = phone.replace("+91", "").replace("-", "").replace(" ", "").replace("(", "").replace(")", "")
    phone = ''.join(filter(str.isdigit, phone))
    if len(phone) > 10 and phone.startswith("91"):
        phone = phone[2:]
    return phone

def load_whitelist_from_csv(csv_path: str) -> list:
    """Load and normalize phone numbers from CSV file"""
    phones = []
    
    with open(csv_path, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            phone = row.get('Mobile Number', '').strip()
            if phone:
                normalized = normalize_phone(phone)
                if normalized and len(normalized) >= 10:
                    phones.append(normalized)
                    print(f"  {phone} -> {normalized}")
    
    return phones

def upload_to_firestore(phones: list):
    """Upload phone whitelist to Firestore"""
    db_name = os.getenv("DB_NAME")
    db = firestore.client(database_id=db_name) if db_name else firestore.client()
    
    doc_ref = db.collection("config").document("phone_whitelist")
    doc_ref.set({
        "phones": phones,
        "count": len(phones),
        "updated_at": firestore.SERVER_TIMESTAMP
    })
    
    print(f"\n✅ Uploaded {len(phones)} phone numbers to Firestore")

import argparse

def main():
    parser = argparse.ArgumentParser(description="Seed phone whitelist to Firestore")
    parser.add_argument("--dry-run", action="store_true", help="Run without uploading to Firestore")
    args = parser.parse_args()

    # Find the CSV file
    script_dir = os.path.dirname(os.path.abspath(__file__))
    # Go up two levels: scripts -> backend -> quiz-app
    csv_path = os.path.join(script_dir, "..", "..", "users-contact-list.csv")
    
    if not os.path.exists(csv_path):
        csv_path = os.path.join(script_dir, "users-contact-list.csv")
    
    if not os.path.exists(csv_path):
        print("❌ Could not find users-contact-list.csv")
        print("   Please ensure the file exists in the quiz-app directory")
        sys.exit(1)
    
    print(f"📂 Loading phone numbers from: {csv_path}")
    print("-" * 50)

    # Gather config details
    project_id = os.getenv("PROJECT_ID") or os.getenv("GOOGLE_CLOUD_PROJECT") or "Unknown (will use default)"
    db_name = os.getenv("DB_NAME") or "(default)"
    creds_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS") or "Default Application Credentials"

    if args.dry_run:
        print("\n🔎 DRY RUN ANALYSIS:")
        print(f"   Target Project ID : {project_id}")
        print(f"   Target Database   : {db_name}")
        print(f"   Credentials       : {creds_path}")
        print("-" * 50)
    
    # Initialize Firebase only if not dry-run
    if not args.dry_run:
        init_firebase()
    
    phones = load_whitelist_from_csv(csv_path)
    
    if not phones:
        print("❌ No valid phone numbers found in CSV")
        sys.exit(1)
    
    print("-" * 50)
    print(f"📱 Found {len(phones)} valid phone numbers in CSV")
    
    if args.dry_run:
        print("-" * 50)
        print("✅ DRY RUN SUMMARY:")
        print(f"   • Would update Firestore document: 'config/phone_whitelist'")
        print(f"   • Would write {len(phones)} phone numbers to the whitelist")
        print(f"   • Target Database: {db_name}")
        print("\n   To execute changes, run without --dry-run flag.")
        return

    # Confirm before uploading
    response = input("\n🔄 Upload to Firestore? (y/n): ").strip().lower()
    if response == 'y':
        upload_to_firestore(phones)
    else:
        print("⏸️  Upload cancelled")

if __name__ == "__main__":
    main()
