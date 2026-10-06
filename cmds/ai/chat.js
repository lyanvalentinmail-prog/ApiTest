export default {
  name: 'chat',
  category: 'IA de texto',
  usage: '<mensaje>',
  description: 'Conversación con contexto.',
  async execute(context, services) {
    return services.runChat(context, context.args);
  },
};
