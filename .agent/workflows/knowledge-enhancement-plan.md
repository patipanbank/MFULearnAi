# Knowledge Base Enhancement — Implementation Plan

## Overview
12 features for the Knowledge Base system, organized by dependency order into 5 phases.
Each phase builds on the previous one.

## Architecture Principle
- **Non-breaking**: All changes use additive schema fields (optional, with defaults)
- **No migration needed**: Old documents continue working without modification
- **Backward compatible APIs**: New fields returned alongside existing ones

---

## Phase 1: Schema Foundation (Features #4, #3, #12)
> Add core fields to Knowledge model that other features depend on.

### 1A. Description Editing (Feature #4)
**What**: Let users edit description/notes after upload via KnowledgeDetailModal.
**Backend**:
- Add `PATCH /api/knowledge/:id` endpoint (update title, description)
- Validate: only owner or admin can edit
**Frontend**:
- Add inline edit mode to `KnowledgeDetailModal.vue`
- Show edit pencil icon for owner/admin
**Impact**: Schema field `description` already exists — just needs edit UI.

### 1B. Tags / Categories (Feature #3)
**What**: Add freeform tags to knowledge items for filtering and search.
**Backend**:
- Add `tags: string[]` to `IKnowledge` schema (default: `[]`)
- Add tag-based filtering to `getKnowledgeList()`
- Index: `KnowledgeSchema.index({ tags: 1 })`
**Frontend**:
- Add tag chips to `KnowledgeDetailModal` and `KnowledgeList`
- Add tag filter to filter bar
**Impact**: New optional field, no existing documents affected.

### 1C. Feedback Loop — Storage (Feature #12)
**What**: Store like/dislike feedback per message for RAG quality analysis.
**Backend**:
- Create `MessageFeedback` model: `{ userId, sessionId, messageId, type: 'liked'|'disliked', knowledgeIds[], query, createdAt }`
- Add `POST /api/chat/feedback` endpoint
- Link feedback to knowledge items used in the response (from `sources`)
**Frontend**:
- Wire `@feedback` event from ChatMessage.vue → Chat.vue → API call
**Impact**: New collection, new API endpoint. No existing data modified.

### Dependencies: None (can start immediately)

---

## Phase 2: Search & Analytics (Features #1, #2, #6)
> Requires Phase 1C (feedback model) for the analytics portion.

### 2A. Knowledge Search (Feature #1)
**What**: Full-text search bar in KnowledgeList to filter by title/description.
**Frontend only**:
- Add search input to `KnowledgeList.vue` above filters
- Client-side filter on `title`, `description`, `tags` (from Phase 1B)
- Debounced input, highlight matched text
**Impact**: Frontend only. No backend changes.

### 2B. Knowledge Stats Dashboard (Feature #2)
**What**: Show most-used knowledge items on admin dashboard.
**Backend**:
- Create `KnowledgeHit` model: `{ knowledgeId, query, score, userId, createdAt }`
- Log hits in `KnowledgeService.search()` (fire-and-forget insert)
- Add `GET /api/knowledge/stats` endpoint:
  - Top 10 most used documents (by hit count)
  - Documents never used (candidates for removal)
  - Hit trend (last 7 days)
**Frontend**:
- Add "Knowledge Stats" section to `AdminDashboard.vue` or dedicated tab
**Impact**: New collection, new endpoint. Adds small write per search (async, non-blocking).

### 2C. Usage Analytics per Document (Feature #6)
**What**: Per-document usage analytics visible in KnowledgeDetailModal.
**Backend**:
- Reuse `KnowledgeHit` model from #2B
- Add `GET /api/knowledge/:id/analytics` endpoint:
  - Total hits, unique users, avg score, last accessed
  - Top queries that retrieved this document
  - Feedback summary (likes/dislikes from Phase 1C)
**Frontend**:
- Add "Analytics" tab to `KnowledgeDetailModal`
**Impact**: Builds on 2B model. New endpoint.

### Dependencies: Phase 1C for feedback data

---

## Phase 3: Upload Enhancements (Features #8, #5, #7)
> Independent of Phase 2, can be developed in parallel.

### 3A. Batch Upload (Feature #8)
**What**: Multi-file drag & drop upload with combined progress.
**Frontend**:
- Refactor `UploadModal.vue` to accept multiple files
- Show file list with individual progress bars
- Sequential upload with overall progress indicator
**Backend**:
- Existing single-file endpoint called in loop (no backend change needed)
- Alternative: Add `POST /api/knowledge/upload/batch` for efficiency
**Impact**: Frontend refactor. Backend optional.

### 3B. Version Control (Feature #5)
**What**: When re-uploading a file with same name, create version instead of duplicate.
**Backend**:
- Add `versions: [{ s3Key, uploadedAt, uploadedBy, versionNumber }]` to `IKnowledge`
- Add `currentVersion: number` field
- On upload: check if title matches existing → prompt user to create new version
- Add `GET /api/knowledge/:id/versions` endpoint
- Add `POST /api/knowledge/:id/rollback/:version` endpoint
**Frontend**:
- Show version history in `KnowledgeDetailModal`
- "Upload New Version" button on existing items
- Version comparison view (optional)
**Impact**: New schema fields (optional). Version-aware processing.

### 3C. URL/Web Scraper Source (Feature #7)
**What**: Add knowledge from URL instead of file upload.
**Backend**:
- Add `POST /api/knowledge/url` endpoint
- Accept: `{ url, type, title? }`
- Server-side: fetch URL → extract text (readability/cheerio) → store as knowledge
- Set `contentSource: url`, add `sourceUrl` field to schema
- Queue for processing (same pipeline as file)
**Frontend**:
- Add "Add from URL" tab in UploadModal
- URL input + preview before submit
**Impact**: New endpoint, new schema field. Reuses existing processing pipeline.

### Dependencies: None (independent)

---

## Phase 4: Intelligence Features (Features #11, #13)
> Requires Phase 2B (hit data) and Phase 1C (feedback) for quality scoring.

### 4A. Semantic Duplicate Detection (Feature #11)
**What**: Warn admin when uploading content that's very similar to existing.
**Backend**:
- After embedding new document chunks, query ChromaDB for similar existing chunks
- If cosine similarity > 0.95 (configurable threshold), flag as potential duplicate
- Add `duplicateOf?: string` field to `IKnowledge` (link to similar doc)
- Add check in `processKnowledgeJob` worker
**Frontend**:
- Show warning in upload result: "This document appears similar to: [DocName]"
- Admin can choose to keep, merge, or discard
**Impact**: Runs during processing (worker). No existing data modified.

### 4B. Knowledge Quality Score (Feature #13)
**What**: Auto-calculate quality score per document.
**Backend**:
- Add `qualityScore: number` field to `IKnowledge` (0-100)
- Calculate from:
  - Text length / chunk count (content completeness)
  - Average re-rank score when retrieved
  - User feedback ratio (likes vs dislikes from Phase 1C)
  - Hit frequency (from Phase 2B)
  - Processing success (clean extraction)
- Run as background job: `calculateQualityScores()` (cron or on-demand)
- Add `GET /api/knowledge/quality` endpoint for admin
**Frontend**:
- Show quality badge on knowledge items (🟢 Good, 🟡 Fair, 🔴 Poor)
- Sort/filter by quality score
**Impact**: New computed field. Depends on hit/feedback data.

### Dependencies: Phase 2B + Phase 1C

---

## Phase 5: Lifecycle Management (Features #9, #10)
> Final phase — organizational and operational features.

### 5A. Folder/Hierarchy Structure (Feature #9)
**What**: Nested collections for multi-level organization.
**Backend**:
- Add `parentId?: string` to `ICollection` schema
- Add `path: string` field (materialized path pattern, e.g., `/root/sub/leaf`)
- Modify `getCollections()` to return tree structure
- Add `GET /api/knowledge/collections/tree` endpoint
**Frontend**:
- Refactor CollectionList to render as expandable tree
- Drag & drop to move collections
- Breadcrumb navigation
**Impact**: New optional fields on Collection. Existing flat collections = root level.

### 5B. Auto-Expiry / Review Cycle (Feature #10)
**What**: Schedule document reviews and auto-archive expired documents.
**Backend**:
- Add `expiresAt?: Date` and `reviewDueAt?: Date` to `IKnowledge`
- Add `lastReviewedAt?: Date` and `reviewedBy?: string`
- Background job (BullMQ cron): check expiring documents daily
  - If `expiresAt < now` → set `visibility: 'archived'`
  - If `reviewDueAt < now + 7days` → create notification
- Add `POST /api/knowledge/:id/review` endpoint (mark as reviewed)
- Add `GET /api/knowledge/expiring` endpoint (admin dashboard)
**Frontend**:
- Add date pickers for expiry/review in KnowledgeDetailModal
- "Expiring Soon" warning list on admin dashboard
- "Mark as Reviewed" button
**Impact**: New optional fields. Background job for auto-archiving.

### Dependencies: Phase 1A (edit capability) for review actions

---

## Execution Priority

| Order | Feature | Phase | Effort | Value |
|-------|---------|-------|--------|-------|
| 1 | #12 Feedback (storage) | 1C | S | HIGH — enables future analytics |
| 2 | #4 Description Edit | 1A | S | HIGH — quick win, UX improvement |
| 3 | #3 Tags | 1B | S | HIGH — enables search/filter |
| 4 | #1 Search Bar | 2A | S | HIGH — most requested UX feature |
| 5 | #6 Usage Analytics | 2B+2C | M | HIGH — admin insights |
| 6 | #2 Stats Dashboard | 2B | M | HIGH — admin visibility |
| 7 | #8 Batch Upload | 3A | M | MEDIUM — UX convenience |
| 8 | #13 Quality Score | 4B | M | MEDIUM — helps curation |
| 9 | #12 Feedback (display) | 4B | S | MEDIUM — closes feedback loop |
| 10 | #5 Version Control | 3B | L | MEDIUM — document lifecycle |
| 11 | #7 URL Scraper | 3C | M | MEDIUM — new content source |
| 12 | #11 Duplicate Detection | 4A | M | LOW — prevention |
| 13 | #9 Folder Hierarchy | 5A | L | LOW — organizational |
| 14 | #10 Auto-Expiry | 5B | M | LOW — operational |

S = Small (1-2 files), M = Medium (3-5 files), L = Large (5+ files)

---

## Schema Changes Summary

### Knowledge Model (additive only)
```typescript
// New optional fields — no migration needed
tags: string[]              // #3
sourceUrl?: string           // #7
versions: VersionEntry[]     // #5
currentVersion: number       // #5
qualityScore?: number        // #13
duplicateOf?: string         // #11
expiresAt?: Date             // #10
reviewDueAt?: Date           // #10
lastReviewedAt?: Date        // #10
reviewedBy?: string          // #10
hitCount?: number            // #2 (denormalized counter)
```

### Collection Model (additive only)
```typescript
parentId?: string            // #9
path?: string                // #9
```

### New Models
```typescript
MessageFeedback              // #12
KnowledgeHit                 // #2, #6
```

### New API Endpoints
```
PATCH  /api/knowledge/:id                  // #4
POST   /api/chat/feedback                 // #12
GET    /api/knowledge/stats               // #2
GET    /api/knowledge/:id/analytics       // #6
POST   /api/knowledge/upload/batch        // #8 (optional)
POST   /api/knowledge/url                 // #7
GET    /api/knowledge/:id/versions        // #5
POST   /api/knowledge/:id/rollback/:ver   // #5
GET    /api/knowledge/collections/tree    // #9
GET    /api/knowledge/expiring            // #10
POST   /api/knowledge/:id/review          // #10
GET    /api/knowledge/quality             // #13
```
