# Thoughts Mapper

![Version](https://img.shields.io/badge/version-0.1.0-4c7fb8)
![Status](https://img.shields.io/badge/status-MVP-2f8f83)
![Storage](https://img.shields.io/badge/storage-local--first-206b62)
![Stack](https://img.shields.io/badge/stack-TypeScript%20%2B%20Vite-d49436)
![Build](https://img.shields.io/badge/build-vite-8067b3)

**Version:** `0.1.0`

**A calm, visual second brain for people who want connections without complexity.**

Thoughts Mapper is a private, local-first thinking inbox that helps you place ideas deliberately, review loose thoughts, and navigate knowledge one focused neighborhood at a time.

## 🚀 Quick Start

Install dependencies and start the Vite dev server:

```sh
npm install
npm run dev
```

Then open the local URL printed by Vite. Your data is saved in this browser using IndexedDB, with a localStorage fallback.

## 🧭 First 5 Minutes

1. Pick a starter project from the left panel, or keep **My first map**.
2. Add a thought with **Capture a thought...**.
3. Select a thought to edit its title, type, tags, and notes in the right panel.
4. Use **Connect to...** to search for another thought, then choose whether it sits above, below, or beside the selected thought.
5. Click any thought in the graph or library to smoothly refocus the map.

The visual graph keeps the selected thought central. Thoughts that frame it sit above, thoughts that flow from it sit below, and lateral connections stay nearby so the local context is easy to read.

## First Map Guide

**Capture first.** Use the quick capture field for loose thoughts. If a thought is not connected yet, it waits in the inbox until you place it.

**Select to focus.** Click a thought in the graph or library to bring its nearby connections into view. The map stays centered on what you are thinking about now.

**Connect by position.** In the right panel, use **Connect to...** and search by title. Choose:

- **Place above** when the other thought frames or contains this one.
- **Add below** when the other thought follows from this one.
- **Connect beside** when the thoughts are associated without a clear up/down direction.

**Write notes where they belong.** Click the note preview to edit. Use Markdown for structure and `[[Thought title]]` mentions to surface possible connections.

**Keep your data portable.** Use the **Data** menu for JSON backup, JSON import, and notes export.

## 🧠 Core Ideas

**Thoughts** are the main items in your map. Each thought has a title, type, tags, notes, and visual position.

**Connections** show how thoughts sit together. A connection can place one thought above another, below another, or beside another. Connection changes animate so you can see what changed.

**Types** are lightweight thought categories. The default type is **Thought** with a blue dot. You can create, rename, recolor, reorder, delete, and choose the default type in **Settings → Types**.

**Inbox thoughts** are captured ideas that are not connected yet. They stay out of the main graph until you place them.

## ✨ What You Can Do

- Create and edit visual thought nodes
- Connect thoughts above, below, or beside each other
- Reconnect thoughts with a smooth line-draw transition
- Remove connections with a fade-out and gentle selected-view transition
- Right-click a thought to create a connected thought
- Right-click a connection to name, reverse, remove, or reconnect it
- Search titles, notes, tags, and types
- Filter by tag
- Use `[[mentions]]` inside notes to discover mention suggestions
- Write Markdown notes, including checklists
- Use undo and redo for map edits
- Pan, zoom, fit, center, and reset the graph view
- Collapse the left library when you want more space
- Switch between multiple projects
- Start from focused templates for project tracking, meetings, personal CRM, learning, software architecture, and helpdesk knowledge bases

## 🎨 Calm Visual Controls

The UI is designed to make the graph feel stable instead of jumpy:

- Selecting a thought smoothly pans and zooms to its local neighborhood
- New and reconnected lines draw from source to target
- Removed connections fade out before the layout settles
- Disconnected nodes briefly dim so the change is understandable
- Type color appears as a slim ribbon instead of overwhelming the node
- Type labels stay quiet and appear mainly when selected, connected, previewed, or zoomed in

Use **Settings** to adjust:

- Line thickness
- Straight or curved connections
- Floating or touching line endpoints
- Light/dark color schemes
- Background presets
- Type names, colors, order, deletion, and default type

## 📝 Notes

Notes support a small, dependency-free Markdown renderer:

- Headings
- Paragraphs
- Lists and checklists
- Blockquotes
- Code blocks and inline code
- Bold, italic, strikethrough
- Links
- `[[Thought title]]` mentions

Click the note preview to edit. Blur the editor to return to preview mode.

## 💾 Data Menu

Use the **Data** menu in the left panel:

- **Backup JSON** exports all projects and settings.
- **Import JSON** restores a full backup or replaces the current map with a single exported map.
- **Export notes** creates a Markdown document of your thoughts, notes, tags, and connections.

Because storage is browser-local, regular JSON backups are the safest way to move or preserve your maps.

## 🔒 Privacy

Thoughts Mapper runs locally in your browser. There is no sync backend, account system, or remote storage in this implementation.

## 🛠 Project Structure

- `index.html` — app markup and controls
- `styles.css` — visual design, layout, themes, and animations
- `src/main.ts` — state, persistence, graph rendering, interactions, notes, import/export, and type management
- `package.json`, `tsconfig.json`, `vite.config.ts` — TypeScript and Vite tooling

## 🧩 Good Next Features

- File and URL attachments
- Optional sync backend
- AI-assisted search and summarization
- More import/export formats
