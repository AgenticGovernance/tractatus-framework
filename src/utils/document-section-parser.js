/**
 * Document Section Parser
 * Analyzes markdown documents and creates card-based sections
 */

/**
 * Parse document into sections based on H2 headings
 */
function parseDocumentSections(markdown, contentHtml) {
  if (!markdown) return [];

  const sections = [];
  const lines = markdown.split('\n');
  let currentSection = null;
  let sectionContent = [];

  // Find H1 (document title) first
  let documentTitle = '';
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const h1Match = line.match(/^#\s+(.+)$/);
    if (h1Match) {
      documentTitle = h1Match[1].trim();
      break;
    }
  }

  // Parse sections by H2 headings
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Check for H2 heading (## Heading)
    const h2Match = line.match(/^##\s+(.+)$/);

    if (h2Match) {
      // Save previous section if exists
      if (currentSection) {
        currentSection.content = sectionContent.join('\n').trim();
        currentSection.excerpt = extractExcerpt(currentSection.content);
        currentSection.readingTime = estimateReadingTime(currentSection.content);
        currentSection.technicalLevel = detectTechnicalLevel(currentSection.content);
        currentSection.category = categorizeSection(currentSection.title, currentSection.content);
        sections.push(currentSection);
      }

      // Start new section
      const title = h2Match[1].trim();
      const slug = generateSlug(title);

      currentSection = {
        title,
        slug,
        level: 2,
        content: '',
        excerpt: '',
        readingTime: 0,
        technicalLevel: 'basic',
        category: 'conceptual'
      };

      // Include the H2 heading itself in the section content
      sectionContent = [line];
    } else if (currentSection) {
      // Only add content until we hit another H2 or H1
      const isH1 = line.match(/^#\s+[^#]/);

      if (isH1) {
        // Skip H1 (document title) - don't add to section
        continue;
      }

      // Add all other content (including H3, H4, paragraphs, etc.)
      sectionContent.push(line);
    }
  }

  // Save last section
  if (currentSection && sectionContent.length > 0) {
    currentSection.content = sectionContent.join('\n').trim();
    currentSection.excerpt = extractExcerpt(currentSection.content);
    currentSection.readingTime = estimateReadingTime(currentSection.content);
    currentSection.technicalLevel = detectTechnicalLevel(currentSection.content);
    currentSection.category = categorizeSection(currentSection.title, currentSection.content);
    sections.push(currentSection);
  }

  return sections;
}

/**
 * Extract excerpt from content (first 2-3 sentences, max 150 chars)
 */
function extractExcerpt(content) {
  if (!content) return '';

  // Remove markdown formatting
  let text = content
    .replace(/^#+\s+/gm, '') // Remove headings
    .replace(/\*\*(.+?)\*\*/g, '$1') // Remove bold
    .replace(/\*(.+?)\*/g, '$1') // Remove italic
    .replace(/`(.+?)`/g, '$1') // Remove code
    .replace(/\[(.+?)\]\(.+?\)/g, '$1') // Remove links
    .replace(/^[-*]\s+/gm, '') // Remove list markers
    .replace(/^\d+\.\s+/gm, '') // Remove numbered lists
    .replace(/^>\s+/gm, '') // Remove blockquotes
    .replace(/\n+/g, ' ') // Collapse newlines
    .trim();

  // Get first 2-3 sentences
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  let excerpt = sentences.slice(0, 2).join(' ');

  // Truncate to 150 chars if needed
  if (excerpt.length > 150) {
    excerpt = excerpt.substring(0, 147) + '...';
  }

  return excerpt;
}

/**
 * Estimate reading time in minutes (avg 200 words/min)
 */
function estimateReadingTime(content) {
  if (!content) return 1;

  const words = content.split(/\s+/).length;
  const minutes = Math.ceil(words / 200);

  return Math.max(1, minutes);
}

/**
 * Detect technical level based on content
 */
function detectTechnicalLevel(content) {
  if (!content) return 'basic';

  const lowerContent = content.toLowerCase();

  // Technical indicators
  const technicalTerms = [
    'api', 'database', 'mongodb', 'algorithm', 'architecture',
    'implementation', 'node.js', 'javascript', 'typescript',
    'async', 'await', 'promise', 'class', 'function',
    'middleware', 'authentication', 'authorization', 'encryption',
    'hash', 'token', 'jwt', 'rest', 'graphql'
  ];

  const advancedTerms = [
    'metacognitive', 'stochastic', 'quadrant classification',
    'intersection observer', 'csp', 'security policy',
    'cross-reference validation', 'boundary enforcement',
    'architectural constraints', 'formal verification'
  ];

  let technicalScore = 0;
  let advancedScore = 0;

  // Count technical terms
  technicalTerms.forEach(term => {
    const regex = new RegExp(`\\b${term}\\b`, 'gi');
    const matches = lowerContent.match(regex);
    if (matches) technicalScore += matches.length;
  });

  // Count advanced terms
  advancedTerms.forEach(term => {
    const regex = new RegExp(`\\b${term}\\b`, 'gi');
    const matches = lowerContent.match(regex);
    if (matches) advancedScore += matches.length;
  });

  // Check for code blocks
  const codeBlocks = (content.match(/```/g) || []).length / 2;
  technicalScore += codeBlocks * 3;

  // Determine level
  if (advancedScore >= 3 || technicalScore >= 15) {
    return 'advanced';
  } else if (technicalScore >= 5) {
    return 'intermediate';
  } else {
    return 'basic';
  }
}

/**
 * Categorize section based on title and content
 */
function categorizeSection(title, content) {
  const lowerTitle = title.toLowerCase();
  const lowerContent = content.toLowerCase();

  // Category keywords
  const categories = {
    conceptual: [
      'what is', 'introduction', 'overview', 'why', 'philosophy',
      'concept', 'theory', 'principle', 'background', 'motivation'
    ],
    technical: [
      'architecture', 'implementation', 'technical', 'code', 'api',
      'configuration', 'setup', 'installation', 'integration',
      'class', 'function', 'service', 'component'
    ],
    practical: [
      'quick start', 'tutorial', 'guide', 'how to', 'example',
      'walkthrough', 'getting started', 'usage', 'practice'
    ],
    reference: [
      'reference', 'api', 'specification', 'documentation',
      'glossary', 'terms', 'definitions', 'index'
    ],
    critical: [
      'security', 'warning', 'important', 'critical', 'boundary',
      'safety', 'risk', 'violation', 'error', 'failure'
    ]
  };

  // Check title first (higher weight)
  for (const [category, keywords] of Object.entries(categories)) {
    for (const keyword of keywords) {
      if (lowerTitle.includes(keyword)) {
        return category;
      }
    }
  }

  // Check content (lower weight)
  const contentScores = {};
  for (const [category, keywords] of Object.entries(categories)) {
    contentScores[category] = 0;
    for (const keyword of keywords) {
      const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
      const matches = lowerContent.match(regex);
      if (matches) contentScores[category] += matches.length;
    }
  }

  // Return category with highest score
  const maxCategory = Object.keys(contentScores).reduce((a, b) =>
    contentScores[a] > contentScores[b] ? a : b
  );

  return contentScores[maxCategory] > 0 ? maxCategory : 'conceptual';
}

/**
 * Generate URL-safe slug from title
 */
function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

module.exports = {
  parseDocumentSections,
  extractExcerpt,
  estimateReadingTime,
  detectTechnicalLevel,
  categorizeSection,
  generateSlug
};
