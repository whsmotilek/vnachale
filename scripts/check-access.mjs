/**
 * Сверка трёх слоёв доступа. Запуск: node scripts/check-access.mjs [api_matrix.json]
 *
 * Зачем. Права живут в трёх местах: меню (Nav.visibleSections), выбор страницы
 * (App.isPageAllowed) и разрешения API. 01.09.2026 первые два разошлись:
 * «Склад ФФ» был в меню ozon-менеджера, но при клике открывалась аналитика Ozon.
 * Глазами такое не ловится — нужна сверка по всем ролям сразу.
 *
 * Инварианты:
 *   1. что попало в меню — обязано открываться;
 *   2. что открывается — обязано получить данные от API (если передан матрикс);
 *   3. что открывается, но скрыто из меню — только намеренно (adminOnly).
 */
import fs from "fs";
import path from "path";

const root = path.resolve(import.meta.dirname, "..");
const nav = fs.readFileSync(path.join(root, "src/components/Nav.tsx"), "utf8");
const app = fs.readFileSync(path.join(root, "src/App.tsx"), "utf8");

const strip = (t) => t
  .replace(/:\s*NavSection\[\]/g, "").replace(/:\s*Role\b/g, "")
  .replace(/:\s*Warehouse\b/g, "").replace(/:\s*boolean\b/g, "")
  .replace(/:\s*Page\b/g, "").replace(/\bIcon:\s*\w+,/g, "");

const SECTIONS_SRC = nav.match(/const SECTIONS: NavSection\[\] = \[[\s\S]*?\n\];/)[0];
const visibleSections = new Function(
  strip(SECTIONS_SRC) + "\n" + strip(nav.match(/function visibleSections\([\s\S]*?\n\}/)[0]) +
  "\nreturn visibleSections;")();
const SECTIONS = new Function(strip(SECTIONS_SRC) + "\nreturn SECTIONS;")();
const isPageAllowed = new Function(
  strip(app.match(/function isPageAllowed\([\s\S]*?\n\}/)[0]) + "\nreturn isPageAllowed;")();

// Пункты, намеренно скрытые у обычных владельцев (дубли «Заказы Склад/ФФ»).
const ADMIN_ONLY = new Set(
  SECTIONS.flatMap((s) => s.items.filter((i) => i.adminOnly).map((i) => i.id)));

// [роль, склад, грант ozon, грант склада, супер-админ]
const PROFILES = {
  "owner Матвей":     ["owner", "both", true, false, true],
  "owner (обычный)":  ["owner", "both", true, false, false],
  "manager":          ["manager", "both", false, false, false],
  "fulfil наш склад": ["fulfillment", "our", false, false, false],
  "fulfil + гранты":  ["fulfillment", "our", true, true, false],
  "fulfil ФФ":        ["fulfillment", "ff", false, false, false],
  "ozon":             ["ozon", "our", true, false, false],
  "ozon + грант":     ["ozon", "our", true, true, false],
};
const ALL_PAGES = ["orders_all", "orders", "preorders", "stock", "stock_ff",
                   "balance", "analytics", "site", "ozon", "ozon_traffic", "hypotheses"];

const apiMatrix = process.argv[2] ? JSON.parse(fs.readFileSync(process.argv[2], "utf8")) : null;
let bad = 0;

for (const [label, [role, wh, oz, ops, admin]] of Object.entries(PROFILES)) {
  const menu = new Set(visibleSections(role, wh, admin, oz, ops).flatMap((s) => s.items.map((i) => i.id)));
  const errs = [];
  for (const page of ALL_PAGES) {
    const inMenu = menu.has(page);
    const opens = isPageAllowed(page, role, wh, oz, ops);
    if (inMenu && !opens) errs.push(`${page}: есть в меню, но откроется чужая страница`);
    if (!inMenu && opens && !ADMIN_ONLY.has(page)) errs.push(`${page}: открывается по ссылке, но скрыт в меню`);
    const api = apiMatrix?.[label]?.[page];
    if (api && inMenu && opens && api !== "ok") errs.push(`${page}: открывается, но API отдаёт ${api}`);
  }
  if (errs.length) { bad++; console.log(`  ✗ ${label}`); errs.forEach((e) => console.log(`      ${e}`)); }
  else console.log(`  ✓ ${label} — ${menu.size} пунктов, расхождений нет`);
}
console.log(bad ? `\nПРОБЛЕМНЫХ РОЛЕЙ: ${bad}` : "\nВсе роли согласованы.");
process.exit(bad ? 1 : 0);
