import { MPEGDecoder } from 'mpg123-decoder';

let decoder = null;
async function getDecoder() {
  if (!decoder) {
    decoder = new MPEGDecoder();
    await decoder.ready;
  }
  return decoder;
}

function resample(data, inRate, outRate) {
  if (inRate === outRate) return data;
  const outLen = Math.floor(data.length * outRate / inRate);
  const out = new Float32Array(outLen);
  for (let i = 0; i < outLen; i++) {
    const pos = i * inRate / outRate;
    const idx = Math.floor(pos);
    const frac = pos - idx;
    const s1 = data[idx] || 0;
    const s2 = data[idx + 1] !== undefined ? data[idx + 1] : s1;
    out[i] = s1 + frac * (s2 - s1);
  }
  return out;
}

export default async function handler(req, res) {
  const text = (req.query.text || '').trim().slice(0, 200);
  if (!text) {
    return res.status(400).send('Missing text parameter');
  }

  const format = (req.query.format || '').toLowerCase();

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

    if (format === 'pcm') {
      const dec = await getDecoder();
      const decoded = dec.decode(new Uint8Array(buffer));
      const inRate = decoded.sampleRate || 24000;
      const targetRate = 16000; // Matches ESP32 PCM5102 I2S sample rate perfectly

      const left = resample(decoded.channelData[0], inRate, targetRate);
      const right = decoded.channelData[1]
        ? resample(decoded.channelData[1], inRate, targetRate)
        : left;

      const numSamples = left.length;
      const pcm = Buffer.alloc(numSamples * 2 * 2); // 16-bit stereo (4 bytes per sample)
      for (let i = 0; i < numSamples; i++) {
        const l = Math.max(-1, Math.min(1, left[i]));
        const r = Math.max(-1, Math.min(1, right[i]));
        pcm.writeInt16LE(Math.floor(l < 0 ? l * 32768 : l * 32767), i * 4);
        pcm.writeInt16LE(Math.floor(r < 0 ? r * 32768 : r * 32767), i * 4 + 2);
      }

      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Length', pcm.length);
      res.setHeader('X-Sample-Rate', '16000');
      res.setHeader('X-Channels', '2');
      res.setHeader('X-Bits-Per-Sample', '16');
      res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
      return res.status(200).send(pcm);
    }

    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Cache-Control', 'public, max-age=86400, s-maxage=86400');
    return res.status(200).send(Buffer.from(buffer));
  } catch (err) {
    return res.status(500).send(err?.message || 'Internal TTS Server Error');
  }
}
