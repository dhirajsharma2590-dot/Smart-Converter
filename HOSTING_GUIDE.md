# Hosting Guide for Hostinger

This application is a **Single Page Application (SPA)** built with React. It runs entirely on the client-side (in the user's browser), making it very cheap and easy to host on Hostinger's standard shared hosting.

## 1. Build the Application

In your local project folder (on your computer):

1.  Open your terminal.
2.  Run the build command:
    ```bash
    npm run build
    ```
3.  This will create a `dist` (or `build`) folder containing `index.html`, javascript files, and assets.

## 2. Prepare Hostinger

1.  Log in to your **Hostinger hPanel**.
2.  Go to **Websites** and select your domain (e.g., `pdfconverter.com`).
3.  Click on **File Manager**.

## 3. Upload Files

1.  In the File Manager, navigate to the `public_html` folder.
2.  **Delete** the default `default.php` or `index.php` if they exist.
3.  **Upload** the *contents* of your local `dist` folder into `public_html`.
    *   You should see `index.html` directly inside `public_html`.
    *   Do NOT upload the `dist` folder itself, upload the *files inside it*.

## 4. Important: Client-Side Routing (If applicable)

Since this is an SPA, if you add complex routing later (using React Router), you need to tell Hostinger to redirect all requests to `index.html`.

1.  In `public_html`, create a new file named `.htaccess`.
2.  Add the following code to it:

```apache
<IfModule mod_rewrite.c>
  RewriteEngine On
  RewriteBase /
  RewriteRule ^index\.html$ - [L]
  RewriteCond %{REQUEST_FILENAME} !-f
  RewriteCond %{REQUEST_FILENAME} !-d
  RewriteCond %{REQUEST_FILENAME} !-l
  RewriteRule . /index.html [L]
</IfModule>
```

## 5. Gemini API Key (Optional)

If you want the AI features to work publicly:
1.  Technically, you shouldn't expose your API key in frontend code.
2.  However, for this specific static implementation, you would need to build the app with the key embedded: `REACT_APP_API_KEY=your_key npm run build`.
3.  **Better approach:** Ask the user to input their own Key in a settings modal (safer for public demos).

Your site is now live!