# The Current-See Website Maintenance Guide

This document provides instructions for maintaining and updating The Current-See website.

## Project Structure

```
public/
├── css/
│   └── common.css        # Main CSS file with all shared styles
├── js/
│   └── public-members-log.js  # Public members display component
│   └── solar_counter.js  # Solar counter functionality
├── templates/
│   ├── header.html       # Common header template
│   └── footer.html       # Common footer template
└── index.html            # Homepage
    prototype.html        # Prototype demo page
    merch.html            # Merchandise page
    my-solar.html         # My Solar page
    founder_note.html     # Founder's note page
    whitepapers.html      # White papers index
    declaration.html      # Solar declaration page
    
server/
├── routes.ts             # Express routes
├── template-processor.ts # Helper for template processing
└── ...                   # Other server files

docs/
└── site-maintenance.md   # This documentation file
```

## Styling

The website uses a centralized CSS approach with variables for consistent styling:

1. All shared styles are in `public/css/common.css`
2. Color variables are defined at the top of the CSS file 
3. For page-specific styles, add them in `<style>` tags or link separate CSS files

### Color Scheme

- Primary Blue: `#0057B8` - Used for text that needs contrast on yellow backgrounds
- Accent Blue: `#0066cc` - Used for headings
- Accent Green: `#4CAF50` - Used for buttons and accents
- Gold: `#FFD700` - Used for navigation links and accents
- Orange: `#FF8C00` - Used in background gradient

## Making Changes

### Updating Navigation

To update navigation links across the entire site:

1. Edit `public/templates/header.html`
2. The change will be applied to all pages that use the template system

### Updating Footer

To update footer content across the entire site:

1. Edit `public/templates/footer.html`
2. The change will be applied to all pages that use the template system

### Adding New Pages

For adding new pages to the site:

1. Create a new HTML file in the `public` directory
2. Use the template system by including header and footer
3. Add a link to the page in the navigation if needed

## Template System

The site uses a simple template system:

1. Templates are in `public/templates/`
2. The server-side processor is in `server/template-processor.ts`
3. Templates use HTML comments as placeholders: `<!-- PLACEHOLDER_NAME -->`

### Example Usage:

```typescript
import { generatePage } from './template-processor';

// Create a page with title, content, and optional CSS/scripts
const htmlContent = generatePage(
  'Page Title',
  '<div class="page-content">Your content here</div>',
  '<style>/* Additional CSS */</style>',
  '<script>// Additional scripts</script>'
);

// Send to client
res.send(htmlContent);
```

## Best Practices

1. Always use variables from common.css for consistent styling
2. Keep all content text in blue (#0057B8) when on yellow backgrounds
3. Test all changes on both desktop and mobile views
4. Add meaningful comments when making significant changes
5. Update this documentation if you make structural changes

## Common Tasks

### Change Text Color

```css
.element {
  color: var(--primary-blue); /* Use CSS variables */
}
```

### Add New Section to Homepage

Edit `public/index.html` and add your section following the existing pattern.

### Update Solar Counter Calculation

Edit `public/js/solar_counter.js` to modify how the counter calculates values.