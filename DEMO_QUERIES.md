# Demo Queries

## Plan-Only Queries

### 1. Add Endpoint
```
Add GET /health/details returning app_name, version, and environment.
```

### 2. Add Validation
```
Add input validation to POST /api/assets/upload: file size under 50MB, filename no special characters, language_hint must be 'vi', 'en', 'ja', or 'ko'.
```

### 3. Error Handling
```
Add structured error handling to the ingestion pipeline: catch Qdrant connection failures, return 503 with retry-after header, log with correlation ID.
```

### 4. Bug Fix
```
Fix the temporal retriever bug where video segments with timestamp_start=0 are incorrectly filtered out due to falsy check.
```

## Patch-Mode Queries

### 5. Add Function (patch mode)
```
Add a getHealthDetails() function that returns status, uptime, app_name, version, and environment.
```
Workspace: `examples/patch_targets/ts_mini_app`

### 6. Add Validation (patch mode)
```
Add email validation to createUser() that rejects emails not containing '@'.
```
Workspace: `examples/patch_targets/ts_mini_app`

### 7. Change Response (patch mode)
```
Change formatUserResponse() to return 'User: NAME (EMAIL)' instead of 'NAME <EMAIL>'.
```
Workspace: `examples/patch_targets/ts_mini_app`

## Expected Outputs

Each query should produce:
- 11 markdown artifacts
- report.html
- Status: completed
- Final validation: true

Patch-mode queries should additionally produce:
- Patch applied: true
- Tests pass: true
- Diff with changed files
