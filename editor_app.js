/* Extended YgoMaster Data editors: Settings, Custom Duel, Shop, Structure, Campaign, Banlist */

let settingsData = null;
let customDuelData = null;
let shopData = null;
let shopOddsData = null;
let structureDeckData = null;
let currentStructureId = null;
let regulationInfo = null;
let banlistData = null;
let currentBanlistId = null;
let currentBanlistSource = null; // 'Regulation.json' | 'Regulation.d/xxxx.json'
let structureDeckMode = false;

async function apiPost(route, body) {
    const response = await fetch(`${workingDirectory}${route}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    const data = await response.json();
    if (!response.ok || !data.ok) {
        throw new Error(data.error || response.statusText);
    }
    return data;
}

async function saveToServer(path, content, { downloadFallback = true } = {}) {
    try {
        await apiPost('/api/save', { path, content });
        notify(`Saved ${path}`, 'success');
        return true;
    } catch (error) {
        console.error('Save failed:', error);
        if (downloadFallback) {
            const text = typeof content === 'string' ? content : JSON.stringify(content, null, 2);
            const blob = new Blob([text], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = path.split('/').pop();
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            notify(`Server save failed (${error.message}). Downloaded ${path} instead.`, 'error');
        } else {
            notify(`Save failed: ${error.message}`, 'error');
        }
        return false;
    }
}

async function loadJsonc(path) {
    const result = await apiPost('/api/load', { path });
    return result.data;
}

async function listDir(path) {
    const result = await apiPost('/api/list', { path });
    return result;
}

function parseJsoncText(text) {
    let cleaned = text.replace(/\/\*[\s\S]*?\*\//g, '');
    cleaned = cleaned.replace(/^\s*\/\/.*$/gm, '');
    cleaned = cleaned.replace(/(^|[^:])\/\/[^\n]*/g, '$1');
    cleaned = cleaned.replace(/,(\s*[\]}])/g, '$1');
    const decoder = new (class {
        decode(s) {
            return JSON.parse(s);
        }
    })();
    try {
        return JSON.parse(cleaned);
    } catch (e) {
        // Handle trailing junk after first object
        const match = cleaned.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
        if (!match) throw e;
        return JSON.parse(match[0]);
    }
}

async function fetchJsonc(path) {
    try {
        return await loadJsonc(path);
    } catch (apiError) {
        console.warn(`api/load failed for ${path}, falling back to fetch`, apiError);
        const response = await fetch(`${workingDirectory}/${path}`);
        if (!response.ok) throw new Error(`Failed to load ${path}`);
        const text = await response.text();
        return parseJsoncText(text);
    }
}

function notify(message, type = 'success') {
    let el = document.getElementById('toastMessage');
    if (!el) {
        el = document.createElement('div');
        el.id = 'toastMessage';
        el.className = 'toast';
        document.body.appendChild(el);
    }
    el.textContent = message;
    el.className = `toast ${type}`;
    el.style.display = 'block';
    clearTimeout(notify._timer);
    notify._timer = setTimeout(() => {
        el.style.display = 'none';
    }, 3500);
}

/* ========== Settings ========== */
const SETTINGS_TOGGLES = [
    ['UnlockAllCards', 'Unlock all cards (Normal)'],
    ['UnlockAllCardsShine', 'Unlock all cards (Shine)'],
    ['UnlockAllCardsHighestRarity', 'Unlock all cards (highest rarity)'],
    ['UnlockAllItems', 'Unlock all items'],
    ['UnlockAllSoloChapters', 'Unlock all Solo chapters'],
    ['DisableBanList', 'Disable banlist'],
    ['DisableDeckValidation', 'Disable deck validation'],
    ['CardCraftableAll', 'All cards craftable'],
    ['SoloDisableNoShuffle', 'Solo disable no-shuffle'],
    ['SoloRewardsInDuelResult', 'Solo rewards in duel result'],
    ['ShowTopics', 'Show topics'],
    ['MultiplayerEnabled', 'Multiplayer enabled']
];

async function loadSettingsEditor() {
    settingsData = await fetchJsonc('Settings.json');
    const root = document.getElementById('settingsToggles');
    root.innerHTML = '';
    SETTINGS_TOGGLES.forEach(([key, label]) => {
        const wrap = document.createElement('label');
        wrap.className = 'check-row';
        wrap.innerHTML = `<input type="checkbox" data-setting="${key}" ${settingsData[key] ? 'checked' : ''}> ${label}`;
        root.appendChild(wrap);
    });
    document.getElementById('settingsDefaultGems').value = settingsData.DefaultGems ?? 0;
    document.getElementById('settingsDeckSlots').value = settingsData.DeckSlots ?? 20;
    document.getElementById('settingsBookmarkLimit').value = settingsData.BookmarkLimit ?? 20;
    const craft = settingsData.Craft?.Craft || {};
    document.getElementById('craftN').value = craft.Normal?.Normal ?? 30;
    document.getElementById('craftR').value = craft.Rare?.Normal ?? 30;
    document.getElementById('craftSR').value = craft.SuperRare?.Normal ?? 30;
    document.getElementById('craftUR').value = craft.UltraRare?.Normal ?? 30;
    document.getElementById('settingsStatus').textContent = 'Settings.json: Loaded';
    document.getElementById('settingsStatus').className = 'status-item loaded';
}

async function saveSettingsEditor() {
    if (!settingsData) await loadSettingsEditor();
    SETTINGS_TOGGLES.forEach(([key]) => {
        const input = document.querySelector(`[data-setting="${key}"]`);
        if (input) settingsData[key] = input.checked;
    });
    settingsData.DefaultGems = parseInt(document.getElementById('settingsDefaultGems').value, 10) || 0;
    settingsData.DeckSlots = parseInt(document.getElementById('settingsDeckSlots').value, 10) || 20;
    settingsData.BookmarkLimit = parseInt(document.getElementById('settingsBookmarkLimit').value, 10) || 20;
    settingsData.Craft = settingsData.Craft || {};
    settingsData.Craft.Craft = settingsData.Craft.Craft || {};
    const map = [
        ['Normal', 'craftN'],
        ['Rare', 'craftR'],
        ['SuperRare', 'craftSR'],
        ['UltraRare', 'craftUR']
    ];
    map.forEach(([rarity, id]) => {
        settingsData.Craft.Craft[rarity] = settingsData.Craft.Craft[rarity] || {};
        settingsData.Craft.Craft[rarity].Normal = parseInt(document.getElementById(id).value, 10) || 0;
    });
    await saveToServer('Settings.json', settingsData);
}

/* ========== Custom Duel ========== */
async function loadCustomDuelEditor() {
    customDuelData = await fetchJsonc('CustomDuel.json');
    const d = customDuelData;
    document.getElementById('cdPlayerName').value = d.name?.[0] ?? '';
    document.getElementById('cdCpuName').value = d.name?.[1] ?? 'CPU';
    document.getElementById('cdLifeP').value = d.life?.[0] ?? -1;
    document.getElementById('cdLifeC').value = d.life?.[1] ?? -1;
    document.getElementById('cdHandP').value = d.hnum?.[0] ?? -1;
    document.getElementById('cdHandC').value = d.hnum?.[1] ?? -1;
    document.getElementById('cdCpu').value = d.cpu ?? 100;
    document.getElementById('cdFirst').value = d.FirstPlayer ?? -1;
    document.getElementById('cdMatP').value = d.mat?.[0] ?? -1;
    document.getElementById('cdMatC').value = d.mat?.[1] ?? -1;
    document.getElementById('cdSleeveP').value = d.sleeve?.[0] ?? -1;
    document.getElementById('cdSleeveC').value = d.sleeve?.[1] ?? -1;
    document.getElementById('cdDeckP').value = d.Deck?.[0] ?? '';
    document.getElementById('cdDeckC').value = d.Deck?.[1] ?? '';
    document.getElementById('cdBgm').value = (d.bgms || []).join(', ');
    document.getElementById('cdChapter').value = d.targetChapterId ?? 10001;
    document.getElementById('customDuelStatus').textContent = 'CustomDuel.json: Loaded';
    document.getElementById('customDuelStatus').className = 'status-item loaded';
}

async function saveCustomDuelEditor() {
    if (!customDuelData) customDuelData = {};
    const num = (id) => {
        const v = document.getElementById(id).value;
        return v === '' ? -1 : parseInt(v, 10);
    };
    customDuelData.name = [
        document.getElementById('cdPlayerName').value,
        document.getElementById('cdCpuName').value
    ];
    customDuelData.life = [num('cdLifeP'), num('cdLifeC')];
    customDuelData.hnum = [num('cdHandP'), num('cdHandC')];
    customDuelData.cpu = parseInt(document.getElementById('cdCpu').value, 10) || 100;
    customDuelData.FirstPlayer = parseInt(document.getElementById('cdFirst').value, 10);
    customDuelData.mat = [num('cdMatP'), num('cdMatC')];
    customDuelData.sleeve = [num('cdSleeveP'), num('cdSleeveC')];
    customDuelData.Deck = [
        document.getElementById('cdDeckP').value,
        document.getElementById('cdDeckC').value
    ];
    customDuelData.bgms = document.getElementById('cdBgm').value.split(',').map(s => s.trim()).filter(Boolean);
    customDuelData.targetChapterId = parseInt(document.getElementById('cdChapter').value, 10) || 10001;
    await saveToServer('CustomDuel.json', customDuelData);
}

/* ========== Shop / Odds ========== */
async function loadShopEditor() {
    shopData = await fetchJsonc('Shop.json');
    shopOddsData = await fetchJsonc('ShopPackOdds.json');
    const select = document.getElementById('shopPackSelect');
    select.innerHTML = '';
    Object.keys(shopData.PackShop || {}).sort().forEach(id => {
        const pack = shopData.PackShop[id];
        const opt = document.createElement('option');
        opt.value = id;
        opt.textContent = `${id} — ${pack.nameTextId || ''}`;
        select.appendChild(opt);
    });
    document.getElementById('shopUnlockSecrets').checked = !!shopData.UnlockAllSecrets;
    document.getElementById('shopNoDupes').checked = !!shopData.NoDuplicatesPerPack;
    document.getElementById('shopAllInStandard').checked = !!shopData.PutAllCardsInStandardPack;
    populateShopPackFields();
    renderShopOdds();
    document.getElementById('shopStatus').textContent = 'Shop.json: Loaded';
    document.getElementById('shopStatus').className = 'status-item loaded';
}

function populateShopPackFields() {
    const id = document.getElementById('shopPackSelect').value;
    if (!id || !shopData?.PackShop?.[id]) return;
    const pack = shopData.PackShop[id];
    document.getElementById('shopPackCards').value = pack.pack_card_num ?? 8;
    const p1 = pack.prices?.['1']?.use_item_num ?? 100;
    const p2 = pack.prices?.['2']?.use_item_num ?? 1000;
    document.getElementById('shopPriceSingle').value = p1;
    document.getElementById('shopPriceMulti').value = p2;
    document.getElementById('shopCardList').value = (pack.cardList || []).join(', ');
}

function applyShopPackFields() {
    const id = document.getElementById('shopPackSelect').value;
    if (!id || !shopData?.PackShop?.[id]) return;
    const pack = shopData.PackShop[id];
    pack.pack_card_num = parseInt(document.getElementById('shopPackCards').value, 10) || 8;
    pack.prices = pack.prices || {};
    pack.prices['1'] = pack.prices['1'] || { price_id: 1, item_category: 1, item_id: 1, button_type: 1, buy_count: 1, sort: 1 };
    pack.prices['2'] = pack.prices['2'] || { price_id: 2, item_category: 1, item_id: 1, button_type: 2, buy_count: 1, sort: 2 };
    pack.prices['1'].use_item_num = parseInt(document.getElementById('shopPriceSingle').value, 10) || 0;
    pack.prices['2'].use_item_num = parseInt(document.getElementById('shopPriceMulti').value, 10) || 0;
    pack.cardList = document.getElementById('shopCardList').value
        .split(/[,\s]+/)
        .map(s => parseInt(s, 10))
        .filter(n => !Number.isNaN(n));
}

function renderShopOdds() {
    const root = document.getElementById('shopOddsEditor');
    if (!shopOddsData) return;
    root.innerHTML = '';
    shopOddsData.forEach((entry, idx) => {
        const box = document.createElement('div');
        box.className = 'panel-box';
        const rates = (entry.cardRateList || []).map((row, rIdx) => {
            const rate = row.rate || {};
            return `<div class="form-inline">
                <span>Pull ${row.start_num}-${row.end_num}</span>
                UR <input data-odds="${idx},${rIdx},4" value="${rate['4']?.rate ?? ''}" style="width:70px">
                SR <input data-odds="${idx},${rIdx},3" value="${rate['3']?.rate ?? ''}" style="width:70px">
                R <input data-odds="${idx},${rIdx},2" value="${rate['2']?.rate ?? ''}" style="width:70px">
                N <input data-odds="${idx},${rIdx},1" value="${rate['1']?.rate ?? ''}" style="width:70px">
            </div>`;
        }).join('');
        box.innerHTML = `<h3>Odds set #${idx} (gachaType ${entry.gachaType})</h3>${rates}`;
        root.appendChild(box);
    });
}

function applyShopOddsFields() {
    document.querySelectorAll('[data-odds]').forEach(input => {
        const [idx, rIdx, rarity] = input.dataset.odds.split(',').map(Number);
        const row = shopOddsData[idx]?.cardRateList?.[rIdx];
        if (!row) return;
        row.rate = row.rate || {};
        row.rate[String(rarity)] = row.rate[String(rarity)] || {};
        row.rate[String(rarity)].rate = input.value;
    });
}

async function saveShopEditor() {
    if (!shopData) await loadShopEditor();
    applyShopPackFields();
    applyShopOddsFields();
    shopData.UnlockAllSecrets = document.getElementById('shopUnlockSecrets').checked;
    shopData.NoDuplicatesPerPack = document.getElementById('shopNoDupes').checked;
    shopData.PutAllCardsInStandardPack = document.getElementById('shopAllInStandard').checked;
    await saveToServer('Shop.json', shopData);
    await saveToServer('ShopPackOdds.json', shopOddsData);
}

/* ========== Structure Decks ========== */
async function loadStructureDeckList() {
    const listing = await listDir('StructureDecks');
    const select = document.getElementById('structureSelect');
    select.innerHTML = '';
    listing.files.filter(f => f.endsWith('.json')).forEach(file => {
        const opt = document.createElement('option');
        opt.value = file;
        opt.textContent = file;
        select.appendChild(opt);
    });
}

async function loadStructureDeck() {
    const file = document.getElementById('structureSelect').value;
    if (!file) return;
    structureDeckData = await fetchJsonc(`StructureDecks/${file}`);
    currentStructureId = file;
    document.getElementById('sdBox').value = structureDeckData.accessory?.box ?? '';
    document.getElementById('sdSleeve').value = structureDeckData.accessory?.sleeve ?? '';
    document.getElementById('sdFocus').value = (structureDeckData.focus?.ids || []).join(', ');
    renderStructureContents();
    structureDeckMode = true;
}

function renderStructureContents() {
    const main = document.getElementById('sdMain');
    const extra = document.getElementById('sdExtra');
    main.innerHTML = '';
    extra.innerHTML = '';
    const addCards = (ids, target) => {
        (ids || []).forEach((id, index) => {
            const info = getCardInfo(id);
            const div = document.createElement('div');
            div.className = 'card-item';
            const konami = ydkMapping[id];
            div.innerHTML = `<img src="${getCardImageUrl(konami || id)}" alt="${info?.name || id}"><div class="card-count">${info?.name || id}</div>`;
            div.title = info?.name || String(id);
            div.onclick = () => {
                ids.splice(index, 1);
                if (structureDeckData.contents?.m?.r) structureDeckData.contents.m.r.splice(index, 1);
                if (structureDeckData.contents?.e?.r) structureDeckData.contents.e.r.splice(index, 1);
                renderStructureContents();
            };
            target.appendChild(div);
        });
    };
    addCards(structureDeckData.contents?.m?.ids, main);
    addCards(structureDeckData.contents?.e?.ids, extra);
    document.getElementById('sdMainCount').textContent = `${structureDeckData.contents?.m?.ids?.length || 0} cards`;
    document.getElementById('sdExtraCount').textContent = `${structureDeckData.contents?.e?.ids?.length || 0} cards`;
}

function addCardToStructure(gameId, which = 'm') {
    if (!structureDeckData) return;
    structureDeckData.contents = structureDeckData.contents || {};
    structureDeckData.contents[which] = structureDeckData.contents[which] || { ids: [], r: [] };
    structureDeckData.contents[which].ids.push(parseInt(gameId, 10));
    structureDeckData.contents[which].r.push(1);
    renderStructureContents();
}

async function saveStructureDeck() {
    if (!structureDeckData || !currentStructureId) {
        alert('Load a structure deck first');
        return;
    }
    structureDeckData.accessory = structureDeckData.accessory || {};
    structureDeckData.accessory.box = parseInt(document.getElementById('sdBox').value, 10) || 0;
    structureDeckData.accessory.sleeve = parseInt(document.getElementById('sdSleeve').value, 10) || 0;
    const focusIds = document.getElementById('sdFocus').value.split(/[,\s]+/).map(s => parseInt(s, 10)).filter(n => !Number.isNaN(n));
    structureDeckData.focus = {
        ids: focusIds,
        r: focusIds.map(() => 1)
    };
    await saveToServer(`StructureDecks/${currentStructureId}`, structureDeckData);
}

/* ========== Campaign tools ========== */
function getSoloMaster() {
    return soloData?.res?.[0]?.[1]?.Master?.Solo;
}

async function cloneGate() {
    const master = getSoloMaster();
    if (!master) return alert('Solo.json not loaded');
    const sourceId = document.getElementById('cloneGateSource').value;
    const targetId = document.getElementById('cloneGateTarget').value;
    if (!sourceId || !targetId) return alert('Enter source and target gate IDs');
    if (!master.gate[sourceId]) return alert('Source gate not found');
    if (master.gate[targetId]) return alert('Target gate already exists');

    master.gate[targetId] = JSON.parse(JSON.stringify(master.gate[sourceId]));
    master.chapter[targetId] = {};

    const srcChapters = master.chapter[sourceId] || {};
    const idMap = {};
    const base = parseInt(targetId, 10) * 10000;
    let i = 1;
    for (const oldId of Object.keys(srcChapters)) {
        const newId = String(base + i);
        idMap[oldId] = newId;
        i += 1;
    }

    for (const [oldId, chapter] of Object.entries(srcChapters)) {
        const copy = JSON.parse(JSON.stringify(chapter));
        const newId = idMap[oldId];
        if (copy.parent_chapter && idMap[copy.parent_chapter]) {
            copy.parent_chapter = parseInt(idMap[copy.parent_chapter], 10);
        }
        master.chapter[targetId][newId] = copy;

        // Clone duel file if present
        try {
            const duel = await fetchJsonc(`SoloDuels/${oldId}.json`);
            if (duel?.res?.[0]?.[1]?.Duel) {
                duel.res[0][1].Duel.chapter = parseInt(newId, 10);
            }
            await saveToServer(`SoloDuels/${newId}.json`, duel, { downloadFallback: false });
        } catch (_) {
            // no duel file
        }
    }

    if (master.gate[targetId].clear_chapter && idMap[master.gate[targetId].clear_chapter]) {
        master.gate[targetId].clear_chapter = parseInt(idMap[master.gate[targetId].clear_chapter], 10);
    }

    updateLists();
    await saveToServer('Solo.json', soloData);
    notify(`Cloned gate ${sourceId} -> ${targetId}`, 'success');
}

async function bulkSetRewards() {
    const master = getSoloMaster();
    if (!master) return alert('Solo.json not loaded');
    const gateId = document.getElementById('bulkGateId').value;
    const itemCat = document.getElementById('bulkItemCat').value || '1';
    const itemId = document.getElementById('bulkItemId').value || '1';
    const amount = parseInt(document.getElementById('bulkAmount').value, 10) || 50;
    if (!gateId || !master.chapter[gateId]) return alert('Gate not found');

    for (const chapterId of Object.keys(master.chapter[gateId])) {
        const setId = master.chapter[gateId][chapterId].set_id;
        if (!setId) continue;
        master.reward = master.reward || {};
        master.reward[String(setId)] = { [itemCat]: { [itemId]: amount } };
    }
    updateLists();
    await saveToServer('Solo.json', soloData);
    notify(`Updated rewards for gate ${gateId}`, 'success');
}

function parseYdk(text) {
    const main = [];
    const extra = [];
    const side = [];
    let mode = 'main';
    text.split(/\r?\n/).forEach(line => {
        line = line.trim();
        if (!line || line.startsWith('#') && !line.startsWith('#main') && !line.startsWith('#extra')) {
            if (line.toLowerCase() === '#main') mode = 'main';
            if (line.toLowerCase() === '#extra') mode = 'extra';
            return;
        }
        if (line.toLowerCase() === '#main') { mode = 'main'; return; }
        if (line.toLowerCase() === '#extra') { mode = 'extra'; return; }
        if (line.toLowerCase() === '!side') { mode = 'side'; return; }
        if (!/^\d+$/.test(line)) return;
        const konamiId = line;
        // reverse map: konami -> game id
        let gameId = null;
        for (const [g, k] of Object.entries(ydkMapping)) {
            if (String(k) === String(konamiId)) {
                gameId = parseInt(g, 10);
                break;
            }
        }
        if (!gameId) return;
        if (mode === 'main') main.push(gameId);
        else if (mode === 'extra') extra.push(gameId);
        else side.push(gameId);
    });
    return { main, extra, side };
}

async function importYdkToChapter() {
    const chapterId = document.getElementById('ydkChapterId').value;
    const target = document.getElementById('ydkTarget').value; // player|cpu
    const fileInput = document.getElementById('ydkFile');
    if (!chapterId) return alert('Enter chapter ID');
    if (!fileInput.files?.length) return alert('Choose a .ydk file');

    const text = await fileInput.files[0].text();
    const parsed = parseYdk(text);
    let duel;
    try {
        duel = await fetchJsonc(`SoloDuels/${chapterId}.json`);
    } catch {
        alert('Could not load SoloDuels/' + chapterId + '.json');
        return;
    }
    const idx = target === 'cpu' ? 1 : 0;
    duel.res[0][1].Duel.Deck = duel.res[0][1].Duel.Deck || [{}, {}];
    duel.res[0][1].Duel.Deck[idx] = {
        Main: { CardIds: parsed.main, Rare: parsed.main.map(() => 1) },
        Extra: { CardIds: parsed.extra, Rare: parsed.extra.map(() => 1) },
        Side: { CardIds: parsed.side, Rare: parsed.side.map(() => 1) }
    };
    await saveToServer(`SoloDuels/${chapterId}.json`, duel);
    notify(`Imported YDK into chapter ${chapterId} (${target})`, 'success');
}

/* ========== Banlist ========== */
async function loadBanlistEditor() {
    regulationInfo = await fetchJsonc('RegulationInfo.json');
    const listing = await listDir('Regulation.d');
    const select = document.getElementById('banlistSelect');
    select.innerHTML = '';

    Object.entries(regulationInfo.rule_list || {}).forEach(([id, name]) => {
        const opt = document.createElement('option');
        opt.value = `reg:${id}`;
        opt.textContent = `${id} — ${name}`;
        select.appendChild(opt);
    });

    listing.files.filter(f => f.endsWith('.json')).forEach(file => {
        const opt = document.createElement('option');
        opt.value = `file:${file}`;
        opt.textContent = `Custom: ${file}`;
        select.appendChild(opt);
    });
}

async function loadSelectedBanlist() {
    const value = document.getElementById('banlistSelect').value;
    if (!value) return;
    if (value.startsWith('reg:')) {
        const id = value.slice(4);
        const all = await fetchJsonc('Regulation.json');
        banlistData = all[id];
        currentBanlistId = id;
        currentBanlistSource = 'Regulation.json';
    } else {
        const file = value.slice(5);
        banlistData = await fetchJsonc(`Regulation.d/${file}`);
        currentBanlistId = file;
        currentBanlistSource = `Regulation.d/${file}`;
    }
    const lists = banlistData.banlist || banlistData.available || { a0: [], a1: [], a2: [], a3: [] };
    if (typeof applyBanlistListsFromData === 'function') {
        applyBanlistListsFromData(lists);
    } else {
        document.getElementById('banForbidden').value = (lists.a0 || []).join(', ');
        document.getElementById('banLimited').value = (lists.a1 || []).join(', ');
        document.getElementById('banSemi').value = (lists.a2 || []).join(', ');
        document.getElementById('banUnlimited').value = (lists.a3 || []).join(', ');
    }
    document.getElementById('banlistStatus').textContent = `Banlist: ${currentBanlistSource}`;
    document.getElementById('banlistStatus').className = 'status-item loaded';
}

function parseIdList(text) {
    return text.split(/[,\s]+/).map(s => parseInt(s, 10)).filter(n => !Number.isNaN(n));
}

async function saveBanlistEditor() {
    if (!banlistData || !currentBanlistSource) return alert('Load a banlist first');
    if (typeof syncBanlistHiddenFields === 'function') syncBanlistHiddenFields();
    const lists = (typeof banlistLists !== 'undefined' && banlistLists)
        ? {
            a0: [...(banlistLists.a0 || [])],
            a1: [...(banlistLists.a1 || [])],
            a2: [...(banlistLists.a2 || [])],
            a3: [...(banlistLists.a3 || [])]
        }
        : {
            a0: parseIdList(document.getElementById('banForbidden').value),
            a1: parseIdList(document.getElementById('banLimited').value),
            a2: parseIdList(document.getElementById('banSemi').value),
            a3: parseIdList(document.getElementById('banUnlimited').value)
        };

    if (currentBanlistSource === 'Regulation.json') {
        const all = await fetchJsonc('Regulation.json');
        all[currentBanlistId] = all[currentBanlistId] || { require: { r1: [], r2: [], r3: [] }, available: {} };
        all[currentBanlistId].available = lists;
        await saveToServer('Regulation.json', all);
    } else {
        if (banlistData.banlist) banlistData.banlist = lists;
        else banlistData.available = lists;
        await saveToServer(currentBanlistSource, banlistData);
    }
}

async function createCustomBanlist() {
    const id = parseInt(document.getElementById('newBanlistId').value, 10);
    const name = document.getElementById('newBanlistName').value || `Custom ${id}`;
    if (!id) return alert('Enter a regulation ID (e.g. 9000)');
    const payload = {
        regulation_id: id,
        name,
        regulation_icon: { icon: 'RegulationLogoStandard' },
        require: { r1: [], r2: [], r3: [] },
        banlist: { a0: [], a1: [], a2: [], a3: [] }
    };
    const file = `${id}_${name.replace(/[^\w]+/g, '_')}.json`;
    await saveToServer(`Regulation.d/${file}`, payload);
    await loadBanlistEditor();
    document.getElementById('banlistSelect').value = `file:${file}`;
    await loadSelectedBanlist();
}

/* ========== Init / wiring ========== */
async function initExtendedEditors() {
    try {
        await loadSettingsEditor();
    } catch (e) { console.warn(e); }
    try {
        if (typeof enhanceCosmeticsPickers === 'function') enhanceCosmeticsPickers();
        await loadCustomDuelEditor();
    } catch (e) { console.warn(e); }
    try {
        await loadShopEditor();
    } catch (e) { console.warn(e); }
    try {
        await loadStructureDeckList();
    } catch (e) { console.warn(e); }
    try {
        await loadBanlistEditor();
    } catch (e) { console.warn(e); }
    if (typeof initExtraTools === 'function') {
        try {
            await initExtraTools();
        } catch (e) { console.warn(e); }
    }
}

// Hook structure search into existing card search when on Structure tab
const _origAddCard = typeof addCard === 'function' ? addCard : null;
window.addCardFromSearch = function (gameId) {
    const active = document.querySelector('.section.active');
    if (active && active.id === 'structure' && structureDeckData) {
        const which = document.getElementById('sdAddTarget')?.value || 'm';
        addCardToStructure(gameId, which);
        return;
    }
    if (_origAddCard) _origAddCard(currentDeckType, gameId);
};
