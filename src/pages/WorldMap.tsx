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
import { languageNames, words, sources } from "../domain/catalog";
import { CountryFlag, LanguageLabel } from "../components/LanguageLabel";
import { mapConnections, type MapLayer } from "../domain/mapConnections";

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
const iso: Record<string, string> = Object.fromEntries(
  countries.map((c) => {
    const id = String(c.id).padStart(3, "0");
    return [id, countryNames.numericToAlpha2(id) || ""];
  }),
);
export function WorldMap({ preview = false }: { preview?: boolean } = {}) {
  const [layer, setLayer] = useState<MapLayer>("correspondences");
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
  const connections = mapConnections(words, sources, layer);
  const linkedCountries = new Set(connections.map((c) => c.card.countryCode));
  const countryConnections = connections.filter(
    (c) => c.card.countryCode === iso[selected ?? ""],
  );
  const availableLanguages = [
    ...new Set(countryConnections.map((c) => c.card.languageCode)),
  ];
  const found = [
    ...new Map(
      countryConnections
        .filter((c) => !language || c.card.languageCode === language)
        .map((c) => [c.word.id, c.word]),
    ).values(),
  ];
  if (preview)
    return (
      <svg
        className="home-map-preview"
        viewBox="0 0 900 500"
        aria-hidden="true"
      >
        <rect width="900" height="500" fill="#F8F9FB" />
        {countries.map((c) => {
          const id = String(c.id).padStart(3, "0");
          const linked = linkedCountries.has(iso[id]);
          return (
            <path
              key={id}
              d={path(c) ?? ""}
              fill={linked ? "#829BB6" : "#DDE3EA"}
              stroke="white"
              strokeWidth=".6"
            />
          );
        })}
      </svg>
    );
  return (
    <>
      <h1 className="atlas-title">Карта русского следа</h1>
      <div
        className="map-layout"
        onKeyDown={(e) => {
          if (e.key === "Escape") setSelected(null);
        }}
      >
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
                  setSelected(null);
                }}
              >
                <RotateCcw />
              </button>
            </div>
            <label className="map-layer">
              Слой карты
              <select
                value={layer}
                onChange={(e) => {
                  setLayer(e.target.value as MapLayer);
                  setLanguage("");
                }}
              >
                <option value="correspondences">Словарные соответствия</option>
                <option value="borrowings">Подтверждённые заимствования</option>
              </select>
            </label>
            <span>Масштаб {zoom.toFixed(1)}×</span>
          </div>
          <svg
            className="world-map"
            viewBox="0 0 900 500"
            aria-label="Интерактивная карта стран мира"
            onKeyDown={(e) => {
              if (e.key === "Escape") setSelected(null);
            }}
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
            <rect
              width="900"
              height="500"
              fill="#F8F9FB"
              onClick={() => {
                if (!moved.current) setSelected(null);
              }}
            />
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
                        : linkedCountries.has(iso[id])
                          ? "focus-country"
                          : "")
                    }
                    onClick={() => {
                      if (!moved.current) select(id, label);
                    }}
                  ></path>
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
            <div className="atlas-shortcuts flex flex-wrap gap-2">
              {["840", "250", "051"].map((id) => (
                <button className="chip" key={id} onClick={() => select(id)}>
                  {names[id]}
                </button>
              ))}
            </div>
          </div>
          <p className="map-credit">
            Опорная страна обозначает язык или вариант, а не частотность и не
            территорию исключительного употребления. Словарные соответствия
            включают также переводы и собственные имена. Границы: Natural Earth,
            масштаб 1:110 млн (public domain), world-atlas. География не
            обозначает доказанные маршруты заимствования. Для малых стран
            используйте список.
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
            <h2>
              <CountryFlag country={iso[selected]} />
              {name}
            </h2>
            <label>
              Язык
              <select
                value={language}
                onChange={(e) => setLanguage(e.target.value)}
              >
                <option value="">Все языки страны</option>
                {availableLanguages.map((c) => (
                  <option key={c} value={c}>
                    {languageNames[c] || c}
                  </option>
                ))}
              </select>
            </label>
            <strong className="map-count">{found.length}</strong>
            <p>
              {layer === "borrowings"
                ? "слов с подтверждёнными заимствованиями"
                : "слов со словарными соответствиями"}
            </p>
            <div className="word-languages">
              {availableLanguages.map((code) => (
                <LanguageLabel key={code} code={code} country={iso[selected]} />
              ))}
            </div>
            {found.length ? (
              found.map((w) => (
                <Link key={w.id} to={"/dictionary/" + w.slug}>
                  {w.russianLemma}
                </Link>
              ))
            ) : (
              <div className="empty">
                <h3>
                  {layer === "borrowings"
                    ? "Пока нет подтверждённых слов"
                    : "Нет словарных соответствий"}
                </h3>
                <p>
                  {layer === "borrowings"
                    ? "Для этого слоя нужны подтверждённые источники и установленный тип заимствования. Посмотрите также слой словарных соответствий."
                    : "В опубликованном словаре нет материалов, привязанных к этой опорной стране."}
                </p>
              </div>
            )}
            <Link className="text-link" to="/dictionary">
              Открыть словарь ↗
            </Link>
          </aside>
        ) : null}
      </div>
    </>
  );
}
