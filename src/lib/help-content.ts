export type HelpTopic = {
  key: string;
  title: string;
  summary: string;
  steps: string[];
  tips?: string[];
};

// Ajuda por tela. O primeiro padrão que combinar com o endereço vale (do mais específico ao geral).
export const helpTopics: { match: RegExp; topic: HelpTopic }[] = [
  { match: /^\/pedidos\/novo/, topic: { key: "pedido-novo", title: "Novo pedido", summary: "Registra a entrada do paciente e os exames a realizar.",
    steps: ["Busque o paciente pelo nome ou código. Se for novo, cadastre antes em Cadastros > Pacientes.", "Escolha o convênio e, se houver, o médico solicitante e o CID.", "Adicione os exames pelo código ou pelo nome, ou use um grupo de exames.", "Marque Urgente se o pedido tiver prioridade.", "Confira o total e salve. Depois imprima o comprovante e as etiquetas."],
    tips: ["O preço vem da tabela do convênio. Se um exame não tiver preço, ajuste em Cadastros > Tabelas de preço.", "Um exame com mais de um tubo gera mais de uma etiqueta."] } },
  { match: /^\/pedidos\/[^/]+\/etiquetas/, topic: { key: "etiquetas", title: "Etiquetas", summary: "Etiquetas de código de barras para colar nos tubos.",
    steps: ["Informe a largura e a altura da sua etiqueta, em milímetros.", "Use Cópias de cada para imprimir mais de uma por tubo.", "Clique em Imprimir etiquetas e escolha a impressora de etiquetas.", "Na janela de impressão, desligue as margens e use escala 100%."],
    tips: ["O tamanho fica salvo neste computador.", "O código de barras identifica o pedido e a amostra. É ele que a Coleta lê."] } },
  { match: /^\/pedidos\/[^/]+\/laudo/, topic: { key: "laudo", title: "Laudo", summary: "Laudo do paciente, pronto para imprimir.",
    steps: ["Confira os dados do paciente e os resultados.", "Use o botão de imprimir do navegador (Ctrl+P) ou salve em PDF."], tips: ["O laudo só mostra resultados já liberados."] } },
  { match: /^\/pedidos\/[^/]+\/comprovante/, topic: { key: "comprovante", title: "Comprovante", summary: "Comprovante de entrada para o paciente.",
    steps: ["Confira os exames e a data prevista.", "Imprima com Ctrl+P e entregue ao paciente."] } },
  { match: /^\/pedidos\/[^/]+/, topic: { key: "pedido", title: "Detalhes do pedido", summary: "Acompanha cada exame do pedido, da coleta ao laudo.",
    steps: ["Veja o status de cada exame e das amostras.", "Imprima etiquetas, comprovante e laudo pelos botões da página.", "Registre pagamentos quando for particular."],
    tips: ["Um pedido só é finalizado quando todos os exames forem liberados."] } },
  { match: /^\/pedidos/, topic: { key: "pedidos", title: "Pedidos", summary: "Lista dos pedidos e acompanhamento do que está pronto.",
    steps: ["Use os botões Todos, Prontos para entrega e Em andamento para filtrar.", "Prontos para entrega mostra os pedidos com exames liberados que ainda não foram entregues, de qualquer dia. Entregues mostra os que já saíram.", "Busque pelo nome do paciente ou pelo número. A busca procura em todas as datas.", "Sem busca, escolha a data no calendário ou use Todas as datas.", "Clique em um pedido para ver os detalhes. Em um exame ainda sem resultado, o botão Lançar resultado leva direto à digitação.", "Gere o laudo quando o pedido estiver pronto.", "Ao entregar o laudo ao paciente, abra o pedido e clique em Marcar como entregue. Dá para informar quem retirou e para desfazer, se foi engano."],
    tips: ["A coluna Pagamento ajuda a conferir se há valor pendente antes de entregar.", "No Dashboard, o cartão Prontos para entrega abre esta lista já filtrada."] } },
  { match: /^\/apoio/, topic: { key: "apoio", title: "Envio ao apoio", summary: "Exames terceirizados: envio das amostras ao laboratório de apoio e acompanhamento.",
    steps: ["Depois da coleta, os exames de apoio aparecem em A enviar, agrupados por laboratório.", "Desmarque o que não vai nesta remessa e clique em Criar remessa e marcar como enviada.", "Imprima o romaneio e coloque junto das amostras. Ele tem os pacientes, exames e campos de conferência e assinatura.", "Quando o apoio devolver o resultado, ele aparece em Resultados para você digitar, como os demais.", "Em Aguardando retorno você vê cada exame enviado que ainda não voltou, com a previsão e o atraso. Atrasados aparecem primeiro, em vermelho.", "Em Remessas enviadas você vê o que já voltou e pode reabrir o romaneio."],
    tips: ["Enviou por engano? Use Desfazer na remessa. Só é possível enquanto nenhum resultado dela foi lançado.", "Para um exame ir ao apoio, vincule-o a um laboratório de apoio em Cadastros > Exames.", "A previsão é a data do envio mais o prazo do laboratório de apoio, em dias corridos. Sem prazo no apoio, vale o prazo do exame. Um selo vermelho no menu e um aviso no Dashboard mostram os atrasados."] } },
  { match: /^\/cadastros\/laboratorios-apoio/, topic: { key: "labs-apoio", title: "Laboratórios de apoio", summary: "Laboratórios que fazem exames terceirizados para o seu.",
    steps: ["Clique no nome em Apoios do XLAB7 para adicionar rápido. Os exames que tinham esse setor técnico já ficam vinculados.", "Ou use Novo para cadastrar nome, contato, telefone e prazo.", "Depois, em Cadastros > Exames, escolha o laboratório de apoio de cada exame terceirizado."],
    tips: ["O prazo aparece na tela de envio.", "Desmarque Ativo para parar de usar um apoio sem perder o histórico."] } },
  { match: /^\/coleta/, topic: { key: "coleta", title: "Coleta e recebimento", summary: "Confirma que a amostra foi coletada e chegou à bancada.",
    steps: ["Clique no campo de leitura e passe o leitor no código de barras da etiqueta.", "A amostra muda de coletada para recebida.", "Se o material não serve, rejeite a amostra e informe o motivo. Será pedida nova coleta."],
    tips: ["Sem leitor, digite o código à mão e pressione Enter.", "Exames com dois tubos só vão para resultado quando todos estiverem recebidos."] } },
  { match: /^\/resultados/, topic: { key: "resultados", title: "Lançamento de resultados", summary: "Digite o resultado de cada exame com amostra recebida.",
    steps: ["Use a busca (paciente, nº do pedido ou exame) ou o filtro de setor para achar o exame.", "Por padrão a fila mostra só exames com a amostra recebida. Para lançar os que ainda aguardam coleta ou recebimento, marque Incluir exames ainda sem amostra recebida, ou abra o pedido do paciente e clique no exame.", "Digite os valores. Pode usar vírgula ou ponto.", "Campos marcados como calculado são preenchidos sozinhos.", "Clique em Lançar. O exame segue para a liberação."],
    tips: ["Valor fora da faixa de referência fica em amarelo.", "Valor de pânico fica em vermelho e pede confirmação antes de lançar.", "Em exames descritivos, escolha um texto-modelo e ajuste o que precisar.", "Lançando direto pelo pedido, um aviso amarelo mostra se a amostra ainda não foi recebida ou se o exame de apoio não foi enviado. Confira antes de lançar."] } },
  { match: /^\/liberacao/, topic: { key: "liberacao", title: "Liberação", summary: "Conferência final antes de o resultado chegar ao paciente.",
    steps: ["Revise os valores e as observações.", "Libere o exame. Ele passa a aparecer no laudo e no portal do paciente.", "Se achar erro, clique em Devolver, informe o motivo e o exame volta para a fila de Resultados para ser digitado de novo. Só vale antes de liberar."],
    tips: ["Só quem tem o perfil de liberação enxerga esta tela."] } },
  { match: /^\/financeiro\/lotes/, topic: { key: "lotes", title: "Lotes de faturamento", summary: "Agrupa pedidos de um convênio por mês para cobrança.",
    steps: ["Crie um lote escolhendo o convênio e o mês de referência.", "Abra o lote para ver os pedidos incluídos.", "Registre o pagamento quando o convênio pagar."] } },
  { match: /^\/financeiro\/convenios/, topic: { key: "fin-convenios", title: "Financeiro por convênio", summary: "Quanto cada convênio deve ao laboratório.",
    steps: ["Veja o valor em aberto de cada convênio.", "Abra os lotes do convênio para detalhar."] } },
  { match: /^\/financeiro/, topic: { key: "financeiro", title: "Financeiro", summary: "Visão geral de recebimentos e pendências.",
    steps: ["A receber mostra particular e convênios em aberto.", "Recebido no mês soma os pagamentos registrados.", "Use Convênios e Lotes para o detalhe."] } },
  { match: /^\/cadastros\/pacientes/, topic: { key: "pacientes", title: "Pacientes", summary: "Cadastro de pacientes.",
    steps: ["Clique em Novo para cadastrar. Nome e data de nascimento são importantes para os valores de referência.", "O sexo e a idade definem a faixa de referência de cada exame."], tips: ["Evite cadastrar a mesma pessoa duas vezes. Busque antes."] } },
  { match: /^\/cadastros\/medicos/, topic: { key: "medicos", title: "Médicos", summary: "Médicos solicitantes.", steps: ["Cadastre nome e registro (CRM).", "O médico aparece como opção ao criar o pedido."] } },
  { match: /^\/cadastros\/convenios/, topic: { key: "convenios", title: "Convênios", summary: "Planos de saúde e a tabela de preço de cada um.",
    steps: ["Crie o convênio e escolha a tabela de preço.", "Para copiar convênios do XLAB7, use o seletor da biblioteca."], tips: ["Particular é o convênio usado para pagamento direto."] } },
  { match: /^\/cadastros\/unidades/, topic: { key: "unidades", title: "Unidades", summary: "Locais de atendimento do laboratório.", steps: ["Cadastre cada unidade com nome e endereço.", "Escolha a unidade ao criar o pedido."] } },
  { match: /^\/cadastros\/tabelas-preco/, topic: { key: "tabelas", title: "Tabelas de preço", summary: "Preço de cada exame por tabela.",
    steps: ["Crie a tabela e preencha o valor de cada exame.", "Vincule a tabela a um convênio."], tips: ["Em Exames, dá para copiar preços da biblioteca do XLAB7 (AMB e outras)."] } },
  { match: /^\/cadastros\/exames/, topic: { key: "exames", title: "Exames", summary: "Catálogo de exames, parâmetros e valores de referência.",
    steps: ["Clique em Novo e busque no catálogo para preencher código, nome, prazo e jejum.", "Defina o setor, o material e quantos tubos e etiquetas o exame usa.", "Cadastre os parâmetros e as faixas de referência por sexo e idade.", "Preencha a faixa de pânico para ativar o alerta."],
    tips: ["Campo calculado: informe uma fórmula usando os códigos dos parâmetros, como TOTAL - DIRETA.", "Exame descritivo usa textos-modelo em vez de números."] } },
  { match: /^\/cadastros\/grupos-exames/, topic: { key: "grupos", title: "Grupos de exames", summary: "Conjuntos de exames pedidos juntos, como um check-up.", steps: ["Crie o grupo e adicione os exames.", "No novo pedido, escolha o grupo para incluir todos de uma vez."] } },
  { match: /^\/cadastros\/textos-modelo/, topic: { key: "textos", title: "Textos-modelo", summary: "Textos prontos para exames descritivos.", steps: ["Crie um texto por exame ou situação.", "No lançamento de resultados, escolha o texto e edite se precisar."] } },
  { match: /^\/cadastros\/usuarios/, topic: { key: "usuarios", title: "Usuários", summary: "Equipe do laboratório e permissões.",
    steps: ["Convide por e-mail. A pessoa cria a conta com esse e-mail e entra no seu laboratório.", "Defina o perfil: administrador, recepção, coleta, bancada ou liberação."], tips: ["Dê a cada pessoa só o acesso de que ela precisa."] } },
  { match: /^\/configuracoes/, topic: { key: "config", title: "Configurações", summary: "Dados do laboratório.", steps: ["Atualize nome, contato e demais dados do laboratório."] } },
  { match: /^\/dashboard/, topic: { key: "dashboard", title: "Dashboard", summary: "Movimento do dia.",
    steps: ["Veja pedidos de hoje, em aberto, finalizados e urgentes.", "Use Novo pedido para começar um atendimento."], tips: ["O dia a dia segue esta ordem: Novo pedido, Etiquetas, Coleta, Resultados, Liberação, Laudo."] } },
];

export const workflowSteps = ["Novo pedido", "Etiquetas", "Coleta", "Resultados", "Liberação", "Laudo"];

export function helpFor(pathname: string): HelpTopic | null {
  return helpTopics.find(h => h.match.test(pathname))?.topic ?? null;
}
