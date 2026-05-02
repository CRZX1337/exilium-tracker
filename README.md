<div align="center">

<img src="src-tauri/icons/logo-transparent.webp" alt="Exilium Tracker Logo" width="240" height="126" />

# Exilium Tracker

**A sleek, cross-platform desktop app for tracking your strains — built with Tauri v2 + Vite.**

[![Release](https://img.shields.io/badge/release-v0.3.0-7c3aed?style=flat-square)](https://github.com/CRZX1337/exilium-tracker/releases/latest)
[![CI](https://img.shields.io/github/actions/workflow/status/CRZX1337/exilium-tracker/ci.yml?style=flat-square&label=CI&color=10b981)](https://github.com/CRZX1337/exilium-tracker/actions)
[![License](https://img.shields.io/badge/license-MIT-f59e0b?style=flat-square)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-blue?style=flat-square)](https://github.com/CRZX1337/exilium-tracker/releases)

</div>

---

## ✨ Features

- 🌿 **Strain Tracking** — Log, manage and organize your strains in one place
- ☁️ **Cloud Sync** — Powered by Supabase for real-time data sync across devices
- 🎨 **Smooth Animations** — GSAP-powered transitions for a premium feel
- 🖤 **Custom Frameless UI** — Dark theme, transparent window, fully custom titlebar
- 📦 **Cross-Platform** — Native installers for Windows, macOS (ARM + Intel) and Linux
- ⚡ **Blazing Fast** — Tauri v2 + Vite 8 — tiny bundle, native performance

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
git tag v1.0.0
git push origin v1.0.0
```

GitHub Actions will build installers for all platforms and create a draft release automatically.

---

## 🏗️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Vanilla JS + Vite 8 |
| Desktop Runtime | Tauri v2 (Rust) |
| Backend / DB | Supabase |
| Animations | GSAP 3 |
| Package Manager | pnpm |
| CI/CD | GitHub Actions |

---

## 📄 License

This project is licensed under the **MIT License** — see [LICENSE](LICENSE) for details.

---

<div align="center">
  Made with ❤️ by <a href="https://github.com/CRZX1337">CRZX1337</a>
</div>
