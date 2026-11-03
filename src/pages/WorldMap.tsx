import { useRef, useState } from "react";
import { geoNaturalEarth1, geoPath } from "d3-geo";
import { feature } from "topojson-client";
import type { Topology, GeometryCollection } from "topojson-specification";
import atlas from "world-atlas/countries-110m.json";
import countryNames from "i18n-iso-countries";
import ruLocale from "i18n-iso-countries/langs/ru.json";
countryNames.registerLocale(ruLocale);
const russianCountryName = (id: string) =>
  countryNames.getName(countryNames.numericToAlpha2(id) || "", "ru") ||
  "Страна";
import { Link } from "react-router-dom";
import { Minus, Plus, RotateCcw, X } from "lucide-react";
import { languageNames, verifiedWords, type Language } from "../domain/catalog";
import { PageTitle } from "../components/Common";
const topology = atlas as unknown as Topology<{
  countries: GeometryCollection<{ name: string }>;
}>;
const countries = feature(topology, topology.objects.countries).features;
const projection = geoNaturalEarth1().fitExtent(
  [
    [12, 20],
    [888, 480],
  ],
  { type: "Sphere" },
);
const path = geoPath(projection);
const names: Record<string, string> = {
  "840": "США",
  "250": "Франция",
  "051": "Армения",
  "643": "Россия",
  "826": "Великобритания",
  "276": "Германия",
  "156": "Китай",
  "124": "Канада",
  "036": "Австралия",
  "076": "Бразилия",
  "356": "Индия",
  "392": "Япония",
};
const iso: Record<string, string> = { "840": "US", "250": "FR", "051": "AM" };
const centers: Record<string, [number, number]> = {
  "840": [-100, 39],
  "250": [2, 47],
  "051": [45, 40],
};
export function WorldMap() {
  const [selected, setSelected] = useState<string | null>(null);
  const [language, setLanguage] = useState("");
  const [zoom, setZoom] = useState(1);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ x: number; y: number; ox: number; oy: number } | null>(
    null,
  );
  const moved = useRef(false);
  const [name, setName] = useState("");
  function select(id: string, label?: string) {
    setSelected(id);
    setName(names[id] ?? label ?? "Выбранная страна");
    setLanguage("");
  }
  const found = verifiedWords().filter((w) =>
    w.languages.some(
      (l) =>
        l.attestationStatus === "verified" &&
        l.countryCode === iso[selected ?? ""] &&
        (!language || l.languageCode === language),
    ),
  );
  return (
    <>
      <PageTitle eyebrow="География исследования" title="Карта русского следа">
        Выберите страну, чтобы увидеть подтверждённые записи. Масштабируйте
        карту кнопками и перемещайте её перетаскиванием.
      </PageTitle>
      <div className="map-layout">
        <section className="map-area">
          <div className="map-toolbar">
            <div className="map-controls">
              <button
                aria-label="Увеличить карту"
                onClick={() => setZoom((z) => Math.min(6, z + 0.5))}
              >
                <Plus />
              </button>
              <button
                aria-label="Уменьшить карту"
                onClick={() => setZoom((z) => Math.max(1, z - 0.5))}
              >
                <Minus />
              </button>
              <button
                aria-label="Сбросить карту"
                onClick={() => {
                  setZoom(1);
                  setOffset({ x: 0, y: 0 });
                }}
              >
                <RotateCcw />
              </button>
            </div>
            <span>Масштаб {zoom.toFixed(1)}×</span>
          </div>
          <svg
            className="world-map"
            viewBox="0 0 900 500"
            aria-label="Интерактивная карта стран мира"
            onPointerDown={(e) => {
              drag.current = {
                x: e.clientX,
                y: e.clientY,
                ox: offset.x,
                oy: offset.y,
              };
              moved.current = false;
            }}
            onPointerMove={(e) => {
              if (drag.current) {
                const d = drag.current;
                if (Math.abs(e.clientX - d.x) + Math.abs(e.clientY - d.y) > 5)
                  moved.current = true;
                const scale =
                  900 / e.currentTarget.getBoundingClientRect().width;
                setOffset({
                  x: d.ox + (e.clientX - d.x) * scale,
                  y: d.oy + (e.clientY - d.y) * scale,
                });
              }
            }}
            onPointerUp={() => {
              drag.current = null;
            }}
            onPointerLeave={() => {
              drag.current = null;
            }}
          >
            <rect width="900" height="500" fill="#e9eff0" />
            <g
              transform={`translate(${450 + offset.x},${250 + offset.y}) scale(${zoom}) translate(-450,-250)`}
            >
              {countries.map((c) => {
                const id = String(c.id).padStart(3, "0");
                const label = names[id] ?? russianCountryName(id);
                return (
                  <path
                    key={id}
                    d={path(c) ?? ""}
                    className={
                      "country " +
                      (selected === id
                        ? "selected"
                        : iso[id]
                          ? "focus-country"
                          : "")
                    }
                    onClick={() => {
                      if (!moved.current) select(id, label);
                    }}
                  >
                    <title>{label}</title>
                  </path>
                );
              })}
              {Object.entries(centers).map(([id, center]) => {
                const p = projection(center)!;
                return (
                  <g
                    className="map-marker"
                    key={id}
                    transform={`translate(${p[0]},${p[1]})`}
                    onClick={() => {
                      if (!moved.current) select(id);
                    }}
                  >
                    <circle r={7 / Math.sqrt(zoom)} />
                    <text
                      y={-13 / Math.sqrt(zoom)}
                      textAnchor="middle"
                      fontSize={13 / Math.sqrt(zoom)}
                    >
                      {names[id]}
                    </text>
                  </g>
                );
              })}
            </g>
          </svg>
          <div className="country-choices">
            <label>
              Выбрать страну
              <select
                value={selected ?? ""}
                onChange={(e) =>
                  select(e.target.value, russianCountryName(e.target.value))
                }
              >
                <option value="" disabled>
                  Все страны мира
                </option>
                {countries.map((c) => {
                  const id = String(c.id).padStart(3, "0");
                  return (
                    <option key={id} value={id}>
                      {names[id] ?? russianCountryName(id)}
                    </option>
                  );
                })}
              </select>
            </label>
            <div className="flex flex-wrap gap-2">
              {Object.keys(iso).map((id) => (
                <button className="chip" key={id} onClick={() => select(id)}>
                  {names[id]}
                </button>
              ))}
            </div>
          </div>
          <p className="map-credit">
            Границы: Natural Earth, масштаб 1:110 млн (public domain),
            world-atlas. География не обозначает доказанные маршруты
            заимствования. Для малых стран используйте список.
          </p>
        </section>
        {selected ? (
          <aside className="map-panel">
            <button
              className="close"
              aria-label="Закрыть панель страны"
              onClick={() => setSelected(null)}
            >
              <X />
            </button>
            <p className="eyebrow">Выбранная страна</p>
            <h2>{name}</h2>
            <label>
              Язык
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                <option value="">Все языки страны</option>
                {Object.entries(languageNames)
                  .filter(
                    ([c]) =>
                      c ===
                      { "840": "en-US", "250": "fr-FR", "051": "hy-AM" }[
                        selected
                      ],
                  )
                  .map(([c, n]) => (
                    <option key={c} value={c as Language}>
                      {n}
                    </option>
                  ))}
              </select>
            </label>
            <strong className="map-count">{found.length}</strong>
            <p>подтверждённых слов</p>
            {found.length ? (
              found.map((w) => (
                <Link key={w.id} to={"/dictionary/" + w.slug}>
                  {w.russianLemma}
                </Link>
              ))
            ) : (
              <div className="empty">
                <h3>Пока нет подтверждённых слов</h3>
                <p>
                  {iso[selected]
                    ? "Материалы об этой стране есть в исследовании, но требуют проверки первоисточников."
                    : "Страна пока не входит в основной круг исследования."}
                </p>
              </div>
            )}
            <Link className="text-link" to="/dictionary">
              Изучить исследовательские записи ↗
            </Link>
          </aside>
        ) : (
          <aside className="map-panel">
            <p className="eyebrow">Как читать карту</p>
            <h2>Слова и границы</h2>
            <p>
              Три выделенные страны — основное направление исследования.
              Выберите страну на карте или в списке.
            </p>
            <p>
              Карта показывает только подтверждённые заимствования. Кандидаты не
              включаются в счётчики.
            </p>
          </aside>
        )}
      </div>
    </>
  );
}
