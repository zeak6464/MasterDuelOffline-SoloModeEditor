/* Extra tools: decks/YDK, rewards, card pool, cosmetics, backups, search, validation, topics */

let cardListData = null;
let craftableList = null;
let topicsData = null;
let browserDeck = null;
let browserMeta = { source: '', path: '', side: 0 };
let banlistLists = { a0: [], a1: [], a2: [], a3: [] };
let banlistTarget = 'a0';
let cardPoolView = 'owned';

function renderIdGrid(containerId, ids, { onRemove = null, showRarity = false, filter = '' } = {}) {
    const root = document.getElementById(containerId);
    if (!root) return;
    root.innerHTML = '';
    const q = (filter || '').toLowerCase();
    const counts = {};
    (ids || []).forEach(id => {
        counts[id] = (counts[id] || 0) + 1;
    });

    const unique = showRarity
        ? [...new Set((ids || []).map(Number))]
        : Object.keys(counts).map(Number);

    unique.forEach(id => {
        if (q) {
            const info = typeof getCardInfo === 'function' ? getCardInfo(id) : null;
            const name = (info?.name || '').toLowerCase();
            if (!String(id).includes(q) && !name.includes(q)) return;
        }
        const count = showRarity
            ? (cardListData?.[id] ?? cardListData?.[String(id)] ?? 1)
            : counts[id];
        const tile = document.createElement('div');
        tile.className = 'card-item';
        const konami = gameToKonami(id);
        const info = typeof getCardInfo === 'function' ? getCardInfo(id) : null;
        const img = konami && typeof getCardImageUrl === 'function' ? getCardImageUrl(konami) : '';
        tile.innerHTML = `
            ${img ? `<img src="${img}" alt="${info?.name || id}">` : `<div style="color:#fff;font-size:10px;padding:4px">${id}</div>`}
            <div class="card-count">${showRarity ? 'r' + count : 'x' + count}</div>
        `;
        tile.title = info?.name ? `${info.name} (${id})` : String(id);
        tile.onmouseover = () => showCardPreview(id);
        if (onRemove) tile.onclick = () => onRemove(id);
        root.appendChild(tile);
    });
}

function renderSearchResults(containerId, query, onPick) {
    const root = document.getElementById(containerId);
    if (!root) return;
    root.innerHTML = '';
    const q = (query || '').toLowerCase();
    if (q.length < 2) return;

    const hits = [];
    Object.entries(ydkMapping || {}).forEach(([gameId, konamiId]) => {
        const info = cardDatabase?.[konamiId];
        if (!info) return;
        if (gameId.includes(q) || info.name.toLowerCase().includes(q) || String(konamiId).includes(q)) {
            hits.push({ gameId, info, konamiId });
        }
    });
    hits.sort((a, b) => a.info.name.localeCompare(b.info.name));
    hits.slice(0, 50).forEach(result => {
        const div = document.createElement('div');
        div.className = 'result-item';
        div.innerHTML = `
            <img src="${getCardImageUrl(result.konamiId)}" alt="${result.info.name}">
            <div class="result-info">
                <div class="result-name">${result.info.name}</div>
                <div class="result-type">${result.info.type}</div>
            </div>
        `;
        div.onmouseover = () => showCardPreview(result.gameId);
        div.onclick = () => onPick(result.gameId);
        root.appendChild(div);
    });
}

const ITEM_CAT_NAMES = {
    '1': 'Gem/Consume',
    '2': 'Ticket?',
    '3': 'Card?'
};

function gameToKonami(gameId) {
    return ydkMapping[String(gameId)] || ydkMapping[gameId] || null;
}

function cardLabel(gameId) {
    const info = typeof getCardInfo === 'function' ? getCardInfo(gameId) : null;
    return info ? `${info.name} (${gameId})` : `Card ${gameId}`;
}

function downloadText(filename, text) {
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function deckToYdk(deck, name = 'Deck') {
    const main = deck?.Main?.CardIds || [];
    const extra = deck?.Extra?.CardIds || [];
    const side = deck?.Side?.CardIds || [];
    const lines = [`#created by YgoMaster Editor`, `#main`];
    main.forEach(id => {
        const k = gameToKonami(id);
        if (k) lines.push(String(k));
    });
    lines.push('#extra');
    extra.forEach(id => {
        const k = gameToKonami(id);
        if (k) lines.push(String(k));
    });
    lines.push('!side');
    side.forEach(id => {
        const k = gameToKonami(id);
        if (k) lines.push(String(k));
    });
    return lines.join('\n') + '\n';
}

/* ========== Deck browser / YDK ========== */
async function refreshDeckBrowserList() {
    const type = document.getElementById('deckBrowserType').value;
    const select = document.getElementById('deckBrowserSelect');
    select.innerHTML = '';
    if (type === 'solo') {
        const listing = await listDir('SoloDuels');
        listing.files.filter(f => f.endsWith('.json')).forEach(f => {
            const opt = document.createElement('option');
            opt.value = f;
            opt.textContent = f;
            select.appendChild(opt);
        });
    } else {
        const listing = await listDir('StructureDecks');
        listing.files.filter(f => f.endsWith('.json')).forEach(f => {
            const opt = document.createElement('option');
            opt.value = f;
            opt.textContent = f;
            select.appendChild(opt);
        });
    }
}

async function loadDeckBrowser() {
    const type = document.getElementById('deckBrowserType').value;
    const file = document.getElementById('deckBrowserSelect').value;
    const side = parseInt(document.getElementById('deckBrowserSide').value, 10) || 0;
    if (!file) return;
    if (type === 'solo') {
        const data = await fetchJsonc(`SoloDuels/${file}`);
        browserDeck = data?.res?.[0]?.[1]?.Duel?.Deck?.[side] || data?.Duel?.Deck?.[side] || null;
        browserMeta = { source: 'solo', path: `SoloDuels/${file}`, side };
    } else {
        const data = await fetchJsonc(`StructureDecks/${file}`);
        browserDeck = {
            Main: { CardIds: data.contents?.m?.ids || [] },
            Extra: { CardIds: data.contents?.e?.ids || [] },
            Side: { CardIds: [] }
        };
        browserMeta = { source: 'structure', path: `StructureDecks/${file}`, side: 0 };
    }
    renderDeckBrowser();
}

function renderDeckBrowser() {
    const filter = document.getElementById('deckBrowserSearch')?.value || '';
    const main = browserDeck?.Main?.CardIds || [];
    const extra = browserDeck?.Extra?.CardIds || [];
    const side = browserDeck?.Side?.CardIds || [];
    renderIdGrid('browserMainDeck', main, { filter });
    renderIdGrid('browserExtraDeck', extra, { filter });
    renderIdGrid('browserSideDeck', side, { filter });
    const mainEl = document.getElementById('browserMainCount');
    const extraEl = document.getElementById('browserExtraCount');
    const sideEl = document.getElementById('browserSideCount');
    if (mainEl) mainEl.textContent = `${main.length} cards`;
    if (extraEl) extraEl.textContent = `${extra.length} cards`;
    if (sideEl) sideEl.textContent = `${side.length} cards`;
}

function exportBrowserYdk() {
    if (!browserDeck) return alert('Load a deck first');
    const base = browserMeta.path.split('/').pop().replace(/\.json$/i, '');
    const text = deckToYdk(browserDeck, base);
    downloadText(`${base}.ydk`, text);
    notify(`Exported ${base}.ydk`, 'success');
}

/* ========== Reward visualizer ========== */
function describeReward(rewardObj) {
    if (!rewardObj) return 'None';
    const parts = [];
    for (const [cat, items] of Object.entries(rewardObj)) {
        for (const [itemId, amount] of Object.entries(items || {})) {
            const catName = ITEM_CAT_NAMES[cat] || `Cat ${cat}`;
            const label = (String(cat) === '1' && String(itemId) === '1') ? 'Gems' : `${catName} #${itemId}`;
            parts.push(`${label}: ${amount}`);
        }
    }
    return parts.join(', ') || 'None';
}

function renderRewardVisualizer() {
    const master = typeof getSoloMaster === 'function' ? getSoloMaster() : soloData?.res?.[0]?.[1]?.Master?.Solo;
    const root = document.getElementById('rewardView');
    if (!master) {
        root.innerHTML = '<div class="help-text">Solo.json not loaded</div>';
        return;
    }
    const filter = (document.getElementById('rewardGateFilter').value || '').trim();
    const rows = [];
    for (const [gateId, chapters] of Object.entries(master.chapter || {})) {
        if (filter && gateId !== filter) continue;
        for (const [chapterId, chapter] of Object.entries(chapters)) {
            const setId = chapter.set_id;
            const mySet = chapter.mydeck_set_id;
            rows.push(`<tr>
                <td>${gateId}</td>
                <td>${chapterId}</td>
                <td>${chapter.npc_id || 0}</td>
                <td>${setId || 0}<br><span class="help-text">${describeReward(master.reward?.[String(setId)])}</span></td>
                <td>${mySet || 0}<br><span class="help-text">${describeReward(master.reward?.[String(mySet)])}</span></td>
            </tr>`);
        }
    }
    root.innerHTML = `<table class="data-table">
        <thead><tr><th>Gate</th><th>Chapter</th><th>NPC</th><th>set_id reward</th><th>mydeck_set_id reward</th></tr></thead>
        <tbody>${rows.join('') || '<tr><td colspan="5">No chapters</td></tr>'}</tbody>
    </table>`;
}

/* ========== Card pool ========== */
async function loadCardPoolEditor() {
    cardListData = await fetchJsonc('CardList.json');
    craftableList = await fetchJsonc('CardCraftableList.json');
    if (!Array.isArray(craftableList)) craftableList = [];
    document.getElementById('cardPoolStatus').textContent =
        `Card pool: ${Object.keys(cardListData).length} owned, ${craftableList.length} craftable`;
    document.getElementById('cardPoolStatus').className = 'status-item loaded';
    renderCardPoolGrid();
}

function setCardPoolView(view) {
    cardPoolView = view;
    document.getElementById('poolViewOwned')?.classList.toggle('active', view === 'owned');
    document.getElementById('poolViewCraftable')?.classList.toggle('active', view === 'craftable');
    const title = document.getElementById('cardPoolGridTitle');
    if (title) {
        title.innerHTML = view === 'owned'
            ? `Owned Cards <span class="deck-count" id="cardPoolCount">0 cards</span>`
            : `Craftable Cards <span class="deck-count" id="cardPoolCount">0 cards</span>`;
    }
    renderCardPoolGrid();
}

function renderCardPoolGrid() {
    if (!cardListData) return;
    const filter = (document.getElementById('cardPoolSearch')?.value || '').toLowerCase();
    let ids = cardPoolView === 'craftable'
        ? (craftableList || []).map(Number)
        : Object.keys(cardListData).map(Number);

    if (filter.length >= 1) {
        ids = ids.filter(id => {
            const info = typeof getCardInfo === 'function' ? getCardInfo(id) : null;
            const name = (info?.name || '').toLowerCase();
            return String(id).includes(filter) || name.includes(filter);
        });
    } else {
        ids = ids.slice(0, 120);
    }

    renderIdGrid('cardPoolGrid', ids, {
        showRarity: cardPoolView === 'owned',
        onRemove: (id) => {
            if (cardPoolView === 'owned') {
                delete cardListData[id];
                delete cardListData[String(id)];
            } else {
                setCardCraftable(id, false);
            }
            renderCardPoolGrid();
        }
    });
    const total = cardPoolView === 'craftable'
        ? (craftableList || []).length
        : Object.keys(cardListData).length;
    const countEl = document.getElementById('cardPoolCount');
    if (countEl) countEl.textContent = filter ? `${ids.length} / ${total}` : `showing ${ids.length} / ${total}`;
}

function searchCardPoolCards() {
    const q = document.getElementById('cardPoolSearch')?.value || '';
    renderSearchResults('cardPoolSearchResults', q, (gameId) => {
        addCardToPool(gameId);
    });
    renderCardPoolGrid();
}

function addCardToPool(gameId) {
    if (!cardListData) return;
    const rarity = parseInt(document.getElementById('grantRarity')?.value, 10) || 1;
    const makeCraftable = document.getElementById('grantCraftable')?.checked;
    cardListData[String(gameId)] = rarity;
    if (makeCraftable) setCardCraftable(gameId, true);
    renderCardPoolGrid();
    notify(`Added ${cardLabel(gameId)}`, 'success');
}

function setCardOwned(gameId, value) {
    if (!cardListData) return;
    const n = parseInt(value, 10) || 0;
    if (n <= 0) {
        delete cardListData[gameId];
        delete cardListData[String(gameId)];
    } else {
        cardListData[String(gameId)] = n;
    }
    renderCardPoolGrid();
}

function setCardCraftable(gameId, enabled) {
    if (!Array.isArray(craftableList)) craftableList = [];
    const id = Number(gameId);
    craftableList = craftableList.filter(x => Number(x) !== id);
    if (enabled) craftableList.push(id);
}

function grantCardIds() {
    if (!cardListData) return alert('Load card pool first');
    const rarity = parseInt(document.getElementById('grantRarity').value, 10) || 1;
    const ids = (document.getElementById('grantIds').value || '')
        .split(/[,\s]+/)
        .map(s => parseInt(s, 10))
        .filter(n => !Number.isNaN(n));
    const makeCraftable = document.getElementById('grantCraftable').checked;
    ids.forEach(id => {
        cardListData[String(id)] = rarity;
        if (makeCraftable) setCardCraftable(id, true);
    });
    notify(`Granted ${ids.length} cards`, 'success');
    renderCardPoolGrid();
}

async function saveCardPool() {
    if (!cardListData) await loadCardPoolEditor();
    await saveToServer('CardList.json', cardListData);
    await saveToServer('CardCraftableList.json', craftableList);
}

/* ========== Banlist visual ========== */
function setBanlistTarget(key) {
    banlistTarget = key;
    const ids = { a0: 'banTargetA0', a1: 'banTargetA1', a2: 'banTargetA2', a3: 'banTargetA3' };
    Object.entries(ids).forEach(([k, elId]) => {
        document.getElementById(elId)?.classList.toggle('active', k === key);
    });
}

function syncBanlistHiddenFields() {
    const map = {
        banForbidden: 'a0',
        banLimited: 'a1',
        banSemi: 'a2',
        banUnlimited: 'a3'
    };
    Object.entries(map).forEach(([elId, key]) => {
        const el = document.getElementById(elId);
        if (el) el.value = (banlistLists[key] || []).join(', ');
    });
}

function renderBanlistGrids() {
    const bind = (key, gridId, countId) => {
        renderIdGrid(gridId, banlistLists[key] || [], {
            onRemove: (id) => {
                banlistLists[key] = (banlistLists[key] || []).filter(x => Number(x) !== Number(id));
                syncBanlistHiddenFields();
                renderBanlistGrids();
            }
        });
        const el = document.getElementById(countId);
        if (el) el.textContent = `${(banlistLists[key] || []).length} cards`;
    };
    bind('a0', 'banGridA0', 'banA0Count');
    bind('a1', 'banGridA1', 'banA1Count');
    bind('a2', 'banGridA2', 'banA2Count');
    bind('a3', 'banGridA3', 'banA3Count');
    syncBanlistHiddenFields();
}

function searchBanlistCards() {
    const q = document.getElementById('banlistSearch')?.value || '';
    renderSearchResults('banlistSearchResults', q, (gameId) => {
        addCardToBanlist(gameId);
    });
}

function addCardToBanlist(gameId) {
    const id = Number(gameId);
    // Remove from other lists so a card has one status
    ['a0', 'a1', 'a2', 'a3'].forEach(k => {
        banlistLists[k] = (banlistLists[k] || []).filter(x => Number(x) !== id);
    });
    banlistLists[banlistTarget] = banlistLists[banlistTarget] || [];
    banlistLists[banlistTarget].push(id);
    renderBanlistGrids();
}

function applyBanlistListsFromData(lists) {
    banlistLists = {
        a0: [...(lists.a0 || [])],
        a1: [...(lists.a1 || [])],
        a2: [...(lists.a2 || [])],
        a3: [...(lists.a3 || [])]
    };
    renderBanlistGrids();
}

// Keep old name used by grant UI remnants
function renderCardPoolSearch() {
    searchCardPoolCards();
}

/* ========== Cosmetics / BGM ========== */
const DEFAULT_BGMS = Array.from({ length: 16 }, (_, i) => {
    const n = String(i + 1).padStart(2, '0');
    return `BGM_DUEL_NORMAL_${n}`;
}).concat([
    'BGM_DUEL_DC01_NORMAL', 'BGM_DUEL_DC02_NORMAL', 'BGM_DUEL_DC03_NORMAL',
    'BGM_DUEL_EX_01', 'BGM_DUEL_EX_02_NORMAL', 'BGM_DUEL_EX_03_NORMAL',
    'BGM_DUEL_EX_04_NORMAL', 'BGM_DUEL_EX_05_NORMAL', 'BGM_DUEL_RATE01_NORMAL'
]);

function enhanceCosmeticsPickers() {
    if (!itemData) return;
    const fill = (elementId, category, keepValue = true) => {
        const el = document.getElementById(elementId);
        if (!el) return;
        const prev = el.value;
        const items = itemData[category] || [];
        el.innerHTML = '';
        items.sort((a, b) => a.id - b.id).forEach(item => {
            const opt = document.createElement('option');
            opt.value = item.id;
            opt.textContent = `${category} ${item.id}`;
            el.appendChild(opt);
        });
        if (keepValue && prev) el.value = prev;
    };

    ['playerField', 'cpuField', 'cdMatP', 'cdMatC'].forEach(id => fill(id, 'FIELD'));
    ['playerSleeve', 'cpuSleeve', 'cdSleeveP', 'cdSleeveC'].forEach(id => fill(id, 'PROTECTOR'));
    ['playerIcon', 'cpuIcon'].forEach(id => fill(id, 'ICON'));
    ['playerIconFrame', 'cpuIconFrame'].forEach(id => fill(id, 'ICON_FRAME'));

    const bgmSelects = ['bgmSelect', 'cdBgmSelect'].map(id => document.getElementById(id)).filter(Boolean);
    const bgmSet = new Set(DEFAULT_BGMS);
    bgmSelects.forEach(sel => {
        const prev = sel.value;
        sel.innerHTML = '';
        [...bgmSet].forEach(bgm => {
            const opt = document.createElement('option');
            opt.value = bgm;
            opt.textContent = bgm;
            sel.appendChild(opt);
        });
        if (prev) sel.value = prev;
    });

    // Cosmetic helper lists
    const root = document.getElementById('cosmeticsLists');
    if (root) {
        root.innerHTML = ['FIELD', 'PROTECTOR', 'ICON', 'AVATAR', 'COIN', 'WALLPAPER'].map(cat => {
            const items = (itemData[cat] || []).slice(0, 12).map(i => i.id).join(', ');
            const total = (itemData[cat] || []).length;
            return `<div class="panel-box"><strong>${cat}</strong> (${total}) sample: ${items}</div>`;
        }).join('');
    }
}

function applyCdBgmSelect() {
    const sel = document.getElementById('cdBgmSelect');
    const input = document.getElementById('cdBgm');
    if (!sel || !input) return;
    const base = sel.value;
    input.value = [
        base,
        base.replace('NORMAL', 'KEYCARD'),
        base.replace('NORMAL', 'CLIMAX')
    ].join(', ');
}

/* ========== Backups ========== */
async function refreshBackups() {
    const result = await apiPost('/api/backups', {});
    const root = document.getElementById('backupList');
    if (!result.backups?.length) {
        root.innerHTML = '<div class="help-text">No .bak files yet. Save something to create backups.</div>';
        return;
    }
    root.innerHTML = result.backups.map(b => {
        const when = new Date(b.mtime * 1000).toLocaleString();
        const kb = Math.round(b.size / 1024);
        return `<div class="file-item">
            <div><strong>${b.original}</strong> <span class="help-text">(${kb} KB, ${when})</span></div>
            <div class="button-row">
                <button onclick="showBackupDiff('${b.original.replace(/'/g, "\\'")}')">Diff</button>
                <button onclick="restoreBackup('${b.original.replace(/'/g, "\\'")}')">Restore</button>
            </div>
        </div>`;
    }).join('');
}

async function showBackupDiff(path) {
    const result = await apiPost('/api/diff', { path });
    const pre = document.getElementById('backupDiff');
    pre.textContent = (result.diff || []).join('\n') || '(no differences)';
    if (result.truncated) pre.textContent += '\n\n... truncated ...';
}

async function restoreBackup(path) {
    if (!confirm(`Restore ${path} from its .bak file?`)) return;
    await apiPost('/api/restore', { path });
    notify(`Restored ${path}`, 'success');
    await refreshBackups();
}

/* ========== Global search ========== */
async function runGlobalSearch() {
    const q = (document.getElementById('globalSearchInput').value || '').trim().toLowerCase();
    const root = document.getElementById('globalSearchResults');
    if (q.length < 2) {
        root.innerHTML = '<div class="help-text">Type at least 2 characters</div>';
        return;
    }
    const hits = [];
    const master = typeof getSoloMaster === 'function' ? getSoloMaster() : soloData?.res?.[0]?.[1]?.Master?.Solo;
    if (master) {
        Object.entries(master.gate || {}).forEach(([id, gate]) => {
            const blob = `${id} gate ${JSON.stringify(gate)}`.toLowerCase();
            if (blob.includes(q)) hits.push({ type: 'Gate', label: `Gate ${id}`, action: `showSection('gates')` });
        });
        Object.entries(master.chapter || {}).forEach(([gateId, chapters]) => {
            Object.entries(chapters).forEach(([chapterId, ch]) => {
                const blob = `${gateId} ${chapterId} npc ${ch.npc_id} ${JSON.stringify(ch)}`.toLowerCase();
                if (blob.includes(q)) {
                    hits.push({
                        type: 'Chapter',
                        label: `Gate ${gateId} / Chapter ${chapterId} (npc ${ch.npc_id || 0})`,
                        action: `showSection('chapters')`
                    });
                }
            });
        });
    }
    if (shopData?.PackShop) {
        Object.entries(shopData.PackShop).forEach(([id, pack]) => {
            const blob = `${id} ${pack.nameTextId || ''}`.toLowerCase();
            if (blob.includes(q)) hits.push({ type: 'Pack', label: `${id} — ${pack.nameTextId || ''}`, action: `showSection('shop')` });
        });
    }
    Object.entries(ydkMapping || {}).forEach(([gameId, konamiId]) => {
        const info = cardDatabase?.[konamiId];
        if (!info) return;
        if (info.name.toLowerCase().includes(q) || gameId.includes(q)) {
            hits.push({ type: 'Card', label: `${info.name} (${gameId})`, action: `showSection('cardPool')` });
        }
    });
    root.innerHTML = hits.slice(0, 100).map(h =>
        `<div class="file-item" onclick="${h.action}"><strong>${h.type}</strong> — ${h.label}</div>`
    ).join('') || '<div class="help-text">No results</div>';
}

/* ========== Validation ========== */
async function runValidation() {
    const root = document.getElementById('validationResults');
    root.innerHTML = '<div class="help-text">Running checks...</div>';
    const issues = [];
    const master = typeof getSoloMaster === 'function' ? getSoloMaster() : soloData?.res?.[0]?.[1]?.Master?.Solo;
    if (!master) {
        root.innerHTML = '<div class="error">Solo.json not loaded</div>';
        return;
    }

    const duelListing = await listDir('SoloDuels');
    const duelFiles = new Set(duelListing.files);

    for (const [gateId, chapters] of Object.entries(master.chapter || {})) {
        const chapterIds = new Set(Object.keys(chapters));
        for (const [chapterId, ch] of Object.entries(chapters)) {
            if (ch.parent_chapter && ch.parent_chapter !== 0 && !chapterIds.has(String(ch.parent_chapter))) {
                // parent may be in same gate only typically
                const parentOk = Object.values(master.chapter).some(g => g[String(ch.parent_chapter)]);
                if (!parentOk) {
                    issues.push({ level: 'error', msg: `Chapter ${chapterId}: parent_chapter ${ch.parent_chapter} missing` });
                }
            }
            if (ch.npc_id > 0 && !duelFiles.has(`${chapterId}.json`)) {
                issues.push({ level: 'error', msg: `Chapter ${chapterId}: npc_id ${ch.npc_id} but SoloDuels/${chapterId}.json missing` });
            }
            if (ch.anime === 1) {
                try {
                    await fetchJsonc(`SoloMovies/${chapterId}.json`);
                } catch {
                    issues.push({ level: 'warn', msg: `Chapter ${chapterId}: anime flag set but SoloMovies/${chapterId}.json missing` });
                }
            }
            if (ch.set_id && !master.reward?.[String(ch.set_id)]) {
                issues.push({ level: 'warn', msg: `Chapter ${chapterId}: set_id ${ch.set_id} has no reward entry` });
            }
        }
        const gate = master.gate?.[gateId];
        if (gate?.clear_chapter && !chapterIds.has(String(gate.clear_chapter))) {
            issues.push({ level: 'error', msg: `Gate ${gateId}: clear_chapter ${gate.clear_chapter} missing` });
        }
    }

    // Sample validate a few loaded solo duels for unknown card ids
    let checked = 0;
    for (const file of [...duelFiles].slice(0, 40)) {
        try {
            const data = await fetchJsonc(`SoloDuels/${file}`);
            const decks = data?.res?.[0]?.[1]?.Duel?.Deck || [];
            decks.forEach((deck, idx) => {
                ['Main', 'Extra', 'Side'].forEach(part => {
                    (deck?.[part]?.CardIds || []).forEach(id => {
                        if (!gameToKonami(id)) {
                            issues.push({ level: 'warn', msg: `${file} deck[${idx}] ${part}: unknown card id ${id}` });
                        }
                    });
                });
            });
            checked += 1;
        } catch {
            issues.push({ level: 'error', msg: `SoloDuels/${file} failed to parse` });
        }
    }

    if (!issues.length) {
        root.innerHTML = `<div class="panel-box">No issues found (checked structure + ${checked} duel files).</div>`;
        return;
    }
    root.innerHTML = `<div class="help-text">${issues.length} issue(s); sampled ${checked} duel files</div>` +
        issues.slice(0, 300).map(i =>
            `<div class="file-item" style="border-left:4px solid ${i.level === 'error' ? '#a12622' : '#b8860b'}">${i.level.toUpperCase()}: ${i.msg}</div>`
        ).join('');
}

/* ========== Topics ========== */
async function loadTopicsEditor() {
    topicsData = await fetchJsonc('Topics/YgoMaster.json');
    document.getElementById('topicsBannerTitle').value = topicsData.banner?.prefArgsJson?.Title || '';
    document.getElementById('topicsBannerImage').value = topicsData.banner?.prefArgsJson?.BackImage || '';
    const contents = topicsData.body?.contents || [];
    document.getElementById('topicsContents').value = contents.map(block => {
        const text = block.text?.en_US || '';
        return `[${block.tp}]\n${text}`;
    }).join('\n\n---\n\n');
    document.getElementById('topicsStatus').textContent = 'Topics: Loaded';
    document.getElementById('topicsStatus').className = 'status-item loaded';
}

async function saveTopicsEditor() {
    if (!topicsData) await loadTopicsEditor();
    topicsData.banner = topicsData.banner || {};
    topicsData.banner.prefArgsJson = topicsData.banner.prefArgsJson || {};
    topicsData.banner.prefArgsJson.Title = document.getElementById('topicsBannerTitle').value;
    topicsData.banner.prefArgsJson.BackImage = document.getElementById('topicsBannerImage').value;

    const chunks = document.getElementById('topicsContents').value.split(/\n\s*---\s*\n/);
    const contents = [];
    chunks.forEach(chunk => {
        const lines = chunk.trim().split('\n');
        if (!lines.length || !lines[0]) return;
        const m = lines[0].match(/^\[([^\]]+)\]/);
        const tp = m ? m[1] : 'Text';
        const text = (m ? lines.slice(1) : lines).join('\n').trim();
        const block = { tp, text: { en_US: text } };
        if (tp === 'Text') block.indent = -1;
        contents.push(block);
    });
    topicsData.body = topicsData.body || {};
    topicsData.body.contents = contents;
    await saveToServer('Topics/YgoMaster.json', topicsData);
}

/* ========== Init ========== */
async function initExtraTools() {
    try { await refreshDeckBrowserList(); } catch (e) { console.warn(e); }
    try { enhanceCosmeticsPickers(); } catch (e) { console.warn(e); }
    try { await loadCardPoolEditor(); } catch (e) { console.warn(e); }
    try { await loadTopicsEditor(); } catch (e) { console.warn(e); }
    try { await refreshBackups(); } catch (e) { console.warn(e); }
    try { renderRewardVisualizer(); } catch (e) { console.warn(e); }
}

// Improve existing item selects after ItemID loads
const _origPopulateItemSelects = typeof populateItemSelects === 'function' ? populateItemSelects : null;
window.populateItemSelects = function () {
    if (_origPopulateItemSelects) _origPopulateItemSelects();
    enhanceCosmeticsPickers();
};
