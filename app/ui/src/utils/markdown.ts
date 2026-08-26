// Ultra-simple markdown to HTML converter with nested list + inline code support.
// Shared by the chat message display and the prefill progress panel so AI output
// (headings, bold, inline code, lists, images) renders consistently.
export function convertMarkdownToHTML(markdown: string, baseUrl?: string): string {
  let html = markdown;

  // Convert headers
  html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
  html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
  html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

  // Convert bold
  html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

  // Convert images: ![alt](url)
  html = html.replace(/!\[(.*?)\]\((.*?)\)/g, (match, alt, url) => {
    // Prepend baseUrl if it's a relative URL (starts with /)
    const src = (baseUrl && url.startsWith('/')) ? `${baseUrl}${url}` : url;
    return `<img src="${src}" alt="${alt}" loading="lazy" />`;
  });

  // Convert links: [text](url)
  html = html.replace(/\[(.*?)\]\((.*?)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');

  // Convert inline code (`code`)
  html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

  // Convert lists with nesting support
  const lines = html.split('\n');
  const processed: string[] = [];
  const listStack: { type: string; indent: number }[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const bulletMatch = line.match(/^(\s*)-\s+(.+)$/);
    const numberMatch = line.match(/^(\s*)\d+\.\s+(.+)$/);

    if (bulletMatch || numberMatch) {
      const indent = (bulletMatch?.[1] || numberMatch?.[1] || '').length;
      const content = bulletMatch?.[2] || numberMatch?.[2] || '';
      const currentType = bulletMatch ? 'ul' : 'ol';

      // Close lists that are at a deeper or equal indentation level
      while (listStack.length > 0 && listStack[listStack.length - 1].indent >= indent) {
        const closed = listStack.pop()!;
        processed.push(`</${closed.type}>`);
      }

      // Open new list if we're at a new indentation level
      if (listStack.length === 0 || listStack[listStack.length - 1].indent < indent) {
        processed.push(`<${currentType}>`);
        listStack.push({ type: currentType, indent });
      }

      processed.push(`<li>${content}</li>`);
    } else {
      // Close all open lists
      while (listStack.length > 0) {
        const closed = listStack.pop()!;
        processed.push(`</${closed.type}>`);
      }

      if (line.trim() === '') {
        processed.push('<br/>');
      } else if (!line.startsWith('<h') && !line.startsWith('<strong>')) {
        processed.push(`<p>${line}</p>`);
      } else {
        processed.push(line);
      }
    }
  }

  // Close any remaining open lists
  while (listStack.length > 0) {
    const closed = listStack.pop()!;
    processed.push(`</${closed.type}>`);
  }

  return processed.join('\n');
}
