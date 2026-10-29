import { Fragment, type ReactNode } from "react";

const LIST_ITEM = /^\s*(?:[-*•]|\d+[.)])\s+/;

/**
 * The little markdown the agent writes: paragraphs, bullet or numbered
 * lists and **bold**. Anything else is shown as plain text.
 */
export function RichText({ text }: { text: string }) {
  const blocks = text.trim().split(/\n{2,}/);
  return (
    <div className="flex flex-col gap-2.5">
      {blocks.map((block, index) => {
        const lines = block.split("\n");
        if (lines.every((line) => LIST_ITEM.test(line))) {
          const ordered = /^\s*\d/.test(lines[0] ?? "");
          const List = ordered ? "ol" : "ul";
          return (
            <List
              key={index}
              className={`flex flex-col gap-1 pl-5 ${ordered ? "list-decimal" : "list-disc"}`}
            >
              {lines.map((line, item) => (
                <li key={item}>{inline(line.replace(LIST_ITEM, ""))}</li>
              ))}
            </List>
          );
        }
        return (
          <p key={index}>
            {lines.map((line, row) => (
              <Fragment key={row}>
                {row > 0 && <br />}
                {inline(line)}
              </Fragment>
            ))}
          </p>
        );
      })}
    </div>
  );
}

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((piece, index) =>
    piece.startsWith("**") && piece.endsWith("**") && piece.length > 4 ? (
      <strong key={index} className="font-semibold">
        {piece.slice(2, -2)}
      </strong>
    ) : (
      piece
    ),
  );
}
