# Backend Scripts

This folder contains one-time utility scripts for database seeding and configuration.

## Scripts

### `seed_whitelist.py`
**Purpose**: Load phone whitelist from CSV file to Firestore.

**When to use**: Run this once to populate the phone whitelist from `users-contact-list.csv`. This enables the phone validation feature that restricts quiz registration to approved numbers only.

**Usage**:
```bash
cd quiz-app/backend
python scripts/seed_whitelist.py
```

**Prerequisites**:
- Firestore credentials configured (`.env` with `GOOGLE_APPLICATION_CREDENTIALS`)
- `users-contact-list.csv` file in the `quiz-app/` directory

---

### `seed_db.py`
**Purpose**: Seed the database with initial sample data.

**When to use**: Run this for development/testing to populate the database with sample questions, users, or other test data.

**Usage**:
```bash
cd quiz-app/backend
python scripts/seed_db.py
```

---

### `fix_submitted_field.py`
**Purpose**: Fix inconsistent `submitted` capability for users.

**When to use**: Run this if users are facing issues with re-submitting quizzes or if the `submitted` status is out of sync.

**Usage**:
```bash
cd quiz-app/backend
python scripts/fix_submitted_field.py
```

---

### `debug_users.py`
**Purpose**: Debug user data and submission states.

**When to use**: Use this to inspect user records, checking for duplicates or inconsistent states during debugging.

**Usage**:
```bash
cd quiz-app/backend
python scripts/debug_users.py
```

---

### `migrate_v1_to_v2.py`
**Purpose**: Migrate database schema from V1 to V2.

**When to use**: Run this ONLY if you are upgrading an old V1 database to the new V2 schema layout.

**Usage**:
```bash
cd quiz-app/backend
python scripts/migrate_v1_to_v2.py
```

---

## Notes
- These scripts are meant to be run manually, not as part of the application
- Always ensure proper Firebase credentials are configured before running
- Back up your database before running seed scripts in production
