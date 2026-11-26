import { supabase } from "@/integrations/supabase/client";

export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;

export function validateAttachment(file: { size: number; name: string }) {
  if (file.size > MAX_ATTACHMENT_BYTES) throw new Error(`${file.name}: o limite é 20 MB por arquivo.`);
  if (file.size === 0) throw new Error(`${file.name}: o arquivo está vazio.`);
}

export async function saveTicketAttachment(file: File, userId: string, ticketId: string) {
  validateAttachment(file);
  const path = `${userId}/${ticketId}/${crypto.randomUUID()}-${file.name.replace(/[^\w.-]/g, "_")}`;
  const { error: uploadError } = await supabase.storage.from("attachments").upload(path, file);
  if (uploadError) throw new Error(`Não foi possível enviar ${file.name}.`);
  const { error } = await supabase.from("ticket_attachments").insert({
    ticket_id: ticketId, uploaded_by: userId, file_name: file.name,
    storage_path: path, mime_type: file.type, size_bytes: file.size,
  });
  if (error) throw new Error(`Não foi possível vincular ${file.name} ao chamado. Tente anexá-lo novamente.`);
}