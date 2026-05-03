# Changelog

All notable changes to **Exilium Tracker** will be documented in this file.

---

## [0.3.5] - 2026-05-02

### ✨ Features
- **Custom Upload Button & Drag-and-Drop Zone** — Replaced native browser file input with a fully styled custom upload button; added drag-and-drop support for strain images with hover feedback
- **Image Lightbox with Zoom** — Strain images can now be opened in a full-screen lightbox with mousewheel zoom support
- **Sorting** — Added sort dropdown to filter strains by newest, best rating, alphabetical, or highest THC content
- **Half-Star Rating** — Rating input and display now support half-star precision using overlay technique for better browser compatibility
- **Copy Medical Name** — One-click copy button next to the medical/botanical name in the strain detail modal with visual animation feedback
- **Custom I-Beam Cursor** — Input fields now show a clean, custom-styled text cursor instead of the native OS cursor

### 🐛 Bug Fixes
- **Modal Overlay Fix** — Added `display: none` to hidden modals to prevent accidental interaction; all modals now close on Escape key
- **Admin Panel Dropdown** — Fixed broken role-select dropdown in the admin user management panel; replaced with custom styled dropdown
- **Panel Navigation Links** — Fixed `e.preventDefault()` for admin/user panel nav links to prevent unwanted hash navigation
- **Custom Cursor `setCursorMode`** — Text inputs now correctly receive `mode-text` class with proper I-beam icon and positioning

### 🎨 UI Improvements
- Modal title and type badge reorganized into a horizontal row
- Expanded and refined core stylesheet for strain grid, modals, and sidebar
- Replaced Lucide leaf icons in titlebar and empty state with custom `logo-transparent.webp`; corrected image paths and sizes

### ⚙️ Internal
- Updated app version to `0.3.5` in `index.html` and `tauri.conf.json`
- Refactored modal closing into reusable `forceResetModalOverlays()` function
- Improved admin panel opening with forced reset and error handling

---

## [0.3.0] - 2026-05-02

### ✨ Features
- **Tauri v2 Desktop App** — Initial cross-platform build; supports Windows (`.exe`/`.msi`), macOS (Intel + Apple Silicon), Linux (`.AppImage`, `.deb`, `.rpm`)
- **Supabase Integration** — Full backend with PostgreSQL for strain data, image storage, and authentication
- **Strain Management** — Add, edit, delete strains with Name, Medical Name, Type, THC %, CBD %, Rating, Effects, Flavor, Grower, Price/g, Notes, Image
- **User Authentication** — Email/password login and registration via Supabase Auth
- **Role System** — Three roles: `user`, `admin`, `owner`
- **Admin Panel** — Tabbed panel for managing all strains and users incl. role changes
- **Private Strains** — Mark a strain as private (only visible to its owner)
- **Frameless Window** — Custom titlebar with minimize, maximize, close via Tauri window controls
- **Connection Status** — Live online/offline indicator in the sidebar footer
- **Local Image Fallback** — Broken images fall back to local `placeholder.png`
- **CI/CD** — GitHub Actions for automated CI and Tauri release builds

### ⚙️ Internal
- Initialized project with Vite + Tauri v2
- Set unique Tauri bundle identifier
- Node.js 24 for GitHub Actions runners
- Added MIT License and initial README
