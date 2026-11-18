# Template library (static site)

Plain HTML, CSS and JavaScript. No PHP, no database, no build step.

- Gallery with live thumbnails, search and category filters
- Template page: live preview (desktop / tablet / mobile), code tabs (Full file / HTML / CSS / JS) with line numbers and copy, download as .zip
- Light and dark theme (remembers your choice)
- Shortcuts: "/" focuses search, Esc goes back to the gallery

## Run it
Open it through a web server (browsers block reading files when you double-click index.html):
- Local: VS Code "Live Server", XAMPP (put the folder in htdocs), or `python3 -m http.server`
- Online: GitHub Pages, Netlify, or any normal web host. Upload the folder.

## Add a new template
1. Create a folder: `templates/pricing-table/`
2. Put the main HTML file inside (CSS in a `<style>` block, JS in a `<script>` block) plus any `images/` or `videos/`. Use relative paths.
3. Add one entry to `templates.json`:

   {
     "slug": "pricing-table",
     "title": "Pricing table",
     "category": "Sections",
     "description": "Three-column pricing with a highlighted plan.",
     "tags": ["pricing", "cards"],
     "entry": "pricing-table.html",
     "files": ["pricing-table.html", "images/icon.svg"]
   }

   - `slug` must match the folder name
   - `entry` is the main HTML file
   - `files` lists everything that goes into the downloaded .zip (paths relative to the template folder)
4. Refresh the page.

Tip: the thumbnail is the template rendered at 1280px wide, so full-width sections look best.
