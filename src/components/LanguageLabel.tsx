import { languageNames } from "../domain/schema";
import { editorial } from "../domain/editorial";
const defaults: Record<string, string> = {
  "en-US": "US",
  "fr-FR": "FR",
  "hy-AM": "AM",
  de: "DE",
  it: "IT",
  es: "ES",
  pt: "PT",
  ja: "JP",
  nl: "NL",
};
export function referenceCountry(code: string) {
  return (
    editorial.languages.find((l) => l.code === code)?.country ||
    defaults[code] ||
    ""
  );
}
export function CountryFlag({ country }: { country: string }) {
  return /^(US|FR|AM|DE|IT|ES|PT|JP|NL)$/.test(country) ? (
    <img
      className="country-flag"
      src={`/flags/${country.toLowerCase()}.svg`}
      alt=""
      aria-hidden="true"
      width="24"
      height="16"
    />
  ) : null;
}
export function LanguageLabel({
  code,
  country,
}: {
  code: string;
  country?: string;
}) {
  return (
    <span className="language-label">
      <CountryFlag country={country || referenceCountry(code)} />
      <span>
        {languageNames[code] ||
          editorial.languages.find((l) => l.code === code)?.name ||
          "Язык"}
      </span>
    </span>
  );
}
