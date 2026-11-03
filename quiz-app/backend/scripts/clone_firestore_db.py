import os
import argparse
import firebase_admin
from firebase_admin import credentials, firestore
from dotenv import load_dotenv

# Load environment
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(BASE_DIR, ".env"))

def init_firebase():
    if not firebase_admin._apps:
        cred_path = os.getenv("GOOGLE_APPLICATION_CREDENTIALS")
        if cred_path and os.path.exists(cred_path):
            cred = credentials.Certificate(cred_path)
            firebase_admin.initialize_app(cred)
        else:
            firebase_admin.initialize_app()

def copy_collection(source_db, target_db, collection_name, batch_size=400):
    print(f"\n📂 Replicating collection: '{collection_name}'...")
    src_coll = source_db.collection(collection_name)
    docs = list(src_coll.stream())
    
    if not docs:
        print(f"   ℹ️ No documents found in '{collection_name}'. Skipping.")
        return

    print(f"   Found {len(docs)} documents in '{collection_name}'. Copying in batches...")
    
    batch = target_db.batch()
    op_count = 0
    total_copied = 0

    for doc in docs:
        target_ref = target_db.collection(collection_name).document(doc.id)
        batch.set(target_ref, doc.to_dict())
        op_count += 1
        total_copied += 1

        # Check for subcollections (e.g., users/{user_id}/submissions)
        for sub_coll_ref in doc.reference.collections():
            sub_name = sub_coll_ref.id
            sub_docs = list(sub_coll_ref.stream())
            for sub_doc in sub_docs:
                target_sub_ref = target_ref.collection(sub_name).document(sub_doc.id)
                batch.set(target_sub_ref, sub_doc.to_dict())
                op_count += 1
                total_copied += 1

                if op_count >= batch_size:
                    batch.commit()
                    batch = target_db.batch()
                    op_count = 0
                    print(f"   Committed batch ({total_copied} items so far)...")

        if op_count >= batch_size:
            batch.commit()
            batch = target_db.batch()
            op_count = 0
            print(f"   Committed batch ({total_copied} items so far)...")

    if op_count > 0:
        batch.commit()

    print(f"   ✅ Finished '{collection_name}': {total_copied} total items replicated.")

def main():
    parser = argparse.ArgumentParser(description="Replicate Firestore Database from Prod to Dev")
    parser.add_argument("--source", default="first-firestore-db", help="Source DB name (default: first-firestore-db)")
    parser.add_argument("--target", default="dev-firestore-db", help="Target DB name (default: dev-firestore-db)")
    parser.add_argument("--collections", nargs="+", default=["users", "questions", "config", "weeks"], help="Collections to copy")
    
    args = parser.parse_args()
    
    print("=" * 60)
    print("🔄 FIRESTORE DATABASE REPLICATION (PROD -> DEV)")
    print(f"   Source DB: {args.source}")
    print(f"   Target DB: {args.target}")
    print(f"   Collections: {', '.join(args.collections)}")
    print("=" * 60)

    init_firebase()

    source_db = firestore.Client(database=args.source)
    target_db = firestore.Client(database=args.target)

    for coll in args.collections:
        copy_collection(source_db, target_db, coll)

    print("\n🎉 Database replication complete!")

if __name__ == "__main__":
    main()
