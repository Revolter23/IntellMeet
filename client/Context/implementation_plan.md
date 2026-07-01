# Secure Client-Side JWT Storing (In-Memory Access Token via Zustand + HttpOnly Refresh Token)

Implement a secure, state-of-the-art authentication mechanism using the "In-Memory Access Token + HttpOnly Refresh Token" pattern. Access tokens will be stored in an in-memory Zustand store (eliminating standard XSS-based storage theft), and session renewals will be processed via secure cookies. Using Zustand simplifies Axios interceptors by allowing state access directly from non-React code.

## User Review Required

> [!IMPORTANT]
> - **Server Dependency:** We need to install `cookie-parser` on the backend server.
> - **Client Dependency:** We need to install `zustand` on the frontend client.
> - **CORS Configuration:** We will update CORS settings in the server to allow cross-origin requests with credentials (`credentials: true` and pointing directly to the frontend origin `http://localhost:5173`).
> - **Environment Variable:** A `JWT_REFRESH_SECRET` will be added to the `.env` file for signing the refresh tokens.

## Open Questions
- None. Proceeding with the Zustand-based secure auth pattern.

---

## Proposed Changes

### Backend (Server)

#### [MODIFY] [package.json](file:///c:/Web%20Programmes/IntellMeet/server/package.json)
- Add `cookie-parser` dependency.

#### [MODIFY] [.env](file:///c:/Web%20Programmes/IntellMeet/server/.env)
- Add `JWT_REFRESH_SECRET` key.

#### [MODIFY] [index.js](file:///c:/Web%20Programmes/IntellMeet/server/index.js)
- Import `cookie-parser` and add `app.use(cookieParser())`.
- Update `app.use(cors(...))` configuration to:
  ```javascript
  app.use(cors({
      origin: "http://localhost:5173",
      credentials: true
  }));
  ```

#### [MODIFY] [AuthRoutes.js](file:///c:/Web%20Programmes/IntellMeet/server/routes/AuthRoutes.js)
- Update registration and login to:
  - Generate a short-lived `accessToken` (15m expiration).
  - Generate a long-lived `refreshToken` (7d expiration).
  - Set the `refreshToken` in an HttpOnly cookie.
  - Return the `accessToken` and user object (excluding the password) in the response body.
- Add `/refresh` endpoint to read the `refreshToken` cookie, verify it, and return a new `accessToken`.
- Add `/logout` endpoint to clear the `refreshToken` cookie.

---

### Frontend (Client)

#### [MODIFY] [package.json](file:///c:/Web%20Programmes/IntellMeet/client/package.json)
- Add `zustand` dependency.

#### [NEW] [useAuthStore.ts](file:///c:/Web%20Programmes/IntellMeet/client/src/store/useAuthStore.ts)
- Implement `useAuthStore` containing state for `accessToken`, `user`, and `isCheckingAuth` flag.
- Provide actions for `setAuth`, `clearAuth`, and `checkAuth` (silent refresh on boot).

#### [NEW] [api.ts](file:///c:/Web%20Programmes/IntellMeet/client/src/lib/api.ts)
- Create a customized Axios instance configured with `withCredentials: true`.
- Setup request interceptor to attach the `accessToken` directly from the Zustand store: `useAuthStore.getState().accessToken`.
- Setup response interceptor to handle `401 Unauthorized` by performing a token refresh using `/auth/refresh`, updates the Zustand store, and retries the original request.

#### [MODIFY] [App.tsx](file:///c:/Web%20Programmes/IntellMeet/client/src/App.tsx)
- Add a `useEffect` on app mount that runs the Zustand `checkAuth()` action to check for active cookies.
- Render a loading fallback while `isCheckingAuth` is true to prevent quick login screens or route jumps.

#### [MODIFY] [Login.tsx](file:///c:/Web%20Programmes/IntellMeet/client/src/AuthComponents/Login.tsx)
- Replace manual `axios` call with Zustand state setters and api calls.

#### [MODIFY] [SignUp.tsx](file:///c:/Web%20Programmes/IntellMeet/client/src/AuthComponents/SignUp.tsx)
- Replace manual `axios` call with Zustand state setters and api calls.

#### [MODIFY] [Dashboard.tsx](file:///c:/Web%20Programmes/IntellMeet/client/DashboardComponents/Dashboard.tsx)
- Retrieve the current user's profile and dynamic initials from `useAuthStore`.
- Call the Zustand `clearAuth` / API logout endpoint upon logging out.

---

## Verification Plan

### Automated Tests
- Build client and server compilation tests to ensure all typescript/javascript components compile cleanly.

### Manual Verification
- **Login Flow:** Verify that logging in sets the `refreshToken` HttpOnly cookie (visible in browser dev tools -> Application -> Cookies) and stores the access token only in Zustand state (cannot be found in LocalStorage).
- **Session Persistence:** Reload the page on `/dashboard`. The page should recover the session via Zustand `checkAuth` without prompting login again.
- **Silent Refresh Interception:** Artificially set access token to expire (e.g. 5 seconds) and verify Axios intercepts 401s, calls `/refresh`, and recovers requests without visual glitches.
- **Logout Flow:** Verify that logging out clears the cookies and redirects back to `/login`.
