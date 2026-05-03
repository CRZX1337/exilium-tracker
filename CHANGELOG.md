# Changelog

All notable changes to **Exilium Tracker** are documented here.
Every commit has been reviewed and categorized per release.

---

## [0.3.5] 🪄 Polished — 2026-05-02

> Zwischenrelease focused on UI polish, quality-of-life improvements, and cleaner interactions.

### ✨ Features
- **Custom Image Upload Button** — Native browser file input replaced with a fully custom styled button and drag-and-drop zone for strain images with hover feedback (`feat: implement main.js and expand dashboard UI`)
- **Image Lightbox** — Strain images can now be clicked to open in a full-screen lightbox overlay (`feat(lightbox): implement lightbox functionality for strain images`)
- **Lightbox Mousewheel Zoom** — Zoom in/out on lightbox images using the mousewheel (`feat(lightbox): add mousewheel zoom functionality to lightbox images`)
- **Strain Sorting** — New sort dropdown in the dashboard: Newest, Best Rating, Alphabetical, Highest THC (`feat: add sorting functionality to strain list`)
- **Copy Medical Name** — One-click copy button next to the botanical name in the detail modal with animation and color feedback (`feat(modal): add copy button for medical name and improve layout`)
- **Custom I-Beam Cursor** — Clean styled text cursor for all input fields via `setCursorMode` (`feat: initialize core application logic and stylesheet`)

### 🐛 Bug Fixes
- **Modal `display: none` Fix** — Hidden modals now correctly use `display: none` to prevent accidental interaction (`fix(modal): ensure modal overlays are properly hidden and add escape key support`)
- **Escape Key** — All open modals now close when pressing Escape (`fix(modal): ensure modal overlays are properly hidden and add escape key support`)
- **Admin Panel Role Dropdown** — Fixed broken custom dropdown for user role assignment in admin panel (`Fixed dropdown in admin panel!`)
- **Admin Panel Custom Dropdown** — Replaced native `<select>` with styled custom dropdown for role select (`fix: use custom dropdown in admin panel user role select`)
- **Panel Nav Links** — Added `e.preventDefault()` to admin/user panel nav anchor tags to prevent unwanted hash routing (`fix: prevent default behavior for panel navigation links`)

### 🎨 UI Improvements
- **Modal Layout** — Strain modal title and type badge reorganized into a horizontal row (`feat(modal): add copy button for medical name and improve layout`)
- **Core Stylesheet Expanded** — Refined and extended main application styles for strain grid, cards, modals, and sidebar (`feat: initialize core application logic and stylesheet`)
- **Logo Paths Fixed** — Corrected `logo-transparent.webp` paths and sizes in titlebar and empty state (`feat: update logo image paths and sizes in titlebar and empty state`)
- **Logo Replacement** — Replaced Lucide leaf icons in titlebar and empty state with custom logo asset (`feat: replace leaf icons with logo-transparent.webp in titlebar and empty state`)

### ⚙️ Internal
- Updated app version to `0.3.5` in `index.html` and `src-tauri/tauri.conf.json` (`feat: update application version to 0.3.0 in index.html and Cargo.toml`)
- Refactored modal close logic into reusable `forceResetModalOverlays()` function (`fix(modal): ensure modal overlays are properly hidden and add escape key support`)
- Implemented core application logic and lightbox, Supabase integration fully wired (`feat: implement core application logic and UI structure with Supabase integration and lightbox functionality`)

---

## [0.3.0] 🌐 Connected — 2026-05-02

> The biggest update yet — full authentication, admin panel, user roles, and a complete UI overhaul.

### ✨ Features
- **Half-Star Rating Input & Display** — Rating system now supports 0.5-star precision using overlay technique for both input and display (`feat: implement half-star rating display and input`)
- **User Authentication** — Full email/password login and registration via Supabase Auth with session management (`feat: implement user authentication, private strain toggles, and profile management interface`)
- **Private Strain Toggle** — Users can mark strains as private, visible only to themselves (`feat: implement user authentication, private strain toggles, and profile management interface`)
- **Admin Panel** — Tabbed admin modal with full strain management and user management (`feat: implement admin panel with tabbed strain and user management navigation`)
- **User Role System** — Three roles: `user`, `admin`, `owner`; edit/delete restricted to admins (`feat(auth): implement admin authentication and conditional edit/delete rendering`)
- **Admin Login Modal** — Integrated login modal for admin access with dynamic login/logout button states (`feat(auth): implement admin authentication and conditional edit/delete rendering`)
- **Local Image Fallback** — Strain cards and detail modal fall back to local `./assets/placeholder.png` on broken/missing images with `onerror` handler (`feat(ui): implement local placeholder fallback for strain images`)
- **Strain Detail Modal** — Full strain detail modal with hero image, all fields, and edit/delete actions for admins (`feat: initialize core application logic with Supabase integration, window controls, and strain management UI`)
- **Connection Status Indicator** — Live online/offline dot in the sidebar footer (`feat: initialize core application logic with Supabase integration, window controls, and strain management UI`)
- **Custom Frameless Titlebar** — Minimize, maximize, and close via Tauri window controls with custom dark UI (`feat: initialize core application logic with Supabase integration, window controls, and strain management UI`)

### 🎨 UI
- **Global Application Styles** — Full responsive layout, sidebar, strain grid, modals, cards, forms all styled (`feat: add global application styles and responsive layout components`)
- **Search Bar Icon Fix** — Fixed CSS specificity conflict causing search bar icon to overlap input (`feat(auth): implement admin authentication and conditional edit/delete rendering`)

### ⚙️ Internal
- Bumped version from `0.2.0` → `0.3.0` in Tauri config (`chore: bump app version from 0.2.0 to 0.3.0`)
- Updated README for v0.3.0 with full feature list (`docs: update README for v0.3.0 with full feature list`)
- Initialized complete app logic: routing, Supabase integration, strain dashboard rendering (`feat: initialize Tauri application with Supabase integration, routing, and strain management dashboard`)
- Admin panel UI and base application initialization logic implemented (`feat: implement admin panel UI and base application initialization logic`)

---

## [0.2.0] ✨ First Light — 2026-05-02

> First official stable release. Stable, fast, and ready to use.

### ✨ Features
- **Cross-Platform Builds** — Automated builds for Windows (`.exe`/`.msi`), macOS (Intel + Apple Silicon), Linux (`.AppImage`, `.deb`, `.rpm`) via GitHub Actions (`feat: implement main application logic and add complete icon set for cross-platform support`)
- **Supabase Integration** — Cloud data sync with Supabase for strain storage and real-time connection (`feat: initialize frontend application with Supabase integration, routing, and strain dashboard rendering`)
- **Strain Dashboard** — Full strain card grid with search and type filter (Indica/Sativa/Hybrid) (`feat: initialize frontend application with Supabase integration, routing, and strain dashboard rendering`)
- **Strain Management** — Add, edit, delete strains with Name, Type, THC%, CBD%, Rating, Effects, Flavor, Grower, Price/g, Notes, Image (`feat: implement main application logic and add complete icon set for cross-platform support`)
- **Custom App Icons** — Full icon set added for all platforms (`feat: implement main application logic and add complete icon set for cross-platform support`)
- **New Logo Asset** — Project logo updated to new transparent `.webp` asset (`feat: update project logo to new transparent webp asset`)

### ⚙️ Internal
- Bumped version from `0.1.0` → `0.2.0`, renamed `productName` to `Exilium Tracker` (`fix: rename productName to Exilium Tracker & bump version to 0.2.0`)
- Updated release version in README to `v0.2.0` (`Update release version in README.md to v0.2.0`)
- Replaced dynamic badges with static ones in README (`fix: replace dynamic badges with static ones`)
- Fixed MIT license text (`fix: correct MIT license text`)
- Added README, LICENSE and initial repo description (`docs: add README, LICENSE and repo description`)

---

## [0.1.0] 🔥 Ignition — 2026-05-01

> First public pre-release. The foundation is here — not everything is polished yet.

### ✨ Features
- **Tauri v2 + Vite 8** — Initial project setup with Tauri v2 desktop runtime and Vite frontend (`feat: initialize Tauri application with Supabase integration, routing, and strain management dashboard`)
- **Supabase Auth** — Initial Supabase authentication implementation with admin login modal and dynamic UI updates (`feat: implement Supabase authentication with admin login modal and dynamic UI updates`)
- **Strain Dashboard** — Initial strain card rendering with Supabase data fetching (`feat: initialize frontend application with Supabase integration, routing, and strain dashboard rendering`)
- **Admin Panel (initial)** — First implementation of admin panel UI with base initialization logic (`feat: implement admin panel UI and base application initialization logic`)
- **GitHub Actions CI/CD** — CI workflow and Tauri release build pipeline added (`ci: add GitHub Actions workflows (CI + Tauri release)`)
- **Node.js 24 for Actions** — Opted into Node.js 24 for all GitHub Actions runners (`ci: opt into Node.js 24 for actions runners`)

### ⚙️ Internal
- Set unique bundle identifier for Tauri app to prevent conflicts (`fix: set unique bundle identifier for Tauri app`)
- Initial project commit — Tauri v2 scaffold, Vite config, Supabase wiring (`first commit`)

---

*Generated from full commit history · [CRZX1337/exilium-tracker](https://github.com/CRZX1337/exilium-tracker)*
