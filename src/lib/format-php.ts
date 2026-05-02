const phpFormatter = new Intl.NumberFormat("en-PH", {
  style: "currency",
  currency: "PHP",
});

export function formatPHP(value: number): string {
  return phpFormatter.format(value);
}
