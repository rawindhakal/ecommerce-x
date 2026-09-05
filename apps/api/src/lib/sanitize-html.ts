import sanitizeHtml from "sanitize-html";

// Allow-list covers what the admin rich-text editor actually produces for
// CMS page bodies (headings, text formatting, lists, links, images, tables).
// Anything else — scripts, event handlers, iframes, forms — is stripped.
const options: sanitizeHtml.IOptions = {
  allowedTags: [
    "h1", "h2", "h3", "h4", "h5", "h6",
    "p", "br", "hr", "blockquote",
    "b", "strong", "i", "em", "u", "s", "sub", "sup",
    "ul", "ol", "li",
    "a", "img",
    "table", "thead", "tbody", "tr", "th", "td",
    "div", "span",
  ],
  allowedAttributes: {
    a: ["href", "name", "target", "rel"],
    img: ["src", "alt", "width", "height"],
    "*": ["class"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  transformTags: {
    a: sanitizeHtml.simpleTransform("a", { rel: "noopener noreferrer" }, true),
  },
};

export function sanitizeContent(html: string): string {
  return sanitizeHtml(html, options);
}
