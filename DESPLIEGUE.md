# Desplegar Cupertino Corp + Sveltia CMS

Esta guía te lleva de cero a la web publicada en **Cloudflare Pages** con un **CMS** (Sveltia) para editar Blog, Feed, Photography y Audio sin tocar código.

---

## Qué se ha cambiado en el proyecto

El contenido editable se ha sacado del código y ahora vive en archivos JSON dentro de `content/`:

- `content/blog.json` — entradas del blog
- `content/feed.json` — publicaciones del feed
- `content/photography.json` — proyectos e imágenes
- `content/audio.json` — lanzamientos y pistas

Las páginas cargan estos archivos automáticamente (`Blog`, `Feed`, `Photography`, y `assets/radio.js` para el audio). El CMS escribe en estos mismos archivos, así que **editar en el CMS = actualizar la web**.

El CMS vive en `admin/` (`admin/index.html` + `admin/config.yml`).

---

## Parte A — Publicar la web en Cloudflare Pages

1. Sube el proyecto a GitHub (ya está enlazado a `cupert1no/cupertinocorpFINALWEB`). Desde una terminal en la carpeta del proyecto:
   ```
   git add -A
   git commit -m "Contenido editable + Sveltia CMS"
   git push origin main
   ```
   *(Ya he dejado el commit hecho en local; normalmente solo necesitas `git push origin main`.)*

2. Entra en https://dash.cloudflare.com → **Workers & Pages** → **Create** → pestaña **Pages** → **Connect to Git**.

3. Elige el repositorio `cupertinocorpFINALWEB` y pulsa **Begin setup**.

4. En la configuración de build **déjalo vacío** (es un sitio estático, no hay build):
   - Framework preset: **None**
   - Build command: *(vacío)*
   - Build output directory: `/`  (la raíz)

5. **Save and Deploy**. En un minuto tendrás una URL tipo `https://cupertinocorpfinalweb.pages.dev`. La web ya funciona.

Cada vez que hagas `git push` (o guardes algo en el CMS), Cloudflare redepliega solo.

---

## Parte B — Crear la app de OAuth en GitHub

El CMS necesita que inicies sesión con GitHub. Para eso hace falta una "GitHub OAuth App":

1. GitHub → foto de perfil → **Settings** → **Developer settings** → **OAuth Apps** → **New OAuth App**.
2. Rellena:
   - **Application name:** Cupertino Corp CMS
   - **Homepage URL:** tu URL de Pages (p.ej. `https://cupertinocorpfinalweb.pages.dev`)
   - **Authorization callback URL:** `https://cupertino-cms-auth.TU-SUBDOMINIO.workers.dev/callback`
     *(la pondremos exacta en la Parte C; de momento apunta el nombre del worker que crearás).*
3. **Register application**. Guarda el **Client ID** y genera un **Client Secret** (cópialo, solo se ve una vez).

---

## Parte C — Desplegar el Worker de autenticación (OAuth)

Sveltia usa un pequeño Worker de Cloudflare como puente de OAuth: **`sveltia-cms-auth`**.

### Opción rápida (recomendada)
1. Ve al repositorio oficial: https://github.com/sveltia/sveltia-cms-auth
2. Sigue su botón **"Deploy to Cloudflare"** (te crea el Worker en tu cuenta en unos clics).
3. En el Worker, ve a **Settings → Variables** y añade:
   - `GITHUB_CLIENT_ID` = el Client ID de la Parte B
   - `GITHUB_CLIENT_SECRET` = el Client Secret de la Parte B
   - `ALLOWED_DOMAINS` = `*.pages.dev` (y tu dominio propio si lo añades luego)
4. Copia la URL final del Worker, p.ej. `https://cupertino-cms-auth.tu-subdominio.workers.dev`.
5. Vuelve a la OAuth App de GitHub (Parte B) y ajusta el **Authorization callback URL** a:
   `https://cupertino-cms-auth.tu-subdominio.workers.dev/callback`

### Opción por terminal (alternativa)
Si prefieres la CLI: `npm i -g wrangler`, clona `sveltia-cms-auth`, `wrangler deploy`, y añade las mismas variables con `wrangler secret put ...`.

---

## Parte D — Conectar el CMS con el Worker

1. Abre `admin/config.yml` y cambia la línea `base_url` por la URL real de tu Worker:
   ```yaml
   base_url: https://cupertino-cms-auth.tu-subdominio.workers.dev
   ```
2. Comprueba que `repo` y `branch` son correctos (ya están puestos como `cupert1no/cupertinocorpFINALWEB` y `main`).
3. Guarda, y sube el cambio:
   ```
   git add admin/config.yml && git commit -m "CMS: base_url del worker" && git push
   ```

---

## Parte E — Usar el CMS

1. Ve a `https://TU-WEB.pages.dev/admin/`
2. Pulsa **Sign in with GitHub** y autoriza.
3. Verás cuatro secciones en la barra lateral: **Blog, Feed, Photography, Audio**. Edita, sube imágenes/audio, y pulsa **Publish**.
4. Cada publicación hace un commit en GitHub → Cloudflare redepliega → cambios en vivo en ~1 min.

Notas:
- Las **imágenes** que subas van a `assets/img/`; los **audios** a `assets/audio/`.
- En el **Feed**, el campo *Tipo* decide qué se muestra: `text` (solo texto), `image` (rellena *Imagen*) o `video` (rellena *Póster* y, opcional, *Archivo de vídeo*).
- En **Photography**, cada imagen se asigna a un proyecto por su *clave*; usa las mismas claves que aparecen en la lista de proyectos.

---

## Editar en local (opcional, sin desplegar)

Para probar el CMS en tu ordenador antes de publicar:

1. Sirve la web en local (desde la carpeta del proyecto):
   ```
   npx serve .        # o: python3 -m http.server 8000
   ```
2. En otra terminal, arranca el puente local de Sveltia:
   ```
   npx @sveltia/cms-proxy-server
   ```
3. Abre `http://localhost:3000/admin/` (o el puerto que use `serve`). Como `local_backend: true` está activado, editarás los archivos de tu disco directamente, sin GitHub.

---

## Solución de problemas

### Error de deploy: "file ... .git/objects/pack/....pack ... size of 6X MiB" / límite 25 MiB
Cloudflare intentaba subir la carpeta `.git` (que pesa ~180 MB por los audios y vídeos versionados) como si fuera parte de la web. Ningún archivo real de la web supera el límite; el problema es solo `.git`.

**Solución (ya incluida):** el archivo `.assetsignore` en la raíz le dice a Cloudflare qué no subir (`.git`, `node_modules`, etc.). Solo tienes que asegurarte de que está subido al repo y volver a lanzar el deploy:

```
cd "/Volumes/Lexar/PERSONAL/mi web_claude/CUP_deploy"
rm -f .git/index.lock .git/HEAD.lock          # limpia los bloqueos del disco Lexar
git rm -r --cached "._*" "**/._*" 2>/dev/null # quita basura de macOS del repo
git add -A
git commit -m "Excluir .git del deploy (.assetsignore) + limpieza"
git push origin main
```

Después, en el panel de Cloudflare, pulsa **Retry deployment** (o se relanza solo con el push). Ahora debería completar.

### El deploy sigue fallando por tamaño
Confirma que `.assetsignore` está en la raíz del proyecto y contiene `.git`. Si usas *Direct Upload* en vez de la integración con Git, despliega solo la carpeta del sitio (no incluyas `.git`).

---

## Dominio propio (opcional)

En Cloudflare Pages → tu proyecto → **Custom domains** → añade tu dominio y sigue los pasos DNS. Después añade ese dominio a `ALLOWED_DOMAINS` del Worker y actualiza las URLs de la OAuth App.
