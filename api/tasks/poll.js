/**
 * GET /api/tasks/poll
 * Récupère les tâches non synchronisées pour le bridge local
 * POST /api/tasks/poll - Marquer des tâches comme synchronisées
 */

let memoryStore = [];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Vérifier le secret
  const authHeader = req.headers.authorization;
  const secret = authHeader?.replace('Bearer ', '');

  if (secret !== (process.env.POLLING_SECRET || 'dev-secret')) {
    return res.status(401).json({ error: 'Unauthorized - Invalid secret' });
  }

  try {
    let tasks = [];

    // Essayer Vercel KV si disponible
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const { kv } = await import('@vercel/kv');
      tasks = await kv.get('pending_tasks') || [];
    } else {
      tasks = memoryStore;
    }

    if (req.method === 'GET') {
      // Récupérer les tâches non synchronisées
      const unsynced = tasks.filter(t => !t.synced);

      return res.json({
        tasks: unsynced,
        total: tasks.length,
        unsynced: unsynced.length
      });
    }

    if (req.method === 'POST') {
      // Marquer des tâches comme synchronisées
      const { taskIds } = req.body;

      if (!taskIds || !Array.isArray(taskIds)) {
        return res.status(400).json({ error: 'taskIds array required' });
      }

      // Mettre à jour le statut
      tasks = tasks.map(t => {
        if (taskIds.includes(t.id)) {
          return { ...t, synced: true, syncedAt: new Date().toISOString() };
        }
        return t;
      });

      // Sauvegarder
      if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
        const { kv } = await import('@vercel/kv');
        await kv.set('pending_tasks', tasks);
      } else {
        memoryStore = tasks;
      }

      return res.json({
        success: true,
        synced: taskIds.length
      });
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Poll error:', error);
    res.status(500).json({ error: error.message });
  }
}
