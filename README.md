# Clip Chronicler

API endpoint pour créer des clips vidéo avec overlay texte depuis YouTube.

## Installation

```bash
npm install
```

## Démarrage

```bash
npm run dev
```

Le serveur démarre sur `http://localhost:3001`

## Testing

### Mode Dry-Run (sans ffmpeg/yt-dlp)

Pour tester l'endpoint sans exécuter les binaires :

**Local :**
```bash
npm run dev
```

Puis :
```
GET http://localhost:3001/api/make-video?videoId=dQw4w9WgXcQ&start=30&dur=20&text=Hello&dry=1
```

**Production (Vercel) :**
```
GET https://<ton-app>.vercel.app/api/make-video?videoId=dQw4w9WgXcQ&start=30&dur=20&text=Hello&dry=1
```

### Mode Normal (avec traitement complet)

```
GET http://localhost:3001/api/make-video?videoId=dQw4w9WgXcQ&start=30&dur=20&text=Hello
```

### Paramètres

- `videoId` : ID YouTube (requis)
- `start` : début en secondes (défaut: 0)
- `dur` : durée en secondes (défaut: 20)
- `text` : texte à overlay (défaut: "Chronique Trunks")
- `voice` : URL audio optionnelle
- `dry=1` : mode test (pas d'exécution ffmpeg/yt-dlp)

### Réponse

**Mode normal :**
```json
{
  "ok": true,
  "url": "https://..."
}
```

**Mode dry-run :**
```json
{
  "ok": true,
  "url": "blob://dry-run.mp4",
  "note": "dry-run, no ffmpeg/yt-dlp executed"
}
```

## Structure

```
clip-chronicler/
├── app/
│   └── api/
│       └── make-video/
│           └── route.ts          # Endpoint principal
├── bin/
│   ├── ffmpeg                    # Binaire ffmpeg
│   └── yt-dlp                    # Binaire yt-dlp
├── assets/
│   └── font.ttf                  # Police pour overlay texte
├── package.json
└── README.md
```

## Fonctionnalités

- ✅ Téléchargement d'extraits YouTube avec yt-dlp
- ✅ Traitement vidéo avec ffmpeg (9:16, overlay texte)
- ✅ Mode dry-run pour tests
- ✅ Support Node.js runtime (pas Edge)
- ✅ Upload vers Vercel Blob
- ✅ Gestion des erreurs robuste

## Déploiement

### GitHub

```bash
# Initialiser le repository
git init
git add .
git commit -m "Initial commit: Clip Chronicler API"

# Créer un repository sur GitHub puis :
git remote add origin https://github.com/votre-username/clip-chronicler.git
git branch -M main
git push -u origin main
```

### Vercel

1. Connectez votre repository GitHub à Vercel
2. Configurez les variables d'environnement :
   - `BLOB_READ_WRITE_TOKEN` : Token Vercel Blob
3. Déployez !

### Variables d'environnement

```bash
# Vercel Blob (optionnel, pour l'upload)
BLOB_READ_WRITE_TOKEN=your_token_here
```

## Développement

```bash
# Installer les dépendances
npm install

# Démarrer en développement
npm run dev

# Build pour production
npm run build

# Démarrer en production
npm start
```
# Trigger deployment
