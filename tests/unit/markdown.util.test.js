/**
 * Unit Tests - Markdown Utility
 * Tests markdown conversion, TOC extraction, front matter parsing, and slug generation
 */

const {
  markdownToHtml,
  extractTOC,
  extractFrontMatter,
  generateSlug
} = require('../../src/utils/markdown.util');

describe('Markdown Utility', () => {
  describe('markdownToHtml', () => {
    test('should return empty string for null input', () => {
      expect(markdownToHtml(null)).toBe('');
    });

    test('should return empty string for undefined input', () => {
      expect(markdownToHtml(undefined)).toBe('');
    });

    test('should return empty string for empty string', () => {
      expect(markdownToHtml('')).toBe('');
    });

    test('should convert basic paragraph', () => {
      const markdown = 'This is a paragraph.';
      const html = markdownToHtml(markdown);

      expect(html).toContain('<p>This is a paragraph.</p>');
    });

    test('should convert headings with IDs', () => {
      const markdown = '# Test Heading';
      const html = markdownToHtml(markdown);

      expect(html).toContain('<h1 id="test-heading">Test Heading</h1>');
    });

    test('should convert multiple heading levels', () => {
      const markdown = `# Heading 1
## Heading 2
### Heading 3`;
      const html = markdownToHtml(markdown);

      expect(html).toContain('<h1 id="heading-1">Heading 1</h1>');
      expect(html).toContain('<h2 id="heading-2">Heading 2</h2>');
      expect(html).toContain('<h3 id="heading-3">Heading 3</h3>');
    });

    test('should generate slugs from headings with special characters', () => {
      const markdown = '# Test: Special Characters!';
      const html = markdownToHtml(markdown);

      expect(html).toContain('id="test-special-characters"');
    });

    test('should convert bold text', () => {
      const markdown = '**bold text**';
      const html = markdownToHtml(markdown);

      expect(html).toContain('<strong>bold text</strong>');
    });

    test('should convert italic text', () => {
      const markdown = '*italic text*';
      const html = markdownToHtml(markdown);

      expect(html).toContain('<em>italic text</em>');
    });

    test('should convert inline code', () => {
      const markdown = '`code snippet`';
      const html = markdownToHtml(markdown);

      expect(html).toContain('<code>code snippet</code>');
    });

    test('should convert code blocks with language', () => {
      const markdown = '```javascript\nconst x = 1;\n```';
      const html = markdownToHtml(markdown);

      expect(html).toContain('<pre');
      expect(html).toContain('<code');
    });

    test('should convert code blocks without language', () => {
      const markdown = '```\nplain code\n```';
      const html = markdownToHtml(markdown);

      expect(html).toContain('<pre');
      expect(html).toContain('plain code');
    });

    test('should convert unordered lists', () => {
      const markdown = `- Item 1
- Item 2
- Item 3`;
      const html = markdownToHtml(markdown);

      expect(html).toContain('<ul>');
      expect(html).toContain('<li>Item 1</li>');
      expect(html).toContain('<li>Item 2</li>');
      expect(html).toContain('<li>Item 3</li>');
      expect(html).toContain('</ul>');
    });

    test('should convert ordered lists', () => {
      const markdown = `1. First
2. Second
3. Third`;
      const html = markdownToHtml(markdown);

      expect(html).toContain('<ol>');
      expect(html).toContain('<li>First</li>');
      expect(html).toContain('<li>Second</li>');
      expect(html).toContain('<li>Third</li>');
      expect(html).toContain('</ol>');
    });

    test('should convert links', () => {
      const markdown = '[Link Text](https://example.com)';
      const html = markdownToHtml(markdown);

      expect(html).toContain('<a href="https://example.com">Link Text</a>');
    });

    test('should convert images', () => {
      const markdown = '![Alt Text](https://example.com/image.png)';
      const html = markdownToHtml(markdown);

      expect(html).toContain('<img');
      expect(html).toContain('src="https://example.com/image.png"');
      expect(html).toContain('alt="Alt Text"');
    });

    test('should convert blockquotes', () => {
      const markdown = '> This is a quote';
      const html = markdownToHtml(markdown);

      expect(html).toContain('<blockquote>');
      expect(html).toContain('This is a quote');
      expect(html).toContain('</blockquote>');
    });

    test('should convert tables', () => {
      const markdown = `| Header 1 | Header 2 |
|----------|----------|
| Cell 1   | Cell 2   |`;
      const html = markdownToHtml(markdown);

      expect(html).toContain('<table>');
      expect(html).toContain('<thead>');
      expect(html).toContain('<tbody>');
      expect(html).toContain('<th>Header 1</th>');
      expect(html).toContain('<td>Cell 1</td>');
    });

    test('should sanitize dangerous HTML (XSS protection)', () => {
      const markdown = '<script>alert("XSS")</script>';
      const html = markdownToHtml(markdown);

      // Script tags should be removed
      expect(html).not.toContain('<script>');
      expect(html).not.toContain('alert');
    });

    test('should sanitize dangerous onclick attributes', () => {
      const markdown = '<a href="#" onclick="alert(\'XSS\')">Click</a>';
      const html = markdownToHtml(markdown);

      // onclick should be removed
      expect(html).not.toContain('onclick');
    });

    test('should allow safe HTML attributes', () => {
      const markdown = '[Link](https://example.com "Title")';
      const html = markdownToHtml(markdown);

      expect(html).toContain('href="https://example.com"');
      expect(html).toContain('title="Title"');
    });

    test('should handle horizontal rules', () => {
      const markdown = '---';
      const html = markdownToHtml(markdown);

      expect(html).toContain('<hr');
    });

    test('should convert strikethrough (GFM)', () => {
      const markdown = '~~strikethrough~~';
      const html = markdownToHtml(markdown);

      expect(html).toContain('<del>strikethrough</del>');
    });
  });

  describe('extractTOC', () => {
    test('should return empty array for null input', () => {
      expect(extractTOC(null)).toEqual([]);
    });

    test('should return empty array for undefined input', () => {
      expect(extractTOC(undefined)).toEqual([]);
    });

    test('should return empty array for empty string', () => {
      expect(extractTOC('')).toEqual([]);
    });

    test('should return empty array for markdown without headings', () => {
      const markdown = 'Just a paragraph without headings.';
      expect(extractTOC(markdown)).toEqual([]);
    });

    test('should extract single heading', () => {
      const markdown = '# Main Title';
      const toc = extractTOC(markdown);

      expect(toc).toHaveLength(1);
      expect(toc[0]).toEqual({
        level: 1,
        title: 'Main Title',
        slug: 'main-title'
      });
    });

    test('should extract multiple headings', () => {
      const markdown = `# Heading 1
## Heading 2
### Heading 3`;
      const toc = extractTOC(markdown);

      expect(toc).toHaveLength(3);
      expect(toc[0].level).toBe(1);
      expect(toc[1].level).toBe(2);
      expect(toc[2].level).toBe(3);
    });

    test('should extract headings with special characters', () => {
      const markdown = '# Test: Special Characters!';
      const toc = extractTOC(markdown);

      expect(toc[0]).toEqual({
        level: 1,
        title: 'Test: Special Characters!',
        slug: 'test-special-characters'
      });
    });

    test('should strip markdown formatting from titles', () => {
      const markdown = '# **Bold** and *Italic* and `code`';
      const toc = extractTOC(markdown);

      expect(toc[0].title).toBe('Bold and Italic and code');
    });

    test('should handle headings with multiple spaces', () => {
      const markdown = '# Multiple   Spaces';
      const toc = extractTOC(markdown);

      expect(toc[0].slug).toBe('multiple-spaces');
    });

    test('should handle all heading levels (1-6)', () => {
      const markdown = `# H1
## H2
### H3
#### H4
##### H5
###### H6`;
      const toc = extractTOC(markdown);

      expect(toc).toHaveLength(6);
      expect(toc[0].level).toBe(1);
      expect(toc[5].level).toBe(6);
    });

    test('should ignore invalid heading formats', () => {
      const markdown = `#No space
# Valid Heading
##No space
## Another Valid`;
      const toc = extractTOC(markdown);

      expect(toc).toHaveLength(2);
      expect(toc[0].title).toBe('Valid Heading');
      expect(toc[1].title).toBe('Another Valid');
    });

    test('should handle headings mixed with content', () => {
      const markdown = `Some text
# Heading 1
More text
## Heading 2
Even more text`;
      const toc = extractTOC(markdown);

      expect(toc).toHaveLength(2);
      expect(toc[0].title).toBe('Heading 1');
      expect(toc[1].title).toBe('Heading 2');
    });
  });

  describe('extractFrontMatter', () => {
    test('should return empty metadata for null input', () => {
      const result = extractFrontMatter(null);

      expect(result).toEqual({
        metadata: {},
        content: null
      });
    });

    test('should return empty metadata for undefined input', () => {
      const result = extractFrontMatter(undefined);

      expect(result).toEqual({
        metadata: {},
        content: undefined
      });
    });

    test('should return empty metadata for markdown without front matter', () => {
      const markdown = '# Just a heading';
      const result = extractFrontMatter(markdown);

      expect(result.metadata).toEqual({});
      expect(result.content).toBe(markdown);
    });

    test('should extract valid front matter', () => {
      const markdown = `---
title: Test Document
author: Test Author
date: 2025-01-01
---
# Content starts here`;

      const result = extractFrontMatter(markdown);

      expect(result.metadata).toEqual({
        title: 'Test Document',
        author: 'Test Author',
        date: '2025-01-01'
      });
      expect(result.content).toBe('# Content starts here');
    });

    test('should handle front matter with colons in values', () => {
      const markdown = `---
url: https://example.com
time: 12:30:45
---
Content`;

      const result = extractFrontMatter(markdown);

      expect(result.metadata.url).toBe('https://example.com');
      expect(result.metadata.time).toBe('12:30:45');
    });

    test('should ignore lines without colons in front matter', () => {
      const markdown = `---
title: Valid
invalid line
author: Also Valid
---
Content`;

      const result = extractFrontMatter(markdown);

      expect(result.metadata).toEqual({
        title: 'Valid',
        author: 'Also Valid'
      });
    });

    test('should handle empty front matter block', () => {
      const markdown = `---
---
Content`;

      const result = extractFrontMatter(markdown);

      // Empty front matter doesn't match regex, returns original content
      expect(result.metadata).toEqual({});
      expect(result.content).toBe(markdown);
    });

    test('should trim whitespace from keys and values', () => {
      const markdown = `---
  title  :  Trimmed Title
  author :Test Author
---
Content`;

      const result = extractFrontMatter(markdown);

      expect(result.metadata.title).toBe('Trimmed Title');
      expect(result.metadata.author).toBe('Test Author');
    });

    test('should handle multiline content after front matter', () => {
      const markdown = `---
title: Test
---
# Heading

Paragraph 1

Paragraph 2`;

      const result = extractFrontMatter(markdown);

      expect(result.metadata.title).toBe('Test');
      expect(result.content).toContain('# Heading');
      expect(result.content).toContain('Paragraph 1');
      expect(result.content).toContain('Paragraph 2');
    });

    test('should handle front matter at end of document', () => {
      const markdown = `---
title: Edge Case
---`;

      const result = extractFrontMatter(markdown);

      // Regex requires content after closing ---, so this doesn't match
      expect(result.metadata).toEqual({});
      expect(result.content).toBe(markdown);
    });
  });

  describe('generateSlug', () => {
    test('should convert simple text to lowercase', () => {
      expect(generateSlug('Simple Text')).toBe('simple-text');
    });

    test('should replace spaces with hyphens', () => {
      expect(generateSlug('Multiple Word Slug')).toBe('multiple-word-slug');
    });

    test('should remove special characters', () => {
      expect(generateSlug('Special!@#$%Characters')).toBe('specialcharacters');
    });

    test('should handle multiple spaces', () => {
      expect(generateSlug('Multiple   Spaces   Here')).toBe('multiple-spaces-here');
    });

    test('should handle multiple hyphens', () => {
      expect(generateSlug('Multiple---Hyphens')).toBe('multiple-hyphens');
    });

    test('should convert leading and trailing whitespace to hyphens', () => {
      // Note: trim() is called but only removes whitespace, not hyphens
      // Spaces are converted to hyphens before trim(), so leading/trailing spaces become hyphens
      expect(generateSlug('  Leading and Trailing  ')).toBe('-leading-and-trailing-');
    });

    test('should preserve leading and trailing hyphens', () => {
      // Hyphens are not trimmed, only whitespace
      expect(generateSlug('-Hyphen-Start-End-')).toBe('-hyphen-start-end-');
    });

    test('should handle mixed case', () => {
      expect(generateSlug('MiXeD CaSe TeXt')).toBe('mixed-case-text');
    });

    test('should handle numbers', () => {
      expect(generateSlug('Title 123 Numbers')).toBe('title-123-numbers');
    });

    test('should handle underscores (keep them)', () => {
      expect(generateSlug('Text_With_Underscores')).toBe('text_with_underscores');
    });

    test('should handle empty string', () => {
      expect(generateSlug('')).toBe('');
    });

    test('should handle only special characters', () => {
      expect(generateSlug('!@#$%^&*()')).toBe('');
    });

    test('should handle unicode characters', () => {
      expect(generateSlug('Café München')).toBe('caf-mnchen');
    });

    test('should handle consecutive special characters', () => {
      expect(generateSlug('Word!!!Another???Word')).toBe('wordanotherword');
    });

    test('should create valid URL slug', () => {
      const slug = generateSlug('What is the Tractatus Framework?');
      expect(slug).toBe('what-is-the-tractatus-framework');
    });
  });
});
