# Clip Chronicler

API Next.js pour créer des clips vidéo avec overlay texte depuis YouTube.

## 🚀 **Fonctionnalités**

- ✅ Téléchargement d'extraits YouTube avec yt-dlp
- ✅ Traitement vidéo avec ffmpeg (9:16, overlay texte)
- ✅ Mode dry-run pour tests
- ✅ Support des cookies YouTube (optionnel)
- ✅ Upload vers Vercel Blob
- ✅ Architecture Next.js optimisée pour Vercel

## 📦 **Installation**

```bash
npm install
```

## 🏃‍♂️ **Démarrage**

```bash
# Développement
npm run dev

# Production
npm run build
npm start
```

Le serveur démarre sur `http://localhost:3001`

## 🧪 **Testing**

### Mode Dry-Run (sans traitement)

```bash
curl "http://localhost:3001/api/make-video?videoId=test&start=0&dur=20&text=Test&dry=1"
```

### Mode Normal (avec traitement complet)

```bash
curl "http://localhost:3001/api/make-video?videoId=VrIjPGNgKg8&start=0&dur=30&text=Chronique%20Trunks"
```

### Avec Cookies YouTube (optionnel)

```bash
curl "http://localhost:3001/api/make-video?videoId=VrIjPGKg8&start=0&dur=30&text=Test&cookies=YOUR_COOKIES"
```

## 📋 **Paramètres**

- `videoId` : ID YouTube (requis)
- `start` : début en secondes (défaut: 0)
- `dur` : durée en secondes (défaut: 20)
- `text` : texte à overlay (défaut: "Chronique Trunks")
- `cookies` : cookies YouTube (optionnel)
- `dry=1` : mode test (pas d'exécution ffmpeg/yt-dlp)

## 📁 **Structure**

```
clip-chronicler/
├── app/
│   └── api/
│       └── make-video/
│           └── route.ts          # Endpoint principal
├── bin/
│   ├── ffmpeg                    # Binaire ffmpeg (dev)
│   └── yt-dlp                    # Binaire yt-dlp (dev)
├── assets/
│   └── font.ttf                  # Police pour overlay texte
├── package.json
├── vercel.json                   # Configuration Vercel
└── README.md
```

## 🚀 **Déploiement Vercel**

1. **Connectez votre repository GitHub à Vercel**
2. **Configurez les variables d'environnement :**
   - `BLOB_READ_WRITE_TOKEN` : Token Vercel Blob
3. **Déployez !**

L'API sera disponible sur : `https://your-app.vercel.app/api/make-video`

## 💡 **Avantages de cette architecture**

- 🚀 **Optimisé pour Vercel** : Utilise les binaires système
- ⚡ **Rapide** : Pas de téléchargement de binaires
- 🔧 **Simple** : Une seule API route
- 📦 **Léger** : Dépendances minimales
- 🛡️ **Robuste** : Gestion d'erreurs complète

## 🔧 **Développement**

```bash
# Installer les dépendances
npm install

# Démarrer en développement
npm run dev

# Tester l'API
curl "http://localhost:3001/api/make-video?videoId=test&dry=1"
```

## 📝 **Notes**

- Les binaires `ffmpeg` et `yt-dlp` sont automatiquement disponibles sur Vercel
- En développement local, les binaires dans `bin/` sont utilisés
- Le mode dry-run permet de tester sans traitement vidéo
- Les cookies YouTube sont optionnels mais peuvent aider à contourner les blocages
