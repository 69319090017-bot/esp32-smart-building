export default async function handler(req, res) {
  const text = (req.query.text || '').trim().slice(0, 200);
  if (!text) {
    return res.status(400).send('Missing text parameter');
  }

  try {
    const encoded = encodeURIComponent(text);
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=th&client=tw-ob&q=${encoded}`;
    const response = await fetch(url, {
      headers: {
        'Referer': 'https://translate.google.com/',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      return res.status(response.status).send('TTS upstream service unavailable');
    }

    const buffer = await response.arrayBuffer();
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
    return res.status(200).send(Buffer.from(buffer));
  } catch (err) {
    return res.status(500).send(err?.message || 'Internal TTS Server Error');
  }
}
