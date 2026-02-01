# Bug Reporter Widget

Widget de signalement de bugs intelligent avec analyse IA et synchronisation vers Auto Claude.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  N'importe quelle App Web                                   │
│  <script src="https://votre-app.vercel.app/widget.js"/>    │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│  Vercel (Cloud)                                             │
│  - API serverless                                           │
│  - Analyse OpenAI GPT-4                                     │
│  - Stockage des tâches                                      │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼ Polling (30s)
┌─────────────────────────────────────────────────────────────┐
│  Local Bridge (ton Mac)                                     │
│  - Récupère les tâches                                      │
│  - Écrit dans .auto-claude/specs/                          │
│  - Copie les screenshots                                    │
└─────────────────────────────────────────────────────────────┘
```

## Déploiement Vercel

### 1. Créer le repo GitHub

```bash
cd support-flow-vercel
git init
git add .
git commit -m "Initial commit"
gh repo create support-flow-widget --public --source=. --push
```

### 2. Déployer sur Vercel

1. Va sur [vercel.com](https://vercel.com)
2. Import le repo GitHub
3. Configure les variables d'environnement :
   - `OPENAI_API_KEY` : ta clé OpenAI
   - `POLLING_SECRET` : un secret aléatoire (générer avec `openssl rand -hex 32`)

### 3. Configurer le Local Bridge

```bash
cd local-bridge
cp .env.example .env
# Modifier .env avec l'URL Vercel et le même POLLING_SECRET
```

## Usage

### Intégrer le widget dans une app

**Option 1: Avec data-project (recommandé)**
```html
<script src="https://votre-app.vercel.app/widget.js" data-project="vigitask"></script>
```

**Option 2: Avec init()**
```html
<script src="https://votre-app.vercel.app/widget.js"></script>
<script>
  BugReporter.init({ projectId: 'vigitask' });
</script>
```

Le `projectId` permet de router les bugs vers le bon dossier Auto Claude!

### Lancer le bridge local

```bash
npm run local-bridge
# ou
node local-bridge/index.js
```

Le bridge vérifie les nouvelles tâches toutes les 30 secondes et les écrit dans Auto Claude.

## Structure des specs Auto Claude

```
.auto-claude/specs/
└── 005-mon-bug/
    ├── spec.md           # Description du bug
    └── screenshots/      # Captures d'écran
        ├── screenshot-0.png
        └── screenshot-1.png
```

## Configuration des projets

### Ajouter un nouveau projet

1. **Dans `api/chat/start.js` et `api/chat/message.js`**, ajouter le projet:
```javascript
const PROJECTS = {
  'vigitask': { ... },
  'mon-nouveau-projet': {
    name: 'Mon Projet',
    description: 'Description du projet',
    components: ['component1', 'component2']
  }
};
```

2. **Dans `local-bridge/index.js`**, configurer le dossier Auto Claude:
```javascript
const PROJECTS_CONFIG = {
  'vigitask': { ... },
  'mon-nouveau-projet': {
    name: 'Mon Projet',
    specsDir: '/chemin/vers/.auto-claude/specs'
  }
};
```

### Projets préconfigurés

| projectId | Projet | Dossier Auto Claude |
|-----------|--------|---------------------|
| `vigitask` | Vigitask | `.../Vigitask-1/.auto-claude/specs` |
| `default` | Par défaut | `./specs` |

## Variables d'environnement

### Vercel (.env)

| Variable | Description |
|----------|-------------|
| `OPENAI_API_KEY` | Clé API OpenAI |
| `POLLING_SECRET` | Secret pour l'authentification du bridge |

### Local Bridge (.env)

| Variable | Description |
|----------|-------------|
| `VERCEL_API_URL` | URL de l'app Vercel |
| `POLLING_SECRET` | Même secret que Vercel |
| `POLL_INTERVAL` | Intervalle en secondes (défaut: 30) |
