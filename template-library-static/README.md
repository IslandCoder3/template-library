# Template library (static site)

Plain HTML, CSS and JavaScript. No PHP, no database, no build step.

## Run it
It must be opened through a web server (browsers block reading files when you double-click index.html):
- Local: VS Code "Live Server", XAMPP (put the folder in htdocs), or `python3 -m http.server` in this folder
- Online: GitHub Pages, Netlify, or any normal web host. Just upload the folder.

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

## Tabs
Full file = the HTML file as-is. HTML = body markup only. CSS / JS = the inline style and script blocks.
