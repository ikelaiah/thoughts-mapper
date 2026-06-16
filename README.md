# Thoughts Mapper

**A calm, visual second brain for people who want connections without complexity.**

Thoughts Mapper is a free, local-first visual thinking app inspired by associative knowledge tools like TheBrain. It helps you capture thoughts, connect them, and move through your ideas without turning your personal knowledge base into a busy database.

## 🚀 Quick Start

Open `index.html` in a modern browser.

No install step, build step, account, or server is required. Your data is saved in this browser using IndexedDB, with a localStorage fallback.

## 🧭 First 5 Minutes

1. Pick a starter project from the left panel, or keep **My first map**.
2. Add a thought with **Capture a thought...**.
3. Select a thought to edit its title, kind, tags, and notes in the right panel.
4. Use **Connect** to link thoughts as parent, child, or related.
5. Click any thought in the graph or library to smoothly refocus the map.

The visual graph keeps the selected thought central, places parents above, children below, and keeps siblings nearby so you can understand the local context quickly.

## 🧠 Core Ideas

**Thoughts** are the main items in your map. Each thought has a title, kind, tags, notes, and visual position.

**Connections** show how thoughts relate. Links can be parent/child or related, and connection changes animate so you can see what changed.

**Kinds** are lightweight thought types. The default kind is **Thought** with a blue dot. You can create, rename, recolor, reorder, delete, and choose the default kind in **Settings → Kinds**.

**Inbox thoughts** are captured ideas that are not connected yet. They stay out of the main graph until you place them.

## ✨ What You Can Do

- Create and edit visual thought nodes
- Connect thoughts as parent, child, or related
- Reconnect links with a smooth line-draw transition
- Unlink thoughts with a fade-out and gentle selected-view transition
- Right-click a thought to create a connected thought
- Right-click a connection to rename, reverse, unlink, or reconnect it
- Search titles, notes, tags, and kinds
- Filter by tag
- Use `[[mentions]]` inside notes to discover backlink suggestions
- Write Markdown notes, including checklists
- Use undo and redo for map edits
- Pan, zoom, fit, center, and reset the graph view
- Collapse the left library when you want more space
- Switch between multiple projects
- Start from templates for research, meetings, Bible study, sermons, project tracking, personal CRM, learning, book summaries, software architecture, and helpdesk knowledge bases

## 🎨 Calm Visual Controls

The UI is designed to make the graph feel stable instead of jumpy:

- Selecting a thought smoothly pans and zooms to its local neighborhood
- New and reconnected links draw from source to target
- Removed links fade out before the layout settles
- Disconnected nodes briefly dim so the change is understandable
- Kind color appears as a small dot instead of overwhelming the node
- Kind labels stay quiet and appear mainly when selected, connected, previewed, or zoomed in

Use **Settings** to adjust:

- Line thickness
- Straight or curved connections
- Floating or touching line endpoints
- Light/dark color schemes
- Background presets
- Kind names, colors, order, deletion, and default kind

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

## 💾 Backup and Import

Use the left panel actions:

- **Backup (JSON)** exports all projects and settings.
- **Import (JSON)** restores a full backup or replaces the current map with a single exported map.
- **Export Notes Only** creates a Markdown document of your thoughts, notes, tags, and links.

Because storage is browser-local, regular JSON backups are the safest way to move or preserve your maps.

## 🔒 Privacy

Thoughts Mapper runs locally in your browser. There is no sync backend, account system, or remote storage in this implementation.

## 🛠 Project Structure

- `index.html` — app markup and controls
- `styles.css` — visual design, layout, themes, and animations
- `app.js` — state, persistence, graph rendering, interactions, notes, import/export, and kind management

## 🧩 Good Next Features

- File and URL attachments
- Optional sync backend
- AI-assisted search and summarization
- More import/export formats
