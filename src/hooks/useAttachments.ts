import { useState } from 'react';
import { fileToAttachment, type Attachment } from '@/lib/attachments';

/** Gerencia a lista de anexos (foto/PDF) de um formulário/chat. */
export function useAttachments() {
  const [items, setItems] = useState<Attachment[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add(files: File[] | FileList | null) {
    const arr = files ? Array.from(files) : [];
    if (arr.length === 0) return;
    setBusy(true);
    setError(null);
    try {
      for (const f of arr) {
        const att = await fileToAttachment(f);
        setItems((prev) => [...prev, att]);
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  }

  function remove(i: number) {
    setItems((prev) => prev.filter((_, idx) => idx !== i));
  }
  function clear() {
    setItems([]);
    setError(null);
  }

  return { items, error, busy, add, remove, clear };
}
