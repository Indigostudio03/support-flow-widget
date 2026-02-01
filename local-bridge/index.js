#!/usr/bin/env node
/**
 * Local Bridge - Polling
 * Récupère les tâches depuis Vercel et les écrit dans Auto Claude
 *
 * Usage: node local-bridge/index.js
 *        ou: npm run local-bridge
 */

// Charger les variables d'environnement depuis .env
require('dotenv').config({ path: require('path').join(__dirname, '.env') });

const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════════════════
// CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════

// Configuration des projets (projectId → dossier Auto Claude)
const PROJECTS_CONFIG = {
  'vigitask': {
    name: 'Vigitask',
    specsDir: '/Users/ennadayhamza/Dropbox/Visoo.be/Clients/AxessGuarding_23052017/V2/Vigitask-1/.auto-claude/specs'
  },
  'default': {
    name: 'Default',
    specsDir: process.env.AUTO_CLAUDE_SPECS_DIR || path.join(__dirname, '../specs')
  }
  // Ajouter d'autres projets ici:
  // 'autre-projet': {
  //   name: 'Autre Projet',
  //   specsDir: '/chemin/vers/.auto-claude/specs'
  // }
};

const CONFIG = {
  // URL de l'API Vercel (à modifier après déploiement)
  API_URL: process.env.VERCEL_API_URL || 'https://your-app.vercel.app',

  // Secret pour l'authentification (doit correspondre à celui de Vercel)
  POLLING_SECRET: process.env.POLLING_SECRET || 'dev-secret',

  // Intervalle de polling (en secondes)
  POLL_INTERVAL: parseInt(process.env.POLL_INTERVAL) || 30,

  // Fichier de log local
  LOG_FILE: path.join(__dirname, 'sync.log')
};

function getSpecsDir(projectId) {
  const project = PROJECTS_CONFIG[projectId] || PROJECTS_CONFIG['default'];
  return project.specsDir;
}

// ═══════════════════════════════════════════════════════════════════════════
// LOGGING
// ═══════════════════════════════════════════════════════════════════════════

function log(message, type = 'info') {
  const timestamp = new Date().toISOString();
  const icons = { info: 'ℹ️', success: '✅', error: '❌', warn: '⚠️', task: '📋' };
  const icon = icons[type] || 'ℹ️';

  const logLine = `[${timestamp}] ${icon} ${message}`;
  console.log(logLine);

  // Écrire dans le fichier de log
  fs.appendFileSync(CONFIG.LOG_FILE, logLine + '\n');
}

// ═══════════════════════════════════════════════════════════════════════════
// API CALLS
// ═══════════════════════════════════════════════════════════════════════════

async function fetchPendingTasks() {
  try {
    const response = await fetch(`${CONFIG.API_URL}/api/tasks/poll`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CONFIG.POLLING_SECRET}`,
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return await response.json();
  } catch (error) {
    log(`Erreur fetch: ${error.message}`, 'error');
    return { tasks: [], error: error.message };
  }
}

async function markTasksSynced(taskIds) {
  try {
    const response = await fetch(`${CONFIG.API_URL}/api/tasks/poll`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.POLLING_SECRET}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ taskIds })
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    return await response.json();
  } catch (error) {
    log(`Erreur mark synced: ${error.message}`, 'error');
    return { success: false };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SPEC CREATION
// ═══════════════════════════════════════════════════════════════════════════

function getNextSpecNumber(specsDir) {
  if (!fs.existsSync(specsDir)) {
    fs.mkdirSync(specsDir, { recursive: true });
    return '001';
  }

  const existingSpecs = fs.readdirSync(specsDir).filter(f => {
    const fullPath = path.join(specsDir, f);
    return fs.statSync(fullPath).isDirectory() && /^\d{3}-/.test(f);
  });

  return String(existingSpecs.length + 1).padStart(3, '0');
}

function createSpecFolder(task) {
  const specsDir = getSpecsDir(task.projectId || 'default');
  const specNumber = getNextSpecNumber(specsDir);

  // Créer le slug du titre
  const specSlug = task.title
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // Supprimer accents
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

  const specFolderName = `${specNumber}-${specSlug}`;
  const specFolder = path.join(specsDir, specFolderName);

  // Créer le dossier
  if (!fs.existsSync(specFolder)) {
    fs.mkdirSync(specFolder, { recursive: true });
  }

  return { specNumber, specFolderName, specFolder, specsDir };
}

function createRequirements(task) {
  // Créer le task_description formaté en markdown
  const taskDescription = `# ${task.title}

## Description
${task.description}

## Étapes de reproduction
${task.steps?.map((s, i) => `${i + 1}. ${s}`).join('\n') || 'Non spécifiées'}

## Critères d'acceptation
- Le bug est reproduit et compris
- La correction est implémentée
- Les tests passent
- Pas de régression
`;

  return {
    task_description: taskDescription,
    workflow_type: 'bug_fix'
  };
}

function createTaskMetadata(task) {
  // Mapping de catégorie vers le format Auto-Claude
  const categoryMapping = {
    'bug': 'bug_fix',
    'feature': 'feature',
    'improvement': 'improvement',
    'refactoring': 'refactoring'
  };

  // Mapping de priorité vers complexité/impact
  const complexityMapping = {
    'low': 'low',
    'medium': 'medium',
    'high': 'high',
    'critical': 'high'
  };

  return {
    sourceType: 'widget',
    model: 'opus',
    thinkingLevel: 'ultrathink',
    isAutoProfile: false,
    phaseModels: {
      spec: 'opus',
      planning: 'opus',
      coding: 'opus',
      qa: 'opus'
    },
    phaseThinking: {
      spec: 'ultrathink',
      planning: 'ultrathink',
      coding: 'ultrathink',
      qa: 'ultrathink'
    },
    baseBranch: 'main',
    category: categoryMapping[task.category] || 'bug_fix',
    complexity: complexityMapping[task.priority] || 'medium',
    impact: complexityMapping[task.priority] || 'medium',
    attachedImages: task.screenshots?.map((_, i) => `screenshots/screenshot-${i}.png`) || [],
    requireReviewBeforeCoding: false
  };
}

function createSpecContent(task, specNumber) {
  const { analysis } = task;

  // Section captures d'écran
  let screenshotsSection = '';
  if (task.screenshots && task.screenshots.length > 0) {
    screenshotsSection = `## Captures d'écran
${task.screenshots.map((s, i) => `![Screenshot ${i + 1}](./screenshots/screenshot-${i}.png)`).join('\n')}

> **Note pour Claude Code**: Les captures d'écran sont disponibles dans le dossier \`screenshots/\` de cette spec. Utilise l'outil Read pour les visualiser.

`;
  }

  // Section logs console (si présents)
  let consoleLogsSection = '';
  if (task.consoleLogs && task.consoleLogs.length > 0) {
    const errorLogs = task.consoleLogs.filter(l => l.type === 'error' || l.type === 'uncaught_error' || l.type === 'unhandled_rejection');
    const warnLogs = task.consoleLogs.filter(l => l.type === 'warn');

    if (errorLogs.length > 0 || warnLogs.length > 0) {
      consoleLogsSection = `## Logs Console (capturés automatiquement)

> **Note pour Claude Code**: Ces logs ont été capturés automatiquement au moment du signalement du bug.

`;
      if (errorLogs.length > 0) {
        consoleLogsSection += `### Erreurs (${errorLogs.length})
\`\`\`
${errorLogs.map(l => `[${l.type}] ${l.timestamp}\n${l.message}${l.stack ? '\n' + l.stack : ''}`).join('\n\n')}
\`\`\`

`;
      }
      if (warnLogs.length > 0) {
        consoleLogsSection += `### Avertissements (${warnLogs.length})
\`\`\`
${warnLogs.map(l => `[warn] ${l.timestamp}\n${l.message}`).join('\n\n')}
\`\`\`

`;
      }
    }
  }

  // Section infos page (si présentes)
  let pageInfoSection = '';
  if (task.pageInfo && task.pageInfo.url) {
    pageInfoSection = `## Contexte Navigateur
- **URL**: ${task.pageInfo.url}
- **User Agent**: ${task.pageInfo.userAgent || 'Non disponible'}
- **Timestamp**: ${task.pageInfo.timestamp || 'Non disponible'}

`;
  }

  return `# ${task.title}

## Objectif
Corriger le bug: ${task.title}

## Description
${task.description}

${screenshotsSection}${consoleLogsSection}${pageInfoSection}## Contexte
- **Catégorie**: ${task.category || 'Non spécifiée'}
- **Composant**: ${task.component || 'À déterminer'}
- **Priorité**: ${task.priority || 'medium'}

## Étapes de reproduction
${task.steps?.map((s, i) => `${i + 1}. ${s}`).join('\n') || 'Non spécifiées'}

## Analyse préliminaire
- **Fichier probable**: ${analysis?.probable_file || 'À déterminer'}
- **Cause probable**: ${analysis?.probable_cause || 'À analyser'}
- **Suggestion**: ${analysis?.suggestion || 'Analyser le code'}
- **Confiance**: ${analysis?.confidence || 'N/A'}

## Critères d'acceptation
- [ ] Le bug est reproduit et compris
- [ ] La correction est implémentée
- [ ] Les tests passent
- [ ] Pas de régression

## Notes
- ID: ${task.id}
- Projet: ${task.projectName || task.projectId || 'default'}
- Spec: ${specNumber}
- Créé: ${task.createdAt}
- Synchronisé: ${new Date().toISOString()}
- Source: Bug Reporter Widget (Vercel)
- Captures d'écran: ${task.screenshots?.length || 0} image(s)
`;
}

function saveScreenshots(task, specFolder) {
  if (!task.screenshots || task.screenshots.length === 0) {
    return [];
  }

  const screenshotsFolder = path.join(specFolder, 'screenshots');
  if (!fs.existsSync(screenshotsFolder)) {
    fs.mkdirSync(screenshotsFolder, { recursive: true });
  }

  const saved = [];

  task.screenshots.forEach((screenshot, index) => {
    try {
      // Extraire les données base64
      const base64Data = screenshot.data.replace(/^data:image\/\w+;base64,/, '');
      const filename = `screenshot-${index}.png`;
      const filepath = path.join(screenshotsFolder, filename);

      fs.writeFileSync(filepath, base64Data, 'base64');
      saved.push(filename);
      log(`  📸 Screenshot sauvegardé: ${filename}`, 'info');
    } catch (error) {
      log(`  ❌ Erreur screenshot ${index}: ${error.message}`, 'error');
    }
  });

  return saved;
}

async function processTask(task) {
  const projectLabel = task.projectName || task.projectId || 'default';
  log(`Traitement de la tâche [${projectLabel}]: ${task.title}`, 'task');

  try {
    // Créer le dossier spec
    const { specNumber, specFolderName, specFolder, specsDir } = createSpecFolder(task);

    // Créer le contenu du spec.md
    const specContent = createSpecContent(task, specNumber);

    // Écrire le fichier spec.md
    const specFile = path.join(specFolder, 'spec.md');
    fs.writeFileSync(specFile, specContent);
    log(`  📝 Spec créée: ${specsDir}/${specFolderName}/spec.md`, 'success');

    // Créer le fichier task_metadata.json (requis par Auto-Claude.app)
    const taskMetadata = createTaskMetadata(task);
    const metadataFile = path.join(specFolder, 'task_metadata.json');
    fs.writeFileSync(metadataFile, JSON.stringify(taskMetadata, null, 2));
    log(`  📋 Metadata créée: task_metadata.json`, 'success');

    // Créer le fichier requirements.json (requis par Auto-Claude.app pour validation)
    const requirements = createRequirements(task);
    const requirementsFile = path.join(specFolder, 'requirements.json');
    fs.writeFileSync(requirementsFile, JSON.stringify(requirements, null, 2));
    log(`  📋 Requirements créées: requirements.json`, 'success');

    // Sauvegarder les logs console (si présents)
    if (task.consoleLogs && task.consoleLogs.length > 0) {
      const consoleLogsFile = path.join(specFolder, 'console_logs.json');
      fs.writeFileSync(consoleLogsFile, JSON.stringify({
        capturedAt: task.pageInfo?.timestamp || new Date().toISOString(),
        pageUrl: task.pageInfo?.url || 'unknown',
        userAgent: task.pageInfo?.userAgent || 'unknown',
        logs: task.consoleLogs
      }, null, 2));
      log(`  🔧 Console logs sauvegardés: console_logs.json (${task.consoleLogs.length} entrées)`, 'success');
    }

    // Sauvegarder les captures d'écran
    const savedScreenshots = saveScreenshots(task, specFolder);
    if (savedScreenshots.length > 0) {
      log(`  📷 ${savedScreenshots.length} capture(s) sauvegardée(s)`, 'success');
    }

    return { success: true, specFolder: specFolderName };
  } catch (error) {
    log(`  ❌ Erreur: ${error.message}`, 'error');
    return { success: false, error: error.message };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN POLLING LOOP
// ═══════════════════════════════════════════════════════════════════════════

async function poll() {
  log('Vérification des nouvelles tâches...', 'info');

  const result = await fetchPendingTasks();

  if (result.error) {
    log(`Erreur API: ${result.error}`, 'error');
    return;
  }

  const { tasks, unsynced } = result;

  if (!tasks || tasks.length === 0) {
    log('Aucune nouvelle tâche', 'info');
    return;
  }

  log(`${tasks.length} tâche(s) à synchroniser`, 'info');

  const syncedIds = [];

  for (const task of tasks) {
    const processResult = await processTask(task);
    if (processResult.success) {
      syncedIds.push(task.id);
    }
  }

  // Marquer les tâches comme synchronisées
  if (syncedIds.length > 0) {
    await markTasksSynced(syncedIds);
    log(`${syncedIds.length} tâche(s) marquée(s) comme synchronisée(s)`, 'success');
  }
}

async function startPolling() {
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('  🔄 LOCAL BRIDGE - Sync Vercel → Auto Claude');
  console.log('═══════════════════════════════════════════════════════════════\n');

  log(`API URL: ${CONFIG.API_URL}`, 'info');
  log(`Intervalle: ${CONFIG.POLL_INTERVAL}s`, 'info');
  console.log('');

  // Afficher les projets configurés
  log('Projets configurés:', 'info');
  for (const [id, project] of Object.entries(PROJECTS_CONFIG)) {
    const exists = fs.existsSync(project.specsDir);
    log(`  - ${id} (${project.name}): ${project.specsDir} ${exists ? '✓' : '⚠️ non trouvé'}`, exists ? 'info' : 'warn');
  }
  console.log('');

  // Vérifier la connexion
  if (CONFIG.API_URL.includes('your-app')) {
    log('⚠️  Configure VERCEL_API_URL dans .env avec l\'URL de ton app Vercel!', 'warn');
    log('   Exemple: VERCEL_API_URL=https://support-flow-xyz.vercel.app', 'warn');
    console.log('');
  }

  // Premier poll immédiat
  await poll();

  // Puis à intervalles réguliers
  setInterval(poll, CONFIG.POLL_INTERVAL * 1000);

  log(`Polling actif (toutes les ${CONFIG.POLL_INTERVAL}s). Ctrl+C pour arrêter.`, 'info');
}

// ═══════════════════════════════════════════════════════════════════════════
// START
// ═══════════════════════════════════════════════════════════════════════════

startPolling().catch(error => {
  log(`Erreur fatale: ${error.message}`, 'error');
  process.exit(1);
});
