import { createFileRoute } from '@tanstack/react-router';
import { PasswordChangeForm } from '@/components/password-change';
export const Route = createFileRoute('/alterar-senha')({
  head: () => ({ meta: [{ title: 'Definir senha pessoal — Trivium SST' }, { name: 'description', content: 'Substitua sua senha temporária por uma senha pessoal segura.' }, { property: 'og:title', content: 'Definir senha pessoal — Trivium SST' }, { property: 'og:description', content: 'Troca segura de senha de acesso ao Trivium SST.' }, { property: 'og:type', content: 'website' }, { name: 'twitter:card', content: 'summary' }] }),
  component: PasswordChangeForm,
});
