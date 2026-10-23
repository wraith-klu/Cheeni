# Backend Work & Maintenance Directory

This directory contains standalone maintenance tools, migration scripts, work logs, and development notes that do not participate directly in the production API request path.

---

## Directory Structure

- **`scripts/`**: One-off diagnostic and data migration scripts.
  - `migrateConversationHistory.js`: Conversation schema backfill and indexing migration.
  - `test_action_detection.js`: Offline heuristic test harness for local intent parser.
- **`notes/`**: Phase execution notes, schema change proposals, and backend task trackers.

---

## Running Maintenance Scripts

To execute any script from this directory:

```bash
cd backend
node work/scripts/<script_name>.js
```
