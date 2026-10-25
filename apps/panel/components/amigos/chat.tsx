import { cn, fmt } from '@/lib/utils';

export type ChatMsg = { id: string; direction: 'in' | 'out'; body: string | null; media_url: string | null; media_kind: string | null; status: string; created_at: string; error_message: string | null };

// La conversación tal como la vería la persona en WhatsApp.
export function Chat({ messages }: { messages: ChatMsg[] }) {
  return (
    <ol className="flex flex-col gap-2 rounded-md bg-[#0b141a] p-3">
      {messages.map((m) => (
        <li key={m.id} className={cn('flex', m.direction === 'in' ? 'justify-end' : 'justify-start')}>
          <div className={cn('max-w-[80%] rounded-lg px-3 py-2 text-sm leading-snug text-white shadow', m.direction === 'in' ? 'bg-[#005c4b]' : 'bg-[#202c33]')}>
            {m.media_kind === 'image' && m.media_url && (
              // eslint-disable-next-line @next/next/no-img-element
              <a href={m.media_url} target="_blank" rel="noreferrer"><img src={m.media_url} alt="Imagen que mandó el bot" className="mb-1.5 w-64 rounded" loading="lazy" /></a>
            )}
            {m.media_kind === 'audio' && m.media_url && <audio controls src={m.media_url} className="mb-1.5 w-64" />}
            {m.body && <p className="whitespace-pre-wrap break-words">{m.body}</p>}
            <p className="mt-1 text-right text-[11px] text-white/50">
              {fmt.datetime(m.created_at)}{m.status === 'failed' ? ` · no salió: ${m.error_message ?? ''}` : ''}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
