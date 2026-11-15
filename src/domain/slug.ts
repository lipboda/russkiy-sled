const alphabet: Record<string, string> = Object.fromEntries(
  [..."абвгдеёжзийклмнопрстуфхцчшщъыьэюя"].map((letter, index) => [
    letter,
    [
      "a",
      "b",
      "v",
      "g",
      "d",
      "e",
      "yo",
      "zh",
      "z",
      "i",
      "y",
      "k",
      "l",
      "m",
      "n",
      "o",
      "p",
      "r",
      "s",
      "t",
      "u",
      "f",
      "kh",
      "ts",
      "ch",
      "sh",
      "shch",
      "",
      "y",
      "",
      "e",
      "yu",
      "ya",
    ][index],
  ]),
);
export function wordSlug(lemma: string) {
  return [
    ...lemma
      .toLowerCase()
      .normalize("NFD")
      .replace(/\u0301/g, "")
      .normalize("NFC"),
  ]
    .map((letter) => alphabet[letter] ?? letter)
    .join("")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
