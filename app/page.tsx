export default function Home() {
  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>🎬 Clip Chronicler API</h1>
      <p>API pour créer des clips vidéo avec overlay texte depuis YouTube</p>
      
      <h2>📋 Endpoint principal</h2>
      <code>/api/make-video</code>
      
      <h2>🧪 Test</h2>
      <a href="/api/test">Test API</a>
      
      <h2>🔧 Paramètres</h2>
      <ul>
        <li><code>videoId</code> : ID YouTube (requis)</li>
        <li><code>start</code> : début en secondes (défaut: 0)</li>
        <li><code>dur</code> : durée en secondes (défaut: 20)</li>
        <li><code>text</code> : texte à overlay (défaut: "Chronique Trunks")</li>
        <li><code>dry=1</code> : mode test</li>
      </ul>
    </div>
  )
}
