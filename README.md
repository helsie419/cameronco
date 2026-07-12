# Cameron & Co — Shopify Liquid Conversion (Batch 1: Static Content Pages)

This batch converts the **static content pages** to Shopify Liquid:
about, contact, faq, jewellery-care, melbourne-office, melbourne-services,
sydney-office, sydney-services, testimonials, timeless-vs-trendy-jewellery,
understanding-diamonds, plus the homepage and shared header/footer/modal/cookie
snippets.

**Not included in this batch** (as agreed): `diamonds.html`, `diamond-builder.html`,
`booking.html` — since diamond search will move to a Shopify app/custom app proxy
and booking needs its own Google Calendar work. Nav/footer links to these still
point at `pages['diamonds']`, `pages['ring-builder']`, `pages['booking']` as
placeholders so the rest of the site's links don't break — create stub Pages (or
swap these routes once those are built) or they'll 404 until then.

## File map

```
layout/theme.liquid              → main theme wrapper (<head>, header, footer, modal, cookie banner)
snippets/site-header.liquid      → nav, with active-page highlighting added
snippets/site-footer.liquid      → footer (copyright year is now dynamic)
snippets/pricing-modal.liquid    → "Request Pricing" modal markup
snippets/cookie-consent.liquid   → cookie banner + settings panel
templates/index.liquid           → homepage content
templates/page.*.liquid          → one per static page (see mapping below)
assets/theme.css.liquid          → your styles.css, unchanged except the one
                                    local background-image url() now uses asset_url
assets/theme.js                  → your scripts.js, unchanged
IMAGE_UPLOAD_MANIFEST.txt        → every local image referenced, with the
                                    sanitized filename to upload it as
```

## Steps to install in Shopify

1. **Upload images.** Shopify's asset folder is flat (no subfolders) and dislikes
   spaces/parentheses/apostrophes in filenames, so 8 of your 33 images needed
   renaming. Open `IMAGE_UPLOAD_MANIFEST.txt`, and upload each file from your
   `assets/images/` folder to the theme's **Assets** (via Shopify CLI / theme
   editor "Add asset") using the sanitized name shown in the right-hand column.
   The Liquid already references the sanitized names, so this step just needs to
   match them up.

2. **Add the theme files.** Drop `layout/theme.liquid`, everything in `snippets/`,
   everything in `templates/`, and the two files in `assets/` into your theme
   (via Shopify CLI `theme push`, or manually in the Shopify admin code editor).

3. **Create the Pages.** In Shopify Admin → Online Store → Pages, create one page
   per row below, and under "Theme template" pick the matching suffix. Set the
   Title and Search engine listing (meta description) exactly as noted in the
   `{% comment %}` block at the top of each template file — I pulled these
   straight from your original `<title>`/`<meta description>` tags:

   | Original file | Page title | Template suffix |
   |---|---|---|
   | about.html | About Us \| Cameron & Co Jewellers | about |
   | contact.html | Contact Us \| Cameron & Co Jewellers — Sydney & Melbourne | contact |
   | faq.html | Frequently Asked Questions \| Cameron & Co Jewellers | faq |
   | jewellerycare.html | Essential Jewellery Care Tips \| Cameron & Co | jewellery-care |
   | melbourneoffice.html | Melbourne Office \| Cameron & Co | melbourne-office |
   | melbourneservices.html | Melbourne Jewellery Services \| Cameron & Co | melbourne-services |
   | sydneyoffice.html | Sydney Office \| Cameron & Co | sydney-office |
   | sydneyservices.html | Sydney Jewellery Services \| Cameron & Co | sydney-services |
   | testimonials.html | Testimonials \| Cameron & Co Jewellers | testimonials |
   | timelesstrending/trendyjewellery.html (identical duplicates) | Timeless vs Trendy Jewellery \| Cameron & Co | timeless-vs-trendy-jewellery |
   | understandingdiamonds.html | Discover the 4 C's of Diamonds \| Cameron & Co | understanding-diamonds |

   Important: the **Page handle** you choose when creating each page must match
   what's used in the Liquid (`pages['about']`, `pages['contact']`, etc. — i.e.
   the handle shown in the last column above, with underscores/case as-is). If
   Shopify auto-generates a different handle from the title, edit the URL/handle
   field on the page to match.

4. **Set the homepage template.** `templates/index.liquid` is used automatically
   as your storefront homepage — no separate Page needed. Set the homepage title/
   meta description under Online Store → Preferences (I put the originals in a
   comment at the top of the file for reference).

5. **Double check the nav.** `site-header.liquid` and `site-footer.liquid` now
   generate their links dynamically from `pages['<handle>']`, so once the Pages
   above exist with matching handles, all internal navigation will resolve
   correctly and the current page gets `aria-current="page"` automatically
   (a small accessibility improvement — the old static site only did this on
   the homepage).

## Known gaps / things worth flagging

- **No CSS/JS changes were made** beyond the one background-image `url()` fix,
  so the visual design should be pixel-for-pixel identical once assets are in
  place — that was the mandate, so I didn't take liberties here.
- The homepage `<head>` in the original referenced `index.css`, but that file
  wasn't present in the project — I left a comment in `theme.liquid` flagging
  this in case there's homepage-only CSS to fold in from elsewhere.
- The pricing modal and cookie banner have markup but rely on JS behaviour
  (open/close, cookie logic) that wasn't present in `scripts.js` — only the
  mobile menu toggle is implemented there. If that logic exists elsewhere
  (e.g. was going to be built later), it'll need to be added to `theme.js`.
- Diamonds/Ring Builder/Booking nav links point at placeholder page handles
  until those are migrated — happy to wire these up for real once we settle
  on the app-proxy approach for Nivoda.
