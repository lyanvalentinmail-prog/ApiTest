export default {
  name: 'ask',
  category: 'IA de texto',
  usage: '<pregunta>',
  description: 'Pregunta directa al modelo seleccionado.',
  async execute(context, services) {
    return services.runAsk(context, context.args);
  },
};
