/* =========================================================================
   Pokepedia — App: estado global, búsqueda global, tema y arranque
   ========================================================================= */

(function () {
    'use strict';

    var C = PW.config;
    var U = PW.utils;
    var api = PW.api;
    var ui = PW.ui;
    var store = PW.store;

    /* ---------------- Barra lateral: regiones ---------------- */

    function buildSidebar() {
        var regionListEl = document.getElementById('regionList');
        if (!regionListEl) return;
        regionListEl.innerHTML = '';
        PW.regions.forEach(function (region) {
            var li = document.createElement('li');
            var a = document.createElement('a');
            a.href = '#/dex?region=' + encodeURIComponent(region.name);
            a.dataset.region = region.name;
            a.innerHTML = '<span>' + region.name + '</span><span class="gen-badge">Gen ' + region.gen + '</span>';
            li.appendChild(a);
            regionListEl.appendChild(li);
        });
    }

    /* ---------------- Búsqueda global ---------------- */

    function initGlobalSearch() {
        var form = document.getElementById('globalSearch');
        var input = document.getElementById('globalSearchInput');
        var box = document.getElementById('searchResults');
        if (!form || !input || !box) return;

        function close() {
            box.innerHTML = '';
            box.classList.remove('open');
        }

        input.addEventListener('input', U.debounce(async function () {
            var term = this.value.trim();
            if (!term) { close(); return; }
            if (term.length < 2) { box.innerHTML = '<div class="search-note">Sigue escribiendo...</div>'; box.classList.add('open'); return; }
            var groups = await api.globalSearch(term).catch(function () { return null; });
            if (!groups) { box.innerHTML = '<div class="search-note">No se pudo conectar con la API.</div>'; box.classList.add('open'); return; }
            if (input.value.trim() !== term) return;

            var plain = term.toLowerCase();
            function hl(name) {
                var label = U.cap(name.replace(/-/g, ' '));
                var idx = label.toLowerCase().indexOf(plain);
                if (idx === -1) return U.esc(label);
                return U.esc(label.slice(0, idx)) + '<mark>' + U.esc(label.slice(idx, idx + term.length)) + '</mark>' +
                    U.esc(label.slice(idx + term.length));
            }

            function group(title, items, route) {
                if (!items.length) return '';
                return '<div class="search-group"><span class="search-group-title">' + title + '</span>' +
                    items.map(function (it) {
                        var fn = route(it);
                        var suffix = it.id != null ? ' <small>#' + U.pad4(it.id) + '</small>' : '';
                        return '<a class="search-item" href="' + fn + '" role="option">' + hl(it.name) + suffix + '</a>';
                    }).join('') + '</div>';
            }

            var html =
                group('Pokémon', groups.pokemon, function (p) { return '#/pokemon/' + p.id; }) +
                group('Movimientos', groups.moves, function (m) { return '#/move/' + m.name; }) +
                group('Habilidades', groups.abilities, function (a) { return '#/ability/' + a.name; }) +
                group('Objetos', groups.items, function (i) { return '#/item/' + i.name; }) +
                group('Bayas', groups.berries, function (b) { return '#/berry/' + b.name; });
            box.innerHTML = html || '<div class="search-note">Sin resultados para "' + U.esc(term) + '".</div>';
            box.classList.add('open');
            activeIdx = -1;
        }, 220));

        /* Navegación por teclado sobre los resultados */
        var activeIdx = -1;
        function moveActive(step) {
            var items = box.querySelectorAll('.search-item');
            if (!items.length) return;
            activeIdx = (activeIdx + step + items.length) % items.length;
            items.forEach(function (a, i) { a.classList.toggle('active', i === activeIdx); });
        }
        input.addEventListener('keydown', function (e) {
            if (e.key === 'ArrowDown') { e.preventDefault(); moveActive(1); }
            else if (e.key === 'ArrowUp') { e.preventDefault(); moveActive(-1); }
            else if (e.key === 'Enter' && activeIdx !== -1 && box.classList.contains('open')) {
                e.preventDefault();
                var items = box.querySelectorAll('.search-item');
                if (items[activeIdx]) { items[activeIdx].click(); }
            }
            else if (e.key === 'Escape') { close(); input.blur(); }
        });

        form.addEventListener('submit', function (e) {
            e.preventDefault();
            var term = input.value.trim();
            var id = parseInt(term, 10);
            if (!isNaN(id) && id > 0 && id <= 1025) {
                PW.router.navigate('#/pokemon/' + id);
            } else {
                PW.state.dex.q = term;
                PW.router.navigate('#/dex');
            }
            close();
        });

        document.addEventListener('click', function (e) {
            if (!e.target.closest('.topsearch')) close();
        });
        box.addEventListener('click', function () { close(); });
    }

    /* ---------------- Favoritos (delegación) ---------------- */

    function initFavDelegation() {
        document.addEventListener('click', function (e) {
            var btn = e.target.closest('[data-fav]');
            if (!btn) return;
            e.preventDefault();
            e.stopPropagation();
            var id = parseInt(btn.getAttribute('data-fav'), 10);
            var nowFav = store.toggleFav(id);
            btn.classList.toggle('faved', nowFav);
            btn.setAttribute('aria-pressed', nowFav ? 'true' : 'false');
            var card = btn.closest('.poke-card');
            if (card) card.classList.toggle('faved', nowFav);
            ui.toast(nowFav ? 'Añadido a favoritos.' : 'Quitado de favoritos.');
        });
    }

    /* ---------------- Tema ---------------- */

    function initThemeToggle() {
        var btn = document.getElementById('themeToggle');
        if (!btn) return;
        btn.addEventListener('click', function () {
            var next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            ui.applyTheme(next);
        });
    }

    /* ---------------- Rutas ---------------- */

    function registerRoutes() {
        var R = PW.router;
        R.on('', PW.views.home);
        R.on('home', PW.views.home);
        R.on('dex', PW.views.dex);
        R.on('pokemon/:id', PW.views.pokemon);
        R.on('types', PW.views.types);
        R.on('types/calc', PW.views.typeCalc);
        R.on('type/:name', PW.views.typeDetail);
        R.on('moves', PW.views.moves);
        R.on('move/:name', PW.views.move);
        R.on('abilities', PW.views.abilities);
        R.on('ability/:name', PW.views.ability);
        R.on('items', PW.views.items);
        R.on('item/:name', PW.views.item);
        R.on('berries', PW.views.berries);
        R.on('berry/:name', PW.views.berry);
        R.on('regions', PW.views.regions);
        R.on('region/:name', PW.views.regionDetail);
        R.on('gyms', PW.views.gyms);
        R.on('characters', PW.views.characters);
        R.on('legendary', PW.views.legendary);
        R.on('teambuilder', PW.views.teambuilder);
        R.on('compare', PW.views.compare);
        R.on('rankings', PW.views.rankings);
        R.on('random', PW.views.random);
        R.on('damage', PW.views.damage);
        R.on('favorites', PW.views.favorites);
        R.on('history', PW.views.history);
        R.on('ayuda', PW.views.ayuda);
    }

    /* ---------------- Inicio ---------------- */

    function init() {
        buildSidebar();
        initGlobalSearch();
        initFavDelegation();
        initThemeToggle();
        ui.initTheme();
        ui.initBackToTop();
        registerRoutes();
        PW.router.init();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
