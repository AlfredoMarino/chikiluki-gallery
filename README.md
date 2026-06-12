# Chikiluki Gallery

Galería de fotos personal con estética editorial. Las fotos viven en tu propio
Google Drive; la app guarda solo metadatos y sirve las imágenes vía proxy.
Colecciones públicas/privadas, links para compartir, modo presentación a
pantalla completa y likes anónimos de visitantes.

## Stack

- **Next.js 16** (App Router, Turbopack) + React 19
- **Drizzle ORM** sobre **Postgres** ([Neon](https://neon.tech) serverless)
- **NextAuth v5** con Google OAuth (scope `drive.file`)
- **Google Drive API** para almacenamiento de originales + thumbnails
- **Tailwind CSS v4**
- **Sharp** para procesado de imágenes (thumbnails + blurhash)

> ⚠️ Esta versión de Next.js tiene breaking changes respecto a versiones
> anteriores. Antes de tocar código, lee la guía relevante en
> `node_modules/next/dist/docs/`. Ver [AGENTS.md](AGENTS.md).

## Setup

### 1. Instalar dependencias

```bash
npm install
```

### 2. Variables de entorno

Crea `.env.local` en la raíz:

```bash
# Postgres (Neon)
DATABASE_URL="postgresql://user:pass@host/db?sslmode=require"

# NextAuth — AUTH_SECRET y NEXTAUTH_SECRET deben tener el MISMO valor.
# Genera uno con: npx auth secret
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="<secret>"
AUTH_SECRET="<mismo secret>"

# Google OAuth (Google Cloud Console → Credentials)
GOOGLE_CLIENT_ID="<client-id>"
GOOGLE_CLIENT_SECRET="<client-secret>"
```

> `AUTH_SECRET` también firma los tokens HMAC del flujo de subida directa a
> Drive, por eso es obligatorio además de `NEXTAUTH_SECRET`.

### 3. Crear el esquema en la base de datos

```bash
npm run db:push
```

### 4. Arrancar

```bash
npm run dev
```

Abre [http://localhost:3000](http://localhost:3000).

## Comandos

| Comando | Descripción |
| --- | --- |
| `npm run dev` | Servidor de desarrollo (Turbopack) |
| `npm run build` | Build de producción |
| `npm run start` | Sirve el build de producción |
| `npm run lint` | ESLint |
| `npm run db:push` | Aplica el esquema de Drizzle a la BD (desarrollo) |
| `npm run db:generate` | Genera archivos de migración SQL |
| `npm run db:migrate` | Aplica migraciones generadas |
| `npm run db:studio` | Drizzle Studio (explorador visual de la BD) |

> Tras cambiar `src/lib/db/schema.ts` corre `npm run db:push` para reflejar los
> cambios en Postgres.

## Estructura

```
src/
├─ app/
│  ├─ (dashboard)/        # Vistas autenticadas (fotos, colecciones, subida)
│  ├─ gallery/[user]/     # Galerías públicas
│  ├─ s/[token]/          # Links de compartir (unlisted)
│  └─ api/
│     ├─ photos/          # CRUD de fotos del dueño
│     ├─ collections/     # CRUD de colecciones
│     ├─ drive/image/     # Proxy de imágenes desde Drive
│     └─ public/          # Endpoints anónimos (likes, galerías compartidas)
├─ components/
│  ├─ layouts/            # Motores de layout (grid/masonry/list/collage)
│  ├─ photos/             # Lightbox, modo presentación, uploader, cards
│  ├─ collections/        # Vista pública de colección
│  └─ likes/              # Provider + botón de likes
└─ lib/
   ├─ db/                 # Esquema y cliente Drizzle
   ├─ drive/              # Cliente de Google Drive + convención de carpetas
   ├─ data/public.ts      # Fetchers de datos públicos (server-only)
   └─ likes/              # Identidad de visitante por cookie
```

## Funcionalidades

### Subida directa a Drive

Las fotos se suben **directamente del navegador a Google Drive** (sesiones de
subida reanudable), saltándose el límite de payload de Vercel. El servidor solo
firma tokens HMAC, valida la integridad por hash y genera el thumbnail. Las
fotos siguen una convención estricta de carpetas/nombres
(`raw/{medium}/{year}/{camera}/{sesión}/{archivo}`).

### Colecciones y compartir

- **Privada**: solo tú.
- **Pública**: visible en `/gallery/{tu-nombre}/{slug}`.
- **Oculta (unlisted)**: accesible solo con el link `/s/{token}`.

Cada colección tiene un layout configurable (grid, masonry, lista, collage) con
columnas responsive, gap y overrides de tamaño por foto.

### Modo presentación

Slideshow a pantalla completa con navegación por teclado/swipe, rotación
automática de fotos landscape en pantallas portrait, y controles que se ocultan
solos. El link de compartir admite `?present=1` para abrir una landing que entra
directo a la presentación con un toque.

### Likes anónimos

Cualquier visitante de una página pública puede dar like a fotos individuales
**sin registrarse**. Una cookie `cl_visitor` (httpOnly, 2 años) identifica el
dispositivo y se crea solo al dar el primer like.

- Los **visitantes** ven únicamente su propio corazón (liked/no), nunca conteos.
- El **dueño** ve el total de likes por foto en su dashboard.

La tabla `photo_likes` usa un PK compuesto `(photoId, visitorId)` que impide
likes duplicados a nivel de base de datos. El endpoint solo acepta likes a fotos
que pertenecen a colecciones públicas/unlisted.

## Deploy

Pensado para [Vercel](https://vercel.com). Configura las mismas variables de
entorno en el proyecto y corre `npm run db:push` (o `db:migrate`) contra la BD
de producción. La función de finalización de subida usa `maxDuration = 300`
(requiere plan Pro).
