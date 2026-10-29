// Dates are shown in the company's time zone, wherever the server runs
const TIME_ZONE = "America/Sao_Paulo";

const dateParts = new Intl.DateTimeFormat("pt-BR", {
  timeZone: TIME_ZONE,
  day: "2-digit",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
});

const relative = new Intl.RelativeTimeFormat("pt-BR", { numeric: "auto" });

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** "16 out, 14:20" */
export function formatDateTime(date: Date): string {
  const parts = Object.fromEntries(
    dateParts.formatToParts(date).map((part) => [part.type, part.value]),
  );
  const month = (parts.month ?? "").replace(".", "");
  return `${parts.day} ${month}, ${parts.hour}:${parts.minute}`;
}

/** "há 5 dias", "há 3 horas", "agora" */
export function formatRelative(date: Date, now: Date): string {
  const elapsed = now.getTime() - date.getTime();
  if (elapsed < MINUTE) return "agora";
  if (elapsed < HOUR) return relative.format(-Math.floor(elapsed / MINUTE), "minute");
  if (elapsed < DAY) return relative.format(-Math.floor(elapsed / HOUR), "hour");
  return relative.format(-Math.floor(elapsed / DAY), "day");
}
