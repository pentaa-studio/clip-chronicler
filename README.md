# Clip Chronicler

API Python pour créer des clips vidéo avec overlay texte depuis YouTube.

## Installation

```bash
pip install -r requirements.txt
```

## Démarrage

```bash
python main.py
```

Le serveur démarre sur `http://localhost:8080`

## Testing

### Mode Dry-Run (sans ffmpeg/yt-dlp)

Pour tester l'endpoint sans exécuter les binaires :

**Local :**
```bash
python main.py
```

Puis :
```
GET http://localhost:8080/api/make-video?videoId=dQw4w9WgXcQ&start=30&dur=20&text=Hello&dry=1
```

**Production (Google Cloud Run) :**
```
GET https://<your-app>.run.app/api/make-video?videoId=dQw4w9WgXcQ&start=30&dur=20&text=Hello&dry=1
```

### Mode Normal (avec traitement complet)

```
GET http://localhost:8080/api/make-video?videoId=dQw4w9WgXcQ&start=30&dur=20&text=Hello
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
  "url": "https://storage.googleapis.com/clip-chronicler-videos/trunks/..."
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
├── main.py                       # Application Flask principale
├── requirements.txt              # Dépendances Python
├── Dockerfile                    # Configuration Docker
├── assets/
│   └── font.ttf                  # Police pour overlay texte
└── README.md
```

## Fonctionnalités

- ✅ Téléchargement d'extraits YouTube avec yt-dlp
- ✅ Traitement vidéo avec ffmpeg (9:16, overlay texte)
- ✅ Mode dry-run pour tests
- ✅ Upload vers Google Cloud Storage
- ✅ Gestion des erreurs robuste
- ✅ Architecture Python pure (plus simple et rapide)

## Déploiement

### Google Cloud Platform

1. **Créer le projet GCP :**
```bash
gcloud projects create clip-chronicler-gcp
gcloud config set project clip-chronicler-gcp
```

2. **Activer les APIs :**
```bash
gcloud services enable cloudbuild.googleapis.com
gcloud services enable run.googleapis.com
gcloud services enable storage.googleapis.com
```

3. **Créer le bucket :**
```bash
gcloud storage buckets create gs://clip-chronicler-videos --location=us-central1
```

4. **Déployer :**
```bash
gcloud builds submit --config cloudbuild.yaml
```

### Variables d'environnement

L'application utilise l'authentification par défaut de Google Cloud. Assurez-vous que votre compte a les permissions nécessaires :

- `Storage Object Admin` pour le bucket
- `Cloud Run Admin` pour le déploiement

## Développement

```bash
# Installer les dépendances
pip install -r requirements.txt

# Démarrer en développement
python main.py

# Tester l'API
curl "http://localhost:8080/health"
```

## Avantages de l'architecture Python

- 🐍 **Plus simple** : Un seul langage pour tout
- ⚡ **Plus rapide** : Pas de bridge Node.js ↔ Python
- 📦 **Plus léger** : Moins de dépendances
- 💰 **Moins cher** : Image Docker plus petite
- 🔧 **Plus maintenable** : Code plus cohérent
