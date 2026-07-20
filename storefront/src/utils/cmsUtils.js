/**
 * Parses CMS HTML content into structured sections.
 * Robust approach: Finds all header tags in document order and splits content.
 */
export const parseCMSContent = (htmlString) => {
    if (!htmlString) return [];

    const sections = [];
    const container = document.createElement('div');
    container.innerHTML = htmlString;

    // Support all header levels as section starters
    const headerTags = ['H1', 'H2', 'H3', 'H4', 'H5', 'H6'];
    
    // We'll flatten the structure to identify headers and their following siblings
    // But sometimes headers are nested inside <p> or <div> because of the editor
    const allElements = container.querySelectorAll('*');
    const headers = Array.from(allElements).filter(el => headerTags.includes(el.tagName));

    if (headers.length === 0) {
        // No headers at all? Treat whole thing as intro
        return [{
            title: 'General Information',
            originalTitle: '',
            content: htmlString,
            iconKey: 'info'
        }];
    }

    headers.forEach((header, index) => {
        const title = header.innerText.trim();
        // Robust cleanup: Removes leading numbers like "1.", "1.1", "Section 1:"
        const cleanTitle = title.replace(/^(?:Section\s+)?(?:\d+\.?)+\s*:?\s*/i, '');
        
        let content = '';
        let next = header.nextSibling;
        
        // Collect siblings until we hit the next header or end
        // IMPORTANT: We need to handle cases where the next header might not be a sibling 
        // but nested elsewhere. However, for typical CMS outputs, siblings or subsequent nodes are common.
        
        // A better way: find everything between this header and the next header in the headers array
        const nextHeader = headers[index + 1];
        
        // Create a temporary div to collect content
        const tempDiv = document.createElement('div');
        let current = header.nextSibling;
        
        while (current && current !== nextHeader) {
            // Check if current contains the next header (edge case for nesting)
            if (nextHeader && current.contains && current.contains(nextHeader)) break;
            
            tempDiv.appendChild(current.cloneNode(true));
            current = current.nextSibling;
        }
        
        // Fallback: If siblings logic fails (due to weird nesting), 
        // we might have skipped content. But for standard editors, siblings are expected.
        
        sections.push({
            title: cleanTitle,
            originalTitle: title,
            content: tempDiv.innerHTML.trim() || '<p>No content provided for this section.</p>',
            iconKey: getIconKeyByTitle(cleanTitle)
        });
    });

    // Special case: Handle content before the very first header
    const firstHeader = headers[0];
    const introDiv = document.createElement('div');
    let introNode = container.firstChild;
    while (introNode && introNode !== firstHeader) {
        if (firstHeader.contains(introNode)) break;
        introDiv.appendChild(introNode.cloneNode(true));
        introNode = introNode.nextSibling;
    }
    
    if (introDiv.innerText.trim()) {
        sections.unshift({
            title: 'Introduction',
            originalTitle: '',
            content: introDiv.innerHTML,
            iconKey: 'info'
        });
    }

    return sections;
};

/**
 * Maps common policy section titles to Lucide icon keys
 */
const getIconKeyByTitle = (title) => {
    const t = title.toLowerCase();
    if (t.includes('collect') || t.includes('information')) return 'eye';
    if (t.includes('use') || t.includes('data')) return 'lock';
    if (t.includes('security') || t.includes('protect')) return 'shield';
    if (t.includes('right') || t.includes('legal')) return 'scroll';
    if (t.includes('contact') || t.includes('question')) return 'mail';
    if (t.includes('refund') || t.includes('return')) return 'refresh';
    if (t.includes('ship') || t.includes('delivery')) return 'truck';
    if (t.includes('term') || t.includes('service')) return 'file-text';
    if (t.includes('track')) return 'truck';
    if (t.includes('area') || t.includes('coverage')) return 'map';
    if (t.includes('time') || t.includes('process')) return 'clock';
    if (t.includes('guarantee') || t.includes('protection')) return 'shield';
    return 'info';
};
