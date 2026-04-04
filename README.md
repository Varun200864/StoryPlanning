# Story Planning Website

This project now uses one PHP-based structure for both local use and Hostinger shared hosting.

## Main Structure

```text
public_html/
  .htaccess
  api.php
  app.js
  index.html
  styles.css
private/
  data/
    store.json
router.php
start-local.ps1
start-local.bat
```

## Run Locally

Option 1:

```powershell
npm start
```

Option 2:

```powershell
.\start-local.bat
```

If PHP is not in PATH, set it first:

```powershell
$env:PHP_EXE = "C:\\path\\to\\php.exe"
npm start
```

Open:

```text
http://localhost:3000
```

## Upload To Hostinger

Upload the contents of `public_html/` to Hostinger `public_html`.

Create this folder beside it on the server:

```text
private/data/store.json
```

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

## Notes

- Local and Hostinger now use the same frontend and the same PHP API logic.
- Vote data is stored in `private/data/store.json`.
- The older `server.js` version is left in the repo only as a fallback reference.
