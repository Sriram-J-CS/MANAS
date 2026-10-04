# EmotiCare AI — Automated Testing Suite

## 1. Test Architecture Overview

The EmotiCare AI test suite validates the entire stack from unit logic to live server crisis regression and cryptographic security isolation.

```
tests/
  ├── test_crisis.py                 # Live crisis triage regression (11/11 PASSED)
  ├── test_emoticare_production.py   # Full production flow & RBAC (5/5 PASSED)
  └── test_security_p0.py            # P0 security & DPDP purge tests (7/7 PASSED)
backend/tests/
  └── test_pipeline.py               # Complete conversational pipeline suite (40/40 PASSED)
```

**Total Automated Tests**: 52 unit/integration tests + 11 live server crisis tests = 63 tests (100% Passing).

---

## 2. Test Execution Commands

### Run Full Test Suite (Pytest)
```bash
python -m pytest tests/ backend/tests/
```
*Expected Result: 52 passed in ~120s.*

### Run Crisis Regression Suite (Live Server)
Ensure the FastAPI backend is running on `http://127.0.0.1:8008`, then execute:
```bash
python tests/test_crisis.py
```
*Expected Result: 11 PASSED, 0 FAILED.*

### Run Security P0 Suite
```bash
python -m pytest tests/test_security_p0.py -v
```
Validates:
- Cross-user chat data isolation (`403 Forbidden`).
- Cross-user memory isolation (`403 Forbidden`).
- Cross-user mood history isolation (`403 Forbidden`).
- Unauthenticated access prevention on private routes (`401 Unauthorized`).
- Tampered JWT token signature rejection (`401 Unauthorized`).
- Zero-fabrication honest empty states.
- DPDP Act machine-readable export and cascading account deletion.

### Run Frontend Production Typecheck & Build
```bash
npm --prefix frontend run build
```
*Expected Result: `tsc -b && vite build` completes with exit code 0.*
