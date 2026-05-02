<div align="center">

<img src="src-tauri/icons/logo-transparent.webp" alt="Exilium Tracker Logo" width="240" height="126" />

# Exilium Tracker

**A sleek, cross-platform desktop app for tracking your medical strains — built with Tauri v2 + Vite.**

[![Release](https://img.shields.io/badge/release-v0.3.0-7c3aed?style=flat-square)](https://github.com/CRZX1337/exilium-tracker/releases/latest)
[![CI](https://img.shields.io/github/actions/workflow/status/CRZX1337/exilium-tracker/ci.yml?style=flat-square&label=CI&color=10b981)](https://github.com/CRZX1337/exilium-tracker/actions)
[![License](https://img.shields.io/badge/license-MIT-f59e0b?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue?style=flat-square)](https://github.com/CRZX1337/exilium-tracker/releases)

</div>

---

## ✨ Features

### 🌿 Strain Management
- Add, edit and delete strains with full detail support
- Strain types: **Indica**, **Sativa**, **Hybrid** with color-coded badges
- Per-strain fields: name, **medical name**, type, THC%, CBD%, grower/importer, price per gram, effects, flavor profile, notes
- **📋 One-click copy** — copy the medical name instantly via the copy button in the detail modal (animated feedback)
- Upload a custom strain image or paste an image URL
- Mark strains as **private** — hidden from other users
- Half-star precision rating system (0.5 steps, 1–5 stars)

### 🔍 Search & Filter
- Live search across strain name and medical name
- Filter by strain type (All / Indica / Sativa / Hybrid)
- Real-time grid update with smooth GSAP animations

### 📊 Statistics Dashboard
- Total strain count, average rating, average THC%
- Type distribution bar (Indica / Sativa / Hybrid percentage)
- Animated number counters on load
- Top rated strain highlight with image preview

### 🔐 Authentication & Roles
- Email + password login and registration via Supabase Auth
- Role system: **User**, **Admin**, **Owner**
- Users can only edit/delete their own strains
- Owners/Admins have full CRUD access across all strains

### 👤 User Panel
- Personal panel showing all strains added by the logged-in user
- Quick edit and delete directly from the panel
- Private badge indicator per strain

### 🛡️ Admin Panel
- Full strain list with ownership info (own vs. other users)
- Edit and delete any strain regardless of owner
- User management: view all registered users
- Change user roles (User / Admin / Owner) via inline dropdown
- Delete users with confirmation dialog

### 🎨 UI & Experience
- Fully custom **frameless window** with custom titlebar (minimize, maximize, close)
- Dark theme with neon-green accent — no system chrome
- **GSAP-powered animations** — card entrances, modal transitions, floating logo
- Mouse-tracking glow effect on strain cards
- Custom-styled select dropdowns
- Toast notification system (success / error / info)
- Confirm modal for destructive actions
- Smooth view transitions between dashboard, add, statistics and about

### ☁️ Cloud & Sync
- Supabase backend for real-time data persistence
- Strain image storage via Supabase Storage (`strain-images` bucket)
- Manual refresh button to pull latest data
- Connection status indicator (online / offline)

### ⚙️ CI/CD
- Automated CI pipeline on every push/PR (build + type-check)
- Automated multi-platform release builds via GitHub Actions on git tag
- Builds for Windows, macOS (Apple Silicon + Intel) and Linux

---

## 📥 Download

Head to the [**Releases**](https://github.com/CRZX1337/exilium-tracker/releases/latest) page and grab the installer for your platform:

| Platform | File |
|----------|------|
| 🪟 Windows | `exilium-weed-programm_x64-setup.exe` or `.msi` |
| 🍎 macOS (Apple Silicon) | `exilium-weed-programm_aarch64.dmg` |
| 🍎 macOS (Intel) | `exilium-weed-programm_x64.dmg` |
| 🐧 Linux | `.AppImage`, `.deb` or `.rpm` |

---

## 🛠️ Development

### Prerequisites

- [Node.js](https://nodejs.org/) 22+
- [pnpm](https://pnpm.io/) 10+
- [Rust](https://www.rust-lang.org/) (stable)
- [Tauri CLI v2](https://v2.tauri.app/)

### Setup

```bash
# Clone the repo
git clone https://github.com/CRZX1337/exilium-tracker.git
cd exilium-tracker

# Install dependencies
pnpm install

# Copy environment variables
cp .env.example .env
# Fill in your Supabase credentials in .env
```

### Environment Variables

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Run

```bash
# Start dev server (hot-reload)
pnpm tauri dev

# Build for production
pnpm tauri build
```

---

## 🚀 Release

Releases are fully automated via GitHub Actions. To publish a new version:

```bash
git tag v0.3.0
git push origin v0.3.0
```

GitHub Actions will automatically build native installers for all platforms and create a draft release.

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla JS + Vite 8 |
| Desktop Runtime | Tauri v2 (Rust) |
| Backend / DB | Supabase (PostgreSQL) |
| File Storage | Supabase Storage |
| Animations | GSAP 3 |
| Icons | Lucide Icons |
| Package Manager | pnpm |
| CI/CD | GitHub Actions |

---

## 📄 License

This project is licensed under the **MIT License** — see [LICENSE](LICENSE) for details.

---

<div align="center">
  Made with ❤️ by <a href="https://github.com/CRZX1337">CRZX1337</a>
</div>
