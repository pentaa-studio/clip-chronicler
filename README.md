# 🎬 Clip Chronicler API

API Python pour créer des clips vidéo avec overlay texte depuis YouTube, déployée sur Vercel.

## 🚀 Architecture

- **Runtime**: Python 3.12 (Vercel Functions)
- **YouTube Download**: `yt-dlp` (Python native)
- **Video Processing**: `ffmpeg` (système)
- **Storage**: Vercel Blob (à implémenter)

## 📋 Endpoint principal

```
GET /api/make-video
```

## 🧪 Test

```bash
# Test dry-run
curl "https://clip-chronicler.vercel.app/api/make-video?videoId=VrIjPGNgKg8&dry=1"

# Test réel
curl "https://clip-chronicler.vercel.app/api/make-video?videoId=VrIjPGNgKg8&start=0&dur=30&text=Chronique%20Trunks"
```

## 🔧 Paramètres

- `videoId` : ID YouTube (requis)
- `start` : début en secondes (défaut: 0)
- `dur` : durée en secondes (défaut: 20)
- `text` : texte à overlay (défaut: "Chronique Trunks")
- `dry=1` : mode test

## 🛠️ Développement local

```bash
# Installer Vercel CLI
npm i -g vercel

# Déployer
vercel --prod
```

## 📦 Dépendances

- `yt-dlp==2024.12.13` : Téléchargement YouTube
- `requests==2.31.0` : Requêtes HTTP

## 🎯 Fonctionnalités

- ✅ Téléchargement YouTube avec `yt-dlp`
- ✅ Conversion vidéo 9:16 avec `ffmpeg`
- ✅ Overlay texte
- ✅ Mode dry-run pour tests
- ✅ Gestion d'erreurs détaillée
- ⏳ Upload Vercel Blob (à implémenter)
