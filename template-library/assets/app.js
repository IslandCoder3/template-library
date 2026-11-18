(function () {
	var templates = window.TL_TEMPLATES || [];
	var $ = function (sel) { return document.querySelector(sel); };
	var els = { list: $('#tl_list'), cats: $('#tl_cats'), search: $('#tl_search'), count: $('#tl_count'), main: $('#tl_main') };
	var state = { q: '', cat: 'All', slug: null, tab: 'full', viewport: 'desktop', code: {} };

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

	/* ---------- helpers ---------- */
	function esc(s) {
		return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
	}
	function find(slug) {
		for (var i = 0; i < templates.length; i++) if (templates[i].slug === slug) return templates[i];
		return null;
	}
	function fmtSize(n) {
		if (n < 1024) return n + ' B';
		if (n < 1048576) return (n / 1024).toFixed(1) + ' KB';
		return (n / 1048576).toFixed(1) + ' MB';
	}
	function plural(n, word) { return n + ' ' + word + (n === 1 ? '' : 's'); }

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

	/* ---------- sidebar ---------- */
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

	function renderCats() {
		var cats = categories();
		if (cats.length < 2) { els.cats.innerHTML = ''; return; }
		var html = '<button class="tl_cat' + (state.cat === 'All' ? ' tl_cat--on' : '') + '" data-cat="All">All (' + templates.length + ')</button>';
		cats.forEach(function (c) {
			html += '<button class="tl_cat' + (state.cat === c.name ? ' tl_cat--on' : '') + '" data-cat="' + esc(c.name) + '">' + esc(c.name) + ' (' + c.n + ')</button>';
		});
		els.cats.innerHTML = html;
	}

	function renderList() {
		var items = visible();
		els.count.textContent = plural(templates.length, 'template');
		if (!items.length) {
			els.list.innerHTML = templates.length
				? '<p class="tl_none">No templates match your search. <button type="button" id="tl_clear">Clear filters</button></p>'
				: '<p class="tl_none">No templates yet.</p>';
			return;
		}
		els.list.innerHTML = items.map(function (t) {
			return '<button type="button" class="tl_item' + (t.slug === state.slug ? ' tl_item--on' : '') + '" data-slug="' + esc(t.slug) + '">' +
				'<span class="tl_item__title">' + esc(t.title) + '</span>' +
				'<span class="tl_item__meta">' + esc(t.category) + '</span></button>';
		}).join('');
	}

	/* ---------- main panel ---------- */
	function renderEmpty() {
		els.main.innerHTML = '<div class="tl_empty"><h2>No templates yet</h2><p>Create a folder inside <code>templates/</code>, put your HTML file (and any images or videos) in it, then refresh this page.</p></div>';
	}

	function select(slug, push) {
		var t = find(slug);
		if (!t) return;
		state.slug = slug;
		state.tab = 'full';
		if (push !== false) history.replaceState(null, '', '#' + encodeURIComponent(slug));
		renderList();
		renderMain(t);
		loadCode(t);
	}

	function renderMain(t) {
		var tags = t.tags.map(function (g) { return '<span class="tl_tag">' + esc(g) + '</span>'; }).join('');
		var segs = VIEWPORTS.map(function (v) {
			return '<button type="button" class="tl_seg__btn' + (v.key === state.viewport ? ' tl_seg__btn--on' : '') + '" data-vp="' + v.key + '">' + v.label + '</button>';
		}).join('');
		var files = t.files.map(function (f) { return '<li><span>' + esc(f.path) + '</span><span>' + fmtSize(f.size) + '</span></li>'; }).join('');

		els.main.innerHTML =
			'<header class="tl_head"><div>' +
				'<h2 class="tl_head__title">' + esc(t.title) + '</h2>' +
				(t.description ? '<p class="tl_head__desc">' + esc(t.description) + '</p>' : '') +
				(tags ? '<div class="tl_head__tags">' + tags + '</div>' : '') +
			'</div><div class="tl_actions">' +
				'<a class="tl_btn" href="' + esc(t.url) + '" target="_blank" rel="noopener">Open preview</a>' +
				'<a class="tl_btn tl_btn--primary" href="?download=' + encodeURIComponent(t.slug) + '">Download .zip</a>' +
			'</div></header>' +

			'<section class="tl_card"><div class="tl_card__bar"><span class="tl_card__label">Preview</span><div class="tl_seg" id="tl_seg">' + segs + '</div></div>' +
				'<div class="tl_stage"><div class="tl_frame" id="tl_frame"><iframe id="tl_iframe" src="' + esc(t.url) + '" title="Preview of ' + esc(t.title) + '"></iframe></div></div></section>' +

			'<section class="tl_card"><div class="tl_card__bar tl_card__bar--dark"><div class="tl_tabs" id="tl_tabs"></div>' +
				'<button type="button" class="tl_btn tl_btn--copy" id="tl_copy">Copy</button></div>' +
				'<pre class="tl_code"><code id="tl_codeview">Loading…</code></pre></section>' +

			'<section class="tl_card"><div class="tl_card__bar"><span class="tl_card__label">Files in the download</span></div>' +
				'<ul class="tl_files">' + files + '</ul>' +
				'<p class="tl_files__note">Copied code does not include these files. Keep the same relative paths (for example <code>images/</code> and <code>videos/</code>) or update the paths after pasting.</p></section>';

		applyViewport();
		bindFrame();
	}

	function applyViewport() {
		var vp = VIEWPORTS.filter(function (v) { return v.key === state.viewport; })[0];
		var frame = $('#tl_frame');
		if (frame) frame.style.setProperty('--tl-w', vp.w);
		var btns = document.querySelectorAll('.tl_seg__btn');
		for (var i = 0; i < btns.length; i++) btns[i].classList.toggle('tl_seg__btn--on', btns[i].getAttribute('data-vp') === state.viewport);
	}

	function bindFrame() {
		var iframe = $('#tl_iframe');
		if (!iframe) return;
		function fit() {
			try {
				var d = iframe.contentDocument;
				var h = Math.max(d.documentElement.scrollHeight, d.body ? d.body.scrollHeight : 0);
				iframe.style.height = Math.min(Math.max(h, 240), 760) + 'px';
			} catch (e) { /* cross-origin: keep default height */ }
		}
		iframe.addEventListener('load', function () {
			fit();
			try { iframe.contentWindow.addEventListener('resize', fit); } catch (e) {}
		});
	}

	function loadCode(t) {
		if (state.code[t.slug]) { renderCode(); return; }
		fetch('?api=code&slug=' + encodeURIComponent(t.slug), { cache: 'no-store' })
			.then(function (r) { if (!r.ok) throw new Error('Request failed'); return r.json(); })
			.then(function (data) {
				state.code[t.slug] = data.code;
				if (state.slug === t.slug) renderCode();
			})
			.catch(function () {
				var view = $('#tl_codeview');
				if (view && state.slug === t.slug) view.textContent = 'Could not load the code for this template. Refresh the page and try again.';
			});
	}

	function renderCode() {
		var code = state.code[state.slug];
		var tabsEl = $('#tl_tabs'), view = $('#tl_codeview'), copyBtn = $('#tl_copy');
		if (!code || !tabsEl || !view) return;

		var avail = TABS.filter(function (tab) { return tab.key === 'full' || (code[tab.key] || '').trim() !== ''; });
		if (!avail.some(function (tab) { return tab.key === state.tab; })) state.tab = 'full';

		tabsEl.innerHTML = avail.map(function (tab) {
			return '<button type="button" class="tl_tab' + (tab.key === state.tab ? ' tl_tab--on' : '') + '" data-tab="' + tab.key + '">' + tab.label + '</button>';
		}).join('');

		var cur = TABS.filter(function (tab) { return tab.key === state.tab; })[0];
		view.innerHTML = highlight(code[cur.key] || '', cur.lang);
		copyBtn.textContent = 'Copy ' + (cur.key === 'full' ? 'full file' : cur.label);
		copyBtn.classList.remove('tl_btn--done');
	}

	/* ---------- events ---------- */
	els.search.addEventListener('input', function () { state.q = els.search.value; renderList(); });

	els.cats.addEventListener('click', function (e) {
		var b = e.target.closest('[data-cat]');
		if (!b) return;
		state.cat = b.getAttribute('data-cat');
		renderCats();
		renderList();
	});

	els.list.addEventListener('click', function (e) {
		if (e.target.id === 'tl_clear') {
			state.q = ''; state.cat = 'All'; els.search.value = '';
			renderCats(); renderList();
			return;
		}
		var b = e.target.closest('[data-slug]');
		if (b) select(b.getAttribute('data-slug'));
	});

	els.main.addEventListener('click', function (e) {
		var vp = e.target.closest('[data-vp]');
		if (vp) { state.viewport = vp.getAttribute('data-vp'); applyViewport(); return; }

		var tab = e.target.closest('[data-tab]');
		if (tab) { state.tab = tab.getAttribute('data-tab'); renderCode(); return; }

		var copy = e.target.closest('#tl_copy');
		if (copy) {
			var code = state.code[state.slug];
			if (!code) return;
			var text = code[state.tab] || '';
			var label = copy.textContent;
			copyText(text).then(function () {
				copy.textContent = 'Copied';
				copy.classList.add('tl_btn--done');
				setTimeout(function () { if (copy.textContent === 'Copied') { copy.textContent = label; copy.classList.remove('tl_btn--done'); } }, 1600);
			}, function () {
				copy.textContent = 'Press Ctrl+C';
				var sel = window.getSelection(), range = document.createRange();
				range.selectNodeContents($('#tl_codeview'));
				sel.removeAllRanges(); sel.addRange(range);
			});
		}
	});

	window.addEventListener('hashchange', function () {
		var slug = decodeURIComponent(location.hash.slice(1));
		if (slug && slug !== state.slug && find(slug)) select(slug, false);
	});

	/* ---------- start ---------- */
	renderCats();
	renderList();
	if (!templates.length) { renderEmpty(); return; }
	var fromHash = decodeURIComponent(location.hash.slice(1));
	select(find(fromHash) ? fromHash : templates[0].slug, false);
})();
