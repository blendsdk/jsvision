# Roadmap: Theme Designer

> **Feature-Set**: Theme Designer
> **Status**: Done
> **Created**: 2026-07-08
> **Last Updated**: 2026-07-09
> **Progress**: 1 / 1 (100%)
> **CodeOps Skills Version**: 3.3.2

A standalone, "pro" terminal application (`@jsvision/theme-designer`) for authoring `@jsvision/core`
themes — live preview, per-channel RGB color picking, WCAG contrast, depth downsampling, the 7 presets,
and JSON import/export via a real file dialog. Dogfoods the SDK: built from the widgets it themes. Along
the way it fills a real framework gap — a reusable **`Slider`** control in `@jsvision/ui` (both
orientations), sharing its value-track math with `ScrollBar`. Standalone plan (no upstream RD); the plan's
`01-requirements.md` owns the requirements.

## Legend

⬜ Backlog · ✏️ RD Drafted · 🔎 RD Preflighted · 📋 Plan Created · 🔬 Plan Preflighted · 🔄 Executing · ✅ Done · ⛔ Blocked · ⏸️ Deferred

## Tracker

| ID | Title | RD | Plan | Stage | Status | Last Updated | Notes / Blocker |
|----|-------|----|------|-------|--------|--------------|-----------------|
| PL-01 | Theme designer app + reusable `Slider` | — (standalone plan) | [theme-designer](plans/theme-designer/00-index.md) | Done | ✅ | 2026-07-09 | Done — @jsvision/theme-designer app (live preview · RGB picking · WCAG contrast · depth downsample · presets · JSON import/export) + reusable Slider (H+V) sharing ScrollBar track-math (40 tasks). |
