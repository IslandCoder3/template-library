# Template library

Browse reusable front-end templates, preview them (desktop / tablet / mobile), copy the code, or download a whole template as a .zip.

## Run it
- Upload the folder to any PHP host (PHP 7.4+ with the zip extension), or run locally:
  `php -S localhost:8080` inside this folder, then open http://localhost:8080

## Add a new template
1. Create a folder inside `templates/`, e.g. `templates/pricing-table/`
2. Put the main HTML file inside it (`pricing-table.html` or `index.html`), with its CSS in a `<style>` block and JS in a `<script>` block.
3. Put any images/videos next to it (`images/`, `videos/`). Use relative paths.
4. Optional: add `meta.json`
   {
     "title": "Pricing table",
     "category": "Sections",
     "description": "Three-column pricing with a highlighted plan.",
     "tags": ["pricing", "cards"],
     "entry": "pricing-table.html"
   }
5. Refresh the page. It appears automatically.

Without `meta.json` the title comes from the HTML `<title>` and the category is "General".

## What the tabs show
Full file = the HTML file as-is. HTML = body markup only. CSS / JS = the inline style and script blocks, un-indented.
`meta.json` is not included in the downloaded zip.

## Note
There is no login. If you host this publicly, anyone with the link can view and download your templates, so protect it (password, private URL or IP rule) if that matters.
