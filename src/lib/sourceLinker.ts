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
  ];
}
