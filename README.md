<div align="center">

<img src="src-tauri/icons/logo-transparent.webp" alt="Exilium Tracker Logo" width="220" />

# Exilium Tracker

**Track your medical strains. Beautifully. On your desktop.**

[![Release](https://img.shields.io/badge/release-v0.3.5-7c3aed?style=flat-square)](https://github.com/CRZX1337/exilium-tracker/releases/latest)
[![CI](https://img.shields.io/github/actions/workflow/status/CRZX1337/exilium-tracker/ci.yml?style=flat-square&label=CI&color=10b981)](https://github.com/CRZX1337/exilium-tracker/actions)
[![License](https://img.shields.io/badge/license-MIT-f59e0b?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue?style=flat-square)](https://github.com/CRZX1337/exilium-tracker/releases)

</div>

---

Exilium Tracker is a desktop app built with **Tauri v2 + Vite** for tracking your medical cannabis strains — everything from THC/CBD values to grower info and personal ratings, all stored in the cloud via Supabase.

Dark theme, frameless window, GSAP animations. It looks like something you'd actually want to use.

---

## What it does

- **Strain library** — add strains with name, medical name, type (Indica/Sativa/Hybrid), THC%, CBD%, grower, price/g, effects, flavor, notes and a photo
- **Search & filter** — live search + filter by type, results update instantly
- **Stats** — average THC, average rating, type distribution, top rated strain
- **Accounts & roles** — login via email, three roles: User / Admin / Owner
- **Admin panel** — manage all strains and users, change roles, delete accounts
- **Private strains** — mark a strain as private, only you can see it
- **Lightbox + zoom** — click any strain image to open it fullscreen with mousewheel zoom

---

## Download

Grab the latest build from [**Releases**](https://github.com/CRZX1337/exilium-tracker/releases/latest):

| Platform | Installer |
|---|---|
| 🪟 Windows | `.exe` or `.msi` |
| 🍎 macOS (Apple Silicon) | `_aarch64.dmg` |
| 🍎 macOS (Intel) | `_x64.dmg` |
| 🐧 Linux | `.AppImage`, `.deb`, `.rpm` |

---

## Dev setup

**You'll need:** Node.js 22+, pnpm 10+, Rust (stable)

```bash
git clone https://github.com/CRZX1337/exilium-tracker.git
cd exilium-tracker
pnpm install
cp .env.example .env   # add your Supabase credentials
pnpm tauri dev
```

For a production build: `pnpm tauri build`

### Environment variables

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

---

## Releasing

Builds are fully automated. Push a tag and GitHub Actions handles the rest:

```bash
git tag v0.3.5
git push origin v0.3.5
```

It'll build installers for all platforms and create a draft release automatically.

---

## Stack

Tauri v2 · Vite 8 · Vanilla JS · Supabase · GSAP 3 · Lucide Icons · pnpm · GitHub Actions

---

<div align="center">
  Made with ❤️ by <a href="https://github.com/CRZX1337">CRZX1337</a>
</div>
