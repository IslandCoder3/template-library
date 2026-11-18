(function () {
	var $ = function (sel) { return document.querySelector(sel); };
	var view = $('#tl_view');
	var templates = [];
	var state = { q: '', cat: 'All', tab: 'full', viewport: 'desktop', code: {}, intro: true, slug: null };
	var thumbRO = null;
	var toastTimer = null;

	var TABS = [
		{ key: 'full', label: 'Full file', lang: 'html' },
		{ key: 'html', label: 'HTML', lang: 'html' },
		{ key: 'css', label: 'CSS', lang: 'css' },
		{ key: 'js', label: 'JS', lang: 'js' }
	];
	var VIEWPORTS = [
		{ key: 'desktop', label: 'Desktop', w: '100%' },
		{ key: 'tablet', label: 'Tablet', w: '768px' },
		{ key: 'mobile', label: 'Mobile', w: '375px' }
	];

	/* ---------- icons ---------- */
	function svg(inner, size) {
		size = size || 18;
		return '<svg width="' + size + '" height="' + size + '" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + inner + '</svg>';
	}
	var ICON = {
		search: svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>', 20),
		back: svg('<path d="M15 18l-6-6 6-6"/>'),
		prev: svg('<path d="M15 18l-6-6 6-6"/>'),
		next: svg('<path d="M9 18l6-6-6-6"/>'),
		external: svg('<path d="M14 4h6v6M20 4l-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/>', 15),
		download: svg('<path d="M12 4v11M7 11l5 5 5-5M5 20h14"/>'),
		copy: svg('<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>'),
		check: svg('<path d="M5 12.5l4.5 4.5L19 7.5"/>'),
		code: svg('<path d="M9 8l-5 4 5 4M15 8l5 4-5 4"/>', 16),
		desktop: svg('<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>', 16),
		tablet: svg('<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M11 18h2"/>', 16),
		mobile: svg('<rect x="7" y="3" width="10" height="18" rx="2"/><path d="M11 18h2"/>', 16)
	};

	/* ---------- helpers ---------- */
	function esc(s) {
		return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
	}
	function find(slug) {
		for (var i = 0; i < templates.length; i++) if (templates[i].slug === slug) return templates[i];
		return null;
	}
	function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }
	function encodePath(p) { return p.split('/').map(encodeURIComponent).join('/'); }

	function toast(msg, ms, noIcon) {
		var el = $('#tl_toast');
		el.innerHTML = (noIcon ? '' : ICON.check) + '<span>' + esc(msg) + '</span>';
		el.classList.add('tl_toast--show');
		clearTimeout(toastTimer);
		toastTimer = setTimeout(function () { el.classList.remove('tl_toast--show'); }, ms || 1800);
	}

	function extInfo(path) {
		var e = (path.split('.').pop() || '').toLowerCase();
		if (e === 'html' || e === 'htm' || e === 'php') return ['html', 'HTML'];
		if (e === 'css') return ['css', 'CSS'];
		if (e === 'js' || e === 'mjs') return ['js', 'JS'];
		if (['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'avif', 'ico'].indexOf(e) !== -1) return ['img', 'IMG'];
		if (['mp4', 'webm', 'mov', 'ogv'].indexOf(e) !== -1) return ['vid', 'VID'];
		return ['file', (e || 'file').slice(0, 4).toUpperCase()];
	}

	/* ---------- syntax highlighting ---------- */
	function tokenize(code, re, render) {
		var out = '', last = 0, m;
		re.lastIndex = 0;
		while ((m = re.exec(code))) {
			out += esc(code.slice(last, m.index)) + render(m);
			last = m.index + m[0].length;
			if (m[0].length === 0) re.lastIndex++;
		}
		return out + esc(code.slice(last));
	}
	function span(type, text) { return '<span class="tl_t-' + type + '">' + esc(text) + '</span>'; }

	function hlCSS(code) {
		var re = /(\/\*[\s\S]*?\*\/)|("[^"]*"|'[^']*')|(@[\w-]+)|(#[0-9a-fA-F]{3,8}\b)|(-?\b\d*\.?\d+(?:px|%|s|ms|em|rem|vh|vw|deg|fr)?)|([a-zA-Z-]+)(?=\s*:\s)/g;
		return tokenize(code, re, function (m) {
			if (m[1]) return span('comment', m[0]);
			if (m[2]) return span('str', m[0]);
			if (m[3]) return span('at', m[0]);
			if (m[4] || m[5]) return span('num', m[0]);
			return span('prop', m[0]);
		});
	}
	function hlJS(code) {
		var re = /(\/\/[^\n]*|\/\*[\s\S]*?\*\/)|("(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|`(?:\\.|[^`\\])*`)|\b(var|let|const|function|return|if|else|for|while|new|this|true|false|null|undefined|typeof|in|of|break|continue|switch|case|default|try|catch|throw|async|await|class)\b|(\b\d+(?:\.\d+)?\b)/g;
		return tokenize(code, re, function (m) {
			if (m[1]) return span('comment', m[0]);
			if (m[2]) return span('str', m[0]);
			if (m[3]) return span('kw', m[0]);
			return span('num', m[0]);
		});
	}
	function hlTag(tag) {
		var m = tag.match(/^(<\/?)([^\s>\/]+)([\s\S]*?)(\/?>)$/);
		if (!m) return esc(tag);
		var attrs = tokenize(m[3], /("[^"]*"|'[^']*')|([\w:@.-]+)(?==)/g, function (a) {
			return a[1] ? span('str', a[0]) : span('attr', a[0]);
		});
		return esc(m[1]) + span('tag', m[2]) + attrs + esc(m[4]);
	}
	function hlHTML(code) {
		var re = /(<!--[\s\S]*?-->)|(<script\b[^>]*>)([\s\S]*?)(<\/script>)|(<style\b[^>]*>)([\s\S]*?)(<\/style>)|(<\/?[a-zA-Z][^>]*>)/g;
		return tokenize(code, re, function (m) {
			if (m[1]) return span('comment', m[0]);
			if (m[2]) return hlTag(m[2]) + hlJS(m[3]) + hlTag(m[4]);
			if (m[5]) return hlTag(m[5]) + hlCSS(m[6]) + hlTag(m[7]);
			return hlTag(m[8]);
		});
	}
	function highlight(code, lang) {
		if (code.length > 200000) return esc(code);
		if (lang === 'css') return hlCSS(code);
		if (lang === 'js') return hlJS(code);
		return hlHTML(code);
	}

	/* ---------- split one HTML file into markup / CSS / JS ---------- */
	function dedent(s) {
		s = s.replace(/\r\n/g, '\n').replace(/^\n+|\n+$/g, '');
		var lines = s.split('\n'), min = null;
		lines.forEach(function (l) {
			if (!l.trim()) return;
			var n = l.match(/^[ \t]*/)[0].length;
			min = min === null ? n : Math.min(min, n);
		});
		if (!min) return s.replace(/\s+$/, '');
		return lines.map(function (l) { return l.slice(min); }).join('\n').replace(/\s+$/, '');
	}

	function parseHTML(raw) {
		raw = raw.replace(/\r\n/g, '\n');
		var css = [], js = [], m, re;
		re = /<style\b[^>]*>([\s\S]*?)<\/style>/gi;
		while ((m = re.exec(raw))) if (m[1].trim()) css.push(dedent(m[1]));
		var inlineScript = /<script\b(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi;
		while ((m = inlineScript.exec(raw))) if (m[1].trim()) js.push(dedent(m[1]));

		var bm = raw.match(/<body\b[^>]*>([\s\S]*)<\/body>/i), body;
		if (bm) body = bm[1];
		else body = raw.replace(/<head\b[^>]*>[\s\S]*?<\/head>/i, '').replace(/<!DOCTYPE[^>]*>|<\/?html\b[^>]*>/gi, '');
		body = body.replace(inlineScript, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
		return { full: raw, html: dedent(body).replace(/\n{3,}/g, '\n\n'), css: css.join('\n\n'), js: js.join('\n\n') };
	}

	function normalize(t) {
		var entry = t.entry || (t.slug + '.html');
		return {
			slug: t.slug,
			title: t.title || t.slug,
			category: t.category || 'General',
			description: t.description || '',
			tags: t.tags || [],
			entry: entry,
			url: 'templates/' + encodeURIComponent(t.slug) + '/' + encodePath(entry),
			files: (t.files && t.files.length) ? t.files : [entry]
		};
	}

	function ensureCode(t) {
		if (state.code[t.slug]) return Promise.resolve(state.code[t.slug]);
		return fetch(t.url, { cache: 'no-store' })
			.then(function (r) { if (!r.ok) throw new Error('Request failed'); return r.text(); })
			.then(function (text) { state.code[t.slug] = parseHTML(text); return state.code[t.slug]; });
	}

	var LOAD_ERROR = 'Could not load the code. Open this page through a web server (GitHub Pages, XAMPP, VS Code Live Server), not by double-clicking the file.';

	/* ---------- clipboard ---------- */
	function copyText(text) {
		if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
		return new Promise(function (resolve, reject) {
			var ta = document.createElement('textarea');
			ta.value = text;
			ta.setAttribute('readonly', '');
			ta.style.cssText = 'position:fixed;top:-1000px;opacity:0;';
			document.body.appendChild(ta);
			ta.select();
			try { document.execCommand('copy') ? resolve() : reject(); } catch (e) { reject(e); }
			document.body.removeChild(ta);
		});
	}

	function copyFull(t) {
		ensureCode(t).then(function (code) {
			return copyText(code.full).then(function () { toast('Copied ' + t.title + ' (full file)'); });
		}).catch(function () { toast('Could not copy. Try the code viewer on the template page.', 3500, true); });
	}

	/* ---------- zip download (runs in the browser) ---------- */
	function downloadZip(t, btn) {
		if (!window.JSZip) { toast('The zip library did not load. Refresh the page and try again.', 3500, true); return; }
		var label = btn.querySelector('span');
		var oldText = label ? label.textContent : '';
		btn.disabled = true;
		if (label) label.textContent = 'Preparing…';
		var zip = new JSZip();
		Promise.all(t.files.map(function (path) {
			return fetch('templates/' + encodeURIComponent(t.slug) + '/' + encodePath(path), { cache: 'no-store' }).then(function (r) {
				if (!r.ok) throw new Error('Missing file: ' + path + '. Check the "files" list in templates.json.');
				return r.arrayBuffer();
			}).then(function (buf) { zip.file(path, buf); });
		})).then(function () {
			return zip.generateAsync({ type: 'blob' });
		}).then(function (blob) {
			var a = document.createElement('a');
			a.href = URL.createObjectURL(blob);
			a.download = t.slug + '.zip';
			document.body.appendChild(a);
			a.click();
			document.body.removeChild(a);
			setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
			toast('Downloaded ' + t.slug + '.zip');
		}).catch(function (err) {
			toast(err && err.message ? err.message : 'Could not create the zip.', 4500, true);
		}).then(function () {
			btn.disabled = false;
			if (label) label.textContent = oldText;
		});
	}

	/* ---------- gallery ---------- */
	function categories() {
		var map = {};
		templates.forEach(function (t) { map[t.category] = (map[t.category] || 0) + 1; });
		return Object.keys(map).sort().map(function (c) { return { name: c, n: map[c] }; });
	}

	function visible() {
		var q = state.q.trim().toLowerCase();
		return templates.filter(function (t) {
			if (state.cat !== 'All' && t.category !== state.cat) return false;
			if (!q) return true;
			return (t.title + ' ' + t.description + ' ' + t.category + ' ' + t.tags.join(' ') + ' ' + t.slug).toLowerCase().indexOf(q) !== -1;
		});
	}

	function showGallery() {
		state.slug = null;
		document.title = 'Template library';
		view.innerHTML =
			'<div class="tl_wrap">' +
				'<section class="tl_hero">' +
					'<h1 class="tl_hero__title">Reusable front-end templates</h1>' +
					'<p class="tl_hero__sub">Preview each one live, copy its HTML, CSS or JS, or download the whole folder.</p>' +
					'<label class="tl_find">' + ICON.search +
						'<input id="tl_search" type="search" placeholder="Search by name, category or tag" aria-label="Search templates" autocomplete="off" value="' + esc(state.q) + '">' +
						'<span class="tl_kbd" aria-hidden="true">/</span>' +
					'</label>' +
					'<div class="tl_cats" id="tl_cats"></div>' +
				'</section>' +
				'<section class="tl_grid' + (state.intro ? ' tl_intro' : '') + '" id="tl_grid"></section>' +
			'</div>';
		renderCats();
		renderGrid();
		if (state.intro) {
			state.intro = false;
			setTimeout(function () { var g = $('#tl_grid'); if (g) g.classList.remove('tl_intro'); }, 1400);
		}
	}

	function renderCats() {
		var box = $('#tl_cats');
		if (!box) return;
		var cats = categories();
		if (cats.length < 2) { box.innerHTML = ''; return; }
		var html = '<button type="button" class="tl_cat' + (state.cat === 'All' ? ' tl_cat--on' : '') + '" data-cat="All">All<span class="tl_cat__n">' + templates.length + '</span></button>';
		cats.forEach(function (c) {
			html += '<button type="button" class="tl_cat' + (state.cat === c.name ? ' tl_cat--on' : '') + '" data-cat="' + esc(c.name) + '">' + esc(c.name) + '<span class="tl_cat__n">' + c.n + '</span></button>';
		});
		box.innerHTML = html;
	}

	function card(t, i) {
		var href = '#' + encodeURIComponent(t.slug);
		var tags = t.tags.slice(0, 3).map(function (g) { return '<span class="tl_tag">' + esc(g) + '</span>'; }).join('');
		return '<article class="tl_tcard" style="--i:' + i + '">' +
			'<a class="tl_thumb" href="' + href + '" tabindex="-1" aria-label="Open ' + esc(t.title) + '">' +
				'<iframe src="' + esc(t.url) + '" loading="lazy" tabindex="-1" aria-hidden="true" sandbox="allow-scripts allow-same-origin" title=""></iframe>' +
				'<span class="tl_thumb__cta">' + ICON.code + 'View code</span>' +
			'</a>' +
			'<div class="tl_tcard__body">' +
				'<span class="tl_chip">' + esc(t.category) + '</span>' +
				'<h2 class="tl_tcard__title"><a href="' + href + '">' + esc(t.title) + '</a></h2>' +
				(t.description ? '<p class="tl_tcard__desc">' + esc(t.description) + '</p>' : '') +
				'<div class="tl_tcard__foot"><div class="tl_tags">' + tags + '</div>' +
					'<div class="tl_tcard__acts">' +
						'<button type="button" class="tl_iconbtn" data-act="copy" data-slug="' + esc(t.slug) + '" title="Copy full file" aria-label="Copy full file of ' + esc(t.title) + '">' + ICON.copy + '</button>' +
						'<button type="button" class="tl_iconbtn" data-act="zip" data-slug="' + esc(t.slug) + '" title="Download .zip" aria-label="Download ' + esc(t.title) + ' as a zip"><span hidden></span>' + ICON.download + '</button>' +
					'</div></div>' +
			'</div></article>';
	}

	function addCard(i) {
		return '<div class="tl_add" style="--i:' + i + '"><h3>Add another template</h3><ol>' +
			'<li>Create a folder inside <code>templates/</code> with your HTML file and any images or videos.</li>' +
			'<li>Add an entry for it in <code>templates.json</code>.</li>' +
			'<li>Refresh this page.</li></ol></div>';
	}

	function renderGrid() {
		var grid = $('#tl_grid');
		if (!grid) return;
		var items = visible();
		var filtering = state.q.trim() !== '' || state.cat !== 'All';
		if (!items.length) {
			grid.innerHTML = '<p class="tl_none">No templates match your search. <button type="button" id="tl_clear">Clear filters</button></p>';
			return;
		}
		grid.innerHTML = items.map(card).join('') + (filtering ? '' : addCard(items.length));
		observeThumbs();
	}

	function observeThumbs() {
		if (thumbRO) thumbRO.disconnect();
		if (!window.ResizeObserver) return;
		thumbRO = new ResizeObserver(function (entries) {
			entries.forEach(function (e) { e.target.style.setProperty('--s', (e.contentRect.width / 1280).toFixed(4)); });
		});
		document.querySelectorAll('.tl_thumb').forEach(function (el) { thumbRO.observe(el); });
	}

	/* ---------- detail ---------- */
	function showDetail(t) {
		state.slug = t.slug;
		state.tab = 'full';
		document.title = t.title + ' - Template library';
		var idx = templates.indexOf(t);
		var prev = templates[idx - 1], next = templates[idx + 1];

		var pager = templates.length > 1
			? '<div class="tl_pager">' +
				(prev ? '<a class="tl_iconbtn" href="#' + encodeURIComponent(prev.slug) + '" title="Previous: ' + esc(prev.title) + '" aria-label="Previous template: ' + esc(prev.title) + '">' + ICON.prev + '</a>' : '') +
				(next ? '<a class="tl_iconbtn" href="#' + encodeURIComponent(next.slug) + '" title="Next: ' + esc(next.title) + '" aria-label="Next template: ' + esc(next.title) + '">' + ICON.next + '</a>' : '') +
			  '</div>' : '';

		var tags = t.tags.map(function (g) { return '<span class="tl_tag">' + esc(g) + '</span>'; }).join('');
		var segs = VIEWPORTS.map(function (v) {
			return '<button type="button" class="tl_seg__btn" data-vp="' + v.key + '" aria-label="' + v.label + ' width">' + ICON[v.key] + '<span>' + v.label + '</span></button>';
		}).join('');
		var files = t.files.map(function (f) {
			var x = extInfo(f);
			return '<li class="tl_file"><span class="tl_ext tl_ext--' + x[0] + '">' + esc(x[1]) + '</span><span>' + esc(f) + '</span></li>';
		}).join('');

		view.innerHTML =
			'<div class="tl_wrap tl_detail">' +
				'<nav class="tl_crumb"><a class="tl_back" href="#">' + ICON.back + 'All templates</a>' + pager + '</nav>' +

				'<header class="tl_dhead"><div>' +
					'<span class="tl_chip">' + esc(t.category) + '</span>' +
					'<h1 class="tl_dhead__title">' + esc(t.title) + '</h1>' +
					(t.description ? '<p class="tl_dhead__desc">' + esc(t.description) + '</p>' : '') +
					(tags ? '<div class="tl_tags">' + tags + '</div>' : '') +
				'</div><div class="tl_dactions">' +
					'<button type="button" class="tl_btn" id="tl_copyfull">' + ICON.copy + '<span>Copy full file</span></button>' +
					'<button type="button" class="tl_btn tl_btn--primary" id="tl_dl">' + ICON.download + '<span>Download .zip</span></button>' +
				'</div></header>' +

				'<section class="tl_win" aria-label="Live preview">' +
					'<div class="tl_win__bar"><div class="tl_win__dots"><i></i><i></i><i></i></div>' +
						'<div class="tl_addr"><span>' + esc(t.url) + '</span><a href="' + esc(t.url) + '" target="_blank" rel="noopener" title="Open preview in a new tab" aria-label="Open preview in a new tab">' + ICON.external + '</a></div>' +
						'<div class="tl_seg" role="group" aria-label="Preview width">' + segs + '</div></div>' +
					'<div class="tl_stage"><div class="tl_frame" id="tl_frame"><iframe id="tl_iframe" src="' + esc(t.url) + '" scrolling="no" title="Preview of ' + esc(t.title) + '"></iframe></div></div>' +
				'</section>' +

				'<section class="tl_codebox" aria-label="Code">' +
					'<div class="tl_codebar"><div class="tl_tabs" id="tl_tabs"></div>' +
						'<div class="tl_codebar__right"><span class="tl_codemeta" id="tl_codemeta"></span>' +
						'<button type="button" class="tl_copy" id="tl_copy">' + ICON.copy + '<span>Copy</span></button></div></div>' +
					'<div class="tl_codewrap"><pre class="tl_gutter" id="tl_gutter" aria-hidden="true">1</pre><pre class="tl_code"><code id="tl_codeview">Loading…</code></pre></div>' +
				'</section>' +

				'<section class="tl_files"><div class="tl_files__head"><h2>Files in the download</h2><span>' + plural(t.files.length, 'file') + '</span></div>' +
					'<ul>' + files + '</ul>' +
					'<p class="tl_files__note">Copied code does not include these files. Keep the same relative paths (for example <code>images/</code> and <code>videos/</code>) or update the paths after pasting.</p></section>' +
			'</div>';

		applyViewport();
		bindFrame();
		ensureCode(t).then(function () { if (state.slug === t.slug) renderCode(); })
			.catch(function () { var v = $('#tl_codeview'); if (v && state.slug === t.slug) v.textContent = LOAD_ERROR; });
	}

	function applyViewport() {
		var vp = VIEWPORTS.filter(function (v) { return v.key === state.viewport; })[0];
		var frame = $('#tl_frame');
		if (frame) frame.style.setProperty('--tl-w', vp.w);
		var btns = document.querySelectorAll('.tl_seg__btn');
		for (var i = 0; i < btns.length; i++) {
			var on = btns[i].getAttribute('data-vp') === state.viewport;
			btns[i].classList.toggle('tl_seg__btn--on', on);
			btns[i].setAttribute('aria-pressed', on ? 'true' : 'false');
		}
	}

	function bindFrame() {
		var iframe = $('#tl_iframe');
		if (!iframe) return;
		function fit() {
			try {
				var h = Math.ceil(iframe.contentDocument.documentElement.getBoundingClientRect().height);
				iframe.style.height = Math.min(Math.max(h, 200), 4000) + 'px';
			} catch (e) { /* cross-origin: keep default height */ }
		}
		iframe.addEventListener('load', function () {
			fit();
			try {
				var RO = iframe.contentWindow.ResizeObserver;
				if (RO) new RO(fit).observe(iframe.contentDocument.documentElement);
				else iframe.contentWindow.addEventListener('resize', fit);
			} catch (e) {}
		});
	}

	function renderCode() {
		var code = state.code[state.slug];
		var tabsEl = $('#tl_tabs'), view_ = $('#tl_codeview'), copyBtn = $('#tl_copy');
		if (!code || !tabsEl || !view_) return;

		var avail = TABS.filter(function (tab) { return tab.key === 'full' || (code[tab.key] || '').trim() !== ''; });
		if (!avail.some(function (tab) { return tab.key === state.tab; })) state.tab = 'full';

		tabsEl.innerHTML = avail.map(function (tab) {
			return '<button type="button" class="tl_tab' + (tab.key === state.tab ? ' tl_tab--on' : '') + '" data-tab="' + tab.key + '">' + tab.label + '</button>';
		}).join('');

		var cur = TABS.filter(function (tab) { return tab.key === state.tab; })[0];
		var text = code[cur.key] || '';
		var lines = text.split('\n').length;
		view_.innerHTML = highlight(text, cur.lang);

		var nums = [];
		for (var i = 1; i <= lines; i++) nums.push(i);
		$('#tl_gutter').textContent = nums.join('\n');
		$('#tl_codemeta').textContent = plural(lines, 'line');

		copyBtn.querySelector('span').textContent = 'Copy ' + (cur.key === 'full' ? 'full file' : cur.label);
		copyBtn.classList.remove('tl_copy--done');
		copyBtn.innerHTML = ICON.copy + '<span>Copy ' + (cur.key === 'full' ? 'full file' : cur.label) + '</span>';
	}

	/* ---------- events ---------- */
	view.addEventListener('input', function (e) {
		if (e.target.id === 'tl_search') { state.q = e.target.value; renderGrid(); }
	});

	view.addEventListener('click', function (e) {
		var cat = e.target.closest('[data-cat]');
		if (cat) { state.cat = cat.getAttribute('data-cat'); renderCats(); renderGrid(); return; }

		if (e.target.id === 'tl_clear') {
			state.q = ''; state.cat = 'All';
			var s = $('#tl_search'); if (s) s.value = '';
			renderCats(); renderGrid();
			return;
		}

		var act = e.target.closest('[data-act]');
		if (act) {
			var t = find(act.getAttribute('data-slug'));
			if (!t) return;
			if (act.getAttribute('data-act') === 'copy') copyFull(t);
			else downloadZip(t, act);
			return;
		}

		var vp = e.target.closest('[data-vp]');
		if (vp) { state.viewport = vp.getAttribute('data-vp'); applyViewport(); return; }

		var tab = e.target.closest('[data-tab]');
		if (tab) { state.tab = tab.getAttribute('data-tab'); renderCode(); return; }

		var cur = find(state.slug);
		if (e.target.closest('#tl_dl') && cur) { downloadZip(cur, e.target.closest('#tl_dl')); return; }
		if (e.target.closest('#tl_copyfull') && cur) { copyFull(cur); return; }

		var copy = e.target.closest('#tl_copy');
		if (copy) {
			var code = state.code[state.slug];
			if (!code) return;
			var key = state.tab;
			copyText(code[key] || '').then(function () {
				var label = TABS.filter(function (tb) { return tb.key === key; })[0].label;
				copy.classList.add('tl_copy--done');
				copy.innerHTML = ICON.check + '<span>Copied</span>';
				toast('Copied ' + (key === 'full' ? 'full file' : label));
				setTimeout(function () {
					if (copy.classList.contains('tl_copy--done')) {
						copy.classList.remove('tl_copy--done');
						copy.innerHTML = ICON.copy + '<span>Copy ' + (key === 'full' ? 'full file' : label) + '</span>';
					}
				}, 1600);
			}, function () {
				toast('Copy was blocked by the browser. Select the code and press Ctrl+C.', 3500, true);
				var sel = window.getSelection(), range = document.createRange();
				range.selectNodeContents($('#tl_codeview'));
				sel.removeAllRanges(); sel.addRange(range);
			});
		}
	});

	$('#tl_theme').addEventListener('click', function () {
		var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
		document.documentElement.setAttribute('data-theme', next);
		try { localStorage.setItem('tl_theme', next); } catch (e) {}
	});

	document.addEventListener('keydown', function (e) {
		var tag = (e.target.tagName || '').toLowerCase();
		var typing = tag === 'input' || tag === 'textarea';
		if (e.key === '/' && !typing && !e.metaKey && !e.ctrlKey) {
			var s = $('#tl_search');
			if (s) { e.preventDefault(); s.focus(); }
		} else if (e.key === 'Escape') {
			if (typing && e.target.id === 'tl_search') { e.target.blur(); return; }
			if (state.slug) location.hash = '';
		}
	});

	/* ---------- routing ---------- */
	function route() {
		var slug = decodeURIComponent(location.hash.slice(1));
		var t = slug ? find(slug) : null;
		if (t) showDetail(t); else showGallery();
		window.scrollTo(0, 0);
	}
	window.addEventListener('hashchange', route);

	/* ---------- start ---------- */
	fetch('templates.json', { cache: 'no-store' })
		.then(function (r) { if (!r.ok) throw new Error('Request failed'); return r.json(); })
		.then(function (data) {
			templates = (Array.isArray(data) ? data : []).filter(function (t) { return t && t.slug; }).map(normalize);
			templates.sort(function (a, b) { return a.title.localeCompare(b.title); });
			$('#tl_count').textContent = plural(templates.length, 'template');
			route();
		})
		.catch(function () {
			view.innerHTML = '<div class="tl_empty"><h2>Could not load templates.json</h2><p>Open this page through a web server (GitHub Pages, XAMPP, VS Code Live Server) instead of double-clicking <code>index.html</code>, and make sure <code>templates.json</code> is valid JSON.</p></div>';
		});
})();
