# htmldrop-clone ðž”…

A lightweight, modern replica of `htmldrop.link `built with **React (Vite) ** on the frontend and **Netlify Functions** on the backend. This allows users to drop HTML/MD/TXT content, protect it with an optional password, define a Custom Time-to-Live (TTL), and share it immediately using dynamic links.

## &#9788; Features
1. **Drag-and-Drop / Paste Uploads**: Drag any HTML, Markdown, or text file or type inside the fully functional editor.
2. **Dynamic Preview Rendering**: Direct client-side `iframe` rendering with `sandbox` protection.
3. **Optional Password Protection**: Keep secure items safe with custom authorization headers.
4. **Time-To-Live (TTL)**: Configurable expiration limits (1, 3, 7, 30 days) to keep temporary items clean.
5. **No Databases Required**: Fully self-contained inside a warm Netlify Functions memory context, optimized for ease of use. (Can be easily extended to Supabase or Upstash Redis if persistent high-scale storage is needed!).

## ðžch One-Click Deploy to Netlify
1. Connect this repository to your Netlify account.
2. Add build command `npm run build` and directory `dist`.
3. Done!
