# Security Specification - Vocabulary Sheet App

## Data Invariants
- A sheet must belong to a valid authenticated user (anonymous is okay).
- A user can only access their own sheets and stats.
- Timestamps must be server-generated.
- Sheets are limited to 100 words.

## The Dirty Dozen Payloads
1. **Identity Spoofing**: Attempt to create a sheet for another user's UID.
2. **Resource Poisoning**: Use a 10MB string as a sheet title.
3. **Ghost Field Injection**: Add `isAdmin: true` to a sheet document.
4. **Timestamp Forgery**: Provide a client-side `createdAt` timestamp.
5. **Orphaned Access**: Read a sheet without being authenticated.
6. **Cross-User Leak**: List sheets belonging to user B while logged in as user A.
7. **Document ID Junk**: Use a complex SQL-injection-like string as a document ID.
8. **Stat Inflation**: Update `completedToday` as a non-owner.
9. **Word Limit Bypass**: Try to save a sheet with 10,000 words.
10. **Type Mismatch**: Save a sheet where `wordLimit` is a string.
11. **Update Hijack**: Change the `userId` of an existing sheet.
12. **Blanket Read Attack**: Try to query all sheets in the database via the REST API.

## Red Team Audit Pass Criteria
- All write operations must use `isValid[Entity]()`.
- All `allow list` rules must enforce `resource.data.userId == request.auth.uid`.
- All document IDs must be validated with `isValidId()` where applicable.
- All timestamps must match `request.time`.
- `hasOnly` or strict key size matching must be used for schema enforcement.
