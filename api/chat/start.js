/**
 * POST /api/chat/start
 * Démarre une nouvelle conversation
 */

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

  const sessionId = 'session_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);

  // En serverless, on ne peut pas stocker en mémoire
  // Le client garde l'historique et le renvoie à chaque message

  res.json({
    sessionId,
    message: "Salut! 👋 Décris-moi le problème que tu rencontres. Tu peux aussi joindre une capture d'écran si ça aide!"
  });
}
