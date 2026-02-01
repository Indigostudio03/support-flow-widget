/**
 * POST /api/tasks/store
 * Stocke une tâche (appelé internement après analyse)
 * Utilise Vercel KV si disponible, sinon stockage temporaire
 */

// Stockage temporaire en mémoire (pour dev/fallback)
// En production, utiliser Vercel KV ou une DB
let memoryStore = [];

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Vérifier le secret (sécurité basique)
  const secret = req.headers['x-internal-secret'];
  if (secret !== (process.env.POLLING_SECRET || 'dev-secret')) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const task = req.body;

  if (!task || !task.id) {
    return res.status(400).json({ error: 'Invalid task' });
  }

  try {
    // Essayer Vercel KV si disponible
    if (process.env.KV_REST_API_URL && process.env.KV_REST_API_TOKEN) {
      const { kv } = await import('@vercel/kv');

      // Ajouter à la liste des tâches
      const tasks = await kv.get('pending_tasks') || [];
      tasks.push(task);
      await kv.set('pending_tasks', tasks);

      console.log(`Task stored in KV: ${task.id}`);
    } else {
      // Fallback: stockage en mémoire (limité en serverless)
      memoryStore.push(task);
      console.log(`Task stored in memory: ${task.id} (total: ${memoryStore.length})`);
    }

    res.json({ success: true, taskId: task.id });
  } catch (error) {
    console.error('Store error:', error);
    // Fallback en mémoire
    memoryStore.push(task);
    res.json({ success: true, taskId: task.id, fallback: true });
  }
}

// Export pour le polling
export { memoryStore };
