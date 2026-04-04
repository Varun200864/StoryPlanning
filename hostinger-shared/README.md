# Hostinger Shared Hosting Package

This folder is the shared-hosting version of the app for Hostinger.

## Structure

```text
hostinger-shared/
  public_html/
    .htaccess
    api.php
    app.js
    index.html
    styles.css
  private/
    data/
      store.json
```

## Upload To Hostinger

1. Upload everything inside `public_html/` to your Hostinger `public_html` folder.
2. Create a folder named `private` next to `public_html` in File Manager.
3. Upload `private/data/store.json` into that `private/data/` folder.

Final layout on Hostinger should look like:

```text
/home/your-hostinger-user/
  public_html/
    index.html
    styles.css
    app.js
    api.php
    .htaccess
  private/
    data/
      store.json
```

## Why This Version Works On Shared Hosting

- Hostinger shared hosting supports PHP, but Hostinger says Node.js requires VPS rather than regular Web, WordPress, or Cloud shared plans.
- The UI stays the same.
- The API is handled by `api.php`.
- Vote data is stored outside `public_html` for better safety.
