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

The site uses a simple template-to-static file system:

1. Templates are stored in `public/templates/`
2. The server-side processor is in `server/template-processor.ts`
3. The static file generator is in `server/template-to-static.ts`
4. Templates use HTML comments as placeholders: `<!-- PLACEHOLDER_NAME -->`
5. Static HTML files are generated at server startup

### How the Template System Works:

1. When the server starts, it runs `template-to-static.ts` which:
   - Reads template files from `public/templates/`
   - Processes them using `template-processor.ts`
   - Generates static HTML files in the `public` directory

2. The server serves these static HTML files directly

3. This approach offers the advantages of both template systems (maintainability)
   and static files (performance, simplicity)

### Template Components:

- `header.html` - Contains the HTML head and navigation
- `footer.html` - Contains the footer and closing tags
- `home-content.html` - Content specific to the homepage
- `home-page-scripts.html` - Scripts for the homepage

### Adding a New Page with Templates:

1. Create a new content template in `public/templates/` (e.g., `about-content.html`)
2. Create a new scripts template if needed (e.g., `about-scripts.html`)
3. Add a generator function in `server/template-to-static.ts`:

```typescript
// Generate about page
generateStaticPage(
  'about',                            // Output filename (without .html)
  'About Us - The Current-See',       // Page title
  'about-content.html',              // Content template filename
  '',                                // Additional CSS (optional)
  fs.readFileSync(                   // Additional scripts (optional)
    path.join(templatesDir, 'about-scripts.html'), 
    'utf8'
  )
);
```

4. Restart the server to generate the new static page

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