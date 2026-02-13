# Example Inspection Workflow

1. Inspector opens project and inspection template.
2. At a checklist item, inspector taps **Capture Evidence**.
3. App captures photo with EXIF retained.
4. App collects GPS coordinates + accuracy.
5. App attaches device timestamp and computes metadata SHA-256.
6. Inspector records voice note; transcript is editable with revision tracking.
7. Inspector links relevant NCC/BCA clause (with version snapshot).
8. Evidence item is saved locally and queued for sync.
9. When connectivity returns, sync engine sends queued operations.
10. Server writes immutable audit log chain entries and stores media pointer.
11. Reviewer exports signed PDF report + chain-of-custody trail.

