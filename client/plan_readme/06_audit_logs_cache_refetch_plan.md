# Improve Audit Logs Caching Behavior

This plan outlines the changes needed to improve the user experience on the `AuditLogsPage` when navigating back to it while audit logs data is already cached.

## Proposed Changes

### client

#### [MODIFY] [AuditLogsPage.tsx](file:///home/shubham-pandey/Local_Storage/Codes/learning_something_new/NodeJS/learn_RBAC_postgresql/client/src/pages/AuditLogsPage.tsx)

1. **Detect Cached Data (Line 37):** 
   - **Change:** Added `const hasCachedData = !!auditLogs.data;` before the main return statement.
   - **Why:** To determine if React Query already has data available in its cache, so we can alter the UI state appropriately when the component remounts after switching tabs.

2. **Update Refetch Logic (Line 48):**
   - **Change:** Modified the button `onClick` handler to `if (fetchEnabled || hasCachedData) void auditLogs.refetch();`
   - **Why:** To ensure that clicking the button will actually trigger a refetch if we are relying on cached data, as `fetchEnabled` might initially be false when returning to the tab.

3. **Update Fetch Button Text (Line 51):** 
   - **Change:** Changed the button text to `{hasCachedData ? "re-Fetch" : "Fetch logs"}`
   - **Why:** To provide clear UX, showing "re-Fetch" when logs are already present on the screen from the cache.

4. **Update Conditional Rendering (Lines 56-66):**
   - **Change:** Replaced simple `fetchEnabled` checks with `(fetchEnabled || hasCachedData)` across the rendering conditionals. Specifically:
     - Line 56: `{!fetchEnabled && !hasCachedData ? ...}` to suppress the "Logs have not been fetched" message if data is cached.
     - Lines 57 & 58 & 65: `{(fetchEnabled || hasCachedData) && ...}` to ensure the skeleton loaders, error states, and "No logs returned" empty states are correctly evaluated even if the initial explicit fetch hasn't been re-triggered during this component mount.
   - **Why:** To seamlessly allow the existing table to render its stale (cached) data without flashing empty states or hiding the table when the user switches tabs back and forth.
## Verification Plan

### Manual Verification
- Navigate to the Audit Logs page for the first time. Verify "Logs have not been fetched" is displayed and the button says "Fetch logs".
- Click "Fetch logs". Verify data loads and table appears.
- Switch to another page (e.g. Users or Dashboard) and switch back to Audit Logs.
- Verify the table shows the cached data immediately.
- Verify the button says "re-Fetch".
- Verify the "Logs have not been fetched" message does NOT appear.
