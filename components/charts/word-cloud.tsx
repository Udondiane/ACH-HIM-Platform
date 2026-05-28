'use client';

const STOPWORDS = new Set([
  'and','the','to','of','in','a','is','that','for','it','on','with','as','are','was','this','at','be','by','an','or',
  'from','but','not','we','my','had','have','they','their','our','you','your','she','he','her','his','me','i','did',
  'do','can','so','if','up','out','what','when','where','how','about','some','any','very','just','more','also','has',
  'been','would','could','should','which','who','whom','whose','why','will','also','more','than','then','them','its',
  'were','am','because','through','during','before','after','one','two','three','many','few','most','these','those',
]);

export function WordCloud({ texts, max = 40 }: { texts: string[]; max?: number }) {
  const joined = texts.filter(Boolean).join(' ').toLowerCase();
  if (!joined.trim()) {
    return <div className="text-[12.5px] text-ach-navy/55 italic">Not enough narrative text to build a word cloud yet.</div>;
  }
  const tokens = joined.match(/\b[a-z]{3,}\b/g) ?? [];
  const counts = new Map<string, number>();
  for (const t of tokens) {
    if (STOPWORDS.has(t)) continue;
    counts.set(t, (counts.get(t) ?? 0) + 1);
  }
  const items = Array.from(counts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, max);
  if (items.length === 0) {
    return <div className="text-[12.5px] text-ach-navy/55 italic">Narrative text is too sparse to form patterns yet.</div>;
  }
  const maxV = items[0][1];
  const minV = items[items.length - 1][1];

  return (
    <div className="flex flex-wrap items-center justify-center gap-3 p-5 rounded-[14px] bg-ach-page/60 min-h-[160px]">
      {items.map(([word, count], i) => {
        const scale = maxV === minV ? 1 : 0.7 + ((count - minV) / (maxV - minV)) * 1.6;
        const opacity = 0.55 + (scale - 0.7) * 0.25;
        return (
          <span
            key={word}
            title={`${word} - ${count} mention${count === 1 ? '' : 's'}`}
            style={{ fontSize: `${scale}rem`, opacity }}
            className={`font-medium leading-none ${i % 3 === 0 ? 'text-ach-navy' : i % 3 === 1 ? 'text-ach-slate-deep' : 'text-ach-navy/80'}`}
          >
            {word}
          </span>
        );
      })}
    </div>
  );
}
