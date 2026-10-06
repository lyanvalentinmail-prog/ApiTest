export default {
  name: 'clear',
  category: 'Sistema',
  usage: '',
  description: 'Elimina el contexto de la conversación.',
  async execute(context, services) {
    await services.state.clearHistory(context.identity);
    return services.sendText(context, '୨୧ Contexto de .chat eliminado.');
  },
};
