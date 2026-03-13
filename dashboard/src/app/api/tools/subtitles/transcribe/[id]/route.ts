import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/server/auth';

const SONIOX_API_URL = 'https://api.soniox.com/v1';

interface SubtitleEntry {
  id: string;
  start: number;
  end: number;
  text: string;
}

/**
 * Convert Soniox tokens into subtitle segments.
 * Groups tokens into segments of ~5 seconds or ~80 chars, breaking on punctuation.
 */
function tokensToSubtitles(tokens: any[]): SubtitleEntry[] {
  if (!tokens || tokens.length === 0) return [];

  const subtitles: SubtitleEntry[] = [];
  let currentText = '';
  let segmentStart: number | null = null;
  let segmentEnd = 0;
  let idx = 0;

  const MAX_SEGMENT_DURATION = 5; // seconds
  const MAX_SEGMENT_CHARS = 80;

  for (const token of tokens) {
    const start = token.start_ms / 1000;
    const end = token.end_ms / 1000;

    if (segmentStart === null) segmentStart = start;
    currentText += token.text;
    segmentEnd = end;

    // Break segment on duration, char limit, or sentence-ending punctuation
    const duration = segmentEnd - (segmentStart ?? 0);
    const endsWithPunctuation = /[.!?]\s*$/.test(currentText.trim());

    if (duration >= MAX_SEGMENT_DURATION || currentText.length >= MAX_SEGMENT_CHARS || endsWithPunctuation) {
      const trimmed = currentText.trim();
      if (trimmed) {
        subtitles.push({
          id: `sub-${idx++}`,
          start: segmentStart ?? 0,
          end: segmentEnd,
          text: trimmed,
        });
      }
      currentText = '';
      segmentStart = null;
    }
  }

  // Flush remaining
  if (currentText.trim()) {
    subtitles.push({
      id: `sub-${idx}`,
      start: segmentStart ?? 0,
      end: segmentEnd,
      text: currentText.trim(),
    });
  }

  return subtitles;
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    await requireAuth(req);
    const { id } = await params;

    const apiKey = process.env.SONIX_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'SONIX_API_KEY not configured' }, { status: 500 });

    // 1. Check status
    const res = await fetch(`${SONIOX_API_URL}/transcriptions/${id}`, {
      headers: { 'Authorization': `Bearer ${apiKey}` },
    });

    if (!res.ok) {
      const err = await res.text();
      return NextResponse.json({ error: err }, { status: res.status });
    }

    const data = await res.json();
    console.log('[Subtitles] Status:', data.status);

    const status = data.status?.toLowerCase();
    if (status === 'completed') {
      // 2. Fetch transcript with tokens
      const transcriptRes = await fetch(`${SONIOX_API_URL}/transcriptions/${id}/transcript`, {
        headers: { 'Authorization': `Bearer ${apiKey}` },
      });

      if (!transcriptRes.ok) {
        const err = await transcriptRes.text();
        return NextResponse.json({ error: `Failed to fetch transcript: ${err}` }, { status: 500 });
      }

      const transcriptData = await transcriptRes.json();
      console.log('[Subtitles] Token count:', transcriptData.tokens?.length || 0);

      const tokens = transcriptData.tokens || [];
      const subtitles = tokensToSubtitles(tokens);
      console.log('[Subtitles] Segments:', subtitles.length);

      return NextResponse.json({
        status: 'completed',
        subtitles,
        text: transcriptData.text || subtitles.map(s => s.text).join(' '),
      });
    }

    if (status === 'failed') {
      return NextResponse.json({
        status: 'failed',
        error: data.error_message || 'Transcription failed',
      });
    }

    // Still processing
    return NextResponse.json({ status: status || 'processing' });

  } catch (error: any) {
    console.error('[Subtitles Status] Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
