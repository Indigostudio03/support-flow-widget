/**
 * POST /api/chat/start
 * Démarre une nouvelle conversation
 */

// Projets configurés (à étendre selon les besoins)
const PROJECTS = {
  'vigitask': {
    name: 'Vigitask',
    description: 'Application de gestion de présences et planning',
    components: ['attendance', 'clients', 'reports', 'auth', 'dashboard', 'agents', 'planning'],
    welcomeMessage: "Salut! 👋 Décris-moi le problème que tu rencontres sur Vigitask. Tu peux aussi joindre une capture d'écran!"
  },
  'default': {
    name: 'Projet',
    description: 'Application',
    components: [],
    welcomeMessage: "Salut! 👋 Décris-moi le problème que tu rencontres. Tu peux aussi joindre une capture d'écran si ça aide!"
  }
};

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { projectId = 'default' } = req.body;
  const project = PROJECTS[projectId] || PROJECTS['default'];

  const sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

  res.json({
    sessionId,
    projectId,
    projectName: project.name,
    message: project.welcomeMessage
  });
}

export { PROJECTS };
