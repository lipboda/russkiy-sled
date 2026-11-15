export function localDateTime(value: string, timezone: string) {
  if (!value) return "";
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date(value));
  const get = (name: string) => parts.find((p) => p.type === name)?.value;
  return `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}`;
}
export function publicationInstant(local: string, timezone: string) {
  if (!local) return "";
  const target = Date.parse(local + "Z");
  if (!Number.isFinite(target))
    throw new Error("Выберите дату и время публикации");
  let instant = target;
  for (let i = 0; i < 4; i++) {
    const difference =
      Date.parse(
        localDateTime(new Date(instant).toISOString(), timezone) + "Z",
      ) - target;
    if (difference === 0) return new Date(instant).toISOString();
    instant -= difference;
  }
  throw new Error(
    "Такого местного времени нет при переходе на летнее время. Выберите другое время.",
  );
}
