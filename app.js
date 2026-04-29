const DATASETS = {
  cards: {
    label: "Cards",
    file: "cards.json",
    title: "Magic Cards, passives, items, and curses",
    searchable: ["en_name", "id", "cn_name", "en_description", "cn_description", "hero_en", "kind_en", "icon"],
    hero: true,
    type: true,
    render: renderCard,
  },
  items: {
    label: "Items",
    file: "items.json",
    title: "Items and artifacts",
    searchable: ["en_name", "id", "cn_name", "en_description", "cn_description", "icon"],
    render: renderItem,
  },
  events: {
    label: "Event Text",
    file: "event_text.json",
    title: "Dialogue and event text",
    searchable: ["display_event", "en_text", "cn_text", "en_talker", "cn_talker", "en_npc", "cn_npc", "rule_en", "internal_event_id"],
    render: renderEvent,
  },
  destructibles: {
    label: "Destructibles",
    file: "destructibles.json",
    title: "Scene destructibles and breakable objects",
    searchable: ["en_name", "id", "cn_name", "en_type", "type_cn", "hit_effect", "destroy_effect"],
    render: renderDestructible,
  },
  missing: {
    label: "Missing Text",
    file: "untranslated_terms.json",
    title: "Untranslated or not-yet-finalized text",
    searchable: ["category", "cn_text", "suggested_en", "first_seen_id"],
    render: renderMissing,
  },
};

const MAX_VISIBLE = 240;
const state = {
  active: "cards",
  data: {},
  query: "",
  hero: "all",
  type: "all",
};

const tabs = document.querySelector("#tabs");
const searchInput = document.querySelector("#searchInput");
const heroFilter = document.querySelector("#heroFilter");
const typeFilter = document.querySelector("#typeFilter");
const stats = document.querySelector("#stats");
const results = document.querySelector("#results");
const resultTitle = document.querySelector("#resultTitle");
const resultCount = document.querySelector("#resultCount");
const datasetLabel = document.querySelector("#datasetLabel");
const template = document.querySelector("#cardTemplate");

init().catch((error) => {
  results.innerHTML = `<div class="empty">Failed to load data: ${escapeHtml(error.message)}</div>`;
});

async function init() {
  renderTabs();
  bindEvents();

  const entries = await Promise.all(
    Object.entries(DATASETS).map(async ([key, spec]) => {
      const response = await fetch(`./data/${spec.file}`);
      if (!response.ok) throw new Error(`${spec.file} ${response.status}`);
      return [key, await response.json()];
    }),
  );

  state.data = Object.fromEntries(entries);
  renderStats();
  refreshFilters();
  render();
}

function renderTabs() {
  tabs.innerHTML = Object.entries(DATASETS)
    .map(([key, spec]) => `<button class="tab ${key === state.active ? "active" : ""}" data-tab="${key}">${spec.label}</button>`)
    .join("");
}

function bindEvents() {
  tabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-tab]");
    if (!button) return;
    state.active = button.dataset.tab;
    state.hero = "all";
    state.type = "all";
    renderTabs();
    refreshFilters();
    render();
  });

  searchInput.addEventListener("input", () => {
    state.query = searchInput.value.trim().toLowerCase();
    render();
  });

  heroFilter.addEventListener("change", () => {
    state.hero = heroFilter.value;
    render();
  });

  typeFilter.addEventListener("change", () => {
    state.type = typeFilter.value;
    render();
  });
}

function renderStats() {
  const cards = state.data.cards?.length ?? 0;
  const items = state.data.items?.length ?? 0;
  const events = state.data.events?.length ?? 0;
  const destructibles = state.data.destructibles?.length ?? 0;
  stats.innerHTML = [
    stat("Cards", cards),
    stat("Items", items),
    stat("Event Text", events),
    stat("Destructibles", destructibles),
  ].join("");
}

function stat(label, value) {
  return `<div class="stat"><strong>${formatNumber(value)}</strong><span>${label}</span></div>`;
}

function refreshFilters() {
  const spec = DATASETS[state.active];
  const rows = state.data[state.active] ?? [];

  heroFilter.disabled = !spec.hero;
  typeFilter.disabled = !spec.type;

  fillSelect(heroFilter, "All heroes", unique(rows.map((row) => row.hero_en).filter(Boolean)));
  fillSelect(typeFilter, "All types", unique(rows.map((row) => row.kind_en).filter(Boolean)));
}

function fillSelect(select, label, values) {
  select.innerHTML = [`<option value="all">${label}</option>`, ...values.map((value) => `<option value="${escapeHtml(value)}">${escapeHtml(value)}</option>`)].join("");
  select.value = "all";
}

function render() {
  const spec = DATASETS[state.active];
  const rows = filterRows(state.data[state.active] ?? [], spec);
  datasetLabel.textContent = spec.label;
  resultTitle.textContent = spec.title;
  resultCount.textContent = `${formatNumber(rows.length)} result${rows.length === 1 ? "" : "s"}`;

  if (rows.length === 0) {
    results.innerHTML = `<div class="empty">No rows match the current search.</div>`;
    return;
  }

  const visible = rows.slice(0, MAX_VISIBLE);
  results.innerHTML = visible.map((row) => spec.render(row)).join("");

  if (rows.length > MAX_VISIBLE) {
    results.insertAdjacentHTML(
      "beforeend",
      `<div class="empty">Showing first ${MAX_VISIBLE} of ${formatNumber(rows.length)} results. Use search or filters to narrow this down.</div>`,
    );
  }
}

function filterRows(rows, spec) {
  return rows.filter((row) => {
    if (spec.hero && state.hero !== "all" && row.hero_en !== state.hero) return false;
    if (spec.type && state.type !== "all" && row.kind_en !== state.type) return false;
    if (!state.query) return true;
    return spec.searchable.some((field) => String(row[field] ?? "").toLowerCase().includes(state.query));
  });
}

function renderCard(row) {
  return baseCard({
    className: heroClass(row.hero_en),
    badge: [row.hero_en, row.kind_en].filter(Boolean).join(" / ") || "Card",
    id: row.id,
    title: row.en_name,
    subtitle: row.cn_name,
    description: row.en_description || row.cn_description,
    meta: [
      ["Rarity", row.rarity],
      ["Item Lv", row.item_level],
      ["Icon", row.icon],
      ["Obtainable", row.obtainable],
      ["CN Type", row.kind_cn],
      ["CN Hero", row.hero_cn],
    ],
  });
}

function renderItem(row) {
  return baseCard({
    badge: `Item Lv ${row.item_level || "?"}`,
    id: row.id,
    title: row.en_name,
    subtitle: row.cn_name,
    description: row.en_description || row.cn_description,
    meta: [
      ["Rarity", row.rarity],
      ["Icon", row.icon],
      ["Obtainable", row.obtainable],
      ["Shop", row.shop_unlock],
    ],
  });
}

function renderEvent(row) {
  return baseCard({
    badge: row.rule_en || "Event",
    id: row.internal_event_id,
    title: row.display_event,
    subtitle: [row.en_talker, row.en_npc].filter(Boolean).join(" / "),
    description: row.en_text || row.cn_text,
    meta: [
      ["Talker CN", row.cn_talker],
      ["NPC CN", row.cn_npc],
      ["Context", row.scene || row.status],
      ["Actions", row.event_actions],
    ],
  });
}

function renderDestructible(row) {
  return baseCard({
    badge: row.en_type || row.type_cn || "Object",
    id: row.id,
    title: row.en_name,
    subtitle: row.cn_name,
    description: `HP ${row.hp || "?"}. Slash ${row.slash_efficiency || "?"}, strike ${row.strike_efficiency || "?"}, bullet ${row.bullet_efficiency || "?"}.`,
    meta: [
      ["Blocks Path", row.blocks_path],
      ["Blocks Bullets", row.blocks_bullets],
      ["Indestructible", row.indestructible],
      ["Phases", row.phases],
      ["Destroy FX", row.destroy_effect],
    ],
  });
}

function renderMissing(row) {
  return baseCard({
    badge: row.category,
    id: row.first_seen_id,
    title: row.cn_text,
    subtitle: row.suggested_en ? `Suggested: ${row.suggested_en}` : "No English text yet",
    description: `Appears ${row.count} time${Number(row.count) === 1 ? "" : "s"} in the export.`,
    meta: [["First Seen", row.first_seen_id]],
  });
}

function baseCard({ className = "", badge = "", id = "", title = "", subtitle = "", description = "", meta = [] }) {
  const node = template.content.firstElementChild.cloneNode(true);
  if (className) node.classList.add(className);
  node.querySelector(".badge").textContent = badge;
  node.querySelector(".id-label").textContent = id;
  node.querySelector("h3").textContent = title || "(Untitled)";
  node.querySelector(".subname").textContent = subtitle || "";
  node.querySelector(".description").textContent = description || "";

  const metaNode = node.querySelector(".meta");
  metaNode.innerHTML = meta
    .filter(([, value]) => value !== undefined && value !== null && value !== "")
    .map(([label, value]) => `<div><dt>${escapeHtml(label)}</dt><dd>${escapeHtml(value)}</dd></div>`)
    .join("");

  return node.outerHTML;
}

function heroClass(hero) {
  return String(hero || "").toLowerCase();
}

function unique(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b));
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US").format(value);
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
