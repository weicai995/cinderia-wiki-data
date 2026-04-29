const DATASETS = {
  cards: {
    label: "Cards",
    file: "cards.json",
    title: "Magic Cards and passive abilities",
    searchable: ["en_name", "id", "cn_name", "base_en_name", "base_id", "base_cn_name", "en_description", "cn_description", "hero_en", "kind_en", "icon"],
    tableFields: ["base_en_name", "en_name", "id", "cn_name", "hero_en", "kind_en", "rarity", "item_level", "icon", "en_description"],
    hero: true,
    type: true,
    render: renderCard,
  },
  items: {
    label: "Items",
    file: "items.json",
    title: "Items and artifacts",
    searchable: ["en_name", "id", "cn_name", "base_en_name", "base_id", "base_cn_name", "en_description", "cn_description", "icon"],
    tableFields: ["base_en_name", "en_name", "id", "cn_name", "item_level", "rarity", "icon", "obtainable", "en_description"],
    render: renderItem,
  },
  curses: {
    label: "Curses",
    file: "curses.json",
    title: "Curses and blessings",
    searchable: ["en_name", "id", "cn_name", "base_en_name", "base_id", "base_cn_name", "en_description", "cn_description", "icon"],
    tableFields: ["base_en_name", "en_name", "id", "cn_name", "item_level", "rarity", "icon", "obtainable", "en_description"],
    render: renderCurse,
  },
  events: {
    label: "Event Text",
    file: "event_text.json",
    title: "Dialogue and event text",
    searchable: ["display_event", "en_text", "cn_text", "en_talker", "cn_talker", "en_npc", "cn_npc", "rule_en", "internal_event_id"],
    tableFields: ["display_event", "en_text", "cn_text", "en_talker", "en_npc", "rule_en", "scene", "internal_event_id"],
    render: renderEvent,
  },
  destructibles: {
    label: "Destructibles",
    file: "destructibles.json",
    title: "Scene destructibles and breakable objects",
    searchable: ["en_name", "id", "cn_name", "en_type", "type_cn", "hit_effect", "destroy_effect"],
    tableFields: ["en_name", "id", "en_type", "hp", "blocks_path", "blocks_bullets", "slash_efficiency", "strike_efficiency", "bullet_efficiency", "destroy_effect"],
    render: renderDestructible,
  },
  missing: {
    label: "Missing Text",
    file: "untranslated_terms.json",
    title: "Untranslated or not-yet-finalized text",
    searchable: ["category", "cn_text", "suggested_en", "first_seen_id"],
    tableFields: ["category", "cn_text", "suggested_en", "count", "first_seen_id"],
    render: renderMissing,
  },
};

const BUILD_VERSION = "20260429-base-name";

const state = {
  active: "cards",
  data: {},
  query: "",
  hero: "all",
  type: "all",
  view: "cards",
  page: 1,
  pageSize: 25,
};

const tabs = document.querySelector("#tabs");
const searchInput = document.querySelector("#searchInput");
const heroFilter = document.querySelector("#heroFilter");
const typeFilter = document.querySelector("#typeFilter");
const viewMode = document.querySelector("#viewMode");
const pageSize = document.querySelector("#pageSize");
const stats = document.querySelector("#stats");
const results = document.querySelector("#results");
const pagination = document.querySelector("#pagination");
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
      const response = await fetch(`./data/${spec.file}?v=${BUILD_VERSION}`);
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
    state.page = 1;
    renderTabs();
    refreshFilters();
    render();
  });

  searchInput.addEventListener("input", () => {
    state.query = searchInput.value.trim().toLowerCase();
    state.page = 1;
    render();
  });

  heroFilter.addEventListener("change", () => {
    state.hero = heroFilter.value;
    state.page = 1;
    render();
  });

  typeFilter.addEventListener("change", () => {
    state.type = typeFilter.value;
    state.page = 1;
    render();
  });

  viewMode.addEventListener("change", () => {
    state.view = viewMode.value;
    state.page = 1;
    render();
  });

  pageSize.addEventListener("change", () => {
    state.pageSize = Number(pageSize.value);
    state.page = 1;
    render();
  });

  pagination.addEventListener("click", (event) => {
    const button = event.target.closest("[data-page]");
    if (!button) return;
    state.page = Number(button.dataset.page);
    render();
    document.querySelector(".results-head")?.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  results.addEventListener("click", (event) => {
    const button = event.target.closest(".expand-toggle");
    if (!button) return;

    const card = button.closest(".data-card");
    const expanded = card.classList.toggle("expanded");
    button.textContent = expanded ? "Collapse text" : "Show full text";
  });
}

function renderStats() {
  const cards = state.data.cards?.length ?? 0;
  const items = state.data.items?.length ?? 0;
  const curses = state.data.curses?.length ?? 0;
  const events = state.data.events?.length ?? 0;
  const destructibles = state.data.destructibles?.length ?? 0;
  stats.innerHTML = [
    stat("Cards", cards),
    stat("Items", items),
    stat("Curses", curses),
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
  const totalPages = Math.max(1, Math.ceil(rows.length / state.pageSize));
  state.page = Math.min(Math.max(1, state.page), totalPages);
  const start = (state.page - 1) * state.pageSize;
  const visible = rows.slice(start, start + state.pageSize);
  datasetLabel.textContent = spec.label;
  resultTitle.textContent = spec.title;
  resultCount.textContent = rows.length
    ? `${formatNumber(start + 1)}-${formatNumber(start + visible.length)} of ${formatNumber(rows.length)} results`
    : "0 results";

  if (rows.length === 0) {
    results.innerHTML = `<div class="empty">No rows match the current search.</div>`;
    pagination.innerHTML = "";
    return;
  }

  results.className = state.view === "table" ? "table-results" : "grid";
  results.innerHTML = state.view === "table"
    ? renderTable(visible, spec)
    : visible.map((row) => spec.render(row)).join("");
  renderPagination(totalPages);
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
      ["Base", row.base_en_name],
      ["Base ID", row.base_id],
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
      ["Base", row.base_en_name],
      ["Base ID", row.base_id],
      ["Rarity", row.rarity],
      ["Icon", row.icon],
      ["Obtainable", row.obtainable],
      ["Shop", row.shop_unlock],
    ],
  });
}

function renderCurse(row) {
  return baseCard({
    badge: `Curse / Blessing${row.item_level ? ` Lv ${row.item_level}` : ""}`,
    id: row.id,
    title: row.en_name,
    subtitle: row.cn_name,
    description: row.en_description || row.cn_description,
    meta: [
      ["Base", row.base_en_name],
      ["Base ID", row.base_id],
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

function renderTable(rows, spec) {
  const fields = spec.tableFields ?? spec.searchable;
  return `
    <div class="table-wrap">
      <table>
        <thead>
          <tr>${fields.map((field) => `<th>${escapeHtml(labelFor(field))}</th>`).join("")}</tr>
        </thead>
        <tbody>
          ${rows.map((row) => renderTableRow(row, fields)).join("")}
        </tbody>
      </table>
    </div>
  `;
}

function renderTableRow(row, fields) {
  const hero = heroClass(row.hero_en);
  return `<tr class="${hero ? `row-${hero}` : ""}">${fields.map((field) => `<td>${escapeHtml(row[field] ?? "")}</td>`).join("")}</tr>`;
}

function renderPagination(totalPages) {
  if (totalPages <= 1) {
    pagination.innerHTML = "";
    return;
  }

  const pages = paginationWindow(state.page, totalPages);
  pagination.innerHTML = `
    <button ${state.page === 1 ? "disabled" : ""} data-page="${state.page - 1}">Previous</button>
    ${pages.map((page) => page === "..." ? `<span>...</span>` : `<button class="${page === state.page ? "active" : ""}" data-page="${page}">${page}</button>`).join("")}
    <button ${state.page === totalPages ? "disabled" : ""} data-page="${state.page + 1}">Next</button>
  `;
}

function paginationWindow(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, index) => index + 1);
  const pages = new Set([1, 2, total - 1, total, current - 1, current, current + 1]);
  const sorted = [...pages].filter((page) => page >= 1 && page <= total).sort((a, b) => a - b);
  const result = [];
  for (const page of sorted) {
    const previous = result[result.length - 1];
    if (typeof previous === "number" && page - previous > 1) result.push("...");
    result.push(page);
  }
  return result;
}

function labelFor(field) {
  const labels = {
    en_name: "English Name",
    base_en_name: "Base English Name",
    base_id: "Base ID",
    base_cn_name: "Base Chinese Name",
    id: "Internal ID",
    cn_name: "Chinese Name",
    en_description: "English Description",
    display_event: "Display Event",
    en_text: "English Text",
    cn_text: "Chinese Text",
    en_talker: "Talker",
    en_npc: "NPC",
    rule_en: "Rule",
    scene: "Scene",
    internal_event_id: "Internal Event ID",
    hero_en: "Hero",
    kind_en: "Type",
    item_level: "Item Lv",
    en_type: "Type",
    blocks_path: "Blocks Path",
    blocks_bullets: "Blocks Bullets",
    slash_efficiency: "Slash",
    strike_efficiency: "Strike",
    bullet_efficiency: "Bullet",
    destroy_effect: "Destroy FX",
    suggested_en: "Suggested EN",
    first_seen_id: "First Seen ID",
  };
  return labels[field] ?? field.replaceAll("_", " ");
}

function baseCard({ className = "", badge = "", id = "", title = "", subtitle = "", description = "", meta = [] }) {
  const node = template.content.firstElementChild.cloneNode(true);
  const descriptionText = String(description || "");
  const canExpand = descriptionText.length > 190 || descriptionText.includes("\n");

  if (className) node.classList.add(className);
  node.querySelector(".badge").textContent = badge;
  node.querySelector(".id-label").textContent = id;
  node.querySelector("h3").textContent = title || "(Untitled)";
  node.querySelector(".subname").textContent = subtitle || "";
  node.querySelector(".description").textContent = descriptionText;
  node.querySelector(".expand-toggle").hidden = !canExpand;

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
