/**
 * SourceLinker (seção 9): dado um tópico/problema, monta links de BUSCA prontos
 * em fontes legais e de acesso aberto. Não faz scraping nem reproduz conteúdo —
 * apenas abre a busca na fonte. CAPES Periódicos é a via legal de texto completo
 * para acadêmicos no Brasil (acesso via CAFe da instituição).
 */

export interface SourceLink {
  name: string;
  url: string;
  hint: string;
  openAccess?: boolean;
}

export function buildSourceLinks(topic: string): SourceLink[] {
  const q = encodeURIComponent(topic.trim());
  return [
    {
      name: 'PubMed',
      url: `https://pubmed.ncbi.nlm.nih.gov/?term=${q}`,
      hint: 'Abstracts e referências (NLM/NIH).',
    },
    {
      name: 'PMC (acesso aberto)',
      url: `https://www.ncbi.nlm.nih.gov/pmc/?term=${q}`,
      hint: 'Texto completo gratuito (open access).',
      openAccess: true,
    },
    {
      name: 'CAPES Periódicos',
      url: `https://www.periodicos.capes.gov.br/index.php/acervo/buscador.html?q=${q}`,
      hint: 'Texto completo via CAFe da sua instituição.',
    },
    {
      name: 'Google Acadêmico',
      url: `https://scholar.google.com/scholar?q=${q}`,
      hint: 'Busca acadêmica ampla.',
    },
    {
      name: 'Diretrizes (sociedades)',
      url: `https://www.google.com/search?q=${encodeURIComponent('diretriz ' + topic + ' (SBC OR SBPT OR SBN OR SBI OR AMB OR ESC OR AHA OR IDSA OR KDIGO)')}`,
      hint: 'Documentos oficiais de sociedades.',
    },
    {
      name: 'Medscape PT',
      url: `https://portugues.medscape.com/index/busca?q=${q}`,
      hint: 'Referência clínica (em português).',
      openAccess: true,
    },
    {
      name: 'Sanarmed',
      url: `https://www.google.com/search?q=${encodeURIComponent(topic + ' site:sanarmed.com')}`,
      hint: 'Resumos e condutas (Sanar).',
      openAccess: true,
    },
    {
      name: 'Afya / Whitebook',
      url: `https://www.google.com/search?q=${encodeURIComponent(topic + ' (site:portal.afya.com.br OR site:whitebook.afya.com.br)')}`,
      hint: 'Conteúdo clínico da Afya.',
      openAccess: true,
    },
    {
      name: 'Blogs médicos (Manole/PósMed/Inspirali)',
      url: `https://www.google.com/search?q=${encodeURIComponent(topic + ' (site:blog.manole.com.br OR site:posmed.com.br OR site:inspirali.com)')}`,
      hint: 'Revisões e atualizações em português.',
      openAccess: true,
    },
    {
      name: 'NEJM (conteúdo aberto)',
      url: `https://www.nejm.org/search?q=${q}`,
      hint: 'New England Journal of Medicine.',
      openAccess: true,
    },
    {
      name: 'The Lancet',
      url: `https://www.thelancet.com/action/doSearch?text1=${q}&field1=AllField`,
      hint: 'Muitos artigos de acesso aberto.',
      openAccess: true,
    },
  ];
}

/**
 * Domínios de fontes confiáveis, para orientar (no prompt) os agentes com busca
 * na web a priorizarem estas fontes. Não restringe a busca — apenas prioriza.
 */
export const FONTES_CONFIAVEIS = [
  'portal.afya.com.br',
  'whitebook.afya.com.br',
  'sanarmed.com',
  'blog.manole.com.br',
  'posmed.com.br',
  'inspirali.com',
  'portugues.medscape.com',
  'nejm.org',
  'thelancet.com',
  'pubmed.ncbi.nlm.nih.gov',
  'ncbi.nlm.nih.gov/pmc',
].join(', ');
